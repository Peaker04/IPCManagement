import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.IPC_VISUAL_BASE_URL ?? 'http://127.0.0.1:3032'
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/menu-amendment/correction')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const query = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const countsSql = `SELECT (SELECT COUNT(*) FROM menuschedules) menuschedules,(SELECT COUNT(*) FROM menuitems) menuitems,(SELECT COUNT(*) FROM menuversions) menuversions,(SELECT COUNT(*) FROM materialrequests) materialrequests,(SELECT COUNT(*) FROM purchaserequests) purchaserequests,(SELECT COUNT(*) FROM purchaseorders) purchaseorders,(SELECT COUNT(*) FROM inventoryreceipts) receipts,(SELECT COUNT(*) FROM inventoryissues) issues;`
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, pointerTrusted: false, keyboardTrusted: false, responses: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
let browser
try {
  result.before = { business: query(countsSql), correction: query('SELECT COUNT(*) corrections FROM menuamendmentreconciliationcorrections;'), caseState: query('SELECT status FROM menuamendmentreconciliationcases;') }
  if (!result.before.correction.endsWith('\n0') || !result.before.caseState.endsWith('\nOPEN')) throw new Error(`Correction preflight drifted: ${JSON.stringify(result.before)}`)
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__correctionEvidence', (_source, kind) => { result[`${kind}Trusted`] = true })
  await context.addInitScript(() => { addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__correctionEvidence('pointer') }, true); addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__correctionEvidence('keyboard') }, true) })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }) })
  page.on('response', (response) => { const pathname = new URL(response.url()).pathname; if (pathname.includes('/amendments/decisions/') && response.request().method() === 'POST') result.responses.push({ pathname, status: response.status(), method: 'POST' }) })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' }); await page.locator('#username').click(); await page.keyboard.type('admin'); await page.locator('#password').click(); await page.keyboard.type(process.env.K6_PASSWORD); await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto(`${baseUrl}/approvals`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Đối soát điều chỉnh thực đơn' }).waitFor()
  const customerSelect = page.locator('#menu-reconciliation-customer')
  const anvValue = await customerSelect.locator('option').filter({ hasText: 'ANV - AMANN' }).getAttribute('value')
  if (!anvValue) throw new Error('Không tìm thấy khách hàng ANV trong bộ lọc đối soát.')
  await customerSelect.selectOption(anvValue)
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chi tiết yêu cầu đối soát' })
  await dialog.getByLabel('Lý do điều chỉnh').click(); await page.keyboard.type('Ghi nhận điều chỉnh theo phạm vi canonical đã được remediation append-only và đối chiếu với Ca phục vụ đã đóng.')
  await dialog.getByRole('button', { name: 'Ghi nhận điều chỉnh' }).click()
  await page.getByText('Đã ghi nhận điều chỉnh và cập nhật lại danh sách.').waitFor()
  await page.screenshot({ path: path.join(output, 'corrected.png'), fullPage: true })
  result.after = { business: query(countsSql), correction: query('SELECT COUNT(*) corrections FROM menuamendmentreconciliationcorrections;'), caseState: query('SELECT status FROM menuamendmentreconciliationcases;'), correctionDecision: query('SELECT COUNT(*) linked FROM menuamendmentreconciliationcorrections WHERE serviceRunDecisionItemId IS NOT NULL;'), transitions: query("SELECT COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='MenuAmendmentReconciliationCase' AND toState='RESOLVED';") }
  result.ui = { resolved: (await page.locator('body').innerText()).includes('Đã ghi nhận điều chỉnh') }
  result.verdict = result.before.business === result.after.business && result.after.correction.endsWith('\n1') && result.after.caseState.endsWith('\nRESOLVED') && result.after.correctionDecision.endsWith('\n1') && result.after.transitions.endsWith('\n1') && result.ui.resolved && result.pointerTrusted && result.keyboardTrusted && result.responses.some((response) => response.status === 200) && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.requestFailures.length === 0 ? 'PASS' : 'FAIL'
  await context.close()
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally { if (browser) await browser.close().catch(() => {}); result.finishedAtUtc = new Date().toISOString(); const serialized = JSON.stringify(result); if (serialized.includes(process.env.K6_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed'); await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`) }
console.log(JSON.stringify(result, null, 2)); if (result.verdict !== 'PASS') process.exitCode = 1
