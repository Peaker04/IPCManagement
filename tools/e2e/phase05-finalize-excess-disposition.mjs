import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/excess-disposition')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPostflight = mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT d.quantity,d.reason,ux.username,HEX(d.sourceIssueLineId),HEX(d.destinationIssueLineId) FROM inventoryallocationdispositions d JOIN users ux ON ux.userId=d.createdBy WHERE d.sourceIssueLineId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*),MIN(aggregateSequence),MAX(aggregateSequence) FROM lifecycletransitions WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) FROM lifecycleoutboxmessages WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='InventoryAllocationDisposition' AND entityId=UNHEX('77436B29BB29D145803429901CD750D0');
`)
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__p05excessFinal', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05excessFinal('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05excessFinal('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('admin')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const section = page.getByText('Đối soát nguyên liệu đã xuất', { exact: true }).locator('xpath=ancestor::section[1]')
  const source = section.getByRole('row').filter({ hasText: 'AMANN (ANV)' }).filter({ hasText: '10/08/2026' }).filter({ hasText: 'Cá hố' })
  const destination = section.getByRole('row').filter({ hasText: 'Draxlmaier (DAV)' }).filter({ hasText: '10/08/2026' }).filter({ hasText: 'Cá hố' })
  await source.waitFor(); await destination.waitFor()
  result.reload = { sourceRow: await source.innerText(), destinationRow: await destination.innerText() }
  await source.getByRole('button', { name: 'Điều phối phần dư', exact: true }).focus(); await page.keyboard.press('Tab')
  await page.screenshot({ path: path.join(output, 'excess-disposition-final.png'), fullPage: true })
} finally { await context.close(); await browser.close() }
const post = result.dbPostflight.replaceAll('\r', '')
const passed = post.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') && post.includes('0.000500\tDieu phoi phan du da duoc duyet\tadmin\t77436B29BB29D145803429901CD750D0\t0C384EC541F3864A89BB20B1650220B0')
  && post.includes('1\t1\t1') && result.reload.sourceRow.includes('102,58468 kg') && result.reload.destinationRow.includes('102,58438 kg')
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'; result.finishedAtUtc = new Date().toISOString()
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
