import { describe, expect, it } from 'vitest'
import fixtureSource from './pcActionCompletenessFixture.ts?raw'
import operationalRegistrySource from './operationalStateActionRegistry.test.ts?raw'
import coordinationRegistrySource from '../src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts?raw'
import weeklyRegistrySource from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts?raw'
import demandModelSource from '../src/features/projects/weekly-menu/demand/demandModel.ts?raw'
import purchasingModelSource from '../src/features/purchasing/purchasingModel.ts?raw'
import { PC_VIEWPORTS } from './pcActionCompletenessContract'
import {
  assertPcFirewallClosed,
  classifyPcMeasurement,
  createPcFixtureRuntime,
  handlePcApiRoute,
  PC_EXECUTABLE_FAMILIES,
  PC_FIXTURE_CONTRACT,
  PC_PROJECTED_REGISTRY_ROWS,
  PC_SOURCE_GUARD_DECLARATIONS,
  type PcFirewallRecord,
} from './pcActionCompletenessFixture'
import {
  assertUniquePcSourceFragments,
  findProductionPcImports,
} from './pcActionCompletenessSourceGuards'
import { UNKNOWN } from './stateActionRegistryContract'

const ruledOut = {
  navigation: { ruledOut: true, evidence: 'route and tab inspected' },
  viewport: { ruledOut: true, evidence: 'declared viewport rendered' },
  fixtureCondition: { ruledOut: true, evidence: 'scenario fixture installed' },
  roleState: { ruledOut: true, evidence: 'declared actor/state installed' },
} as const

const unresolvedNavigation = {
  ...ruledOut,
  navigation: { ruledOut: false, evidence: 'downstream route is denied for this actor' },
} as const

const rawSources: Record<string, string> = {
  'frontend/tests/operationalStateActionRegistry.test.ts': operationalRegistrySource,
  'frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts': coordinationRegistrySource,
  'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts': weeklyRegistrySource,
  'frontend/src/features/projects/weekly-menu/demand/demandModel.ts': demandModelSource,
  'frontend/src/features/purchasing/purchasingModel.ts': purchasingModelSource,
}

const fakeRoute = (method: string, path: string) => {
  const fulfilled: Array<{ status?: number; body?: string }> = []
  return {
    route: {
      request: () => ({
        method: () => method,
        url: () => `http://127.0.0.1:5173${path}`,
      }),
      fulfill: async (response: { status?: number; body?: string }) => {
        fulfilled.push(response)
      },
    },
    fulfilled,
  }
}

describe('PC aggregate read-only fixture', () => {
  it('locks the six executable families, 34 scenarios and 44 canonical scenario×operation rows', () => {
    expect(PC_EXECUTABLE_FAMILIES).toEqual([
      'ApprovalDocument',
      'CoordinationOrderScopeLifecycle',
      'MaterialDemand',
      'PurchasingWorkflow',
      'WarehouseFulfilment',
      'WeeklyMenuLifecycle',
    ])

    const familyCounts = Object.fromEntries(PC_EXECUTABLE_FAMILIES.map((family) => [
      family,
      PC_PROJECTED_REGISTRY_ROWS.filter((row) => row.family === family).length,
    ]))
    expect(familyCounts).toEqual({
      ApprovalDocument: 1,
      CoordinationOrderScopeLifecycle: 20,
      MaterialDemand: 6,
      PurchasingWorkflow: 6,
      WarehouseFulfilment: 1,
      WeeklyMenuLifecycle: 10,
    })
    expect(PC_PROJECTED_REGISTRY_ROWS).toHaveLength(44)
    expect(new Set(PC_PROJECTED_REGISTRY_ROWS.map((row) => `${row.family}\0${row.scenarioId}`)).size).toBe(34)
    expect(new Set(PC_PROJECTED_REGISTRY_ROWS.map((row) => `${row.family}\0${row.scenarioId}\0${row.operation}`)).size).toBe(44)
  })

  it('expands every declared row across every relevant actor and the exact five imported viewports', () => {
    expect(PC_FIXTURE_CONTRACT.viewports).toBe(PC_VIEWPORTS)
    expect(PC_VIEWPORTS.map(({ id }) => id)).toEqual([
      '1920x1080',
      '1440x900',
      '1366x768',
      '1365x900',
      '1280x900',
    ])

    const identities = PC_PROJECTED_REGISTRY_ROWS.flatMap((row) => row.actors.flatMap((actor) => (
      PC_VIEWPORTS.map((viewport) => `${row.family}\0${row.scenarioId}\0${actor}\0${viewport.id}\0${row.operation}`)
    )))
    expect(new Set(identities).size).toBe(identities.length)
    expect(identities.length).toBeGreaterThan(44 * PC_VIEWPORTS.length)
  })

  it('preserves Approval and Warehouse UNKNOWN dimensions instead of inventing a canonical action', () => {
    const unresolvedFamilies = ['ApprovalDocument', 'WarehouseFulfilment']
    for (const family of unresolvedFamilies) {
      const row = PC_PROJECTED_REGISTRY_ROWS.find((candidate) => candidate.family === family)
      expect(row).toMatchObject({
        operation: UNKNOWN,
        registryActor: UNKNOWN,
        backendPermission: UNKNOWN,
        frontendPermission: UNKNOWN,
      })
      expect(classifyPcMeasurement({
        expected: true,
        actualCount: 1,
        exclusions: ruledOut,
        unknownDimensions: ['operation', 'actor', 'backendPermission', 'frontendPermission'],
      })).toBe('CHƯA-KẾT-LUẬN-ĐƯỢC')
    }
  })

  it('classifies all six outcomes and never turns an unresolved exclusion into THIẾU', () => {
    expect(classifyPcMeasurement({ expected: true, actualCount: 1, exclusions: ruledOut })).toBe('KHỚP')
    expect(classifyPcMeasurement({ expected: true, actualCount: 0, exclusions: ruledOut })).toBe('THIẾU')
    expect(classifyPcMeasurement({ expected: false, actualCount: 1, exclusions: ruledOut })).toBe('MỒ CÔI')
    expect(classifyPcMeasurement({ expected: true, actualCount: 1, exclusions: ruledOut, requestExpected: true })).toBe('IM LẶNG')
    expect(classifyPcMeasurement({ expected: true, actualCount: 1, exclusions: ruledOut, routeMismatch: true })).toBe('LỆCH VỊ TRÍ')
    expect(classifyPcMeasurement({ expected: true, actualCount: 0, exclusions: unresolvedNavigation })).toBe('CHƯA-KẾT-LUẬN-ĐƯỢC')
    expect(classifyPcMeasurement({ expected: true, actualCount: 1, exclusions: ruledOut, unknownDimensions: ['actor'] })).not.toBe('KHỚP')
  })

  it('fulfills business mutations in memory and records unmatched API reads as deterministic 501', async () => {
    const runtime = createPcFixtureRuntime()
    const mutation = fakeRoute('POST', '/api/material-demand/generate')
    await handlePcApiRoute(mutation.route as never, runtime)
    expect(mutation.fulfilled).toEqual([expect.objectContaining({ status: 200 })])
    expect(runtime.mutations).toEqual([expect.objectContaining({
      method: 'POST',
      path: '/api/material-demand/generate',
      intercepted: true,
      mutation: true,
    })])

    const unmatched = fakeRoute('GET', '/api/not-declared-by-pc-fixture')
    await handlePcApiRoute(unmatched.route as never, runtime)
    expect(unmatched.fulfilled).toEqual([expect.objectContaining({ status: 501 })])
    expect(runtime.unmatchedApi).toEqual([expect.objectContaining({
      path: '/api/not-declared-by-pc-fixture',
      status: 501,
    })])
    expect(() => assertPcFirewallClosed(runtime.requests)).not.toThrow()
  })

  it('fails the negative escape probe when interception is removed', () => {
    const escaped: PcFirewallRecord = {
      method: 'POST',
      path: '/api/material-demand/generate',
      status: 0,
      intercepted: false,
      mutation: true,
      scenario: 'negative-probe',
    }
    expect(() => assertPcFirewallClosed([escaped])).toThrow('PC request escaped interception')
  })

  it('uses one API catch-all with no API fallback and declares read-only FE fixture semantics', () => {
    expect(PC_FIXTURE_CONTRACT).toMatchObject({
      readOnly: true,
      evidenceKind: 'FE-fixture-read-only',
      backendDbE2e: false,
      apiPattern: '**/api/**',
      unmatchedStatus: 501,
      mutationMode: 'in-memory-fulfill-only',
    })
    expect(fixtureSource).toContain("page.route(/^https?:\\/\\/[^/]+\\/api\\//")
    expect(fixtureSource).not.toContain('route.fallback(')
    expect(fixtureSource).not.toContain('route.continue(')
    expect(fixtureSource).not.toContain('localhost:5')
  })

  it('fails on source drift for every projected canonical seam', () => {
    const guards = PC_SOURCE_GUARD_DECLARATIONS.map((declaration) => ({
      ...declaration,
      source: rawSources[declaration.sourcePath],
    }))
    expect(guards.every((guard) => typeof guard.source === 'string')).toBe(true)
    expect(() => assertUniquePcSourceFragments(guards)).not.toThrow()

    expect(() => assertUniquePcSourceFragments([{
      sourcePath: 'stale-projection.ts',
      source: operationalRegistrySource,
      fragments: ['__missing_pc_projection_fragment__'],
    }])).toThrow('must contain exactly one PC source fragment')
  })

  it('keeps fixture, aggregate spec and evidence vocabulary out of production imports', () => {
    const productionSources = import.meta.glob([
      '../src/*.ts',
      '../src/*.tsx',
      '../src/**/*.ts',
      '../src/**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    expect(findProductionPcImports(productionSources, [
      'pcActionCompletenessFixture',
      'pc-action-completeness',
      'FE-fixture-read-only',
    ])).toEqual([])
  })
})
