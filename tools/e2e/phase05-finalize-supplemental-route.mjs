import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const requestCode = 'SUP-20260813-151359-5984'
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/supplemental-partial')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, requestCode, requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPreflight = mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT requestCode,status,requestedQty,HEX(issueLineId) FROM supplementalmaterialrequests WHERE requestCode='${requestCode}';
SELECT GROUP_CONCAT(aggregateSequence ORDER BY aggregateSequence) sequences FROM lifecycletransitions WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT quantityOut,beforeQty,afterQty FROM stockmovements WHERE refTable='supplementalmaterialrequests' AND refId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) purchaseLinks FROM auditlogs WHERE entityName='SupplementalMaterialRequest' AND entityId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}') AND fieldName='PurchaseRequestId';
SELECT COUNT(*) otherRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('0C384EC541F3864A89BB20B1650220B0');
`)
const pre = result.dbPreflight.replaceAll('\r', '')
if (!pre.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') || !pre.includes(`${requestCode}\tPARTIALLY_FULFILLED\t0.001000\t77436B29BB29D145803429901CD750D0`) || !pre.includes('sequences\n0,2') || !pre.includes('0.000800\t0.000800\t0.000000') || !pre.includes('purchaseLinks\n0') || !pre.includes('otherRequests\n0')) throw new Error(`Supplemental route preflight drifted: ${result.dbPreflight}`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__p05supplementalRoute', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05supplementalRoute('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05supplementalRoute('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('response', (response) => { const request = response.request(); const pathname = new URL(response.url()).pathname; if (request.method() !== 'GET' && pathname.startsWith('/api/')) result.requests.push({ method: request.method(), path: pathname, status: response.status() }) })
try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thukho')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: requestCode }); await row.waitFor(); result.rowBefore = await row.innerText()
  const route = row.getByRole('button', { name: 'Chuyển thu mua', exact: true }); result.routeEnabled = await route.isEnabled()
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/route-to-purchasing'))
  await route.click(); const response = await responsePromise; result.routeResponse = { status: response.status(), body: await response.json() }
  if (response.status() !== 200) throw new Error(`Supplemental route ${response.status()}: ${JSON.stringify(result.routeResponse.body)}`)
  await page.getByText('Đã chuyển sang thu mua', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const reloaded = page.getByRole('row').filter({ hasText: requestCode }); await reloaded.waitFor(); result.rowAfter = await reloaded.innerText()
  await page.screenshot({ path: path.join(output, 'supplemental-routed-reload.png'), fullPage: true })
} finally { await context.close(); await browser.close() }

result.dbPostflight = mq(`
SELECT smr.requestCode,smr.status,pr.purchaseRequestCode,prl.requiredQty,prl.currentStockQty,prl.purchaseQty,HEX(smr.issueLineId),HEX(prl.materialRequestLineId)
FROM supplementalmaterialrequests smr JOIN auditlogs a ON a.entityId=smr.requestId AND a.fieldName='PurchaseRequestId'
JOIN purchaserequests pr ON LOWER(CONCAT(SUBSTR(HEX(pr.purchaseRequestId),1,8),'-',SUBSTR(HEX(pr.purchaseRequestId),9,4),'-',SUBSTR(HEX(pr.purchaseRequestId),13,4),'-',SUBSTR(HEX(pr.purchaseRequestId),17,4),'-',SUBSTR(HEX(pr.purchaseRequestId),21)))=a.newValue
JOIN purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId WHERE smr.requestCode='${requestCode}';
SELECT GROUP_CONCAT(aggregateSequence ORDER BY aggregateSequence) sequences FROM lifecycletransitions WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) lifecycleAudits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='SupplementalMaterialRequest' AND entityId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) otherRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('0C384EC541F3864A89BB20B1650220B0');
`)
const post = result.dbPostflight.replaceAll('\r', '')
const passed = post.includes(`${requestCode}\tNEEDS_PURCHASE\tPR-SUP-`) && post.includes('\t0.000200\t0.000000\t0.000200\t77436B29BB29D145803429901CD750D0\t')
  && post.includes('sequences\n0,2,3') && post.includes('receipts\n3') && post.includes('outbox\n3') && post.includes('lifecycleAudits\n3') && post.includes('otherRequests\n0')
  && result.routeEnabled && result.routeResponse.body?.data?.remainingQty === 0.0002 && result.routeResponse.body?.data?.concurrencyVersion === 4
  && result.rowBefore.includes('0,0008 kg / 0,001 kg') && result.rowBefore.includes('0,0002') && result.rowAfter.includes('Đang chờ mua')
  && result.requests.some((item) => item.path.endsWith('/route-to-purchasing') && item.status === 200) && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted
  && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'; result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result); if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into supplemental route evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
