import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const runtime = 'http://127.0.0.1:3030'
const api = 'http://127.0.0.1:8030/api'
const week = '2026-08-10'
const output = path.resolve(process.env.PHASE05_SUPPLIER_OUTPUT ?? '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/supplier-decisions')
const targetRequestCode = process.env.PHASE05_TARGET_PURCHASE_REQUEST
const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0,
  quotationFixturesCreated: 0, decisionsCreated: 0, submitted: 0,
  requests: [], consoleErrors: [], pageErrors: [], requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
}
const maxDraftDates = Number(process.env.PHASE05_MAX_DRAFT_DATES ?? 1)
let browser
let context

const apiData = async (response) => {
  const body = await response.json()
  if (!response.ok()) throw new Error(`${response.request().method()} ${new URL(response.url()).pathname} returned ${response.status()}: ${body?.message ?? ''}`)
  return body.data
}

const inputDate = async (page, input, isoDate) => {
  const [year, month, day] = isoDate.split('-')
  const expectedValues = new Set([isoDate, `${day}/${month}/${year}`])
  const observed = []
  for (const text of [`${month}/${day}/${year}`, `${day}/${month}/${year}`, `${month}${day}${year}`, `${day}${month}${year}`, isoDate]) {
    await input.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(text)
    await page.keyboard.press('Tab')
    const value = await input.inputValue()
    observed.push({ text, value })
    if (expectedValues.has(value)) return
  }
  throw new Error(`Physical date input failed for ${isoDate}: ${JSON.stringify(observed)}`)
}

await mkdir(output, { recursive: true })
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__phase05SupplierInput', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05SupplierInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05SupplierInput('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.startsWith('/api/') && response.request().method() !== 'GET') result.requests.push({ method: response.request().method(), path: pathname, status: response.status() })
  })

  await page.goto(`${runtime}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thumua')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_PURCHASING_PASSWORD)
  const loginPromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  const loginData = await apiData(await loginPromise)
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  const authHeaders = { Authorization: `Bearer ${loginData.accessToken}` }

  const suppliersResponse = await context.request.get(`${api}/suppliers`, { headers: authHeaders })
  const suppliers = await apiData(suppliersResponse)
  if (!suppliers.length) throw new Error('No active supplier is available for controlled quotation fixtures')
  const supplierId = suppliers[0].supplierId

  const workbenchResponse = await context.request.get(`${api}/purchase-workflow/workbench?week=${week}&date=${week}&pageSize=100`, { headers: authHeaders })
  const initialWorkbench = await apiData(workbenchResponse)
  const ingredientIds = new Set()
  let processedDraftDates = 0
  for (const serviceDate of initialWorkbench.serviceDates) {
    const scoped = await apiData(await context.request.get(`${api}/purchase-workflow/workbench?week=${week}&date=${serviceDate.serviceDate}&pageSize=100`, { headers: authHeaders }))
    scoped.serviceDates.find((item) => item.serviceDate === serviceDate.serviceDate)?.purchaseLines
      .forEach((line) => ingredientIds.add(line.ingredientId))
  }
  for (const ingredientId of ingredientIds) {
    const quotations = await apiData(await context.request.get(`${api}/supplier-quotations/ingredient/${ingredientId}`, { headers: authHeaders }))
    const active = quotations.find((quotation) => quotation.isActive && quotation.effectiveFrom <= '2026-08-15' && (!quotation.effectiveTo || quotation.effectiveTo >= week))
    if (active) continue
    const response = await context.request.post(`${api}/supplier-quotations`, {
      headers: authHeaders,
      data: { supplierId, ingredientId, unitPrice: 100, effectiveFrom: week, effectiveTo: '2026-08-15', note: 'Phase 05 controlled Golden fixture' },
    })
    await apiData(response)
    result.quotationFixturesCreated += 1
  }

  for (const serviceDate of initialWorkbench.serviceDates) {
    await page.goto(`${runtime}/purchasing?week=${week}&date=${serviceDate.serviceDate}&stage=supplier-price`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const current = await apiData(await context.request.get(`${api}/purchase-workflow/workbench?week=${week}&date=${serviceDate.serviceDate}&pageSize=100`, { headers: authHeaders }))
    const dateState = current.serviceDates.find((item) => item.serviceDate === serviceDate.serviceDate)
    if (dateState.purchaseRequestStatus !== 'DRAFT') continue
    if (targetRequestCode && dateState.purchaseRequestCode !== targetRequestCode) continue
    if (processedDraftDates >= maxDraftDates) break
    processedDraftDates += 1
    const pendingLines = dateState.purchaseLines.filter((line) => !line.currentSupplierDecision)
    for (const line of pendingLines) {
      const search = page.locator('#purchase-line-search')
      await search.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(line.purchaseRequestLineId)
      const table = page.getByRole('table')
      const sourceButton = table.getByRole('button', { name: /^Xem \d+ nguồn$/ }).first()
      if (await sourceButton.isVisible().catch(() => false)) await sourceButton.click()
      const sourceRow = table.getByRole('listitem').filter({ hasText: line.purchaseRequestLineId })
      if (await sourceRow.isVisible().catch(() => false)) await sourceRow.getByRole('button', { name: 'Mở dòng nguồn' }).click()
      else await table.getByRole('button', { name: /Xem bằng chứng|Xem quyết định/ }).click()

      const evidenceButton = page.getByRole('button', { name: /^Chọn / }).first()
      await evidenceButton.waitFor({ state: 'visible', timeout: 15_000 })
      await evidenceButton.click()
      await inputDate(page, page.getByLabel('Ngày giao'), serviceDate.serviceDate)
      const warehouse = page.getByRole('combobox', { name: 'Kho nhận' })
      await warehouse.click()
      await page.getByRole('option').first().click()
      const terms = page.getByLabel('Điều khoản mua')
      await terms.click(); await page.keyboard.type('Giao tại kho')
      await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Xác nhận nhà cung cấp' })
      await dialog.waitFor({ state: 'visible' })
      const decisionPromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/supplier-decision'))
      await dialog.getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
      const decision = await decisionPromise
      if (decision.status() !== 200) throw new Error(`${line.purchaseRequestLineId} decision returned ${decision.status()}`)
      await dialog.waitFor({ state: 'detached' })
      result.decisionsCreated += 1
    }

    const refreshed = await apiData(await context.request.get(`${api}/purchase-workflow/workbench?week=${week}&date=${serviceDate.serviceDate}&pageSize=100`, { headers: authHeaders }))
    const refreshedDate = refreshed.serviceDates.find((item) => item.serviceDate === serviceDate.serviceDate)
    if (refreshedDate.purchaseLines.some((line) => !line.currentSupplierDecision)) throw new Error(`${serviceDate.serviceDate} still has pending supplier decisions`)
    if (refreshedDate.purchaseRequestStatus === 'DRAFT') {
      await page.goto(`${runtime}/purchasing?week=${week}&date=${serviceDate.serviceDate}&stage=supplier-price`, { waitUntil: 'domcontentloaded' })
      const submit = page.locator('#purchase-decision-panel').getByRole('button', { name: 'Gửi đề xuất mua', exact: true })
      await submit.waitFor({ state: 'visible', timeout: 20_000 })
      await submit.click()
      const dialog = page.getByRole('dialog', { name: 'Gửi đề xuất mua' })
      const submitPromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/submit'))
      await dialog.getByRole('button', { name: 'Gửi đề xuất mua', exact: true }).click()
      const submitted = await submitPromise
      if (submitted.status() !== 200) {
        const failureBody = await submitted.json().catch(() => null)
        throw new Error(`${serviceDate.serviceDate} submit returned ${submitted.status()}: ${failureBody?.message ?? JSON.stringify(failureBody)}`)
      }
      await dialog.waitFor({ state: 'detached' })
      result.submitted += 1
    }
  }

  const postflight = await apiData(await context.request.get(`${api}/purchase-workflow/workbench?week=${week}&date=${week}&pageSize=100`, { headers: authHeaders }))
  result.postflight = postflight.serviceDates.map((item) => ({ serviceDate: item.serviceDate, status: item.purchaseRequestStatus, supplierReadyLineCount: item.supplierReadyLineCount, shortageLineCount: item.shortageLineCount }))
  const complete = result.postflight.length === 6 && result.postflight.every((item) => item.status === 'SENTTOSUPPLIER' && item.supplierReadyLineCount === item.shortageLineCount)
  if (!result.physicalInput.pointerTrusted || !result.physicalInput.keyboardTrusted || result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length) throw new Error('Physical/browser gate failed')
  result.verdict = complete ? 'PASS' : 'PARTIAL_PASS'
} catch (error) {
  result.verdict = 'FAIL'
  result.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_PURCHASING_PASSWORD) || /Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (!['PASS', 'PARTIAL_PASS'].includes(result.verdict)) process.exitCode = 1
