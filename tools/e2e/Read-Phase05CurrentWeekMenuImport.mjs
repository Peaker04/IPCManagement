import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/current-week-import')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })
const evidence = { lane: 'ipc_lane7', mode: 'headed-readback-only', weekStartDate: '2026-08-10', protectedLaneConnectionAttempts: 0, api: [], consoleErrors: [], pageErrors: [], requestFailures: [], startedAtUtc: new Date().toISOString() }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
let browser
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }) })
  page.on('response', async response => {
    const url = new URL(response.url())
    if (url.pathname === '/api/coordination/weekly-menu/import-history') evidence.api.push({ status: response.status(), body: await response.json().catch(() => null) })
  })
  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/weekly-menu')

  const commandDate = page.locator('input[data-date-locale="vi-VN"]').first()
  await commandDate.fill('10/08/2026')
  await commandDate.press('Tab')
  await page.getByRole('button', { name: 'Mở lịch chọn ngày' }).first().click()
  const calendar = page.getByRole('dialog', { name: 'Lịch chọn ngày' })
  await calendar.waitFor()
  evidence.dateControl = { displayValue: await commandDate.inputValue(), title: await calendar.locator('strong').textContent(), hasToday: await calendar.getByRole('button', { name: 'Hôm nay' }).count(), hasSunday: await calendar.getByText('CN', { exact: true }).count(), nativeDateInputCount: await page.locator('input[type="date"]').count() }
  assert(evidence.dateControl.displayValue === '10/08/2026' && evidence.dateControl.title === 'Tháng 8 năm 2026' && evidence.dateControl.hasToday === 1 && evidence.dateControl.hasSunday === 1 && evidence.dateControl.nativeDateInputCount === 0, 'Vietnamese shared date control readback failed.')
  await calendar.getByRole('button', { name: 'Đóng' }).click()

  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  const rows = dialog.locator('tbody tr').filter({ hasText: '10/08/2026' }).filter({ hasText: '120 thành công' })
  await rows.first().waitFor({ timeout: 30000 })
  const history = evidence.api.at(-1)?.body?.data ?? []
  const current = history.filter(item => item.weekStartDate === evidence.weekStartDate && item.status === 'DRAFT')
  evidence.readback = { domRows: await rows.count(), anvDom: await rows.filter({ hasText: 'ANV - AMANN' }).count(), davDom: await rows.filter({ hasText: 'DAV - Draxlmaier' }).count(), records: current.map(item => ({ customerCode: item.customerCode, weekStartDate: item.weekStartDate, versionNo: item.versionNo, status: item.status, successRowCount: item.successRowCount, sourceFileName: item.sourceFileName })) }
  assert(evidence.readback.anvDom > 0 && evidence.readback.davDom > 0 && current.length === 2 && current.every(item => item.successRowCount === 120), 'Current-week readback does not contain both 120-row imports.')
  await page.screenshot({ path: path.join(output, 'current-week-readback-final.png'), fullPage: true })
  assert(evidence.consoleErrors.length === 0 && evidence.pageErrors.length === 0 && evidence.requestFailures.length === 0, 'Browser errors occurred during readback.')
  evidence.status = 'PASS'
  await context.close()
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (browser) await browser.close()
  evidence.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Evidence secret scan failed.')
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(output, 'current-week-readback.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
