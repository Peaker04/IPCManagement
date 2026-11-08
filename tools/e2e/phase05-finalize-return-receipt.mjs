import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/return-receipt')
const goldenPath = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/manifest.json')
const runtimeLogPath = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/manual-runtime-logs/api-reload.stdout.log')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()

await mkdir(output, { recursive: true })
const goldenContent = await readFile(goldenPath)
const runtimeLog = await readFile(runtimeLogPath, 'utf8')
const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0,
  goldenManifestSha256: createHash('sha256').update(goldenContent).digest('hex').toUpperCase(),
  scope: { returnCode: 'RET-20260813-204346-E40A', customerCode: 'DAV', serviceDate: '2026-08-10', shiftName: 'AFTERNOON', ingredientName: 'Cá hố', declaredQuantity: 0.001, actualReceivedQuantity: 0.0008 },
  mutation: { actor: 'thukho', method: 'POST', status: 200, requestBody: { expectedVersion: 0, hasDiscrepancy: true, adjustedQuantity: 0.0008 } },
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
  consoleErrors: [], pageErrors: [], requestFailures: [],
  limitation: 'The headed keyboard harness entered only the first ASCII character of the Vietnamese discrepancy note. Durable quantity and discrepancy facts are valid, but the stored note is T and is not claimed as a complete sentence.',
}
const golden = JSON.parse(goldenContent)
if (golden.verdict !== 'PASS' || golden.lane !== 'ipc_lane7' || golden.databaseFence?.protectedLaneConnectionAttempts !== 0) throw new Error('Golden manifest drifted')

result.dbPostflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT ir.returnCode,c.customerCode,ppl.shiftName,ir.receivedAt IS NOT NULL received,ux.username,irl.quantity,HEX(irl.sourceIssueLineId)
  FROM inventoryreturns ir JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId JOIN inventoryissuelines iil ON iil.issueLineId=irl.sourceIssueLineId
  JOIN materialrequestlines mrl ON mrl.requestLineId=iil.materialRequestLineId JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId
  JOIN customers c ON c.customerId=ppl.customerId LEFT JOIN users ux ON ux.userId=ir.receivedBy WHERE ir.returnCode='RET-20260813-204346-E40A';
  SELECT movementType,quantityIn,quantityOut FROM stockmovements WHERE movementType='RETURN' AND refTable='inventoryreturns' AND refId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT commandId FROM lifecyclecommandreceipts WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT aggregateSequence,fromState,toState,expectedVersion FROM lifecycletransitions WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) audits FROM auditlogs WHERE entityId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A') AND businessArea IN ('StorekeeperReturnReceipt','Lifecycle');
`)
const post = result.dbPostflight.replaceAll('\r', '')
const commandId = /commandId\n([^\n]+)/.exec(post)?.[1]
result.mutation.commandId = commandId
result.mutation.requestEvidenceSource = path.relative(process.cwd(), runtimeLogPath).replaceAll('\\', '/')
result.mutation.responseLogMatch = runtimeLog.includes('HTTP POST /api/inventory-returns/c731ab10-4919-4bea-8402-870e94b0a387/confirm-receipt responded 200')

let browser; let context
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05final', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05final('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05final('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thukho')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const search = page.getByLabel('Tìm phiếu trả, ngày hoặc lý do')
  await search.click(); await page.keyboard.type('RET-20260813-204346-E40A')
  await page.waitForTimeout(700)
  result.reload = { pendingRowCount: await page.getByText('RET-20260813-204346-E40A', { exact: true }).count(), emptyMessageVisible: await page.getByText('Không có phiếu trả hoặc hao hụt đang chờ kho.', { exact: true }).isVisible() }
  await page.screenshot({ path: path.join(output, 'return-received-final.png'), fullPage: true })
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
}

const passed = post.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions')
  && post.includes('RET-20260813-204346-E40A\tDAV\tAFTERNOON\t1\tthukho\t0.000800\t0C384EC541F3864A89BB20B1650220B0')
  && post.includes('RETURN\t0.000800\t0.000000') && Boolean(commandId)
  && post.includes('1\tPENDING_RECEIPT\tRECEIVED\t0') && post.includes('outbox\n1') && post.includes('audits\n3')
  && result.mutation.responseLogMatch && result.reload?.pendingRowCount === 0 && result.reload?.emptyMessageVisible
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into RETURN evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (!passed) process.exitCode = 1
