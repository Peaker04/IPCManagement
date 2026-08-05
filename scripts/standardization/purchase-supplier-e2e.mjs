import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')

const phase = process.env.IPC_PURCHASE_SUPPLIER_PHASE ?? 'quotes'
const baseUrl = 'http://127.0.0.1:3010'
const apiUrl = 'http://127.0.0.1:8010'
const week = '2026-08-03'
const date = '2026-08-08'
const root = path.resolve('.artifacts/shipyard-live', process.env.IPC_PURCHASE_SUPPLIER_RUN ?? 'full-project-lifecycle-20260804-case-02-suppliers')
await fs.mkdir(root, { recursive: true })

const evidence = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: { baseUrl, apiUrl, database: 'ipc_e2e_template', credentialSource: 'K6_PASSWORD' },
  headed: true, phase, apiResponses: [], consoleErrors: [], pageErrors: [], requestFailures: [],
}
const context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-purchase-supplier'), {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
  viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'],
})
const page = context.pages()[0] ?? await context.newPage()
let probe = 'startup'
page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push({ probe, text: message.text() }) })
page.on('pageerror', (error) => evidence.pageErrors.push({ probe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({ probe, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? 'unknown' }))
page.on('response', (response) => {
  const url = new URL(response.url())
  if (url.pathname.startsWith('/api/')) evidence.apiResponses.push({ probe, method: response.request().method(), status: response.status(), path: url.pathname })
})
const settle = async () => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(300)
}
const capturePerformance = async (label) => {
  evidence.performance ??= []
  evidence.performance.push({ label, ...(await page.evaluate(() => ({
    cls: performance.getEntriesByType('layout-shift')
      .filter((entry) => !entry.hadRecentInput)
      .reduce((total, entry) => total + entry.value, 0),
    longTasks: performance.getEntriesByType('longtask').map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
  }))) })
}
const workbench = async (token) => {
  const response = await context.request.get(`${apiUrl}/api/purchase-workflow/workbench?week=${week}&date=${date}&stage=supplier-price`, { headers: { authorization: `Bearer ${token}` } })
  if (response.status() !== 200) throw new Error(`Could not read purchase workbench: ${response.status()}`)
  return (await response.json()).data
}
const chooseFirstOptionExcept = async (placeholder) => {
  const options = page.getByRole('option')
  const count = await options.count()
  for (let index = 0; index < count; index += 1) {
    if ((await options.nth(index).innerText()).trim() !== placeholder) {
      await options.nth(index).click()
      return
    }
  }
  throw new Error(`No selectable option beyond ${placeholder}.`)
}
const selectSaturdayOnChefDashboard = async () => {
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Thứ Bảy', exact: true }).click()
  await page.waitForTimeout(300)
}

try {
  probe = 'login'
  await page.goto(`${baseUrl}/login`)
  await settle()
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill(password)
    await Promise.all([page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  }
  const token = await page.evaluate(() => window.sessionStorage.getItem('token'))
  if (!token) throw new Error('Authenticated browser session has no access token.')
  const initialWorkbench = await workbench(token)
  const purchaseDate = initialWorkbench.serviceDates.find((item) => item.serviceDate === date)
  if (!purchaseDate?.purchaseRequestId || !purchaseDate.purchaseLines.length) throw new Error('No purchase request lines are available for supplier E2E.')
  evidence.before = { purchaseRequestId: purchaseDate.purchaseRequestId, shortageLineCount: purchaseDate.shortageLineCount, supplierReadyLineCount: purchaseDate.supplierReadyLineCount }

  if (phase === 'quotes') {
    probe = 'supplier-quotes:ui-create'
    const ingredients = Array.from(new Map(purchaseDate.purchaseLines.map((line) => [line.ingredientId, line])).values())
    evidence.quotations = []
    await page.goto(`${baseUrl}/purchasing?view=quotations`)
    await settle()
    await page.locator('h1').filter({ hasText: 'Quản lý báo giá nhà cung cấp' }).waitFor({ state: 'visible', timeout: 20_000 })
    for (const line of ingredients) {
      await page.getByLabel('Tìm nguyên liệu').fill(line.ingredientName)
      await page.locator('#quotation-ingredient').click()
      await page.getByRole('option', { name: line.ingredientName, exact: true }).click()
      await page.waitForTimeout(150)
      if (await page.getByText('Đang hoạt động', { exact: true }).count()) {
        evidence.quotations.push({ ingredientId: line.ingredientId, ingredientName: line.ingredientName, existing: true })
        continue
      }
      await page.getByRole('combobox', { name: 'Nhà cung cấp', exact: true }).click()
      await page.getByText('Tôm - Chị Vân', { exact: true }).last().click()
      await page.getByLabel('Đơn giá').fill('10000')
      await page.getByLabel('Hiệu lực từ').fill('2026-08-01')
      await page.getByLabel('Ghi chú').fill(`E2E controlled quote for ${line.ingredientName}`)
      const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/supplier-quotations')
      await page.getByRole('button', { name: 'Thêm báo giá', exact: true }).click()
      const response = await createResponse
      if (response.status() !== 200) throw new Error(`Quote creation failed for ${line.ingredientName}: ${response.status()}`)
      evidence.quotations.push({ ingredientId: line.ingredientId, ingredientName: line.ingredientName, status: response.status() })
      await page.waitForTimeout(150)
    }
    await page.reload()
    await settle()
    await page.locator('h1').filter({ hasText: 'Quản lý báo giá nhà cung cấp' }).waitFor({ state: 'visible' })
    await page.screenshot({ path: path.join(root, 'supplier-quotes-after-reload.png'), fullPage: true })
  } else if (phase === 'decisions') {
    probe = 'supplier-decisions:ui-confirm'
    evidence.decisions = []
    await page.goto(`${baseUrl}/purchasing?week=${week}&date=${date}&stage=supplier-price`)
    await settle()
    await page.getByText('Quyết định thu mua', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    for (const line of purchaseDate.purchaseLines.filter((line) => !line.currentSupplierDecision)) {
      const search = page.getByLabel('Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn')
      await search.fill(line.purchaseRequestLineId)
      if (!await page.getByText(line.purchaseRequestLineId, { exact: true }).count()) {
        const openGroup = page.getByRole('button', { name: /^(Xem bằng chứng|Xem \d+ nguồn|Xem quyết định)$/ }).first()
        await openGroup.click()
      }
      if (await page.getByText(line.purchaseRequestLineId, { exact: true }).count()) {
        const source = page.getByText(line.purchaseRequestLineId, { exact: true }).locator('..').locator('..')
        await source.getByRole('button', { name: 'Mở dòng nguồn', exact: true }).click()
      }
      await page.locator('#purchase-decision-panel [aria-label^="Chọn "]').first().waitFor({ state: 'visible', timeout: 20_000 })
      await page.locator('#purchase-decision-panel [aria-label^="Chọn "]').first().click()
      await page.locator('#purchase-decision-panel input[type="date"]').fill(date)
      await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Xác nhận nhà cung cấp' })
      const decisionResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/purchase-workflow\/requests\/[^/]+\/lines\/[^/]+\/supplier-decision$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Xác nhận nhà cung cấp', exact: true }).click()
      const response = await decisionResponse
      if (response.status() !== 200) throw new Error(`Supplier decision failed for ${line.ingredientName}: ${response.status()}`)
      evidence.decisions.push({ purchaseRequestLineId: line.purchaseRequestLineId, ingredientName: line.ingredientName, status: response.status() })
      await page.waitForTimeout(150)
    }
    await page.reload()
    await settle()
    await page.getByText('Đã đủ nhà cung cấp, giá và ngày giao cho mọi dòng.', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.screenshot({ path: path.join(root, 'supplier-decisions-after-reload.png'), fullPage: true })
  } else if (phase === 'submit') {
    probe = 'purchase-request:ui-submit'
    const current = (await workbench(token)).serviceDates.find((item) => item.serviceDate === date)
    if (current?.purchaseRequestStatus?.toUpperCase() === 'DRAFT') {
      await page.goto(`${baseUrl}/purchasing?week=${week}&date=${date}&stage=supplier-price`)
      await settle()
      await page.getByText('Đã đủ nhà cung cấp, giá và ngày giao cho mọi dòng.', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Gửi đề xuất mua', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Gửi đề xuất mua' })
      const submitResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/purchase-workflow\/requests\/[^/]+\/submit$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Gửi đề xuất mua', exact: true }).click()
      const response = await submitResponse
      if (response.status() !== 200) throw new Error(`Purchase request submit failed: ${response.status()}`)
      evidence.submission = { status: response.status() }
    } else if (['SUBMITTED', 'SENTTOSUPPLIER'].includes(current?.purchaseRequestStatus?.toUpperCase() ?? '')) {
      evidence.submission = { alreadySubmitted: true }
    } else throw new Error(`Purchase request has unexpected status ${current?.purchaseRequestStatus ?? 'missing'}.`)
    await page.goto(`${baseUrl}/purchasing?week=${week}&date=${date}&stage=submitted`)
    await settle()
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Mở phê duyệt đề xuất', exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.screenshot({ path: path.join(root, 'purchase-submitted-after-reload.png'), fullPage: true })
  } else if (phase === 'approve') {
    probe = 'purchase-request:ui-approve'
    const requestCode = purchaseDate.purchaseRequestCode ?? 'PR-20260808-FULLDAY'
    await page.goto(`${baseUrl}/approvals?targetType=purchase-request&targetId=${purchaseDate.purchaseRequestId}&week=${week}&date=${date}`)
    await settle()
    await page.getByLabel('Tìm chứng từ hoặc nguyên liệu').fill(requestCode)
    const record = page.locator('[id^="approval-record-"]').filter({ hasText: requestCode })
    await record.waitFor({ state: 'visible', timeout: 20_000 })
    await record.getByRole('button', { name: 'Duyệt chứng từ', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Ghi chú duyệt (tùy chọn)').fill('E2E: duyệt PR sau khi xác minh từng supplier line.')
    const approvalResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/approvals/'))
    await dialog.getByRole('button', { name: 'Duyệt chứng từ', exact: true }).click()
    const response = await approvalResponse
    if (response.status() !== 200) throw new Error(`Purchase request approval failed: ${response.status()}`)
    evidence.approval = { status: response.status() }
    await page.reload()
    await settle()
    await page.getByLabel('Tìm chứng từ hoặc nguyên liệu').fill(requestCode)
    if (await page.locator('[id^="approval-record-"]').filter({ hasText: requestCode }).count()) throw new Error('Approved purchase request remained in the inbox after reload.')
    await page.screenshot({ path: path.join(root, 'purchase-approved-after-reload.png'), fullPage: true })
  } else if (phase === 'orders') {
    probe = 'purchase-order:ui-create'
    const current = (await workbench(token)).serviceDates.find((item) => item.serviceDate === date)
    if ((current?.orderCount ?? 0) === 0) {
      await page.goto(`${baseUrl}/purchasing?week=${week}&date=${date}&stage=approved-order`)
      await settle()
      await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đơn đặt hàng', exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đơn đặt hàng', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Tạo đơn đặt hàng' })
      const orderResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/purchase-orders\/from-request\/[^/]+$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Tạo đơn đặt hàng', exact: true }).click()
      const response = await orderResponse
      const body = await response.json().catch(() => null)
      if (response.status() !== 200 || !Array.isArray(body?.data) || body.data.length === 0) throw new Error(`Purchase order creation failed: ${JSON.stringify(body)}`)
      evidence.orders = { status: response.status(), count: body.data.length, codes: body.data.map((item) => item.purchaseOrderCode) }
    } else evidence.orders = { alreadyCreated: true, count: current.orderCount }
    await page.goto(`${baseUrl}/purchasing?week=${week}&date=${date}&stage=receiving`)
    await settle()
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Mở màn hình nhập kho', exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.screenshot({ path: path.join(root, 'purchase-orders-after-reload.png'), fullPage: true })
  } else if (phase === 'warehouse-receive') {
    probe = 'warehouse:ui-receive-purchase-orders'
    await page.goto(`${baseUrl}/warehouse?week=${week}&purchaseRequestId=${purchaseDate.purchaseRequestId}`)
    await settle()
    const purchaseRow = page.getByRole('row').filter({ hasText: 'PR-20260808-FULLDAY' })
    const openPurchase = purchaseRow.getByRole('button', { name: 'Xem dòng nhận', exact: true })
    if (await openPurchase.count()) await openPurchase.click()
    const orderResponse = await context.request.get(`${apiUrl}/api/purchase-orders`, { headers: { authorization: `Bearer ${token}` } })
    const targetOrder = (await orderResponse.json()).data.find((order) => order.purchaseRequestCode === 'PR-20260808-FULLDAY')
    const remainingLines = targetOrder.lines.filter((line) => Number(line.receivedQty) < Number(line.orderedQty))
    const received = []
    for (const remainingLine of remainingLines) {
      await page.locator('#purchase-order-line-search').fill(remainingLine.purchaseOrderLineId)
      const direct = page.getByRole('button', { name: 'Ghi nhận nhập kho', exact: true })
      const sourceId = page.getByText(remainingLine.purchaseOrderLineId, { exact: true })
      if (await sourceId.count()) await sourceId.locator('..').locator('..').getByRole('button', { name: 'Ghi nhận dòng này', exact: true }).click()
      else if (await direct.count()) await direct.click()
      else {
        await page.getByRole('button', { name: /^Xem \d+ nguồn$/ }).click()
        await page.getByText(remainingLine.purchaseOrderLineId, { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Ghi nhận dòng này', exact: true }).click()
      }
      const dialog = page.getByRole('dialog', { name: 'Ghi nhận nhập kho từ đơn mua' })
      await dialog.waitFor({ state: 'visible', timeout: 20_000 })
      const warehouseSelect = dialog.locator('#purchase-receipt-warehouse')
      if (await warehouseSelect.count()) {
        await warehouseSelect.click()
        const options = page.getByRole('option')
        const count = await options.count()
        let selected = false
        for (let index = 0; index < count; index += 1) {
          if ((await options.nth(index).innerText()).trim() !== 'Chọn kho nhận') { await options.nth(index).click(); selected = true; break }
        }
        if (!selected) await page.getByRole('listbox').getByText('Kho mẫu gia vị BOM', { exact: true }).click()
      }
      await dialog.locator('#purchase-receipt-date').fill(date)
      await dialog.locator('#purchase-receipt-lot').fill('E2E-LOT-20260808')
      if (await dialog.locator('#purchase-receipt-manufacture').count()) await dialog.locator('#purchase-receipt-manufacture').fill('2026-08-01')
      if (await dialog.locator('#purchase-receipt-expiry').count()) await dialog.locator('#purchase-receipt-expiry').fill('2026-12-31')
      await dialog.getByRole('button', { name: 'Tiếp tục xác nhận', exact: true }).click()
      const receiptResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/warehouse\/purchase-orders\/[^/]+\/receipts$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Ghi nhận nhập kho', exact: true }).click()
      const response = await receiptResponse
      if (response.status() !== 200) throw new Error(`Warehouse receipt failed: ${response.status()}`)
      received.push({ status: response.status() })
      await page.waitForTimeout(150)
    }
    evidence.warehouseReceipts = { receivedCount: received.length }
    await page.reload()
    await settle()
    await page.screenshot({ path: path.join(root, 'warehouse-receipts-after-reload.png'), fullPage: true })
  } else if (phase === 'warehouse-issue') {
    probe = 'warehouse:ui-create-issue'
    await page.goto(`${baseUrl}/warehouse?week=${week}&purchaseRequestId=${purchaseDate.purchaseRequestId}`)
    await settle()
    await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo phiếu xuất kho' })
    await dialog.locator('#warehouse-material-request').click()
    await page.getByText('MR-ANV-20260808-FULLDAY', { exact: false }).last().click()
    await dialog.locator('#warehouse-source').click()
    await page.getByRole('listbox').getByText('Kho mẫu gia vị BOM', { exact: true }).click()
    await page.getByText(/Kho có thể xuất \d+\/\d+ nhóm nguyên liệu còn lại/).waitFor({ state: 'visible', timeout: 20_000 })
    const issueResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-issues')
    await dialog.getByRole('button', { name: /^Xác nhận xuất \d+ dòng$/ }).click()
    const response = await issueResponse
    const body = await response.json().catch(() => null)
    if (response.status() < 200 || response.status() >= 300) throw new Error(`Inventory issue failed: ${JSON.stringify(body)}`)
    evidence.inventoryIssue = { status: response.status(), body }
    await page.reload()
    await settle()
    await page.getByText('Bếp xác nhận nhận nguyên liệu', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.screenshot({ path: path.join(root, 'warehouse-issue-after-reload.png'), fullPage: true })
  } else if (phase === 'kitchen-receive') {
    probe = 'kitchen:ui-sign-receipt'
    await page.goto(`${baseUrl}/chef-dashboard?date=${date}`)
    await settle()
    await selectSaturdayOnChefDashboard()
    await page.getByText('Checklist nhận nguyên liệu', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    const openGroups = page.locator('.ipc-chef-checklist-panel button[aria-label^="Mở "]')
    while (await openGroups.count()) await openGroups.first().click()
    const receiptCheckbox = page.locator('[role="checkbox"][aria-label^="Ký nhận "]:not([aria-disabled="true"])').first()
    if (await receiptCheckbox.count()) {
      await receiptCheckbox.click()
      const dialog = page.getByRole('dialog', { name: 'Xác nhận đã nhận nguyên liệu' })
      const receiptResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/inventory-issues\/[^/]+\/confirm-receipt$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Đã kiểm đếm và nhận', exact: true }).click()
      const response = await receiptResponse
      if (response.status() !== 200) throw new Error(`Kitchen receipt failed: ${response.status()}`)
      evidence.kitchenReceipt = { status: response.status() }
    } else evidence.kitchenReceipt = { alreadyReceived: true }
    await page.reload()
    await settle()
    await selectSaturdayOnChefDashboard()
    await page.getByText('Tất cả dòng nguyên liệu từ phiếu xuất kho đã được bếp xác nhận.', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('kitchen-receipt-after-reload')
    await page.screenshot({ path: path.join(root, 'kitchen-receipt-after-reload.png'), fullPage: true })
  } else if (phase === 'kitchen-return') {
    probe = 'kitchen:ui-create-return'
    const existingReturnsResponse = await context.request.get(`${apiUrl}/api/inventory-returns?returnDate=${date}&pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } })
    let returnCode = (await existingReturnsResponse.json()).data.items.find((item) => item.reason === 'E2E controlled clean surplus return.')?.returnCode
    await page.goto(`${baseUrl}/chef-dashboard?date=${date}`)
    await settle()
    await selectSaturdayOnChefDashboard()
    if (!returnCode) {
      await page.getByRole('button', { name: /Ghi nhận nguyên liệu thừa/ }).click()
      const dialog = page.getByRole('dialog', { name: 'Ghi nhận nguyên liệu thừa' })
      await dialog.getByRole('combobox').click()
      await chooseFirstOptionExcept('Nhấp để chọn nguyên liệu...')
      await dialog.locator('#excess-returned-qty').fill('0.1')
      await dialog.locator('#excess-notes').fill('E2E controlled clean surplus return.')
      const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-returns')
      await dialog.getByRole('button', { name: 'Ghi nhận nguyên liệu thừa', exact: true }).click()
      const response = await createResponse
      const body = await response.json().catch(() => null)
      if (response.status() !== 201 || !body?.data?.returnCode) throw new Error(`Kitchen return failed: ${JSON.stringify(body)}`)
      returnCode = body.data.returnCode
      evidence.kitchenReturn = { status: response.status(), body }
    } else evidence.kitchenReturn = { alreadyCreated: true, returnCode }
    await page.reload()
    await settle()
    await selectSaturdayOnChefDashboard()
    await page.getByText('Ghi nhận nguyên liệu thừa', { exact: true }).last().waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('kitchen-return-after-reload')
    await page.screenshot({ path: path.join(root, 'kitchen-return-after-reload.png'), fullPage: true })
  } else if (phase === 'warehouse-return-receive') {
    probe = 'warehouse:ui-receive-return'
    const returnsResponse = await context.request.get(`${apiUrl}/api/inventory-returns?returnDate=${date}&pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } })
    const controlledReturn = (await returnsResponse.json()).data.items.find((item) => item.issueCode === 'ISS-20260804-200023-2BB4' && item.reason === 'E2E controlled clean surplus return.')
    if (!controlledReturn?.returnCode) throw new Error('No controlled kitchen return is available for warehouse receipt.')
    await page.goto(`${baseUrl}/warehouse`)
    await settle()
    await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
    await page.getByText('Phiếu trả dư và hao hụt chờ kho tiếp nhận', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    if (controlledReturn.status === 'PENDING_RECEIPT') {
      await page.locator('#warehouse-return-search').fill(controlledReturn.returnCode)
      const row = page.getByRole('row').filter({ hasText: controlledReturn.returnCode })
      await row.getByRole('button', { name: 'Tiếp nhận', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Tiếp nhận nguyên liệu trả' })
      const receiptResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/inventory-returns/${controlledReturn.returnId}/confirm-receipt`)
      await dialog.getByRole('button', { name: 'Xác nhận tiếp nhận', exact: true }).click()
      const response = await receiptResponse
      if (response.status() !== 200) throw new Error(`Warehouse return receipt failed: ${response.status()}`)
      evidence.warehouseReturnReceipt = { status: response.status(), returnCode: controlledReturn.returnCode }
    } else evidence.warehouseReturnReceipt = { alreadyReceived: true, returnCode: controlledReturn.returnCode }
    await page.reload()
    await settle()
    await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
    await page.locator('#warehouse-return-search').fill(controlledReturn.returnCode)
    await page.getByText('Không có phiếu trả hoặc hao hụt đang chờ kho.', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('warehouse-return-receipt-after-reload')
    await page.screenshot({ path: path.join(root, 'warehouse-return-receipt-after-reload.png'), fullPage: true })
  } else if (phase === 'kitchen-supplemental') {
    probe = 'kitchen:ui-request-supplemental'
    const existingSupplementalsResponse = await context.request.get(`${apiUrl}/api/supplemental-material-requests?pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } })
    let supplementalCode = (await existingSupplementalsResponse.json()).data.items.find((item) => item.reason === 'E2E controlled supplemental request after signed receipt.')?.requestCode
    await page.goto(`${baseUrl}/chef-dashboard?date=${date}`)
    await settle()
    await selectSaturdayOnChefDashboard()
    if (!supplementalCode) {
      await page.getByRole('button', { name: /Yêu cầu cấp bổ sung/ }).click()
      const dialog = page.getByRole('dialog', { name: 'Gửi yêu cầu bổ sung' })
      await dialog.getByRole('combobox').click()
      await chooseFirstOptionExcept('Chọn từ phiếu xuất đã nhận')
      await dialog.locator('#supplemental-request-qty').fill('0.1')
      await dialog.locator('#supplemental-reason').fill('E2E controlled supplemental request after signed receipt.')
      const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/supplemental-material-requests')
      await dialog.getByRole('button', { name: 'Gửi tới kho', exact: true }).click()
      const response = await createResponse
      const body = await response.json().catch(() => null)
      if (response.status() !== 201 || !body?.data?.requestCode) throw new Error(`Supplemental request failed: ${JSON.stringify(body)}`)
      supplementalCode = body.data.requestCode
      evidence.supplementalRequest = { status: response.status(), body }
    } else evidence.supplementalRequest = { alreadyCreated: true, supplementalCode }
    await page.reload()
    await settle()
    await selectSaturdayOnChefDashboard()
    await page.getByRole('button', { name: /Yêu cầu cấp bổ sung/ }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('kitchen-supplemental-after-reload')
    await page.screenshot({ path: path.join(root, 'kitchen-supplemental-after-reload.png'), fullPage: true })
  } else if (phase === 'warehouse-supplemental-fulfill') {
    probe = 'warehouse:ui-fulfill-supplemental'
    const requestsResponse = await context.request.get(`${apiUrl}/api/supplemental-material-requests?pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } })
    const controlledRequest = (await requestsResponse.json()).data.items.find((item) => item.issueCode === 'ISS-20260804-200023-2BB4' && item.reason === 'E2E controlled supplemental request after signed receipt.')
    if (!controlledRequest?.requestCode) throw new Error('No controlled supplemental request is available for warehouse fulfillment.')
    await page.goto(`${baseUrl}/warehouse`)
    await settle()
    await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
    await page.getByText('Yêu cầu cấp nguyên liệu bổ sung', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    if (controlledRequest.canFulfill) {
      await page.locator('#warehouse-supplemental-search').fill(controlledRequest.requestCode)
      const row = page.getByRole('row').filter({ hasText: controlledRequest.requestCode })
      await row.getByRole('button', { name: 'Cấp bổ sung', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Cấp nguyên liệu bổ sung' })
      await dialog.locator('#supplemental-quantity').fill('0.1')
      const fulfillResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/supplemental-material-requests/${controlledRequest.requestId}/fulfill`)
      await dialog.getByRole('button', { name: 'Xác nhận cấp', exact: true }).click()
      const response = await fulfillResponse
      if (response.status() !== 200) throw new Error(`Supplemental fulfillment failed: ${response.status()}`)
      evidence.supplementalFulfillment = { status: response.status(), requestCode: controlledRequest.requestCode }
    } else evidence.supplementalFulfillment = { alreadyFulfilled: true, requestCode: controlledRequest.requestCode }
    await page.reload()
    await settle()
    await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
    await page.locator('#warehouse-supplemental-search').fill(controlledRequest.requestCode)
    await page.getByRole('row').filter({ hasText: controlledRequest.requestCode }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('warehouse-supplemental-after-reload')
    await page.screenshot({ path: path.join(root, 'warehouse-supplemental-after-reload.png'), fullPage: true })
  } else if (phase === 'reports-audit') {
    probe = 'reports:ui-reload-and-audit'
    const [issuesResponse, returnsResponse, supplementsResponse] = await Promise.all([
      context.request.get(`${apiUrl}/api/inventory-issues?issueDate=${date}&pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } }),
      context.request.get(`${apiUrl}/api/inventory-returns?returnDate=${date}&pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } }),
      context.request.get(`${apiUrl}/api/supplemental-material-requests?pageNumber=1&pageSize=100`, { headers: { authorization: `Bearer ${token}` } }),
    ])
    const issue = (await issuesResponse.json()).data.items.find((item) => item.issueCode === 'ISS-20260804-200023-2BB4')
    const returned = (await returnsResponse.json()).data.items.find((item) => item.reason === 'E2E controlled clean surplus return.')
    const supplemental = (await supplementsResponse.json()).data.items.find((item) => item.reason === 'E2E controlled supplemental request after signed receipt.')
    if (!issue?.receivedAt || returned?.status !== 'RECEIVED' || !supplemental || Number(supplemental.fulfilledQty) !== Number(supplemental.requestedQty)) {
      throw new Error(`Lifecycle API state is incomplete: ${JSON.stringify({ issue, returned, supplemental })}`)
    }
    evidence.finalLifecycleState = {
      issue: { issueCode: issue.issueCode, receivedAt: issue.receivedAt },
      returned: { returnCode: returned.returnCode, status: returned.status, receivedAt: returned.receivedAt },
      supplemental: { requestCode: supplemental.requestCode, status: supplemental.status, fulfilledQty: supplemental.fulfilledQty, requestedQty: supplemental.requestedQty },
    }

    await page.goto(`${baseUrl}/reports`)
    await settle()
    await page.getByText('Phân tích và thống kê vận hành', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.getByRole('tab', { name: 'Nhập/xuất kho', exact: true }).click()
    await page.getByText('Lịch sử nhập, xuất, trả và điều chỉnh theo khoảng ngày', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.reload()
    await settle()
    await page.getByRole('tab', { name: 'Nhập/xuất kho', exact: true }).click()
    await page.getByText('Lịch sử nhập, xuất, trả và điều chỉnh theo khoảng ngày', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('reports-movement-after-reload')
    await page.screenshot({ path: path.join(root, 'reports-movement-after-reload.png'), fullPage: true })

    await page.goto(`${baseUrl}/admin-data`)
    await settle()
    await page.getByRole('tab', { name: 'Audit', exact: true }).click()
    await page.getByText('Nhật ký thay đổi hệ thống (Audit Trail)', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.reload()
    await settle()
    await page.getByRole('tab', { name: 'Audit', exact: true }).click()
    await page.getByText('Nhật ký thay đổi hệ thống (Audit Trail)', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    await capturePerformance('admin-audit-after-reload')
    await page.screenshot({ path: path.join(root, 'admin-audit-after-reload.png'), fullPage: true })
  } else if (phase === 'terminal-visual-matrix') {
    probe = 'terminal-ui:five-viewports-read-only'
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1365, height: 900 },
      { width: 1280, height: 900 },
    ]
    evidence.visualMatrix = []
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      const label = `${viewport.width}x${viewport.height}`
      await page.goto(`${baseUrl}/chef-dashboard?date=${date}`)
      await settle()
      await selectSaturdayOnChefDashboard()
      await page.getByText('Tất cả dòng nguyên liệu từ phiếu xuất kho đã được bếp xác nhận.', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.screenshot({ path: path.join(root, `${label}-chef.png`), fullPage: true })

      await page.goto(`${baseUrl}/warehouse`)
      await settle()
      await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
      await page.getByText('Yêu cầu cấp nguyên liệu bổ sung', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.screenshot({ path: path.join(root, `${label}-warehouse-exceptions.png`), fullPage: true })

      await page.goto(`${baseUrl}/reports`)
      await settle()
      await page.getByRole('tab', { name: 'Nhập/xuất kho', exact: true }).click()
      await page.getByText('Lịch sử nhập, xuất, trả và điều chỉnh theo khoảng ngày', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.screenshot({ path: path.join(root, `${label}-reports-movement.png`), fullPage: true })

      await page.goto(`${baseUrl}/admin-data`)
      await settle()
      await page.getByRole('tab', { name: 'Audit', exact: true }).click()
      await page.getByText('Nhật ký thay đổi hệ thống (Audit Trail)', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
      await capturePerformance(`terminal-ui-${label}`)
      await page.screenshot({ path: path.join(root, `${label}-admin-audit.png`), fullPage: true })
      evidence.visualMatrix.push({ viewport: label, routes: ['chef', 'warehouse-exceptions', 'reports-movement', 'admin-audit'] })
    }
  } else {
    throw new Error(`Unsupported phase: ${phase}`)
  }
  const afterWorkbench = await workbench(token)
  const afterDate = afterWorkbench.serviceDates.find((item) => item.serviceDate === date)
  evidence.after = { supplierReadyLineCount: afterDate?.supplierReadyLineCount, purchaseRequestStatus: afterDate?.purchaseRequestStatus }
  if (evidence.consoleErrors.length || evidence.pageErrors.length || evidence.requestFailures.some((item) => item.failure !== 'net::ERR_ABORTED')) throw new Error('Unexpected browser errors were observed.')
  evidence.completedAt = new Date().toISOString()
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error)
  await page.screenshot({ path: path.join(root, 'supplier-e2e-error.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await fs.writeFile(path.join(root, 'purchase-supplier-e2e.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  await context.close()
}
