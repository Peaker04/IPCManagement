import { ROUTES } from '../src/lib/routeConfig'
import { protectedOperationalFamilies } from '../src/routes/protectedOperationalFamilyRegistry.test'

export type UiFloorplanScopeEntry = {
  routeKey: keyof typeof ROUTES
  routePath: string
  surfaceKind: 'route' | 'tab' | 'nested-view'
  surfaceId: string
  parentSurfaceId: string | null
  roleStateId: string
  dataStateId: string
}

export type UiFloorplanScopeKey = string & { readonly __uiFloorplanScopeKey: unique symbol }

export const buildUiFloorplanScopeKey = (entry: UiFloorplanScopeEntry): UiFloorplanScopeKey => JSON.stringify([
  entry.routeKey,
  entry.routePath,
  entry.surfaceKind,
  entry.surfaceId,
  entry.parentSurfaceId,
  entry.roleStateId,
  entry.dataStateId,
]) as UiFloorplanScopeKey

const protectedByRoute = new Map(protectedOperationalFamilies.map((entry) => [entry.routeKey, entry]))

const routeEntry = (routeKey: keyof typeof ROUTES): UiFloorplanScopeEntry => {
  const authority = protectedByRoute.get(routeKey)
  return {
    routeKey,
    routePath: ROUTES[routeKey],
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
  surfaceKind: 'tab' | 'nested-view'
  surfaceId: string
  parentSurfaceId?: string
}

const surfaceDefinitions: readonly SurfaceDefinition[] = [
  ...['admin-bom-import', 'admin-contracts', 'admin-cleanup', 'admin-inventory', 'admin-statistics', 'admin-audit', 'admin-employees']
    .map((surfaceId) => ({ routeKey: 'ADMIN_DATA', surfaceKind: 'tab', surfaceId }) as const),
  ...['bom-current', 'bom-preview']
    .map((surfaceId) => ({ routeKey: 'ADMIN_DATA', surfaceKind: 'nested-view', surfaceId, parentSurfaceId: 'admin-bom-import' }) as const),
  ...['approval-queue', 'approval-history']
    .map((surfaceId) => ({ routeKey: 'APPROVALS', surfaceKind: 'tab', surfaceId }) as const),
  ...['chef-production', 'chef-documents']
    .map((surfaceId) => ({ routeKey: 'CHEF_DASHBOARD', surfaceKind: 'tab', surfaceId }) as const),
  ...['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials']
    .map((surfaceId) => ({ routeKey: 'WEEKLY_MENU', surfaceKind: 'tab', surfaceId }) as const),
  ...['purchasing-workflow', 'purchasing-supplemental', 'purchasing-quotations']
    .map((surfaceId) => ({ routeKey: 'PURCHASING', surfaceKind: 'tab', surfaceId }) as const),
  ...['reports-price', 'reports-demand', 'reports-purchase', 'reports-stock', 'reports-movement', 'reports-kitchen', 'reports-usage', 'reports-audit', 'reports-data-quality']
    .map((surfaceId) => ({ routeKey: 'REPORTS', surfaceKind: 'tab', surfaceId }) as const),
  ...['price-sub-lines', 'price-sub-supplier', 'price-sub-period', 'price-sub-dishGroup']
    .map((surfaceId) => ({ routeKey: 'REPORTS', surfaceKind: 'nested-view', surfaceId, parentSurfaceId: 'reports-price' }) as const),
  ...['warehouse-movement', 'warehouse-demand', 'warehouse-exceptions']
    .map((surfaceId) => ({ routeKey: 'WAREHOUSE', surfaceKind: 'tab', surfaceId }) as const),
]

const routeEntries = (Object.keys(ROUTES) as Array<keyof typeof ROUTES>).map(routeEntry)
const routeEntryByKey = new Map(routeEntries.map((entry) => [entry.routeKey, entry]))

const surfaceEntries = surfaceDefinitions.map((surface): UiFloorplanScopeEntry => {
  const route = routeEntryByKey.get(surface.routeKey)
  if (!route) throw new Error(`Missing route authority for ${surface.routeKey}`)
  return {
    routeKey: surface.routeKey,
    routePath: route.routePath,
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
  const parentIds = new Set(registry.map((entry) => `${entry.routeKey}\0${entry.surfaceId}`))
  const orphanKeys = registry
    .filter((entry) => entry.parentSurfaceId !== null && !parentIds.has(`${entry.routeKey}\0${entry.parentSurfaceId}`))
    .map(buildUiFloorplanScopeKey)

  return {
    missing: sortedUnique(actualKeys.filter((key) => !registrySet.has(key))),
    duplicates: sortedUnique(duplicateKeys),
    orphans: sortedUnique(orphanKeys),
    stale: sortedUnique(registryKeys.filter((key) => !actualSet.has(key))),
  }
}
