import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/kitchen-discrepancy')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, mode: 'headed-read-only-current-source', physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, mutationRequests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__phase05ReadbackPhysical', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05ReadbackPhysical('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05ReadbackPhysical('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('response', (response) => { if (response.request().method() !== 'GET' && new URL(response.url()).pathname.startsWith('/api/') && !new URL(response.url()).pathname.endsWith('/auth/login')) result.mutationRequests.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() }) })
try {
  await page.goto('http://127.0.0.1:3034/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('beptruong')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_CHEF_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3034/chef-dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const day = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' })
  await day.click(); await page.getByRole('option', { name: 'Thứ Ba', exact: true }).click()
  const shift = page.getByRole('combobox', { name: 'Chọn ca sản xuất' })
  await shift.click(); await page.getByRole('option', { name: 'Ca Chiều', exact: true }).click()
  const anv = page.getByText(/AMANN/i).locator('xpath=ancestor::article[1]')
  const dav = page.getByText(/Draxlmaier/i).locator('xpath=ancestor::article[1]')
  await anv.getByText('Cần đối soát', { exact: true }).waitFor()
  result.dom = {
    anvStatus: 'Cần đối soát',
    pendingReasonVisible: (await anv.innerText()).includes('Bếp phát hiện lượng nguyên liệu thực nhận không khớp'),
    davCanOpen: await dav.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).isVisible(),
  }
  await page.screenshot({ path: path.join(output, 'kitchen-discrepancy-reload.png'), fullPage: true })
} finally {
  await context.close(); await browser.close()
}
result.db = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT c.customerCode,sr.serviceDate,sr.shiftName,sr.concurrencyVersion,COUNT(DISTINCT d.serviceRunVarianceDeclarationId) declarations,COUNT(DISTINCT w.serviceRunVarianceWaiverId) waivers
  FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId
  LEFT JOIN servicerunvariancedeclarations d ON d.serviceRunId=sr.serviceRunId
  LEFT JOIN servicerunvariancewaivers w ON w.serviceRunVarianceDeclarationId=d.serviceRunVarianceDeclarationId
  WHERE c.customerCode='ANV' AND sr.serviceDate='2026-08-11' AND sr.shiftName='AFTERNOON'
  GROUP BY c.customerCode,sr.serviceDate,sr.shiftName,sr.concurrencyVersion;
  SELECT lt.commandId,lt.aggregateSequence,lt.expectedVersion,
         (SELECT COUNT(*) FROM lifecyclecommandreceipts cr WHERE cr.commandId=lt.commandId) receipts,
         (SELECT COUNT(*) FROM auditlogs a WHERE a.businessArea='Lifecycle' AND a.correlationId <=> lt.correlationId AND a.reason=lt.reason) audits,
         (SELECT COUNT(*) FROM lifecycleoutboxmessages o WHERE o.commandId=lt.commandId) outbox
  FROM lifecycletransitions lt WHERE lt.commandId LIKE 'service-run-variance-%' ORDER BY lt.createdAt DESC LIMIT 1;
  SELECT COUNT(*) unrelatedDavRuns FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId WHERE c.customerCode='DAV' AND sr.serviceDate='2026-08-11' AND sr.shiftName='AFTERNOON';
`)
const passed = result.db.includes('ipc_lane7\t70\t20260813171032_AddMenuAmendmentDecisionFanRemediations') && result.db.includes('ANV\t2026-08-11\tAFTERNOON\t2\t1\t0') && result.db.includes('\t2\t1\t1\t1\t1') && result.db.endsWith('unrelatedDavRuns\r\n0') && result.dom.anvStatus === 'Cần đối soát' && result.dom.pendingReasonVisible && result.dom.davCanOpen && result.mutationRequests.length === 0 && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
if (!passed) throw new Error(`Kitchen discrepancy readback failed: ${JSON.stringify(result, null, 2)}`)
result.verdict = 'PASS'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || serialized.includes(process.env.IPC_LANE7_CHEF_PASSWORD)) throw new Error('Credential leaked into kitchen discrepancy readback')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
