import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.')
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/current-week-import')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })
const fixtures = {
  ANV: path.join(output, 'fixtures/weekly-menu-golden-ANV.xlsx'),
  DAV: path.join(output, 'fixtures/weekly-menu-golden-DAV.xlsx'),
}
const evidence = {
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  weekStartDate: '2026-08-10',
  displayedWeekStartDate: '10/08/2026',
  tier: 25000,
  mode: 'headed-atomic-current-week-import',
  fixtures: {},
  api: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  startedAtUtc: new Date().toISOString(),
}
for (const [customer, file] of Object.entries(fixtures)) {
  const bytes = await readFile(file)
  evidence.fixtures[customer] = { fileName: path.basename(file), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
let browser
try {
  assert((await fetch('http://127.0.0.1:8030/health/ready')).ok, 'API 8030 is not ready.')
  assert((await fetch('http://127.0.0.1:3030/login')).ok, 'Frontend 3030 is not ready.')
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText })
  })
  page.on('response', async response => {
    const url = new URL(response.url())
    if (url.pathname.includes('/weekly-menu/import')) evidence.api.push({
      method: response.request().method(), path: url.pathname, status: response.status(), body: await response.json().catch(() => null),
    })
  })
  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/weekly-menu')
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })

  for (const customer of ['ANV', 'DAV']) {
    await dialog.getByRole('combobox', { name: 'Khách hàng' }).click()
    await page.getByRole('option', { name: new RegExp(`^${customer} - `) }).click()
    const dateInput = dialog.getByRole('textbox', { name: 'Tuần bắt đầu' })
    await dateInput.fill(evidence.displayedWeekStartDate)
    await dateInput.press('Tab')
    await dialog.waitFor()
    await dialog.locator('#weekly-menu-import-file').setInputFiles(fixtures[customer])
    await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
  }

  await dialog.getByRole('button', { name: 'Kiểm tra tất cả', exact: true }).click()
  await dialog.getByText('2/2 file đã kiểm tra xong', { exact: true }).waitFor({ timeout: 60000 })
  const previewResponses = evidence.api.filter(item => item.path.endsWith('/preview'))
  assert(previewResponses.length === 2 && previewResponses.every(item => item.status === 200), 'Both preview requests must return 200.')
  for (const response of previewResponses) {
    const preview = response.body?.data
    assert(preview?.weekStartDate?.startsWith(evidence.weekStartDate), `Preview week mismatch: ${preview?.weekStartDate}`)
    assert(preview?.detectedLayout?.rowsImported === 120, `Preview row count mismatch: ${preview?.detectedLayout?.rowsImported}`)
    assert(preview?.validation?.errorCount === 0, `Preview contains ${preview?.validation?.errorCount} errors.`)
    assert(!preview?.rows?.some(row => !row.existingDish), 'Preview contains dishes outside the catalog.')
  }
  const saveAll = dialog.getByRole('button', { name: 'Lưu toàn bộ file', exact: true })
  assert(!(await saveAll.isDisabled()), 'Atomic save is disabled after both previews passed.')
  await page.screenshot({ path: path.join(output, 'current-week-preview.png'), fullPage: true })
  await saveAll.click()
  const confirm = page.getByRole('dialog', { name: 'Lưu toàn bộ 2 file?' })
  await confirm.getByRole('button', { name: 'Lưu toàn bộ file', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 60000 })
  const batch = evidence.api.find(item => item.path.endsWith('/commit-batch'))
  assert(batch?.status === 200, `Atomic batch commit failed with ${batch?.status ?? 'no response'}.`)
  const results = batch.body?.data?.results ?? batch.body?.data ?? []
  assert(Array.isArray(results) && results.length === 2, 'Atomic batch response does not contain two customer results.')
  assert(results.every(result => result.weekStartDate?.startsWith(evidence.weekStartDate) && result.detectedLayout?.rowsImported === 120), 'Committed results do not match the current week and 120 rows.')

  await page.reload()
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const reopened = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  const currentRows = reopened.locator('tbody tr').filter({ hasText: '10/08/2026' }).filter({ hasText: '120 thành công' })
  await currentRows.first().waitFor({ timeout: 30000 })
  evidence.readback = { currentWeekRows: await currentRows.count(), anv: await currentRows.filter({ hasText: 'ANV - AMANN' }).count(), dav: await currentRows.filter({ hasText: 'DAV - Draxlmaier' }).count() }
  assert(evidence.readback.anv > 0 && evidence.readback.dav > 0, 'Reload history does not show both current-week imports.')
  await page.screenshot({ path: path.join(output, 'current-week-readback.png'), fullPage: true })
  assert(evidence.consoleErrors.length === 0 && evidence.pageErrors.length === 0 && evidence.requestFailures.length === 0, 'Browser errors occurred during current-week import.')
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
  await writeFile(path.join(output, 'current-week-import.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
