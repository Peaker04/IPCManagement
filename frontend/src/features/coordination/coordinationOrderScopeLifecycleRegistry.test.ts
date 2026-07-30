import { describe, expect, it } from 'vitest'
import { deriveCoordinationStatus } from './coordinationStatus'
import actionToolbarSource from './components/action-toolbar.tsx?raw'
import {
  coordinationOrderScopeLifecycleScenarios,
  type CoordinationScenario,
} from '../../../tests/coordinationOrderScopeLifecycleFixture'
import {
  assertStateActionRegistryRows,
  CORRESPONDENCE_VALUES,
  registryRowKey,
  UNKNOWN,
  type Correspondence,
  type RegistryRow,
} from '../../../tests/stateActionRegistryContract'

type CoordinationOrderScopeLifecycleRow = RegistryRow & {
  object: 'CoordinationOrderScopeLifecycle'
}

type OperationEvidence = {
  operation: string
  actor: string
  backendPermission: string
  frontendPermission: string
  source: readonly [string, string, string, string]
  correspondence: Correspondence
}

const PROJECTION_SOURCE = (
  'projection:frontend/src/features/coordination/coordinationStatus.ts:14-103'
)
const CONTROLLER_POLICY_SOURCE = (
  'backend-permission:backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15 CoordinationAccess'
)

const scenarioById = (scenarioId: string): CoordinationScenario => {
  const scenario = coordinationOrderScopeLifecycleScenarios.find((candidate) => (
    candidate.scenarioId === scenarioId
  ))
  if (!scenario) {
    throw new Error(`Missing Coordination scenario: ${scenarioId}`)
  }
  return scenario
}

const entityStateLabel = (scenario: CoordinationScenario) => JSON.stringify(scenario.entityState)
const scopeLabel = (scenario: CoordinationScenario) => `${scenario.scope.kind}:${scenario.scope.value}`

const row = (
  scenarioId: string,
  evidence: OperationEvidence,
): CoordinationOrderScopeLifecycleRow => {
  const scenario = scenarioById(scenarioId)
  const projection = deriveCoordinationStatus(
    scenario.entityState,
    scenario.queryState === 'loading',
  )

  return {
    object: 'CoordinationOrderScopeLifecycle',
    scenarioId,
    operation: evidence.operation,
    scope: scopeLabel(scenario),
    entityState: entityStateLabel(scenario),
    projectionState: projection.status,
    actor: evidence.actor,
    backendPermission: evidence.backendPermission,
    frontendPermission: evidence.frontendPermission,
    source: evidence.source,
    correspondence: evidence.correspondence,
  }
}

const lockEvidence: OperationEvidence = {
  operation: 'lock-to-confirmed',
  actor: 'quanly|dieuphoi',
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'canLock + ActionGuard[quanly,dieuphoi]',
  source: [
    PROJECTION_SOURCE,
    'frontend:frontend/src/features/coordination/components/action-toolbar.tsx:141,378 canLock + ActionGuard[quanly,dieuphoi]',
    CONTROLLER_POLICY_SOURCE,
    'backend-precondition:backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs:89 CanTransition(status, Confirmed)',
  ],
  correspondence: 'FE-CHẶT-HƠN',
}

const forecastEvidence: OperationEvidence = {
  operation: 'update-forecast',
  actor: UNKNOWN,
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'canEditForecast',
  source: [
    PROJECTION_SOURCE,
    `frontend:${UNKNOWN} — coordinationStatus.ts proves eligibility but the reviewed ActionToolbar source contains no forecast actor gate`,
    CONTROLLER_POLICY_SOURCE,
    'backend-precondition:backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:166 CanEditForecast(status)',
  ],
  correspondence: 'CHỈ-CÓ-Ở-BE',
}

const signoffEvidence: OperationEvidence = {
  operation: 'signoff-to-completed',
  actor: 'quanly|dieuphoi',
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'canSignoff + ActionGuard[quanly,dieuphoi]',
  source: [
    PROJECTION_SOURCE,
    'frontend:frontend/src/features/coordination/components/action-toolbar.tsx:142,391 canSignoff + ActionGuard[quanly,dieuphoi]',
    CONTROLLER_POLICY_SOURCE,
    'backend-precondition:backend/src/IPCManagement.Api/Features/Coordination/Services/OrderSignoffService.cs:140-157 CanTransition(status, Completed)',
  ],
  correspondence: 'FE-CHẶT-HƠN',
}

const unlockEvidence: OperationEvidence = {
  operation: 'unlock-to-draft',
  actor: 'quanly',
  backendPermission: 'CoordinationAccess + CatalogAccess',
  frontendPermission: 'canUnlock + ActionGuard[quanly]',
  source: [
    PROJECTION_SOURCE,
    'frontend:frontend/src/features/coordination/components/action-toolbar.tsx:143,404 canUnlock + ActionGuard[quanly]',
    'backend-permission:backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15,101 CoordinationAccess + CatalogAccess',
    'backend-precondition:backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs:246-264 Confirmed|Adjusted -> Draft',
  ],
  correspondence: 'FE-CHẶT-HƠN',
}

const adjustmentEvidence: OperationEvidence = {
  operation: 'request-adjustment',
  actor: UNKNOWN,
  backendPermission: 'CoordinationAccess',
  frontendPermission: 'canRequestAdjustment',
  source: [
    PROJECTION_SOURCE,
    `frontend:${UNKNOWN} — coordinationStatus.ts proves eligibility but the reviewed ActionToolbar source contains no adjustment actor gate`,
    CONTROLLER_POLICY_SOURCE,
    'backend-precondition:backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:62 IsLocked(status)',
  ],
  correspondence: 'CHỈ-CÓ-Ở-BE',
}

const exportEvidence = (frontendAvailable: boolean): OperationEvidence => ({
  operation: 'export',
  actor: frontendAvailable ? 'quanly|dieuphoi' : UNKNOWN,
  backendPermission: 'CoordinationAccess',
  frontendPermission: frontendAvailable
    ? 'canExport + ActionGuard[quanly,dieuphoi]'
    : UNKNOWN,
  source: [
    PROJECTION_SOURCE,
    frontendAvailable
      ? 'frontend:frontend/src/features/coordination/components/action-toolbar.tsx:144,417 canExport + ActionGuard[quanly,dieuphoi]'
      : `frontend:${UNKNOWN} — action-toolbar.tsx:141-144 makes canExport false outside confirmed/adjusted actionable scopes`,
    CONTROLLER_POLICY_SOURCE,
    `backend-precondition:${UNKNOWN} — OrderPlanService.cs:322-341 exposes report scope normalization without an entity-status precondition`,
  ],
  correspondence: frontendAvailable ? 'FE-CHẶT-HƠN' : 'CHỈ-CÓ-Ở-BE',
})

const rowsForEditableScenarios = ['draft', 'forecasted'].flatMap((scenarioId) => [
  row(scenarioId, lockEvidence),
  row(scenarioId, forecastEvidence),
])

const rowsForLockedScenarios = ['confirmed', 'adjusted'].flatMap((scenarioId) => [
  row(scenarioId, signoffEvidence),
  row(scenarioId, unlockEvidence),
  row(scenarioId, adjustmentEvidence),
])

const exportRows = coordinationOrderScopeLifecycleScenarios.map((scenario) => row(
  scenario.scenarioId,
  exportEvidence(scenario.projectionState.status === 'CONFIRMED' || scenario.projectionState.status === 'ADJUSTED'),
))

export const coordinationOrderScopeLifecycleRegistry: readonly CoordinationOrderScopeLifecycleRow[] = [
  ...rowsForEditableScenarios,
  ...rowsForLockedScenarios,
  ...exportRows,
]

const EVIDENCE_LAYERS = [
  'projection:',
  'frontend:',
  'backend-permission:',
  'backend-precondition:',
] as const

describe('CoordinationOrderScopeLifecycle registry', () => {
  it('enforces exact object, scenario×operation grain, scope, and shared row schema', () => {
    expect(() => assertStateActionRegistryRows(coordinationOrderScopeLifecycleRegistry)).not.toThrow()
    expect(coordinationOrderScopeLifecycleRegistry).toHaveLength(20)
    expect(coordinationOrderScopeLifecycleRegistry.every((item) => (
      item.object === 'CoordinationOrderScopeLifecycle' && item.scope === 'shift:2026-07-27|MORNING'
    ))).toBe(true)

    const keys = coordinationOrderScopeLifecycleRegistry.map(registryRowKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(coordinationOrderScopeLifecycleRegistry.some((item) => 'operations' in item)).toBe(false)
  })

  it('projects state from imported code without collapsing raw entity evidence', () => {
    for (const item of coordinationOrderScopeLifecycleRegistry) {
      const scenario = scenarioById(item.scenarioId)
      const expectedProjection = deriveCoordinationStatus(
        scenario.entityState,
        scenario.queryState === 'loading',
      )

      expect(item.entityState).toBe(JSON.stringify(scenario.entityState))
      expect(item.projectionState).toBe(expectedProjection.status)
    }

    const mixed = coordinationOrderScopeLifecycleRegistry.find((item) => (
      item.scenarioId === 'mixed-confirmed-completed'
    ))
    expect(mixed?.entityState).toBe('["CONFIRMED","COMPLETED"]')
    expect(mixed?.projectionState).toBe('MIXED')
  })

  it('requires four separately labelled evidence layers for every operation row', () => {
    for (const item of coordinationOrderScopeLifecycleRegistry) {
      expect(item.operation).not.toBe(UNKNOWN)
      expect(item.source).toHaveLength(EVIDENCE_LAYERS.length)
      EVIDENCE_LAYERS.forEach((layer, index) => {
        expect(item.source[index].startsWith(layer)).toBe(true)
      })
    }
  })

  it('uses only the canonical unknown marker and preserves FE/BE mismatch reports', () => {
    const evidenceFields = coordinationOrderScopeLifecycleRegistry.flatMap((item) => [
      item.operation,
      item.actor,
      item.backendPermission,
      item.frontendPermission,
    ])
    const unknownValues = evidenceFields.filter((value) => value.includes('KHÔNG-XÁC-ĐỊNH'))

    expect(unknownValues.length).toBeGreaterThan(0)
    expect(unknownValues.every((value) => value === UNKNOWN)).toBe(true)
    expect(coordinationOrderScopeLifecycleRegistry.every((item) => (
      CORRESPONDENCE_VALUES.includes(item.correspondence)
    ))).toBe(true)
    expect(coordinationOrderScopeLifecycleRegistry.some((item) => (
      item.correspondence === 'CHỈ-CÓ-Ở-BE'
    ))).toBe(true)
  })

  it('records controller class policy and method-level unlock policy separately', () => {
    const unlockRows = coordinationOrderScopeLifecycleRegistry.filter((item) => (
      item.operation === 'unlock-to-draft'
    ))
    const otherRows = coordinationOrderScopeLifecycleRegistry.filter((item) => (
      item.operation !== 'unlock-to-draft'
    ))

    expect(unlockRows.map((item) => item.backendPermission))
      .toEqual(['CoordinationAccess + CatalogAccess', 'CoordinationAccess + CatalogAccess'])
    expect(otherRows.every((item) => item.backendPermission === 'CoordinationAccess')).toBe(true)
  })

  it('fails visibly when toolbar eligibility or role evidence drifts', () => {
    const expectedFragments = [
      "const canLock = hasActionableData && !isConfirmed && !isTerminal && !isMixed && !isSyncing",
      "const canSignoff = hasActionableData && isConfirmed && !isTerminal && !isMixed && !isSyncing",
      'const canUnlock = canSignoff',
      'const canExport = canSignoff',
      "{canLock && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>",
      "{canSignoff && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>",
      "{canUnlock && <ActionGuard allowedRoles={['quanly']}>",
      "{canExport && <ActionGuard allowedRoles={['quanly', 'dieuphoi']}>",
    ]

    expectedFragments.forEach((fragment) => expect(actionToolbarSource).toContain(fragment))
  })

  it('keeps the fixture and registry outside production imports', () => {
    const productionSources = import.meta.glob([
      '../../*.ts',
      '../../*.tsx',
      '../../**/*.ts',
      '../../**/*.tsx',
    ], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>

    const forbiddenImports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.'))
      .filter(([, source]) => (
        source.includes('coordinationOrderScopeLifecycleRegistry')
        || source.includes('coordinationOrderScopeLifecycleFixture')
      ))

    expect(forbiddenImports).toEqual([])
  })
})
