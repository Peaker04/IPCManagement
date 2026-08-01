import type { PcActorId, PcFamily, PcProjectedRegistryRow } from './pcActionCompletenessFixture'
import { UNKNOWN } from './stateActionRegistryContract'

export type PcCanonicalCoverageRow = {
  family: PcFamily
  scenarioId: string
  operation: string
  actors: readonly PcActorId[]
}

const row = (
  family: PcFamily,
  scenarioId: string,
  operation: string,
  actors: readonly PcActorId[],
): PcCanonicalCoverageRow => ({ family, scenarioId, operation, actors })

const coordinationRows = [
  ...(['draft', 'forecasted'] as const).flatMap((scenarioId) => [
    row('CoordinationOrderScopeLifecycle', scenarioId, 'lock-to-confirmed', ['manager', 'coordinator']),
    row('CoordinationOrderScopeLifecycle', scenarioId, 'update-forecast', ['admin', 'manager', 'coordinator']),
  ]),
  ...(['confirmed', 'adjusted'] as const).flatMap((scenarioId) => [
    row('CoordinationOrderScopeLifecycle', scenarioId, 'signoff-to-completed', ['manager', 'coordinator']),
    row('CoordinationOrderScopeLifecycle', scenarioId, 'unlock-to-draft', ['manager']),
    row('CoordinationOrderScopeLifecycle', scenarioId, 'request-adjustment', ['admin', 'manager', 'coordinator']),
  ]),
  ...(['draft', 'forecasted', 'confirmed', 'adjusted', 'completed', 'archived', 'cancelled', 'mixed-confirmed-completed', 'empty', 'loading-draft'] as const)
    .map((scenarioId) => row(
      'CoordinationOrderScopeLifecycle',
      scenarioId,
      'export',
      ['confirmed', 'adjusted'].includes(scenarioId)
        ? ['manager', 'coordinator']
        : ['admin', 'manager', 'coordinator'],
    )),
]

export const PC_CANONICAL_COVERAGE: readonly PcCanonicalCoverageRow[] = [
  row('ApprovalDocument', 'actionable-record', UNKNOWN, ['admin']),
  ...coordinationRows,
  row('MaterialDemand', 'not-created', 'generate', ['admin', 'manager', 'coordinator']),
  row('MaterialDemand', 'pending', 'approval', ['admin', 'manager']),
  row('MaterialDemand', 'approved', 'purchasing', ['admin', 'manager']),
  row('MaterialDemand', 'rejected', 'generate', ['admin', 'manager', 'coordinator']),
  row('MaterialDemand', 'cancelled', 'generate', ['admin', 'manager', 'coordinator']),
  row('MaterialDemand', 'terminal', 'none', ['admin', 'manager', 'coordinator']),
  row('PurchasingWorkflow', 'demand', 'create-purchase-request', ['admin', 'manager', 'procurement']),
  row('PurchasingWorkflow', 'supplier-price', 'confirm-supplier', ['admin', 'manager', 'procurement']),
  row('PurchasingWorkflow', 'exception', 'submit-price-exception', ['admin', 'manager', 'procurement']),
  row('PurchasingWorkflow', 'submitted', 'open-purchase-approval', ['admin', 'manager', 'procurement']),
  row('PurchasingWorkflow', 'approved-order', 'create-purchase-orders', ['admin', 'manager', 'procurement']),
  row('PurchasingWorkflow', 'receiving', 'open-receiving', ['admin', 'manager', 'procurement']),
  row('WarehouseFulfilment', 'eligible-demand', UNKNOWN, ['admin', 'warehouse']),
  row('WeeklyMenuLifecycle', 'empty', 'POST /api/coordination/weekly-menu/import/commit', ['admin', 'manager', 'coordinator']),
  row('WeeklyMenuLifecycle', 'draft', 'PATCH /api/coordination/menu-schedules/{id}/version với status ACTIVE', ['admin', 'manager', 'coordinator']),
  row('WeeklyMenuLifecycle', 'active-incomplete', 'POST /api/coordination/meal-quantity-plans/quick-servings với complete=true', ['admin', 'manager', 'coordinator']),
  row('WeeklyMenuLifecycle', 'active-not-generated', 'POST /api/material-demand/generate', ['admin', 'manager', 'coordinator']),
  row('WeeklyMenuLifecycle', 'active-loading', UNKNOWN, ['coordinator']),
  row('WeeklyMenuLifecycle', 'active-error', UNKNOWN, ['coordinator']),
  row('WeeklyMenuLifecycle', 'active-shortage', 'Điều hướng tới /purchasing theo ngày/tuần đang chọn', ['admin', 'manager', 'coordinator']),
  row('WeeklyMenuLifecycle', 'active-no-shortage', UNKNOWN, ['coordinator']),
  row('WeeklyMenuLifecycle', 'inconsistent', UNKNOWN, ['coordinator']),
  row('WeeklyMenuLifecycle', 'superseded', UNKNOWN, ['coordinator']),
]

export const PC_CANONICAL_SCENARIO_COUNT = 34
export const PC_CANONICAL_SCENARIO_OPERATION_COUNT = 44
export const PC_CANONICAL_ACTOR_ROW_COUNT = 107
export const PC_CANONICAL_AGGREGATE_IDENTITY_COUNT = 535

const coverageKey = (item: Pick<PcCanonicalCoverageRow, 'family' | 'scenarioId' | 'operation'>) => (
  `${item.family}\0${item.scenarioId}\0${item.operation}`
)

const sorted = (values: readonly string[]) => [...values].sort((left, right) => left.localeCompare(right))

export const assertPcProjectionMatchesCanonical = (projection: readonly PcProjectedRegistryRow[]) => {
  if (PC_CANONICAL_COVERAGE.length !== PC_CANONICAL_SCENARIO_OPERATION_COUNT) {
    throw new Error('Canonical PC coverage row count drifted')
  }
  const canonicalByKey = new Map(PC_CANONICAL_COVERAGE.map((item) => [coverageKey(item), item]))
  const projectedByKey = new Map(projection.map((item) => [coverageKey(item), item]))
  if (canonicalByKey.size !== PC_CANONICAL_COVERAGE.length || projectedByKey.size !== projection.length) {
    throw new Error('Duplicate canonical or projected PC coverage row')
  }
  const missing = [...canonicalByKey.keys()].filter((key) => !projectedByKey.has(key))
  const extra = [...projectedByKey.keys()].filter((key) => !canonicalByKey.has(key))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`PC projection does not match canonical coverage; missing=${missing.join(',')}; extra=${extra.join(',')}`)
  }
  canonicalByKey.forEach((canonical, key) => {
    const projected = projectedByKey.get(key)!
    if (JSON.stringify(sorted(projected.actors)) !== JSON.stringify(sorted(canonical.actors))) {
      throw new Error(`PC projection actor set drifted for ${key}`)
    }
  })
  const actorRows = PC_CANONICAL_COVERAGE.reduce((count, item) => count + item.actors.length, 0)
  if (actorRows !== PC_CANONICAL_ACTOR_ROW_COUNT) {
    throw new Error(`Canonical PC actor row count is ${actorRows}, expected ${PC_CANONICAL_ACTOR_ROW_COUNT}`)
  }
}
