import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const phase = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence'
const evidence = JSON.parse(readFileSync(resolve(root, phase, 'secondary-route-dispositions.json'), 'utf8'))
const matrix = JSON.parse(readFileSync(resolve(root, phase, 'corrected-authorization-matrix.json'), 'utf8'))
const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')

const expected = [
  'reports-desktop', 'reports-mobile',
  'approvals-desktop', 'approvals-mobile',
  'admin-data-desktop', 'admin-data-mobile',
]

describe('Phase 27.1 secondary route reconciliation', () => {
  it('closes exactly the six authorized secondary identities', () => {
    expect(evidence.planId).toBe('27.1-05')
    expect(evidence.identitySet).toBe('secondary-reports-approvals-admin')
    expect(evidence.rows.map((row: { identity: string }) => row.identity).sort()).toEqual([...expected].sort())
  })

  it('accepts only exact stale-baseline paths with repeated packets and current hashes', () => {
    for (const row of evidence.rows) {
      const entry = matrix.entries.find((candidate: { snapshotName: string }) => candidate.snapshotName === `${row.identity}-expected.png`)
      expect(entry).toBeTruthy()
      expect(row.disposition).toBe('stale-baseline')
      expect(entry.permittedPaths['stale-baseline']).toEqual([row.owner])
      expect(row.beforeSha256[0]).toBe(row.beforeSha256[1])
      expect(row.afterSha256[0]).toBe(row.afterSha256[1])
      expect(row.newSnapshotSha256).toBe(row.beforeSha256[0])
      expect(row.newSnapshotSha256).toBe(row.afterSha256[0])
      expect(row.oldSnapshotSha256).not.toBe(row.newSnapshotSha256)
      expect(sha256(row.owner)).toBe(row.newSnapshotSha256)
    }
  })

  it('keeps Admin Data and Purchasing rollout locked with no production or harness changes', () => {
    expect(evidence.locks).toEqual({
      adminData: 'LOCKED',
      purchasingRollout: 'LOCKED',
      productionChanged: false,
      fixtureChanged: false,
      harnessChanged: false,
    })
    expect(evidence.gitReconciliation.waveBaseCommit).toBe(evidence.waveBaseCommit)
    expect(evidence.gitReconciliation.waveAuthorizedPaths.some((path: string) => path.startsWith('frontend/src/'))).toBe(false)
  })
})
