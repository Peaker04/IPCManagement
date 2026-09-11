import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/approve-demands')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, approvals: [], requests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
const mysqlQuery = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } })
let browser
let context

await mkdir(output, { recursive: true })
try {
  const pending = mysqlQuery("SELECT mr.requestCode FROM materialrequests mr JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' AND mr.status='DRAFT' ORDER BY c.customerCode,pp.planDate;").trim().split(/\r?\n/).slice(1).filter(Boolean)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const url = new URL(response.url()); if (url.pathname.startsWith('/api/')) result.requests.push({ method: response.request().method(), path: url.pathname, status: response.status() }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click()
  await page.keyboard.type('quanly')
  await page.locator('#password').click()
  await page.keyboard.type(process.env.IPC_LANE7_MANAGER_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/approvals', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const search = page.locator('#approval-inbox-search')
  for (const requestCode of pending) {
    await search.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(requestCode)
    await page.waitForTimeout(500)
    const row = page.locator('article.ipc-approval-record').filter({ hasText: requestCode }).first()
    await row.waitFor({ state: 'visible' })
    await row.getByRole('button', { name: 'Duyệt nhu cầu', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Duyệt nhu cầu nguyên liệu?' })
    await dialog.waitFor({ state: 'visible' })
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/approvals/material-demand/'))
    await dialog.getByRole('button', { name: 'Duyệt nhu cầu', exact: true }).click()
    const response = await responsePromise
    if (response.status() !== 200) throw new Error(`${requestCode} approval returned ${response.status()}`)
    await dialog.waitFor({ state: 'detached' })
    result.approvals.push({ requestCode, status: response.status() })
    await page.waitForTimeout(300)
  }
  result.dbPostflight = mysqlQuery("SELECT c.customerCode,mr.status,COUNT(*) requestCount FROM materialrequests mr JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY c.customerCode,mr.status ORDER BY c.customerCode,mr.status;").trim()
  if (!result.dbPostflight.includes('ANV\tMANAGERAPPROVED\t6') || !result.dbPostflight.includes('DAV\tMANAGERAPPROVED\t6')) throw new Error('Demand approval DB postflight failed')
  if (result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length) throw new Error('Browser errors observed during demand approval')
  result.verdict = 'PASS'
} catch (error) {
  result.verdict = 'FAIL'
  result.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_MANAGER_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (result.verdict !== 'PASS') process.exitCode = 1
