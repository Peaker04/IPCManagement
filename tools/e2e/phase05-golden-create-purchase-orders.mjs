import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/create-purchase-orders')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, created: [], requests: [], consoleErrors: [], pageErrors: [], requestFailures: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false } }
const mysqlQuery = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } })
let browser, context
await mkdir(output, { recursive: true })
try {
  const pending = mysqlQuery("SELECT DATE_FORMAT(pr.purchaseForDate,'%Y-%m-%d') serviceDate FROM purchaserequests pr WHERE pr.purchaseForDate BETWEEN '2026-08-10' AND '2026-08-15' AND pr.status='APPROVED' AND NOT EXISTS (SELECT 1 FROM purchaseorders po WHERE po.purchaseRequestId=pr.purchaseRequestId) ORDER BY pr.purchaseForDate;").trim().split(/\r?\n/).slice(1).filter(Boolean)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__phase05PoInput', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05PoInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05PoInput('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const p = new URL(response.url()).pathname; if (p.startsWith('/api/') && response.request().method() !== 'GET') result.requests.push({ method: response.request().method(), path: p, status: response.status() }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('admin')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  for (const serviceDate of pending) {
    await page.goto(`http://127.0.0.1:3030/purchasing?week=2026-08-10&date=${serviceDate}&stage=approved-order`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const create = page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đơn đặt hàng', exact: true })
    await create.waitFor({ state: 'visible' }); await create.click()
    const dialog = page.getByRole('dialog', { name: 'Tạo đơn đặt hàng' })
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/purchase-orders/from-request/'))
    await dialog.getByRole('button', { name: 'Tạo đơn đặt hàng', exact: true }).click()
    const response = await responsePromise
    if (response.status() !== 200) throw new Error(`${serviceDate} PO creation returned ${response.status()}`)
    await dialog.waitFor({ state: 'detached' })
    result.created.push({ serviceDate, status: 200 })
  }
  result.groupingPostflight = mysqlQuery("SELECT po.purchaseOrderCode,po.proposedDeliveryDate,COUNT(DISTINCT c.customerCode) customerCount,COUNT(DISTINCT mr.requestId) demandCount,COUNT(*) lineCount FROM purchaseorders po JOIN purchaseorderlines pol ON pol.purchaseOrderId=po.purchaseOrderId JOIN purchaserequestlines prl ON prl.purchaseRequestLineId=pol.purchaseRequestLineId JOIN materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId JOIN materialrequests mr ON mr.requestId=mrl.requestId JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE pp.planDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY po.purchaseOrderId,po.purchaseOrderCode,po.proposedDeliveryDate ORDER BY po.proposedDeliveryDate;").trim()
  const rows = result.groupingPostflight.split(/\r?\n/).slice(1).filter(Boolean)
  if (rows.length !== 6 || rows.some((row) => !row.split('\t').slice(2,4).every((value) => value === '2'))) throw new Error('PO compatibility/allocation postflight failed')
  if (!result.physicalInput.pointerTrusted || !result.physicalInput.keyboardTrusted || result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length) throw new Error('Physical/browser gate failed')
  result.verdict = 'PASS'
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally {
  if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {})
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(process.env.IPC_LANE7_ADMIN_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
if (result.verdict !== 'PASS') process.exitCode = 1
