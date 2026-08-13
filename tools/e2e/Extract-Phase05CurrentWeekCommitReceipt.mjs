import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/current-week-import')
const source = JSON.parse(await readFile(path.join(root, 'current-week-import.json'), 'utf8'))
const batch = source.api.find(item => item.path === '/api/coordination/weekly-menu/import/commit-batch')
if (batch?.status !== 200 || batch.body?.success !== true || !Array.isArray(batch.body?.data) || batch.body.data.length !== 2) {
  throw new Error('A successful two-customer atomic batch response was not found.')
}
const results = batch.body.data.map(result => ({
  customerCode: result.customerCode,
  weekStartDate: result.weekStartDate,
  weekEndDate: result.weekEndDate,
  menuVersionNo: result.menuVersionNo,
  menuVersionStatus: result.menuVersionStatus,
  rowsImported: result.detectedLayout?.rowsImported,
  menusCreated: result.counts?.menusCreated,
  menuItemsCreated: result.counts?.menuItemsCreated,
  menuSchedulesCreated: result.counts?.menuSchedulesCreated,
  validationErrorCount: result.validation?.errorCount,
  sourceFileName: result.fileName,
}))
if (!results.every(result => result.weekStartDate === '2026-08-10' && result.rowsImported === 120 && result.validationErrorCount === 0)) {
  throw new Error('Atomic batch results do not match the approved current-week contract.')
}
await writeFile(path.join(root, 'current-week-commit-receipt.json'), `${JSON.stringify({
  status: 'PASS',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  method: batch.method,
  path: batch.path,
  httpStatus: batch.status,
  message: batch.body.message,
  results,
  extractedAtUtc: new Date().toISOString(),
  sourceArtifact: 'current-week-import.json',
}, null, 2)}\n`)
