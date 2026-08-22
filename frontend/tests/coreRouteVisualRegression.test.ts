import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const evidencePath = resolve(root, '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/core-route-dispositions.json')
const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')

type Row = {
  identity: string
  displayOrdinal: number
  disposition: string
  owner: string
  beforeSha256: [string, string]
  afterSha256: [string, string]
  oldSnapshotSha256: string
  newSnapshotSha256: string
}

describe('Phase 27.1 core Login/Dashboard reconciliation', () => {
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as { identitySet: string; rows: Row[] }

  it('closes the exact three identities through their stale-baseline snapshot paths', () => {
    expect(evidence.identitySet).toBe('core-login-dashboard')
    expect(evidence.rows.map(row => row.identity).sort()).toEqual([
      'dashboard-desktop',
      'dashboard-mobile',
      'login-mobile',
    ])
    for (const row of evidence.rows) {
      expect(row.disposition).toBe('stale-baseline')
      expect(row.owner).toMatch(new RegExp(`frontend/tests/visual-routes\\.spec\\.ts-snapshots/${row.identity}-chromium-win32\\.png$`))
      expect(row.beforeSha256[0]).toBe(row.beforeSha256[1])
      expect(row.afterSha256[0]).toBe(row.afterSha256[1])
      expect(row.oldSnapshotSha256).not.toBe(row.newSnapshotSha256)
      expect(sha256(row.owner)).toBe(row.newSnapshotSha256)
    }
  })

  it('treats display ordinals as presentation metadata only', () => {
    const reordered = [...evidence.rows].sort((a, b) => b.displayOrdinal - a.displayOrdinal)
    expect(new Set(reordered.map(row => row.identity))).toEqual(new Set(evidence.rows.map(row => row.identity)))
  })
})
