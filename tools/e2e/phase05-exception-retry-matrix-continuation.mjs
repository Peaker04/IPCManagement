import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/retry-matrix')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, mode: 'headed-authenticated-protocol-continuation', physicalEvidencePointer: 'physical-attempt.json', protocolRequests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
try {
  const physicalAttempt = JSON.parse(await readFile(path.join(output, 'physical-attempt.json'), 'utf8'))
  result.physicalEvidence = { pointerTrusted: physicalAttempt.physicalInput?.pointerTrusted === true, keyboardTrusted: physicalAttempt.physicalInput?.keyboardTrusted === true, physicalWinnerStatus: physicalAttempt.physicalWinner?.status, physicalWinnerVersion: physicalAttempt.physicalWinner?.concurrencyVersion }
  result.dbPreflight = mq(`
    SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
    SELECT requestCode,status FROM materialrequests WHERE requestCode LIKE 'MR-P05-RETRY-%' ORDER BY requestCode;
    SELECT currentQty FROM currentstock WHERE warehouseId=UNHEX('A0530000000000000000000000000001') AND ingredientId=UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    SELECT COUNT(*) cIssues FROM inventoryissues WHERE materialRequestId=UNHEX('A0540000000000000000000000000011');
    SELECT COUNT(*) durableIssues FROM inventoryissues WHERE materialRequestId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) movements FROM stockmovements;
    SELECT COUNT(*) dispositions FROM inventoryallocationdispositions;
    SELECT COUNT(*) closedRuns FROM serviceruns WHERE status='CLOSED';
  `)
  if (!result.dbPreflight.includes('ipc_lane7\t70\t20260813171032_AddMenuAmendmentDecisionFanRemediations') || !result.dbPreflight.includes('MR-P05-RETRY-C\tSENTTOWAREHOUSE') || !result.dbPreflight.includes('currentQty\r\n1.000000') || !result.dbPreflight.includes('cIssues\r\n0') || !result.dbPreflight.includes('durableIssues\r\n3') || !result.dbPreflight.includes('movements\r\n1669') || !result.dbPreflight.includes('dispositions\r\n1') || !result.dbPreflight.includes('closedRuns\r\n0')) throw new Error(`Retry continuation preflight drifted: ${result.dbPreflight}`)

  const attemptAReceipt = mq(`SELECT commandId,responseJson FROM lifecyclecommandreceipts WHERE aggregateType='InventoryIssue' AND aggregateId=UNHEX('A0530000000000000000000000000011');`).replaceAll('\r', '').split('\n').at(-1).split('\t')
  const attemptAResponse = JSON.parse(attemptAReceipt[1])
  const attemptAPayload = { commandId: attemptAReceipt[0], expectedVersion: 0, issueDate: '2026-08-15', shiftName: 'MORNING', warehouseId: '000053a0-0000-0000-0000-000000000001', materialRequestId: '000053a0-0000-0000-0000-000000000011', lines: [{ materialRequestLineId: '000053a0-0000-0000-0000-000000000012', ingredientId: '7204b865-f568-48ae-9108-b1a6043dfbc3', unitId: '3f45d270-9ede-4998-bd19-b38c55a2b31b', requestedQty: 1, issuedQty: 1 }] }
  const baseC = { issueDate: '2026-08-15', shiftName: 'MORNING', warehouseId: '000053a0-0000-0000-0000-000000000001', materialRequestId: '000054a0-0000-0000-0000-000000000011', expectedVersion: 0, lines: [{ materialRequestLineId: '000054a0-0000-0000-0000-000000000012', ingredientId: '7204b865-f568-48ae-9108-b1a6043dfbc3', unitId: '3f45d270-9ede-4998-bd19-b38c55a2b31b', requestedQty: 1, issuedQty: 1 }] }

  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  try {
    await page.goto('http://127.0.0.1:3036/login', { waitUntil: 'domcontentloaded' })
    await page.locator('#username').click(); await page.keyboard.type('thukho')
    await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
    await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
    await page.goto('http://127.0.0.1:3036/warehouse', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).waitFor()
    const token = await page.evaluate(() => sessionStorage.getItem('token'))
    if (!token) throw new Error('Authenticated browser session has no access token')
    const send = async (body) => {
      const response = await context.request.post('http://127.0.0.1:8036/api/inventory-issues', { headers: { Authorization: `Bearer ${token}` }, data: body })
      const safeBody = await response.json()
      const item = { status: response.status(), issueId: safeBody?.data?.issueId, issueCode: safeBody?.data?.issueCode, message: safeBody?.message }
      result.protocolRequests.push(item)
      return item
    }
    const replay = await send(attemptAPayload)
    const stale = await send({ ...attemptAPayload, commandId: `inventory-issue-stale-${crypto.randomUUID()}` })
    const [left, right] = await Promise.all([
      send({ ...baseC, commandId: `inventory-issue-concurrent-left-${crypto.randomUUID()}` }),
      send({ ...baseC, commandId: `inventory-issue-concurrent-right-${crypto.randomUUID()}` }),
    ])
    result.protocolMatrix = { replay: { status: replay.status, sameIssue: replay.issueId === attemptAResponse.IssueId }, stale: { status: stale.status }, concurrentStatuses: [left.status, right.status].sort(), concurrentIssueIds: [left.issueId, right.issueId].filter(Boolean) }
    result.reload = { pageReachable: await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).isVisible() }
    await page.screenshot({ path: path.join(output, 'retry-matrix-continuation.png'), fullPage: true })
  } finally { await context.close(); await browser.close() }

  result.dbPostflight = mq(`
    SELECT requestCode,status FROM materialrequests WHERE requestCode LIKE 'MR-P05-RETRY-%' ORDER BY requestCode;
    SELECT currentQty FROM currentstock WHERE warehouseId=UNHEX('A0530000000000000000000000000001') AND ingredientId=UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    SELECT COUNT(*) issues FROM inventoryissues WHERE materialRequestId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) issueLines FROM inventoryissuelines il JOIN inventoryissues i ON i.issueId=il.issueId WHERE i.materialRequestId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) issueMovements FROM stockmovements WHERE warehouseId=UNHEX('A0530000000000000000000000000001') AND movementType='ISSUE';
    SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryIssue' AND aggregateId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='InventoryIssue' AND aggregateId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) audits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='InventoryIssue' AND entityId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryIssue' AND aggregateId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'),UNHEX('A0540000000000000000000000000011'),UNHEX('A0550000000000000000000000000011'));
    SELECT COUNT(*) dispositions FROM inventoryallocationdispositions;
    SELECT COUNT(*) closedRuns FROM serviceruns WHERE status='CLOSED';
  `)
  const passed = result.physicalEvidence.pointerTrusted && result.physicalEvidence.keyboardTrusted && result.physicalEvidence.physicalWinnerStatus === 201 && result.physicalEvidence.physicalWinnerVersion === 1 && result.protocolMatrix.replay.status === 201 && result.protocolMatrix.replay.sameIssue && result.protocolMatrix.stale.status === 409 && JSON.stringify(result.protocolMatrix.concurrentStatuses) === JSON.stringify([201,409]) && result.protocolMatrix.concurrentIssueIds.length === 1 && ['A','B','C','D'].every((suffix) => result.dbPostflight.includes(`MR-P05-RETRY-${suffix}\tEXPORTED`)) && result.dbPostflight.includes('currentQty\r\n0.000000') && result.dbPostflight.includes('issues\r\n4') && result.dbPostflight.includes('issueLines\r\n4') && result.dbPostflight.includes('issueMovements\r\n4') && result.dbPostflight.includes('receipts\r\n4') && result.dbPostflight.includes('transitions\r\n4') && result.dbPostflight.includes('audits\r\n4') && result.dbPostflight.includes('outbox\r\n4') && result.dbPostflight.includes('dispositions\r\n1') && result.dbPostflight.includes('closedRuns\r\n0') && result.reload.pageReachable && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
  if (!passed) throw new Error(`Retry continuation gate failed: ${JSON.stringify(result, null, 2)}`)
  result.verdict = 'PASS'
  result.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || serialized.includes(process.env.IPC_LANE7_WAREHOUSE_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD)) throw new Error('Credential leaked into retry continuation evidence')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error); result.finishedAtUtc = new Date().toISOString()
  await writeFile(path.join(output, 'continuation-failure.json'), `${JSON.stringify(result, null, 2)}\n`)
  throw error
}
