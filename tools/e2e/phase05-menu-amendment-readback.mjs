import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/menu-amendment')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const query = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()
const result = {
  verdict: 'BLOCKED_BEFORE_CORRECTION',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  amendment: query("SELECT HEX(ma.menuAmendmentId) amendmentId,ma.status,mal.serviceDate,mal.shiftName,mal.dishSlot,HEX(mal.oldDishId) oldDishId,HEX(mal.newDishId) newDishId,HEX(rc.menuAmendmentReconciliationCaseId) caseId,rc.status caseStatus FROM menuamendments ma JOIN menuamendmentlines mal ON mal.menuAmendmentId=ma.menuAmendmentId JOIN menuamendmentreconciliationcases rc ON rc.menuAmendmentId=ma.menuAmendmentId;"),
  preservedGoldenCounts: query("SELECT (SELECT COUNT(*) FROM menuschedules) menuschedules,(SELECT COUNT(*) FROM menuitems) menuitems,(SELECT COUNT(*) FROM menuversions) menuversions,(SELECT COUNT(*) FROM materialrequests) materialrequests,(SELECT COUNT(*) FROM purchaserequests) purchaserequests,(SELECT COUNT(*) FROM purchaseorders) purchaseorders,(SELECT COUNT(*) FROM inventoryreceipts) receipts,(SELECT COUNT(*) FROM inventoryissues) issues;"),
  appendCounts: query("SELECT (SELECT COUNT(*) FROM menuamendments) amendments,(SELECT COUNT(*) FROM menuamendmentlines) amendmentLines,(SELECT COUNT(*) FROM menuamendmentreconciliationcases) reconciliationCases,(SELECT COUNT(*) FROM servicerundecisionitems) decisionItems,(SELECT COUNT(*) FROM auditlogs WHERE entityName='MenuAmendment') audits,(SELECT COUNT(*) FROM menuamendmentreconciliationcorrections) corrections;"),
  exactPersistedSlot: query("SELECT HEX(mi.DishId),d.DishName FROM menuschedules ms JOIN menuitems mi ON mi.MenuId=ms.MenuId JOIN dishes d ON d.DishId=mi.DishId WHERE ms.CustomerId=UNHEX('3E0FE4B1A5BD164CBE27EA7146E10D37') AND ms.ServiceDate='2026-08-10' AND ms.ShiftName='AFTERNOON' AND mi.DishSlot='savory-main';"),
  blocker: 'Create appended 120 decision items because the prior grouping used byte-array reference equality and omitted service date. Correction is forbidden because resolving one item would mark the whole case RESOLVED.',
  remediation: 'Production grouping now uses customer string + service date + shift + price tier and has a focused regression. Preserve the existing amendment; do not recreate, delete, or correct until an append-only remediation for the over-fanned decision set is planned.',
  finishedAtUtc: new Date().toISOString(),
}
await mkdir(output, { recursive: true })
const serialized = JSON.stringify(result)
if (serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed')
await writeFile(path.join(output, 'readback.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
