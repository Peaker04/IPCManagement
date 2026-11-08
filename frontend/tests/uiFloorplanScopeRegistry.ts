import { ROUTES } from '../src/lib/routeConfig'
import { protectedOperationalFamilies } from '../src/routes/protectedOperationalFamilyRegistry.test'

export type UiFloorplanOperationMode = 'PUBLIC' | 'DEFAULT' | 'MATERIAL_RECONCILIATION'
export type UiFloorplanSurfaceKind = 'route' | 'task-group' | 'view' | 'subview' | 'task'

export type UiFloorplanScopeEntry = {
  routeKey: keyof typeof ROUTES
  routePath: string
  operationMode: UiFloorplanOperationMode
  surfaceKind: UiFloorplanSurfaceKind
  surfaceId: string
  parentSurfaceId: string | null
  roleStateId: string
  dataStateId: string
}

export type UiFloorplanScopeKey = string & { readonly __uiFloorplanScopeKey: unique symbol }

export const buildUiFloorplanScopeKey = (entry: UiFloorplanScopeEntry): UiFloorplanScopeKey => JSON.stringify([
  entry.routeKey,
  entry.routePath,
  entry.operationMode,
  entry.surfaceKind,
  entry.surfaceId,
  entry.parentSurfaceId,
  entry.roleStateId,
  entry.dataStateId,
]) as UiFloorplanScopeKey

const protectedByRoute = new Map(protectedOperationalFamilies.map((entry) => [entry.routeKey, entry]))

const routeModes: Readonly<Record<keyof typeof ROUTES, readonly UiFloorplanOperationMode[]>> = {
  LOGIN: ['PUBLIC'],
  FORBIDDEN: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
  DASHBOARD: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
  WEEKLY_MENU: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
  MEAL_ORDERS: ['DEFAULT'],
  APPROVALS: ['DEFAULT'],
  PURCHASING: ['DEFAULT'],
  WAREHOUSE: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
  CHEF_DASHBOARD: ['DEFAULT'],
  REPORTS: ['DEFAULT'],
  ADMIN_DATA: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
  RECONCILIATION: ['MATERIAL_RECONCILIATION'],
  APPROVAL_RULES: ['DEFAULT'],
  ADVANCED_SETTINGS: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
}

const routeEntry = (routeKey: keyof typeof ROUTES, operationMode: UiFloorplanOperationMode): UiFloorplanScopeEntry => {
  const authority = protectedByRoute.get(routeKey)
  return {
    routeKey,
    routePath: ROUTES[routeKey],
    operationMode,
    surfaceKind: 'route',
    surfaceId: `route-${routeKey.toLowerCase().replaceAll('_', '-')}`,
    parentSurfaceId: null,
    roleStateId: routeKey === 'LOGIN'
      ? 'role-source:public-login'
      : `role-source:${authority?.roleSource.kind}:${authority?.roleSource.source}`,
    dataStateId: routeKey === 'LOGIN'
      ? 'data-source:login-page-state'
      : `data-source:${authority?.stateSource.kind}:${authority?.stateSource.source}`,
  }
}

type SurfaceDefinition = {
  routeKey: keyof typeof ROUTES
  operationMode: Exclude<UiFloorplanOperationMode, 'PUBLIC'>
  surfaceKind: Exclude<UiFloorplanSurfaceKind, 'route'>
  surfaceId: string
  parentSurfaceId?: string
}

const define = (
  routeKey: SurfaceDefinition['routeKey'],
  operationMode: SurfaceDefinition['operationMode'],
  surfaceKind: SurfaceDefinition['surfaceKind'],
  surfaceIds: readonly string[],
  parentSurfaceId?: string,
): SurfaceDefinition[] => surfaceIds.map((surfaceId) => ({ routeKey, operationMode, surfaceKind, surfaceId, parentSurfaceId }))

const surfaceDefinitions: readonly SurfaceDefinition[] = [
  ...define('ADMIN_DATA', 'DEFAULT', 'view', ['admin-bom-import', 'admin-contracts', 'admin-cleanup', 'admin-inventory', 'admin-statistics', 'admin-audit', 'admin-employees']),
  ...define('ADMIN_DATA', 'MATERIAL_RECONCILIATION', 'view', ['admin-bom-import', 'admin-audit', 'admin-source-changes']),
  ...define('APPROVALS', 'DEFAULT', 'view', ['approval-amendments', 'approval-queue', 'approval-history']),
  ...define('CHEF_DASHBOARD', 'DEFAULT', 'view', ['chef-production', 'chef-documents']),
  ...define('CHEF_DASHBOARD', 'DEFAULT', 'task', ['chef-task-run', 'chef-task-materials'], 'chef-production'),
  ...define('WEEKLY_MENU', 'DEFAULT', 'task-group', ['weekly-group-authoring', 'weekly-group-execution', 'weekly-group-analysis']),
  ...define('WEEKLY_MENU', 'DEFAULT', 'view', ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials']),
  ...define('WEEKLY_MENU', 'MATERIAL_RECONCILIATION', 'view', ['schedule', 'demand']),
  ...define('PURCHASING', 'DEFAULT', 'view', ['purchasing-workflow', 'purchasing-supplemental', 'purchasing-quotations']),
  ...define('REPORTS', 'DEFAULT', 'task-group', ['report-group-cost', 'report-group-planning', 'report-group-warehouse', 'report-group-control']),
  ...define('REPORTS', 'DEFAULT', 'view', ['reports-price', 'reports-demand', 'reports-purchase', 'reports-stock', 'reports-movement', 'reports-kitchen', 'reports-usage', 'reports-audit', 'reports-data-quality']),
  ...define('REPORTS', 'DEFAULT', 'subview', ['price-sub-lines', 'price-sub-supplier', 'price-sub-period', 'price-sub-dishGroup'], 'reports-price'),
  ...define('WAREHOUSE', 'DEFAULT', 'view', ['warehouse-receiving', 'warehouse-demand', 'warehouse-exceptions', 'warehouse-movement']),
  ...define('WAREHOUSE', 'MATERIAL_RECONCILIATION', 'view', ['warehouse-demand', 'warehouse-movement']),
  ...define('ADVANCED_SETTINGS', 'DEFAULT', 'view', ['advanced-operation', 'advanced-display']),
  ...define('ADVANCED_SETTINGS', 'MATERIAL_RECONCILIATION', 'view', ['advanced-operation', 'advanced-display']),
]

const routeEntries = (Object.keys(ROUTES) as Array<keyof typeof ROUTES>)
  .flatMap((routeKey) => routeModes[routeKey].map((mode) => routeEntry(routeKey, mode)))
const routeEntryByKey = new Map(routeEntries.map((entry) => [`${entry.routeKey}\0${entry.operationMode}`, entry]))

const surfaceEntries = surfaceDefinitions.map((surface): UiFloorplanScopeEntry => {
  const route = routeEntryByKey.get(`${surface.routeKey}\0${surface.operationMode}`)
  if (!route) throw new Error(`Missing route authority for ${surface.routeKey}/${surface.operationMode}`)
  return {
    routeKey: surface.routeKey,
    routePath: route.routePath,
    operationMode: surface.operationMode,
    surfaceKind: surface.surfaceKind,
    surfaceId: surface.surfaceId,
    parentSurfaceId: surface.parentSurfaceId ?? route.surfaceId,
    roleStateId: route.roleStateId,
    dataStateId: route.dataStateId,
  }
})

export const uiFloorplanScopeRegistry: readonly UiFloorplanScopeEntry[] = [...routeEntries, ...surfaceEntries]
  .sort((left, right) => buildUiFloorplanScopeKey(left).localeCompare(buildUiFloorplanScopeKey(right)))

export type UiFloorplanScopeComparison = {
  missing: UiFloorplanScopeKey[]
  duplicates: UiFloorplanScopeKey[]
  orphans: UiFloorplanScopeKey[]
  stale: UiFloorplanScopeKey[]
}

const sortedUnique = (keys: readonly UiFloorplanScopeKey[]) => [...new Set(keys)].sort((left, right) => left.localeCompare(right))

export const compareUiFloorplanScopeSets = (
  actual: readonly UiFloorplanScopeEntry[],
  registry: readonly UiFloorplanScopeEntry[] = uiFloorplanScopeRegistry,
): UiFloorplanScopeComparison => {
  const actualKeys = actual.map(buildUiFloorplanScopeKey)
  const registryKeys = registry.map(buildUiFloorplanScopeKey)
  const actualSet = new Set(actualKeys)
  const registrySet = new Set(registryKeys)
  const duplicateKeys = registryKeys.filter((key, index) => registryKeys.indexOf(key) !== index)
  const parentIds = new Set(registry.map((entry) => `${entry.routeKey}\0${entry.operationMode}\0${entry.surfaceId}`))
  const orphanKeys = registry
    .filter((entry) => entry.parentSurfaceId !== null && !parentIds.has(`${entry.routeKey}\0${entry.operationMode}\0${entry.parentSurfaceId}`))
    .map(buildUiFloorplanScopeKey)

  return {
    missing: sortedUnique(actualKeys.filter((key) => !registrySet.has(key))),
    duplicates: sortedUnique(duplicateKeys),
    orphans: sortedUnique(orphanKeys),
    stale: sortedUnique(registryKeys.filter((key) => !actualSet.has(key))),
  }
}
