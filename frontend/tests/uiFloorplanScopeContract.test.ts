import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ROUTES } from '../src/lib/routeConfig'
import {
  discoverProtectedRouteOwners,
  protectedOperationalFamilies,
} from '../src/routes/protectedOperationalFamilyRegistry.test'
import {
  buildUiFloorplanScopeKey,
  compareUiFloorplanScopeSets,
  type UiFloorplanScopeEntry,
  uiFloorplanScopeRegistry,
} from './uiFloorplanScopeRegistry'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const appRouterSource = read('src/routes/AppRouter.tsx')
const routeLoadersSource = read('src/routes/routeLoaders.ts')
const routeConfigSource = read('src/lib/routeConfig.ts')

const tabAuthorities = [
  { routeKey: 'ADMIN_DATA', file: 'src/app/pages/admin-data/useAdminDataPageModel.ts', ids: ['admin-bom-import', 'admin-contracts', 'admin-cleanup', 'admin-inventory', 'admin-statistics', 'admin-audit', 'admin-employees'] },
  { routeKey: 'ADMIN_DATA', file: 'src/app/pages/admin-data/AdminBomPanel.tsx', ids: ['bom-current', 'bom-preview'], parent: 'admin-bom-import' },
  { routeKey: 'APPROVALS', file: 'src/features/approvals/pages/ApprovalPage.tsx', ids: ['approval-queue', 'approval-role', 'approval-history'] },
  { routeKey: 'CHEF_DASHBOARD', file: 'src/features/chef/pages/ChefDashboardPage.tsx', ids: ['chef-production', 'chef-documents'] },
  { routeKey: 'WEEKLY_MENU', file: 'src/features/projects/pages/WeeklyMenuPage.tsx', ids: ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'] },
  { routeKey: 'PURCHASING', file: 'src/features/purchasing/pages/PurchasingPage.tsx', ids: ['purchasing-workflow', 'purchasing-supplemental', 'purchasing-quotations'] },
  { routeKey: 'REPORTS', file: 'src/features/reports/pages/reportsPageModelShared.ts', ids: ['reports-price', 'reports-demand', 'reports-purchase', 'reports-stock', 'reports-movement', 'reports-kitchen', 'reports-usage', 'reports-audit', 'reports-data-quality'] },
  { routeKey: 'REPORTS', file: 'src/features/reports/pages/reportsPageModelShared.ts', ids: ['price-sub-lines', 'price-sub-supplier', 'price-sub-period', 'price-sub-dishGroup'], sourceIds: ['lines', 'supplier', 'period', 'dishGroup'], parent: 'reports-price' },
  { routeKey: 'WAREHOUSE', file: 'src/features/warehouse/pages/WarehousePage.tsx', ids: ['warehouse-movement', 'warehouse-demand', 'warehouse-exceptions'] },
] as const

const sourceContainsId = (source: string, id: string) => {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['\\"]${escaped}['\\"]`).test(source)
}

const routeEntry = (routeKey: keyof typeof ROUTES): UiFloorplanScopeEntry => {
  const authority = protectedOperationalFamilies.find((entry) => entry.routeKey === routeKey)
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

const discoverActualScope = (): UiFloorplanScopeEntry[] => {
  const configuredRouteKeys = [...routeConfigSource.matchAll(/^\s*([A-Z][A-Z0-9_]+):\s*['"]/gm)]
    .map((match) => match[1] as keyof typeof ROUTES)
  const protectedRoutes = discoverProtectedRouteOwners(appRouterSource, routeLoadersSource).map((entry) => entry.routeKey)
  expect(configuredRouteKeys).toEqual(expect.arrayContaining(['LOGIN', ...protectedRoutes]))

  const routes = configuredRouteKeys.map(routeEntry)
  const routeByKey = new Map(routes.map((entry) => [entry.routeKey, entry]))
  const surfaces = tabAuthorities.flatMap((authority) => {
    const source = read(authority.file)
    const sourceIds = 'sourceIds' in authority ? authority.sourceIds : authority.ids
    sourceIds.forEach((id) => expect(sourceContainsId(source, id), `${authority.file} declares ${id}`).toBe(true))
    const route = routeByKey.get(authority.routeKey)
    if (!route) throw new Error(`Missing discovered route ${authority.routeKey}`)
    return authority.ids.map((surfaceId): UiFloorplanScopeEntry => ({
      routeKey: authority.routeKey,
      routePath: route.routePath,
      surfaceKind: 'parent' in authority ? 'nested-view' : 'tab',
      surfaceId,
      parentSurfaceId: 'parent' in authority ? authority.parent : route.surfaceId,
      roleStateId: route.roleStateId,
      dataStateId: route.dataStateId,
    }))
  })
  return [...routes, ...surfaces]
}

const clone = (entries: readonly UiFloorplanScopeEntry[]) => entries.map((entry) => ({ ...entry }))

describe('Phase 26 exact floorplan scope registry', () => {
  it('keys every identity dimension and keeps the live registry deterministic and unique', () => {
    const base = uiFloorplanScopeRegistry[0]
    const dimensions: Array<keyof UiFloorplanScopeEntry> = ['routeKey', 'routePath', 'surfaceKind', 'surfaceId', 'parentSurfaceId', 'roleStateId', 'dataStateId']
    dimensions.forEach((dimension) => {
      const changed = { ...base, [dimension]: `${String(base[dimension])}-changed` } as UiFloorplanScopeEntry
      expect(buildUiFloorplanScopeKey(changed)).not.toBe(buildUiFloorplanScopeKey(base))
    })
    expect(uiFloorplanScopeRegistry.every((entry) => Object.entries(entry).every(([key, value]) => key === 'parentSurfaceId' ? true : String(value).trim().length > 0))).toBe(true)
    expect(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)).toEqual([...uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)].sort((left, right) => left.localeCompare(right)))
    expect(new Set(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey)).size).toBe(uiFloorplanScopeRegistry.length)
  })

  it('equals current routes, tabs, nested views, and declared role/data authorities bidirectionally', () => {
    expect(compareUiFloorplanScopeSets(discoverActualScope())).toEqual({ missing: [], duplicates: [], orphans: [], stale: [] })
  })

  it('reports missing, duplicate, orphan, and stale identities by exact key', () => {
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

  it('keeps test-owned scope contracts out of production imports', () => {
    const productionSources = fs.readdirSync(path.join(frontendRoot, 'src'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
      .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
    expect(productionSources.filter((source) => source.includes('uiFloorplanScopeRegistry') || source.includes('uiFloorplanScopeContract'))).toEqual([])
  })
})
