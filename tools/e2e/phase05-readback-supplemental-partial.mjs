import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const requestCode = 'SUP-20260813-151359-5984'
const purchaseRequestCode = 'PR-SUP-20260813-0FC6'
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/supplemental-partial')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, mode: 'headed-read-only-finalizer', requestCode, purchaseRequestCode, physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [], mutationRequests: [] }
await mkdir(output, { recursive: true })
result.db = mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT smr.requestCode,smr.status,smr.requestedQty,HEX(smr.issueLineId),c.customerCode,pp.planDate,ppl.shiftName,i.ingredientName
FROM supplementalmaterialrequests smr JOIN inventoryissuelines src ON src.issueLineId=smr.issueLineId JOIN materialrequestlines mrl ON mrl.requestLineId=src.materialRequestLineId
JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId JOIN productionplans pp ON pp.planId=ppl.planId JOIN customers c ON c.customerId=ppl.customerId JOIN ingredients i ON i.ingredientId=smr.ingredientId
WHERE smr.requestCode='${requestCode}';
SELECT sm.quantityOut,sm.beforeQty,sm.afterQty FROM stockmovements sm JOIN supplementalmaterialrequests smr ON smr.requestId=sm.refId WHERE sm.refTable='supplementalmaterialrequests' AND smr.requestCode='${requestCode}';
SELECT pr.purchaseRequestCode,pr.status,prl.requiredQty,prl.currentStockQty,prl.purchaseQty,HEX(prl.materialRequestLineId),HEX(src.materialRequestLineId),HEX(smr.issueLineId)
FROM purchaserequests pr JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId
JOIN supplementalmaterialrequests smr ON smr.requestCode='${requestCode}' JOIN inventoryissuelines src ON src.issueLineId=smr.issueLineId
WHERE pr.purchaseRequestCode='${purchaseRequestCode}';
SELECT GROUP_CONCAT(aggregateSequence ORDER BY aggregateSequence) sequences,COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) lifecycleAudits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='SupplementalMaterialRequest' AND entityId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) otherRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('0C384EC541F3864A89BB20B1650220B0');
`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__p05supplementalReadback', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05supplementalReadback('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05supplementalReadback('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('request', (request) => { if (request.method() !== 'GET' && new URL(request.url()).pathname !== '/api/auth/login') result.mutationRequests.push({ method: request.method(), path: new URL(request.url()).pathname }) })
try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thukho')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: requestCode }); await row.waitFor(); result.row = await row.innerText()
  await row.click(); await page.keyboard.press('Tab')
  await page.screenshot({ path: path.join(output, 'supplemental-partial-final.png'), fullPage: true })
} finally { await context.close(); await browser.close() }

const db = result.db.replaceAll('\r', '')
const passed = db.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions')
  && db.includes(`${requestCode}\tNEEDS_PURCHASE\t0.001000\t77436B29BB29D145803429901CD750D0\tANV\t2026-08-10\tAFTERNOON\tCá hố`)
  && db.includes('0.000800\t0.000800\t0.000000')
  && db.includes(`${purchaseRequestCode}\tDRAFT\t0.000200\t0.000000\t0.000200`) && /([A-F0-9]{32})\t\1\t77436B29BB29D145803429901CD750D0/.test(db)
  && db.includes('sequences\ttransitions\n0,2,3\t3') && db.includes('receipts\n3') && db.includes('outbox\n3') && db.includes('lifecycleAudits\n3') && db.includes('otherRequests\n0')
  && result.row.includes('0,0008 kg / 0,001 kg') && result.row.includes('Chờ thu mua') && result.row.includes(purchaseRequestCode) && result.row.includes('0,0002')
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && result.mutationRequests.length === 0
  && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS_WITH_CAPTURED_SEQUENCE_GAP' : 'FAIL'; result.sequenceDisposition = 'Historical attempt recorded sequence 2 before the corrected current-source sequence rule; no row was rewritten. Focused regression proves fresh create/fulfill emits 0,1.'; result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result); if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into supplemental readback evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
