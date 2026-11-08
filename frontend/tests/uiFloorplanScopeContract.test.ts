import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ROUTES } from '../src/lib/routeConfig'
import { eligiblePageTabs, isRouteEligible } from '../src/lib/systemOperationEligibility'
import {
  protectedOperationalFamilies,
} from '../src/routes/protectedOperationalFamilyRegistry.test'
import {
  buildUiFloorplanScopeKey,
  compareUiFloorplanScopeSets,
  type UiFloorplanOperationMode,
  type UiFloorplanScopeEntry,
  type UiFloorplanSurfaceKind,
  uiFloorplanScopeRegistry,
} from './uiFloorplanScopeRegistry'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8')

const routeEntry = (routeKey: keyof typeof ROUTES, operationMode: UiFloorplanOperationMode): UiFloorplanScopeEntry => {
  const authority = protectedOperationalFamilies.find((entry) => entry.routeKey === routeKey)
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

const idLiteralsIn = (source: string, prefix = '') => [...source.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)]
  .map((match) => match[1])
  .filter((id) => id.startsWith(prefix))

const idLiterals = (file: string, prefix: string) => idLiteralsIn(read(file), prefix)

const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start)
  if (startIndex < 0 || source.indexOf(start, startIndex + start.length) >= 0) throw new Error(`Expected one source anchor: ${start}`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`Missing source boundary after ${start}: ${end}`)
  return source.slice(startIndex, endIndex)
}

const requirePattern = (source: string, pattern: RegExp, label: string) => {
  if (!pattern.test(source)) throw new Error(`Production navigation contract drift: ${label}`)
}

const actualRoutes = (): UiFloorplanScopeEntry[] => {
  const keys = Object.keys(ROUTES) as Array<keyof typeof ROUTES>
  return [
    routeEntry('LOGIN', 'PUBLIC'),
    ...(['DEFAULT', 'MATERIAL_RECONCILIATION'] as const).flatMap((mode) => keys
      .filter((key) => key !== 'LOGIN' && isRouteEligible(mode, ROUTES[key]))
      .map((key) => routeEntry(key, mode))),
  ]
}

type ActualSurface = {
  routeKey: keyof typeof ROUTES
  operationMode: Exclude<UiFloorplanOperationMode, 'PUBLIC'>
  surfaceKind: Exclude<UiFloorplanSurfaceKind, 'route'>
  surfaceId: string
  parentSurfaceId?: string
}

const surface = (
  routeKey: ActualSurface['routeKey'],
  operationMode: ActualSurface['operationMode'],
  surfaceKind: ActualSurface['surfaceKind'],
  surfaceIds: readonly string[],
  parentSurfaceId?: string,
): ActualSurface[] => surfaceIds.map((surfaceId) => ({ routeKey, operationMode, surfaceKind, surfaceId, parentSurfaceId }))

const discoverActualSurfaces = (): ActualSurface[] => {
  const weeklySource = read('src/features/projects/weekly-menu/shell/WeeklyMenuNavigation.tsx')
  const weeklyGroupSource = between(weeklySource, 'const groups', 'export function')
  const weeklyViews = [...weeklyGroupSource.matchAll(/\[['"]([^'"]+)['"],\s*['"][^'"]+['"]\]/g)].map((match) => match[1])
  const weeklyGroups = idLiteralsIn(weeklyGroupSource).map((id) => `weekly-group-${id}`)
  const weeklyMrxSource = between(weeklySource, "if (mode === 'MATERIAL_RECONCILIATION')", 'const visibleGroups')
  const weeklyMrxViews = idLiteralsIn(weeklyMrxSource)

  const reportSharedSource = read('src/features/reports/pages/reportsPageModelShared.ts')
  const reportViews = idLiteralsIn(reportSharedSource, 'reports-')
  const priceSubviewSource = between(reportSharedSource, 'export const priceSubViewTabs', 'export const validReportViews')
  const priceSubviews = idLiteralsIn(priceSubviewSource).map((id) => `price-sub-${id}`)
  const reportNavigationSource = read('src/features/reports/pages/ReportsNavigation.tsx')
  const reportGroupSource = between(reportNavigationSource, 'const reportGroups', 'export function')
  const reportGroups = idLiteralsIn(reportGroupSource).map((id) => `report-group-${id}`)
  const warehouseDefaultIds = idLiterals('src/features/warehouse/pages/WarehousePage.tsx', 'warehouse-')
  const warehouseMrxSource = read('src/features/warehouse/pages/ReconciliationWarehousePage.tsx')
  const warehouseEligibility = between(warehouseMrxSource, 'const tabs = eligiblePageTabs', 'const requestedView')
  requirePattern(
    warehouseEligibility,
    /eligiblePageTabs\(\s*['"]MATERIAL_RECONCILIATION['"]\s*,\s*['"]warehouse['"]\s*,\s*operation\?\.capabilities\.pageTabs\.warehouse\s*\?\?\s*\[\]\s*,\s*visibleTabIds\(['"]warehouse['"]\)\s*\)/,
    'MRX Warehouse must derive tabs from MRX warehouse capabilities and visible preferences',
  )
  const warehouseNavigation = between(warehouseMrxSource, 'ariaLabel="Chọn góc nhìn kho đối chiếu"', 'activeTab={`warehouse-${activeView}`}')
  requirePattern(warehouseNavigation, /tabs=\{tabs\.map\(\(id\)\s*=>\s*\(\{\s*id:\s*`warehouse-\$\{id\}`/, 'MRX Warehouse ViewSwitcher must map eligible tabs to warehouse-prefixed IDs')
  const warehouseSourceViews = warehouseDefaultIds.map((id) => id.replace('warehouse-', ''))
  const warehouseMrxIds = eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', warehouseSourceViews, warehouseSourceViews)
    .map((id) => `warehouse-${id}`)

  return [
    ...surface('ADMIN_DATA', 'DEFAULT', 'view', idLiterals('src/app/pages/admin-data/useAdminDataPageModel.ts', 'admin-')),
    ...surface('ADMIN_DATA', 'MATERIAL_RECONCILIATION', 'view', idLiterals('src/app/pages/admin-data/ReconciliationAdminDataPage.tsx', 'admin-')),
    ...surface('APPROVALS', 'DEFAULT', 'view', idLiterals('src/features/approvals/pages/ApprovalPage.tsx', 'approval-')),
    ...surface('CHEF_DASHBOARD', 'DEFAULT', 'view', idLiterals('src/features/chef/pages/ChefDashboardPage.tsx', 'chef-').filter((id) => !id.startsWith('chef-task-'))),
    ...surface('CHEF_DASHBOARD', 'DEFAULT', 'task', idLiterals('src/features/chef/pages/ChefDashboardPage.tsx', 'chef-task-'), 'chef-production'),
    ...surface('WEEKLY_MENU', 'DEFAULT', 'task-group', weeklyGroups),
    ...surface('WEEKLY_MENU', 'DEFAULT', 'view', weeklyViews),
    ...surface('WEEKLY_MENU', 'MATERIAL_RECONCILIATION', 'view', weeklyMrxViews),
    ...surface('PURCHASING', 'DEFAULT', 'view', idLiterals('src/features/purchasing/pages/PurchasingPage.tsx', 'purchasing-')),
    ...surface('REPORTS', 'DEFAULT', 'task-group', reportGroups),
    ...surface('REPORTS', 'DEFAULT', 'view', reportViews),
    ...surface('REPORTS', 'DEFAULT', 'subview', priceSubviews, 'reports-price'),
    ...surface('WAREHOUSE', 'DEFAULT', 'view', warehouseDefaultIds),
    ...surface('WAREHOUSE', 'MATERIAL_RECONCILIATION', 'view', warehouseMrxIds),
    ...surface('ADVANCED_SETTINGS', 'DEFAULT', 'view', idLiterals('src/features/admin/pages/AdvancedDisplaySettingsPage.tsx', 'advanced-')),
    ...surface('ADVANCED_SETTINGS', 'MATERIAL_RECONCILIATION', 'view', idLiterals('src/features/admin/pages/AdvancedDisplaySettingsPage.tsx', 'advanced-')),
  ]
}

const discoverActualScope = (): UiFloorplanScopeEntry[] => {
  const routes = actualRoutes()
  const routeByKey = new Map(routes.map((entry) => [`${entry.routeKey}\0${entry.operationMode}`, entry]))
  const surfaces = discoverActualSurfaces().map((candidate): UiFloorplanScopeEntry => {
    const route = routeByKey.get(`${candidate.routeKey}\0${candidate.operationMode}`)
    if (!route) throw new Error(`Production surface has no eligible route: ${candidate.routeKey}/${candidate.operationMode}/${candidate.surfaceId}`)
    return {
      ...candidate,
      routePath: route.routePath,
      parentSurfaceId: candidate.parentSurfaceId ?? route.surfaceId,
      roleStateId: route.roleStateId,
      dataStateId: route.dataStateId,
    }
  })
  return [...routes, ...surfaces]
}

const clone = (entries: readonly UiFloorplanScopeEntry[]) => entries.map((entry) => ({ ...entry }))

describe('exact mode-aware floorplan scope registry', () => {
  it('keys every identity dimension and keeps the live registry deterministic and unique', () => {
    const base = uiFloorplanScopeRegistry[0]
    const dimensions: Array<keyof UiFloorplanScopeEntry> = ['routeKey', 'routePath', 'operationMode', 'surfaceKind', 'surfaceId', 'parentSurfaceId', 'roleStateId', 'dataStateId']
    dimensions.forEach((dimension) => {
      const changed = { ...base, [dimension]: `${String(base[dimension])}-changed` } as UiFloorplanScopeEntry
      expect(buildUiFloorplanScopeKey(changed)).not.toBe(buildUiFloorplanScopeKey(base))
    })
    expect(uiFloorplanScopeRegistry.every((entry) => Object.entries(entry).every(([key, value]) => key === 'parentSurfaceId' ? true : String(value).trim().length > 0))).toBe(true)
    expect(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)).toEqual([...uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)].sort((left, right) => left.localeCompare(right)))
    expect(new Set(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)).size).toBe(uiFloorplanScopeRegistry.length)
  })

  it('equals source-discovered eligible routes, task groups, views, subviews, and tasks bidirectionally', () => {
    const actual = discoverActualScope()
    const actualKeys = actual.map(buildUiFloorplanScopeKey)
    expect(new Set(actualKeys).size, 'production navigation identities must be unique').toBe(actualKeys.length)
    expect(compareUiFloorplanScopeSets(actual)).toEqual({ missing: [], duplicates: [], orphans: [], stale: [] })
  })

  it('reports missing, duplicate, orphan, and stale identities by exact mode-aware key', () => {
    const actual = discoverActualScope()
    const removed = uiFloorplanScopeRegistry[0]
    const missingRegistry = clone(uiFloorplanScopeRegistry).filter((entry) => buildUiFloorplanScopeKey(entry) !== buildUiFloorplanScopeKey(removed))
    expect(compareUiFloorplanScopeSets(actual, missingRegistry).missing).toEqual([buildUiFloorplanScopeKey(removed)])

    const duplicateRegistry = [...clone(uiFloorplanScopeRegistry), { ...uiFloorplanScopeRegistry[0] }]
    expect(compareUiFloorplanScopeSets(actual, duplicateRegistry).duplicates).toEqual([buildUiFloorplanScopeKey(uiFloorplanScopeRegistry[0])])

    const childIndex = uiFloorplanScopeRegistry.findIndex((entry) => entry.surfaceKind !== 'route')
    const orphanRegistry = clone(uiFloorplanScopeRegistry)
    orphanRegistry[childIndex].parentSurfaceId = '__missing-parent__'
    expect(compareUiFloorplanScopeSets(actual, orphanRegistry).orphans).toEqual([buildUiFloorplanScopeKey(orphanRegistry[childIndex])])

    const stale = { ...uiFloorplanScopeRegistry[0], surfaceId: '__stale-surface__' }
    expect(compareUiFloorplanScopeSets(actual, [...clone(uiFloorplanScopeRegistry), stale]).stale).toEqual([buildUiFloorplanScopeKey(stale)])
  })

  it('rejects a production-shaped view that is not in the acceptance matrix', () => {
    const actual = discoverActualScope()
    const route = actual.find((entry) => entry.routeKey === 'WAREHOUSE' && entry.operationMode === 'DEFAULT' && entry.surfaceKind === 'route')!
    const added: UiFloorplanScopeEntry = { ...route, surfaceKind: 'view', surfaceId: 'warehouse-new-view', parentSurfaceId: route.surfaceId }
    expect(compareUiFloorplanScopeSets([...actual, added]).missing).toEqual([buildUiFloorplanScopeKey(added)])
  })

  it('keeps test-owned scope contracts out of production imports', () => {
    const productionSources = fs.readdirSync(path.join(frontendRoot, 'src'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
      .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
    expect(productionSources.filter((source) => source.includes('uiFloorplanScopeRegistry') || source.includes('uiFloorplanScopeContract'))).toEqual([])
  })
})
