import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = 'http://127.0.0.1:3040'
const database = 'ipc_default_campaign_20260923_075251'
const week = '2026-10-12'
const displayWeek = '12/10/2026'
const output = path.resolve('.artifacts/default-feature-campaign/20260923-075251/weekly-menu-happy')
const password = process.env.IPC_LANE7_ADMIN_PASSWORD
const mysqlPassword = process.env.IPC_LANE7_MYSQL_PASSWORD
if (!password || !mysqlPassword) throw new Error('Campaign credentials are required')
const fixtures = Object.fromEntries(['ANV', 'DAV'].map(customer => [customer, path.resolve(`.artifacts/default-feature-campaign/20260923-075251/fixtures/weekly-menu-${customer}-${week}.xlsx`)]))
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const query = sql => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', `--database=${database}`, '--batch', '--raw', '--skip-column-names', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: mysqlPassword } }).trim()
const scopeSql = `SELECT (SELECT COUNT(*) FROM menuversions WHERE weekStartDate='${week}'),(SELECT COUNT(*) FROM menuschedules WHERE serviceDate BETWEEN '${week}' AND DATE_ADD('${week}',INTERVAL 6 DAY)),(SELECT COUNT(*) FROM mealquantityplans WHERE serviceDate BETWEEN '${week}' AND DATE_ADD('${week}',INTERVAL 6 DAY));`
const result = { verdict: 'RUNNING', database, protectedLaneConnectionAttempts: 0, week, tier: 25000, before: query(scopeSql), fixtures: {}, api: [], browser: [], consoleErrors: [], pageErrors: [], requestFailures: [], mutationRequests: [] }
await mkdir(output, { recursive: true })
for (const [customer, file] of Object.entries(fixtures)) { const bytes = await readFile(file); result.fixtures[customer] = { name: path.basename(file), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1440,900'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
await page.addInitScript(() => { window.__defaultMetrics = { cls: 0, longTasks: [] }; new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__defaultMetrics.cls += entry.value }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__defaultMetrics.longTasks.push(entry.duration) }).observe({ type: 'longtask', buffered: true }) })
page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', error => result.pageErrors.push(error.message))
page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }) })
page.on('response', async response => { const url = new URL(response.url()); if (!url.pathname.includes('/weekly-menu/import')) return; const item = { method: response.request().method(), path: url.pathname, status: response.status(), duration: response.request().timing().responseEnd }; if (item.method !== 'GET') result.mutationRequests.push(item); result.api.push({ ...item, body: await response.json().catch(() => undefined) }) })
try {
  await page.goto(`${baseUrl}/login`); await page.locator('#username').fill('admin'); await page.locator('#password').fill(password); await Promise.all([page.waitForURL(url => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto(`${baseUrl}/weekly-menu`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  for (const customer of ['ANV', 'DAV']) {
    await dialog.getByRole('combobox', { name: 'Khách hàng' }).click(); await page.locator('[role="option"]:visible', { hasText: new RegExp(`^${customer} - `) }).click()
    const weekInput = dialog.getByLabel('Tuần bắt đầu'); await weekInput.fill(displayWeek); await weekInput.press('Enter')
    await dialog.locator('#weekly-menu-import-file').setInputFiles(fixtures[customer]); await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Kiểm tra tất cả', exact: true }).click(); await dialog.getByText('2/2 file đã kiểm tra xong', { exact: true }).waitFor({ timeout: 45000 })
  const previews = result.api.filter(item => item.path.endsWith('/preview') && item.status === 200).map(item => item.body?.data)
  if (previews.length !== 2 || previews.some(item => item?.validation?.errorCount !== 0 || item?.detectedLayout?.rowsImported !== 120 || item?.rows?.some(row => !row.existingDish))) throw new Error('Preview is not canonical and catalog-backed')
  await page.screenshot({ path: path.join(output, 'preview.png'), fullPage: true })
  const save = dialog.getByRole('button', { name: 'Lưu toàn bộ file', exact: true }); if (await save.isDisabled()) throw new Error('Commit disabled after valid previews'); await save.click(); const confirm = page.getByRole('dialog', { name: 'Lưu toàn bộ 2 file?' }); await confirm.getByRole('button', { name: 'Lưu toàn bộ file', exact: true }).click(); await dialog.waitFor({ state: 'hidden', timeout: 45000 })
  result.after = query(scopeSql)
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {})
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) { await page.setViewportSize(viewport); const overflow = await page.locator('body').evaluate(e => e.scrollWidth - e.clientWidth); const metrics = await page.evaluate(() => window.__defaultMetrics ?? { cls: 0, longTasks: [] }); const key = `${viewport.width}x${viewport.height}`; result.browser.push({ viewport: key, url: page.url(), overflow, cls: metrics.cls, maxLongTask: Math.max(0, ...metrics.longTasks) }); await page.screenshot({ path: path.join(output, `${key}-reload.png`), fullPage: true }) }
  const commits = result.api.filter(item => item.path.endsWith('/commit-batch') && item.status === 200)
  result.verdict = result.before === '0\t0\t0' && result.after.startsWith('2\t') && commits.length === 1 && result.browser.every(cell => cell.overflow <= 1) && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length ? 'PASS' : 'FAIL'
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error); result.finalUrl = page.url(); result.bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 20000); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}) }
finally { await context.close(); await browser.close(); result.finishedAt = new Date().toISOString(); const serialized = JSON.stringify(result); if (serialized.includes(password) || serialized.includes(mysqlPassword) || /Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Secret leaked'); await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`) }
console.log(JSON.stringify({ verdict: result.verdict, before: result.before, after: result.after, previews: result.api.filter(x => x.path.endsWith('/preview')).length, commits: result.api.filter(x => x.path.endsWith('/commit-batch')).length, browser: result.browser }, null, 2)); if (result.verdict !== 'PASS') process.exitCode = 1
