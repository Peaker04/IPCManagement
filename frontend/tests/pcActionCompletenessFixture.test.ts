import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fixtureSource from './pcActionCompletenessFixture.ts?raw'
import operationalRegistrySource from './operationalStateActionRegistry.test.ts?raw'
import coordinationRegistrySource from '../src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts?raw'
import weeklyRegistrySource from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts?raw'
import demandModelSource from '../src/features/projects/weekly-menu/demand/demandModel.ts?raw'
import purchasingModelSource from '../src/features/purchasing/purchasingModel.ts?raw'
import controlSurfaceSource from './control-surface.spec.ts?raw'
import coordinationOrderTableSource from '../src/features/coordination/components/order-table.tsx?raw'
import { coordinationOrderScopeLifecycleRegistry } from '../src/features/coordination/coordinationOrderScopeLifecycleRegistry.test'
import { weeklyMenuLifecycleStateActionRegistry } from '../src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test'
import { resolveNextPurchasingAction, type PurchasingStageId } from '../src/features/purchasing/purchasingModel'
import { PC_VIEWPORTS } from './pcActionCompletenessContract'
import {
  assertPcProjectionMatchesCanonical,
  PC_CANONICAL_ACTOR_ROW_COUNT,
  PC_CANONICAL_AGGREGATE_IDENTITY_COUNT,
  PC_CANONICAL_COVERAGE,
  PC_CANONICAL_SCENARIO_COUNT,
  PC_CANONICAL_SCENARIO_OPERATION_COUNT,
} from './pcActionCompletenessCanonicalCoverage'
import {
  assertPcFirewallClosed,
  classifyPcMeasurement,
  createPcFixtureRuntime,
  getPcActionExpectation,
  handlePcApiRoute,
  PC_EXECUTABLE_FAMILIES,
  PC_FIXTURE_CONTRACT,
  PC_PROJECTED_REGISTRY_ROWS,
  PC_SOURCE_GUARD_DECLARATIONS,
  type PcFirewallRecord,
} from './pcActionCompletenessFixture'
import {
  assertUniquePcSourceFragments,
  assertPcSourceRangeProbes,
  findProductionPcImports,
} from './pcActionCompletenessSourceGuards'
import { UNKNOWN } from './stateActionRegistryContract'

const ruledOut = {
  navigation: { ruledOut: true, evidence: 'route and tab inspected' },
  viewport: { ruledOut: true, evidence: 'declared viewport rendered' },
  fixtureCondition: { ruledOut: true, evidence: 'scenario fixture installed' },
  roleState: { ruledOut: true, evidence: 'declared actor/state installed' },
} as const

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const controlSourceFragment = (row: typeof PC_PROJECTED_REGISTRY_ROWS[number]) => {
  if (row.family === 'ApprovalDocument') return "openDecisionModal(record, 'Approve')"
  if (row.family === 'WarehouseFulfilment') return 'onClick={openIssueDialog}'
  if (row.family === 'CoordinationOrderScopeLifecycle') {
    if (row.operation === 'update-forecast') return 'aria-label={`Suất dự kiến của ${order.customerName}`}'
    if (row.operation === 'request-adjustment') return 'aria-label={`Suất thực tế của ${order.customerName}`}'
    return typeof row.expectedControl?.name === 'string' ? row.expectedControl.name : row.operation
  }
  if (row.family === 'MaterialDemand') {
    if (row.operation === 'approval') return 'presentation.demandApprovalStatus.actionLabel'
    if (row.operation === 'purchasing') return 'Mở thu mua'
    return 'onClick={handleGenerate}'
  }
  if (row.family === 'PurchasingWorkflow') {
    const fragments: Record<string, string> = {
      'create-purchase-request': 'selectedDemand && setConfirmation',
      'confirm-supplier': "setConfirmation({ type: 'supplier' })",
      'submit-price-exception': 'purchase-price-exception',
      'open-purchase-approval': 'targetType=purchase-request',
      'create-purchase-orders': "setConfirmation({ type: 'create-orders'",
      'open-receiving': 'Mở màn hình nhập kho',
    }
    return fragments[row.operation]
  }
  if (row.family === 'WeeklyMenuLifecycle') {
    if (row.scenarioId === 'empty') return 'Nhập Excel'
    if (row.scenarioId === 'draft') return 'Publish'
    if (row.scenarioId === 'active-incomplete') return 'scheduleWorkflow.actions.completeQuickServing'
    if (row.scenarioId === 'active-not-generated') return 'onClick={handleGenerate}'
    return 'Mở thu mua'
  }
  return row.operation
}

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
  'frontend/tests/control-surface.spec.ts': controlSurfaceSource,
  'frontend/src/features/coordination/components/order-table.tsx': coordinationOrderTableSource,
}

const fakeRoute = (method: string, path: string, requestBody?: unknown) => {
  const fulfilled: Array<{ status?: number; body?: string }> = []
  return {
    route: {
      request: () => ({
        method: () => method,
        url: () => `http://127.0.0.1:5173${path}`,
        postDataJSON: () => requestBody,
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
    expect(PC_CANONICAL_COVERAGE).toHaveLength(PC_CANONICAL_SCENARIO_OPERATION_COUNT)
    expect(new Set(PC_CANONICAL_COVERAGE.map((row) => `${row.family}\0${row.scenarioId}`)).size).toBe(PC_CANONICAL_SCENARIO_COUNT)
    expect(() => assertPcProjectionMatchesCanonical(PC_PROJECTED_REGISTRY_ROWS)).not.toThrow()
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
    expect(identities).toHaveLength(PC_CANONICAL_AGGREGATE_IDENTITY_COUNT)
    expect(PC_CANONICAL_COVERAGE.reduce((count, row) => count + row.actors.length, 0)).toBe(PC_CANONICAL_ACTOR_ROW_COUNT)
  })

  it('fails when the projection deletes a row or silently narrows its actor set', () => {
    expect(() => assertPcProjectionMatchesCanonical(PC_PROJECTED_REGISTRY_ROWS.slice(1)))
      .toThrow('does not match canonical coverage')
    const narrowed = PC_PROJECTED_REGISTRY_ROWS.map((row, index) => (
      index === 0 ? { ...row, actors: [] } : row
    ))
    expect(() => assertPcProjectionMatchesCanonical(narrowed))
      .toThrow('actor set drifted')
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

  it('locks actor-aware Weekly expectations and button semantics for purchasing navigation actions', () => {
    const weekly = Object.fromEntries(PC_PROJECTED_REGISTRY_ROWS
      .filter((row) => row.family === 'WeeklyMenuLifecycle')
      .map((row) => [row.scenarioId, row]))
    expect(weekly.draft.expectedActors).toEqual(['admin'])
    expect(weekly['active-shortage'].expectedActors).toEqual(['admin', 'manager'])
    expect(weekly['active-incomplete'].expectedActors).toEqual(['admin', 'manager', 'coordinator'])

    const purchasingNavigationRows = PC_PROJECTED_REGISTRY_ROWS.filter((row) => (
      row.family === 'PurchasingWorkflow'
      && ['submitted', 'receiving'].includes(row.scenarioId)
    ))
    expect(purchasingNavigationRows.map((row) => row.expectedControl?.role)).toEqual([
      'button',
      'button',
    ])
  })

  it('uses canonical production role codes and gives every known rendered action an exercise contract', () => {
    const materialActors = PC_PROJECTED_REGISTRY_ROWS
      .filter((row) => row.family === 'MaterialDemand')
      .map((row) => row.registryActor)
    expect(materialActors.some((actors) => actors.includes('manager') || actors.includes('coordinator'))).toBe(false)
    expect(materialActors.some((actors) => actors.includes('quanly') || actors.includes('dieuphoi'))).toBe(true)

    const knownRenderedActions = PC_PROJECTED_REGISTRY_ROWS.filter((row) => (
      row.expectedControl !== null && row.operation !== UNKNOWN
    ))
    expect(knownRenderedActions.filter((row) => getPcActionExpectation(row) === null)).toEqual([])
    const weeklyDraft = PC_PROJECTED_REGISTRY_ROWS.find((row) => (
      row.family === 'WeeklyMenuLifecycle' && row.scenarioId === 'draft'
    ))
    expect(getPcActionExpectation(weeklyDraft!)).toMatchObject({
      kind: 'mutation',
      method: 'PATCH',
      path: '/api/coordination/menu-schedules/{id}/version',
      postAction: 'text=Đã chuyển version thực đơn sang ACTIVE.',
    })
    const weeklyIncomplete = PC_PROJECTED_REGISTRY_ROWS.find((row) => (
      row.family === 'WeeklyMenuLifecycle' && row.scenarioId === 'active-incomplete'
    ))
    expect(getPcActionExpectation(weeklyIncomplete!)).toMatchObject({
      kind: 'mutation',
      method: 'POST',
      path: '/api/coordination/meal-quantity-plans/quick-servings',
      postAction: 'text=Đã hoàn tất',
    })

    const coordinationFeedback = Object.fromEntries(PC_PROJECTED_REGISTRY_ROWS
      .filter((row) => row.family === 'CoordinationOrderScopeLifecycle' && row.expectedControl !== null)
      .map((row) => [row.operation, getPcActionExpectation(row)?.postAction]))
    expect(coordinationFeedback).toMatchObject({
      'lock-to-confirmed': 'text=Đã ghi nhận chốt đơn cả ngày',
      'signoff-to-completed': 'text=Đã hoàn tất ca',
      'unlock-to-draft': 'text=Đã mở khóa ca',
      export: 'text=Đã tải báo cáo điều phối',
    })
    const weeklyEmpty = PC_PROJECTED_REGISTRY_ROWS.find((row) => (
      row.family === 'WeeklyMenuLifecycle' && row.scenarioId === 'empty'
    ))
    expect(getPcActionExpectation(weeklyEmpty!)).toMatchObject({
      kind: 'open-surface',
      postAction: 'text=Nhập thực đơn từ Excel',
    })
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

  it('fulfills approval-route employee preload reads without opening the API firewall', async () => {
    const runtime = createPcFixtureRuntime()
    const roles = fakeRoute('GET', '/api/admin/employees/roles')
    const employees = fakeRoute('GET', '/api/admin/employees')

    await handlePcApiRoute(roles.route as never, runtime)
    await handlePcApiRoute(employees.route as never, runtime)

    expect(roles.fulfilled).toEqual([expect.objectContaining({ status: 200 })])
    expect(employees.fulfilled).toEqual([expect.objectContaining({ status: 200 })])
    expect(runtime.unmatchedApi).toEqual([])
    expect(() => assertPcFirewallClosed(runtime.requests)).not.toThrow()
  })

  it('projects complete quick-serving mutations into the next quantity-plan read', async () => {
    const weeklyIncomplete = PC_PROJECTED_REGISTRY_ROWS.find((row) => (
      row.family === 'WeeklyMenuLifecycle' && row.scenarioId === 'active-incomplete'
    ))
    const runtime = createPcFixtureRuntime(weeklyIncomplete, 'admin')
    const mutation = fakeRoute('POST', '/api/coordination/meal-quantity-plans/quick-servings', { complete: true })
    await handlePcApiRoute(mutation.route as never, runtime)
    expect(runtime.mutationState.quickServingsStatus).toBe('COMPLETED')

    const plans = fakeRoute('GET', '/api/coordination/meal-quantity-plans')
    await handlePcApiRoute(plans.route as never, runtime)
    const body = JSON.parse(plans.fulfilled[0].body ?? '{}') as { data?: Array<{ status?: string; lines?: Array<{ customerId?: string }> }> }
    expect(body.data?.[0]?.status).toBe('COMPLETED')
    expect(body.data?.[0]?.lines?.[0]?.customerId).toBe('customer-pc')
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

    expect(() => assertPcFirewallClosed([], [{
      method: 'POST',
      url: 'http://127.0.0.1:5173/api/material-demand/generate',
      resourceType: 'fetch',
    }])).toThrow('bypassed the route handler')
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
    expect(fixtureSource).toContain("page.route('**/*'")
    expect(fixtureSource).not.toContain('route.fallback(')
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

  it('guards every expected control source range with the control fragment it claims', () => {
    const probes = PC_PROJECTED_REGISTRY_ROWS
      .filter((row) => row.expectedControl !== null)
      .map((row) => {
        const descriptor = row.expectedControl!.source
        const sourcePath = descriptor.split(':')[0]
        return {
          descriptor,
          source: readFileSync(resolve(REPO_ROOT, sourcePath), 'utf8'),
          fragment: controlSourceFragment(row),
        }
      })
    expect(() => assertPcSourceRangeProbes(probes)).not.toThrow()

    expect(() => assertPcSourceRangeProbes([{
      descriptor: 'frontend/src/features/coordination/components/action-toolbar.tsx:1-5',
      source: readFileSync(resolve(REPO_ROOT, 'frontend/src/features/coordination/components/action-toolbar.tsx'), 'utf8'),
      fragment: 'Chốt đơn cả ngày',
    }])).toThrow('must contain exactly one guarded fragment')
  })

  it('reconciles canonical coverage one-to-one with executable registry/model sources', () => {
    const coordinationKeys = coordinationOrderScopeLifecycleRegistry.map((row) => `${row.scenarioId}\0${row.operation}`).sort()
    const canonicalCoordinationKeys = PC_CANONICAL_COVERAGE
      .filter((row) => row.family === 'CoordinationOrderScopeLifecycle')
      .map((row) => `${row.scenarioId}\0${row.operation}`).sort()
    expect(canonicalCoordinationKeys).toEqual(coordinationKeys)

    const weeklyKeys = weeklyMenuLifecycleStateActionRegistry.map((row) => `${row.scenarioId}\0${row.operation}`).sort()
    const canonicalWeeklyKeys = PC_CANONICAL_COVERAGE
      .filter((row) => row.family === 'WeeklyMenuLifecycle')
      .map((row) => `${row.scenarioId}\0${row.operation}`).sort()
    expect(canonicalWeeklyKeys).toEqual(weeklyKeys)

    const purchasingStages: PurchasingStageId[] = ['demand', 'supplier-price', 'exception', 'submitted', 'approved-order', 'receiving']
    const canonicalPurchasingKeys = PC_CANONICAL_COVERAGE
      .filter((row) => row.family === 'PurchasingWorkflow')
      .map((row) => `${row.scenarioId}\0${row.operation}`).sort()
    const stableOperationByStage: Record<PurchasingStageId, string> = {
      demand: 'create-purchase-request',
      'supplier-price': 'confirm-supplier',
      exception: 'submit-price-exception',
      submitted: 'open-purchase-approval',
      'approved-order': 'create-purchase-orders',
      receiving: 'open-receiving',
    }
    expect(canonicalPurchasingKeys).toEqual(purchasingStages.map((stage) => `${stage}\0${stableOperationByStage[stage]}`).sort())
    const modelPurchasingLabels = purchasingStages.map((currentStage) => {
      const presentation = resolveNextPurchasingAction({
        currentStage,
        approvedDemandCount: currentStage === 'demand' ? 1 : 0,
        shortageLineCount: currentStage === 'supplier-price' ? 1 : 0,
        supplierReadyLineCount: 0,
        blockingExceptionCount: currentStage === 'exception' ? 1 : 0,
        purchaseRequestStatus: currentStage === 'submitted' ? 'SUBMITTED' : null,
        orderCount: currentStage === 'approved-order' ? 0 : 1,
        receivingLineCount: currentStage === 'receiving' ? 1 : 0,
        fullyReceivedLineCount: 0,
      })
      return `${currentStage}\0${presentation.label ?? UNKNOWN}`
    }).sort()
    const projectedPurchasingLabels = PC_PROJECTED_REGISTRY_ROWS
      .filter((row) => row.family === 'PurchasingWorkflow')
      .map((row) => `${row.scenarioId}\0${String(row.expectedControl?.name)}`).sort()
    expect(projectedPurchasingLabels).toEqual(modelPurchasingLabels)
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
      'pcActionCompletenessCanonicalCoverage',
      'pc-action-completeness',
      'FE-fixture-read-only',
    ])).toEqual([])
  })
})
