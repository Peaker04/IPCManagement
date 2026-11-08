import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const phase = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence'
const evidence = JSON.parse(readFileSync(resolve(root, phase, 'purchasing-phase09-dispositions.json'), 'utf8'))
const matrix = JSON.parse(readFileSync(resolve(root, phase, 'corrected-authorization-matrix.json'), 'utf8'))
const visualSpec = readFileSync(resolve(root, 'frontend/tests/visual-routes.spec.ts'), 'utf8')
const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')

const identities = [
  'purchasing-phase09-1365x900', 'purchasing-phase09-1280x900',
  'purchasing-phase09-768x1024', 'purchasing-phase09-390x844',
]

describe('Phase 27.1 Purchasing Phase-09 reconciliation', () => {
  it('closes the exact four unchanged viewports through one identity set', () => {
    expect(evidence.identitySet).toBe('purchasing-phase09')
    expect(evidence.rows.map((row: { identity: string }) => row.identity).sort()).toEqual([...identities].sort())
    for (const viewport of ['1365x900', '1280x900', '768x1024', '390x844']) {
      expect(visualSpec).toContain(`name: '${viewport}'`)
    }
  })

  it('binds every stale baseline to its exact matrix path, packets, and current hash', () => {
    for (const row of evidence.rows) {
      const entry = matrix.entries.find((candidate: { snapshotName: string }) => candidate.snapshotName === `${row.identity}-expected.png`)
      expect(row.disposition).toBe('stale-baseline')
      expect(entry.permittedPaths['stale-baseline']).toEqual([row.owner])
      expect(row.beforeSha256).toEqual([row.newSnapshotSha256, row.newSnapshotSha256])
      expect(row.afterSha256).toEqual([row.newSnapshotSha256, row.newSnapshotSha256])
      expect(row.oldSnapshotSha256).not.toBe(row.newSnapshotSha256)
      expect(sha256(row.owner)).toBe(row.newSnapshotSha256)
      expect(row.geometry.documentHorizontalOverflow).toBe(false)
    }
  })

  it('preserves the Purchasing research lock and comparison contract', () => {
    expect(evidence.locks).toEqual({
      purchasingRollout: 'LOCKED', productionChanged: false, fixtureChanged: false,
      harnessChanged: false, thresholdsChanged: false, viewportsChanged: false,
    })
    expect(evidence.gitReconciliation.waveAuthorizedPaths.some((path: string) => path.startsWith('frontend/src/'))).toBe(false)
    expect(visualSpec).toContain("await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`)")
  })
})
