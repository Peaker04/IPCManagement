import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/create-purchase-requests')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, created: [], requests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
const mysqlQuery = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } })
let browser
let context
await mkdir(output, { recursive: true })
try {
  const pending = mysqlQuery("SELECT mr.requestCode,DATE_FORMAT(pp.planDate,'%Y-%m-%d') planDate FROM materialrequests mr JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' AND mr.status='MANAGERAPPROVED' AND NOT EXISTS (SELECT 1 FROM purchaserequestlines prl JOIN materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId WHERE mrl.requestId=mr.requestId) ORDER BY pp.planDate,c.customerCode;").trim().split(/\r?\n/).slice(1).filter(Boolean).map((line) => { const [requestCode, planDate] = line.split('\t'); return { requestCode, planDate } })
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const url = new URL(response.url()); if (url.pathname.startsWith('/api/')) result.requests.push({ method: response.request().method(), path: url.pathname, status: response.status() }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thumua')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_PURCHASING_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  for (const item of pending) {
    await page.goto(`http://127.0.0.1:3030/purchasing?week=2026-08-10&date=${item.planDate}&stage=demand`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const select = page.locator('#approved-demand-selection')
    await select.waitFor({ state: 'visible' })
    if (await select.getAttribute('aria-expanded') !== 'true') await select.click()
    const option = page.getByRole('option').filter({ hasText: item.requestCode }).first()
    await option.waitFor({ state: 'visible' })
    await option.click()
    if (await select.getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape')
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đề xuất mua', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo đề xuất mua' })
    await dialog.waitFor({ state: 'visible' })
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/purchase-workflow/from-demand')
    await dialog.getByRole('button', { name: 'Tạo đề xuất mua', exact: true }).click()
    const response = await responsePromise
    if (response.status() !== 200) throw new Error(`${item.requestCode} purchase request returned ${response.status()}`)
    await dialog.waitFor({ state: 'detached' })
    result.created.push({ ...item, status: response.status() })
  }
  result.dbPostflight = mysqlQuery("SELECT c.customerCode,pr.status,COUNT(DISTINCT pr.purchaseRequestId) requestCount FROM purchaserequests pr JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId JOIN materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId JOIN materialrequests mr ON mr.requestId=mrl.requestId JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY c.customerCode,pr.status ORDER BY c.customerCode,pr.status;").trim()
  result.groupingPostflight = mysqlQuery("SELECT pr.purchaseRequestCode,pr.purchaseForDate,COUNT(DISTINCT c.customerCode) customerCount,COUNT(DISTINCT mr.requestId) demandCount FROM purchaserequests pr JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId JOIN materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId JOIN materialrequests mr ON mr.requestId=mrl.requestId JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY pr.purchaseRequestId,pr.purchaseRequestCode,pr.purchaseForDate ORDER BY pr.purchaseForDate;").trim()
  const groupingRows = result.groupingPostflight.split(/\r?\n/).slice(1).filter(Boolean)
  if (groupingRows.length !== 6 || groupingRows.some((line) => !line.endsWith('\t2\t2'))) throw new Error('Compatible ANV/DAV grouping postflight failed')
  result.expectedPermissionDenials = result.requests.filter((item) => item.method === 'GET' && item.path === '/api/supplemental-material-requests' && item.status === 403)
  result.consoleErrors = result.consoleErrors.filter((message) => !message.includes('status of 403'))
  if (result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length) throw new Error('Browser errors observed while creating purchase requests')
  result.verdict = 'PASS'
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally {
  if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_PURCHASING_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (result.verdict !== 'PASS') process.exitCode = 1
