import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/chef-checklist-quick-fix')
const result = {
  verdict: 'RUNNING',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  requests: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false },
  measurements: null,
}

await mkdir(output, { recursive: true })
let context
try {
  context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-chef-checklist'), {
    channel: 'chrome', headless: false, viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'],
  })
  await context.exposeBinding('__p05ChecklistInput', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05ChecklistInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05ChecklistInput('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }))
  page.on('response', (response) => {
    const request = response.request()
    if (new URL(response.url()).pathname.startsWith('/api/') && request.method() !== 'GET') {
      result.requests.push({ method: request.method(), path: new URL(response.url()).pathname, status: response.status() })
    }
  })

  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click()
  await page.keyboard.type(process.env.IPC_LANE7_CHEF_USERNAME ?? 'beptruong')
  await page.locator('#password').click()
  await page.keyboard.type(process.env.IPC_LANE7_CHEF_PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login')),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])
  await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  const checklist = page.getByRole('heading', { name: 'Checklist nhận nguyên liệu' }).locator('xpath=ancestor::section[1]')
  await checklist.waitFor()
  const pagination = page.getByRole('navigation', { name: 'Phân trang danh sách' })
  await pagination.waitFor()
  const expand = checklist.getByRole('button', { name: /Mở \d+ dòng nguồn của/ }).first()
  if (await expand.count()) {
    await expand.focus()
    await page.keyboard.press('Enter')
  }
  const receive = checklist.getByRole('button', { name: /^Nhận(?: |$)/ }).first()
  if (await receive.count()) {
    await receive.click()
    await page.getByRole('dialog', { name: 'Xác nhận đã nhận nguyên liệu?' }).waitFor()
    await page.keyboard.press('Escape')
  }

  const checklistBox = await checklist.boundingBox()
  const paginationBox = await pagination.boundingBox()
  result.measurements = {
    checklistWidth: checklistBox?.width ?? 0,
    paginationWidth: paginationBox?.width ?? 0,
    widthDifference: Math.abs((checklistBox?.width ?? 0) - (paginationBox?.width ?? 0)),
    receiveButtons: await checklist.getByRole('button', { name: /^Nhận(?: |$)/ }).count(),
    receivedLabels: await checklist.getByText('Đã nhận', { exact: true }).count(),
    struckMaterialNames: await checklist.locator('td.line-through').count(),
    fadedRows: await checklist.locator('tr.opacity-70').count(),
  }
  await page.screenshot({ path: path.join(output, 'checklist-aligned.png'), fullPage: true })
  const noBusinessMutation = result.requests.every((request) => request.path === '/api/auth/login')
  const measurementPass = result.measurements.widthDifference <= 2 && (result.measurements.receiveButtons > 0 || result.measurements.receivedLabels > 0) && result.measurements.struckMaterialNames === 0 && result.measurements.fadedRows === 0
  result.verdict = noBusinessMutation && measurementPass && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.requestFailures.length === 0 ? 'PASS' : 'FAIL'
} catch (error) {
  result.verdict = 'FAIL'
  result.error = error instanceof Error ? error.message : String(error)
} finally {
  await context?.close()
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
}

if (result.verdict !== 'PASS') throw new Error(JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
