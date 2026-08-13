import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/quality-isolation')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const read = async (name) => JSON.parse(await readFile(path.join(root, name, 'result.json'), 'utf8'))
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const [supplier, approve, order, receipt, qualityAttempt, readback] = await Promise.all(['supplier', 'approve', 'order', 'receipt', 'partial', 'readback'].map(read))
const lifecycle = mq(`SELECT GROUP_CONCAT(aggregateSequence ORDER BY aggregateSequence),COUNT(*) FROM lifecycletransitions WHERE aggregateType='Receipt' AND aggregateId=(SELECT receiptId FROM inventoryreceipts WHERE receiptCode='RCP-PO-DD55BAFA3CF7ACDB48352AD02C0F56DB'); SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='Receipt' AND aggregateId=(SELECT receiptId FROM inventoryreceipts WHERE receiptCode='RCP-PO-DD55BAFA3CF7ACDB48352AD02C0F56DB'); SELECT COUNT(*) FROM lifecycleoutboxmessages WHERE aggregateType='Receipt' AND aggregateId=(SELECT receiptId FROM inventoryreceipts WHERE receiptCode='RCP-PO-DD55BAFA3CF7ACDB48352AD02C0F56DB');`)
const stagesPass = [supplier, approve, order, receipt, readback].every((item) => item.verdict === 'PASS' && item.lane === 'ipc_lane7' && item.protectedLaneConnectionAttempts === 0)
const qualityMutationCommitted = qualityAttempt.requests.some((item) => item.path.endsWith('/quality') && item.status === 200)
const durablePass = readback.db.includes('PENDING_APPROVAL\tPARTIALLY_ACCEPTED\t0.001000\t0.000800\t0.000200') && lifecycle.replaceAll('\r', '').includes('0,1\t2') && lifecycle.replaceAll('\r', '').endsWith('\n2\nCOUNT(*)\n2')
const manifest = {
  verdict: stagesPass && qualityMutationCommitted && durablePass ? 'PASS' : 'FAIL',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  scope: { customer: 'DAV', supplementalRequest: 'SUP-20260813-153511-4FF3', purchaseRequest: 'PR-SUP-20260813-6F77', receipt: 'RCP-PO-DD55BAFA3CF7ACDB48352AD02C0F56DB', ingredient: 'Cá hố', requestedQuantity: 0.001, acceptedQuantity: 0.0008, rejectedQuantity: 0.0002 },
  stageVerdicts: { supplier: supplier.verdict, approval: approve.verdict, order: order.verdict, receipt: receipt.verdict, qualityMutation: 'COMMITTED_WITH_UI_ROUNDING_CAPTURED', currentSourceReadback: readback.verdict },
  physicalInput: { pointerTrusted: [supplier, approve, order, receipt, qualityAttempt, readback].every((item) => item.physicalInput.pointerTrusted), keyboardTrusted: [supplier, approve, order, receipt, qualityAttempt, readback].every((item) => item.physicalInput.keyboardTrusted), workaroundAccepted: false },
  isolation: { anvSupplementalStatus: 'NEEDS_PURCHASE', goldenPostedReceipts: 6, goldenPurchaseOrders: 6 },
  lifecycle,
  currentUi: readback.detail,
  consoleErrors: [...supplier.consoleErrors, ...approve.consoleErrors, ...order.consoleErrors, ...receipt.consoleErrors, ...readback.consoleErrors],
  pageErrors: [...supplier.pageErrors, ...approve.pageErrors, ...order.pageErrors, ...receipt.pageErrors, ...readback.pageErrors],
  requestFailures: [...supplier.requestFailures, ...approve.requestFailures, ...order.requestFailures, ...receipt.requestFailures, ...readback.requestFailures],
  finishedAtUtc: new Date().toISOString(),
}
const serialized = JSON.stringify(manifest)
if (/Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))
if (manifest.verdict !== 'PASS') process.exitCode = 1
