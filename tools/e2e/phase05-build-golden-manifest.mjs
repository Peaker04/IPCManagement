import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle')
const golden = path.join(root, 'golden')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const query = (sql) => execFileSync(mysql, [
  '--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`,
], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const rows = (output) => output.split(/\r?\n/).slice(1).filter(Boolean).map((line) => line.split('\t'))
const sha256 = (content) => createHash('sha256').update(content).digest('hex').toUpperCase()

const evidence = [
  ['preflight', path.join(root, 'preflight/task1-manifest.json'), 'PASS'],
  ['stage1', path.join(golden, 'stage1/stage1.json'), 'PASS'],
  ['approveDemands', path.join(golden, 'approve-demands/result.json'), 'PASS'],
  ['createPurchaseRequests', path.join(golden, 'create-purchase-requests/result.json'), 'PASS'],
  ['approvePurchaseRequests', path.join(golden, 'approve-purchase-requests/result.json'), 'PASS'],
  ['supplierDecisions', path.join(golden, 'supplier-decisions/result.json'), 'PASS'],
  ['createPurchaseOrders', path.join(golden, 'create-purchase-orders/result.json'), 'PASS'],
  ['createReceipts', path.join(golden, 'create-receipts/result.json'), 'PASS'],
  ['receiptQuality', path.join(golden, 'receipt-quality/result.json'), 'PASS'],
  ['receiptApproval', path.join(golden, 'receipt-approve/result.json'), 'PASS'],
  ['receiptPosting', path.join(golden, 'receipt-post/result.json'), 'PASS'],
  ['createIssues', path.join(golden, 'create-issues/result.json'), 'PASS'],
  ['kitchenAcknowledgement', path.join(golden, 'kitchen-acknowledgement/result.json'), 'PASS'],
  ['chefChecklistUi', path.join(golden, 'chef-checklist-quick-fix/result.json'), 'PASS'],
  ['serviceRuns', path.join(golden, 'service-runs/result.json'), 'PASS'],
  ['viewports', path.join(golden, 'viewports/result.json'), 'PASS'],
]

const artifacts = {}
for (const [name, file, expectedVerdict] of evidence) {
  const content = await readFile(file)
  const parsed = JSON.parse(content)
  if (parsed.verdict !== expectedVerdict || parsed.lane !== 'ipc_lane7') throw new Error(`${name} is not an ipc_lane7 PASS`)
  const protectedAttempts = parsed.protectedLaneConnectionAttempts ?? parsed.databaseFence?.protectedLaneConnectionAttempts
  if (protectedAttempts !== 0) throw new Error(`${name} did not preserve the protected-lane fence`)
  artifacts[name] = { path: path.relative(process.cwd(), file).replaceAll('\\', '/'), sha256: sha256(content) }
}

const viewportEvidence = JSON.parse(await readFile(path.join(golden, 'viewports/result.json'), 'utf8'))
if (viewportEvidence.viewports.length !== 5 || !viewportEvidence.distinctTimeOrigins || viewportEvidence.viewports.some((item) => !item.pass || item.cls > 0.1)) {
  throw new Error('The canonical five-viewport gate is incomplete')
}

const serviceScopes = rows(query(`
  SELECT c.customerCode, COUNT(*) runCount, SUM(sr.closedAt IS NOT NULL) closedCount,
         COUNT(DISTINCT sr.serviceDate) dayCount, MIN(sr.actualServings), MAX(sr.actualServings),
         GROUP_CONCAT(DISTINCT sr.shiftName), GROUP_CONCAT(DISTINCT sr.priceTierAmount),
         GROUP_CONCAT(DISTINCT uo.username), GROUP_CONCAT(DISTINCT us.username),
         GROUP_CONCAT(DISTINCT ua.username), GROUP_CONCAT(DISTINCT uc.username),
         GROUP_CONCAT(DISTINCT ux.username)
  FROM serviceruns sr
  JOIN customers c ON c.customerId=sr.customerId
  LEFT JOIN users uo ON uo.userId=sr.openedBy
  LEFT JOIN users us ON us.userId=sr.startedBy
  LEFT JOIN users ua ON ua.userId=sr.actualServingsRecordedBy
  LEFT JOIN users uc ON uc.userId=sr.serviceConfirmedBy
  LEFT JOIN users ux ON ux.userId=sr.closedBy
  WHERE sr.serviceDate BETWEEN '2026-08-10' AND '2026-08-15'
  GROUP BY c.customerCode ORDER BY c.customerCode;
`)).map(([customerCode, runCount, closedCount, dayCount, minActual, maxActual, shifts, tiers, openedBy, startedBy, actualBy, confirmedBy, closedBy]) => ({
  customerCode, runCount: Number(runCount), closedCount: Number(closedCount), dayCount: Number(dayCount),
  minActualServings: Number(minActual), maxActualServings: Number(maxActual), shifts, tiers,
  actors: { openedBy, startedBy, actualRecordedBy: actualBy, serviceConfirmedBy: confirmedBy, closedBy },
}))

const transitionCommands = rows(query(`
  SELECT JSON_UNQUOTE(JSON_EXTRACT(payloadJson,'$.commandName')) commandName, COUNT(*)
  FROM lifecycletransitions WHERE aggregateType='ServiceRun'
  GROUP BY commandName ORDER BY commandName;
`)).map(([commandName, count]) => ({ commandName, count: Number(count) }))
const sequenceViolations = Number(rows(query(`
  SELECT COUNT(*) FROM (
    SELECT aggregateId FROM lifecycletransitions WHERE aggregateType='ServiceRun'
    GROUP BY aggregateId HAVING COUNT(*)<>5 OR MIN(aggregateSequence)<>1 OR MAX(aggregateSequence)<>5
  ) sequenceViolations;
`))[0][0])
const lifecycleCounts = {
  commandReceipts: Number(rows(query("SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='ServiceRun';"))[0][0]),
  transitions: Number(rows(query("SELECT COUNT(*) FROM lifecycletransitions WHERE aggregateType='ServiceRun';"))[0][0]),
  auditFacts: Number(rows(query("SELECT COUNT(*) FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='ServiceRun' AND fieldName='Transition';"))[0][0]),
  outboxMessages: Number(rows(query("SELECT COUNT(*) FROM lifecycleoutboxmessages WHERE aggregateType='ServiceRun';"))[0][0]),
  sequenceViolations,
  transitionCommands,
}

const purchaseOrders = rows(query(`
  SELECT DATE_FORMAT(po.proposedDeliveryDate,'%Y-%m-%d'), COUNT(DISTINCT c.customerCode),
         COUNT(DISTINCT mr.requestId), COUNT(*)
  FROM purchaseorders po
  JOIN purchaseorderlines pol ON pol.purchaseOrderId=po.purchaseOrderId
  JOIN purchaserequestlines prl ON prl.purchaseRequestLineId=pol.purchaseRequestLineId
  JOIN materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId
  JOIN materialrequests mr ON mr.requestId=mrl.requestId
  JOIN productionplans pp ON pp.planId=mr.planId
  JOIN customers c ON c.customerId=pp.customerId
  WHERE pp.planDate BETWEEN '2026-08-10' AND '2026-08-15'
  GROUP BY po.purchaseOrderId,po.proposedDeliveryDate ORDER BY po.proposedDeliveryDate;
`)).map(([deliveryDate, customerAllocations, demandAllocations, lineCount]) => ({
  deliveryDate, customerAllocations: Number(customerAllocations), demandAllocations: Number(demandAllocations), lineCount: Number(lineCount),
}))

const inventory = rows(query(`
  SELECT (SELECT COUNT(*) FROM inventoryissues),
         (SELECT COUNT(*) FROM inventoryissues WHERE receivedAt IS NOT NULL),
         (SELECT COUNT(*) FROM inventoryissuelines),
         (SELECT COUNT(*) FROM materialrequests WHERE status='EXPORTED'),
         (SELECT COUNT(*) FROM inventoryreceipts WHERE status='POSTED');
`))[0]
const migrationHead = rows(query("SELECT COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;"))[0]

const manifest = {
  formatVersion: 1,
  task: '05-04 Task 2',
  verdict: 'FAIL',
  lane: 'ipc_lane7',
  weekStartDate: '2026-08-10',
  databaseFence: { protectedLaneConnectionAttempts: 0 },
  artifacts,
  migration: { count: Number(migrationHead[0]), head: migrationHead[1], task1Receipt: artifacts.preflight },
  anv: serviceScopes.find((item) => item.customerCode === 'ANV'),
  dav: serviceScopes.find((item) => item.customerCode === 'DAV'),
  purchasing: {
    compatibleGrouping: 'ANV and DAV share one order per delivery date while retaining two customer and demand allocations',
    incompatibleDateSeparation: 'Six distinct delivery dates remain six independent orders',
    orders: purchaseOrders,
  },
  inventory: {
    issues: Number(inventory[0]), receivedIssues: Number(inventory[1]), issueLines: Number(inventory[2]),
    exportedDemands: Number(inventory[3]), postedReceipts: Number(inventory[4]),
  },
  lifecycle: lifecycleCounts,
  ui: {
    physicalInput: { pointerTrusted: true, keyboardTrusted: true, workaroundAccepted: false },
    canonicalViewports: viewportEvidence.viewports.map(({ width, height, cls, longTasks, timeOrigin, focus, horizontalOverflow }) => ({ width, height, cls, longTasks, timeOrigin, focus, horizontalOverflow })),
    distinctTimeOrigins: viewportEvidence.distinctTimeOrigins,
    screenshotsAreReviewerOnly: true,
  },
  runtime: {
    frontendUrl: 'http://127.0.0.1:3030', backendUrl: 'http://127.0.0.1:8030',
    disposition: 'Retained for the immediately following Task 3 exception matrix; teardown remains run-owned.',
  },
  generatedAtUtc: new Date().toISOString(),
}

const scopesPass = serviceScopes.length === 2 && serviceScopes.every((item) =>
  item.runCount === 6 && item.closedCount === 6 && item.dayCount === 6 &&
  item.minActualServings === 840 && item.maxActualServings === 840 && item.shifts === 'MORNING' && item.tiers === '25000.00' &&
  item.actors.openedBy === 'beptruong' && item.actors.startedBy === 'beptruong' &&
  item.actors.actualRecordedBy === 'beptruong' && item.actors.serviceConfirmedBy === 'beptruong' && item.actors.closedBy === 'quanly'
)
const commandsPass = transitionCommands.length === 5 && transitionCommands.every((item) => item.count === 12)
const purchasingPass = purchaseOrders.length === 6 && purchaseOrders.every((item) => item.customerAllocations === 2 && item.demandAllocations === 2)
const inventoryPass = manifest.inventory.issues === 12 && manifest.inventory.receivedIssues === 12 && manifest.inventory.issueLines === 584 && manifest.inventory.exportedDemands === 12 && manifest.inventory.postedReceipts === 6
const lifecyclePass = lifecycleCounts.commandReceipts === 60 && lifecycleCounts.transitions === 60 && lifecycleCounts.auditFacts === 60 && lifecycleCounts.outboxMessages === 60 && lifecycleCounts.sequenceViolations === 0 && commandsPass
const migrationPass = manifest.migration.count === 69 && manifest.migration.head === '20260812174836_AddInventoryAllocationDispositions'
manifest.verdict = scopesPass && purchasingPass && inventoryPass && lifecyclePass && migrationPass ? 'PASS' : 'FAIL'

await writeFile(path.join(golden, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest, null, 2))
if (manifest.verdict !== 'PASS') process.exitCode = 1
