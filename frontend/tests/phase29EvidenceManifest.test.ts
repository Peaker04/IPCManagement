import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRunConfiguration, buildRunOutcome, performanceBudgetForRoute } from '../../tools/live-visual-audit-contract.mjs'

const root = resolve(import.meta.dirname, '../..')

describe('Measurement contract', () => {
  it('applies pathname budgets to query-string route samples', () => {
    expect(performanceBudgetForRoute('/warehouse?view=exceptions')).toMatchObject({ pathname: '/warehouse', cls: 0.1 })
    expect(performanceBudgetForRoute('/approvals?view=queue')).toMatchObject({ pathname: '/approvals', cls: 0.1 })
  })

  it('builds exact manifest configuration and distinguishes capture from assertion failure', () => {
    expect(buildRunConfiguration({
      assertPerformance: true,
      attributionEnabled: true,
      geometryEnabled: true,
      auditProfile: 'standard',
      routes: [{ name: 'warehouse-exceptions', path: '/warehouse?view=exceptions' }],
      viewports: [{ name: '1366x768', width: 1366, height: 768 }],
    })).toEqual({
      assertPerformance: true,
      attributionEnabled: true,
      geometryEnabled: true,
      auditProfile: 'standard',
      selectedRoutes: [{ name: 'warehouse-exceptions', path: '/warehouse?view=exceptions', pathname: '/warehouse' }],
      selectedViewports: [{ name: '1366x768', width: 1366, height: 768 }],
    })
    expect(buildRunOutcome({ assertPerformance: true, performanceThresholdFailures: [{ metric: 'cls' }] })).toEqual({
      captureStatus: 'completed',
      performanceAssertion: { enabled: true, verdict: 'failed' },
      status: 'failed',
    })
  })

  it('names every prohibited database authority independently', () => {
    const sql = readFileSync(resolve(root, 'tools/database/phase29-e2e-invariants.sql'), 'utf8')
    for (const name of ['purchaseRequests', 'purchaseOrders', 'receipts', 'issues', 'movements', 'lots', 'snapshots', 'currentStock']) {
      expect(sql).toContain(name)
    }
  })
})
