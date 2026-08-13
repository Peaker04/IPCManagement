import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/return-receipt')
const goldenPath = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/manifest.json')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()
const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', stage: 'return-receipt', protectedLaneConnectionAttempts: 0,
  goldenManifestSha256: null, scope: {}, requests: [], consoleErrors: [], pageErrors: [], requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
}

await mkdir(output, { recursive: true })
const goldenContent = await readFile(goldenPath)
const golden = JSON.parse(goldenContent)
result.goldenManifestSha256 = createHash('sha256').update(goldenContent).digest('hex').toUpperCase()
if (golden.verdict !== 'PASS' || golden.lane !== 'ipc_lane7' || golden.databaseFence?.protectedLaneConnectionAttempts !== 0) {
  throw new Error('Golden manifest no longer authorizes exception work')
}

result.dbPreflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT ir.returnCode,c.customerCode,ir.returnDate,ppl.shiftName,i.ingredientName,irl.quantity,
         ir.receivedAt IS NULL pending,HEX(irl.sourceIssueLineId),HEX(ir.returnId),HEX(irl.returnLineId),HEX(ir.warehouseId),HEX(irl.ingredientId),HEX(irl.unitId)
  FROM inventoryreturns ir
  JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId
  JOIN inventoryissues ii ON ii.issueId=ir.issueId
  JOIN inventoryissuelines iil ON iil.issueLineId=irl.sourceIssueLineId
  JOIN materialrequestlines mrl ON mrl.requestLineId=iil.materialRequestLineId
  JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId
  JOIN customers c ON c.customerId=ppl.customerId
  JOIN ingredients i ON i.ingredientId=irl.ingredientId
  WHERE ir.returnCode='RET-20260813-204346-E40A';
  SELECT COUNT(*) FROM stockmovements WHERE movementType='RETURN' AND refTable='inventoryreturns'
    AND refId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='InventoryReturn'
    AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
`)
const lines = result.dbPreflight.replaceAll('\r', '').split('\n')
if (lines[0] !== 'DATABASE()\tCOUNT(*)\tMAX(migrationId)' || lines[1] !== 'ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') {
  throw new Error(`Lane or migration preflight drifted: ${result.dbPreflight}`)
}
const row = lines.find((line) => line.startsWith('RET-20260813-204346-E40A\t'))?.split('\t')
if (!row || row[1] !== 'DAV' || row[2] !== '2026-08-10' || row[3] !== 'AFTERNOON' || row[4] !== 'Cá hố' || row[5] !== '0.001000' || row[6] !== '1') {
  throw new Error(`Pending RETURN lineage drifted: ${result.dbPreflight}`)
}
if (lines.at(-4) !== 'COUNT(*)' || lines.at(-3) !== '0' || lines.at(-2) !== 'COUNT(*)' || lines.at(-1) !== '0') {
  throw new Error(`RETURN already has durable receipt facts: ${result.dbPreflight}`)
}
result.scope = { returnCode: row[0], customerCode: row[1], returnDate: row[2], shiftName: row[3], ingredientName: row[4], declaredQuantity: Number(row[5]), actualReceivedQuantity: 0.0008 }

let browser
let context
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05return', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05return('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05return('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', async (response) => {
    const request = response.request(); const pathname = new URL(response.url()).pathname
    if (request.method() !== 'GET' && pathname.startsWith('/api/')) {
      const body = request.postDataJSON?.() ?? null
      result.requests.push({ method: request.method(), path: pathname, status: response.status(), body: body ? { hasDiscrepancy: body.hasDiscrepancy, expectedVersion: body.expectedVersion, adjustedLines: body.adjustedLines } : null })
    }
  })

  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thukho')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const returnRow = page.getByRole('row').filter({ hasText: 'RET-20260813-204346-E40A' })
  await returnRow.waitFor()
  await returnRow.getByRole('button', { name: 'Tiếp nhận', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tiếp nhận nguyên liệu trả' })
  await dialog.getByText('Cá hố', { exact: true }).waitFor()
  const quantity = dialog.getByLabel('Số thực nhận (kg)')
  await quantity.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('0.0008')
  await dialog.getByLabel('Có chênh lệch so với bếp khai báo').click()
  await dialog.getByLabel('Mô tả chênh lệch').click(); await page.keyboard.type('Thực nhận 0,0008 kg còn đạt yêu cầu')
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/inventory-returns\/[^/]+\/confirm-receipt$/.test(new URL(response.url()).pathname))
  await dialog.getByRole('button', { name: 'Xác nhận tiếp nhận', exact: true }).click()
  const response = await responsePromise
  if (response.status() !== 200) throw new Error(`RETURN receipt failed with ${response.status()}`)
  await page.getByText('Đã nhập lại nguyên liệu trả', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  if (await page.getByText('RET-20260813-204346-E40A', { exact: true }).count()) throw new Error('Received RETURN remained in pending list after reload')
  await page.screenshot({ path: path.join(output, 'return-received-reload.png'), fullPage: true })
} catch (error) {
  result.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
}

result.dbPostflight = mq(`
  SELECT ir.returnCode,ir.receivedAt IS NOT NULL received,ux.username,irl.quantity,HEX(irl.sourceIssueLineId)
  FROM inventoryreturns ir JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId LEFT JOIN users ux ON ux.userId=ir.receivedBy
  WHERE ir.returnCode='RET-20260813-204346-E40A';
  SELECT movementType,quantityIn,quantityOut,reason FROM stockmovements WHERE movementType='RETURN' AND refTable='inventoryreturns'
    AND refId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*),MIN(aggregateSequence),MAX(aggregateSequence),MIN(fromState),MAX(toState) FROM lifecycletransitions WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A');
  SELECT COUNT(*) audits FROM auditlogs WHERE entityId=(SELECT returnId FROM inventoryreturns WHERE returnCode='RET-20260813-204346-E40A') AND businessArea IN ('StorekeeperReturnReceipt','Lifecycle');
`)
const expectedSource = row[7]
const post = result.dbPostflight.replaceAll('\r', '')
const request = result.requests.find((item) => item.path.endsWith('/confirm-receipt'))
const passed = !result.failure && request?.status === 200 && request.body?.expectedVersion === 0 && request.body?.adjustedLines?.[0]?.newQuantity === 0.0008
  && post.includes(`RET-20260813-204346-E40A\t1\tthukho\t0.000800\t${expectedSource}`)
  && post.includes('RETURN\t0.000800\t0.000000') && post.includes('receipts\n1')
  && post.includes('COUNT(*)\tMIN(aggregateSequence)\tMAX(aggregateSequence)\tMIN(fromState)\tMAX(toState)\n1\t1\t1\tPENDING_RECEIPT\tRECEIVED')
  && post.includes('outbox\n1') && post.includes('audits\n2')
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || (process.env.IPC_LANE7_WAREHOUSE_PASSWORD && serialized.includes(process.env.IPC_LANE7_WAREHOUSE_PASSWORD))) throw new Error('Credential leaked into RETURN evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (result.verdict !== 'PASS') process.exitCode = 1
