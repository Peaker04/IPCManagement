import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { pageTabGroups } from '@/lib/navigationPreferences'
import {
  buildRouteLeafHref,
  getRouteLeafIds,
  getVisibleRouteChildren,
  navigationRoutes,
  resolveActiveRouteLeafId,
  routeMetadataForPath,
  routeRegistry,
  type NavChild,
  type RoutePath,
} from './routeRegistry'

describe('route metadata registry', () => {
  it('owns one metadata record for every canonical route', () => {
    expect(Object.keys(routeRegistry).sort()).toEqual(Object.values(ROUTES).sort())
  })

  it('keeps route identity, navigation and permission metadata together', () => {
    expect(routeRegistry[ROUTES.WEEKLY_MENU]).toMatchObject({
      documentTitle: 'Thực đơn tuần',
      shellTitle: 'Thực đơn tuần',
      navLabel: 'Thực đơn tuần',
      requiredPermissions: ['coordination.read'],
      preferenceKey: 'weekly-menu',
    })
    expect(routeRegistry[ROUTES.RECONCILIATION]).toMatchObject({
      documentTitle: 'Đối chiếu nguyên liệu',
      navLabel: 'Đối chiếu',
      requiredPermissions: ['report.read'],
      reconciliationOnly: true,
    })
  })

  it('exposes only primary navigation routes in declared order', () => {
    expect(navigationRoutes.map((route) => route.path)).toEqual([
      ROUTES.DASHBOARD,
      ROUTES.WEEKLY_MENU,
      ROUTES.MEAL_ORDERS,
      ROUTES.APPROVALS,
      ROUTES.PURCHASING,
      ROUTES.WAREHOUSE,
      ROUTES.RECONCILIATION,
      ROUTES.CHEF_DASHBOARD,
      ROUTES.REPORTS,
      ROUTES.ADMIN_DATA,
      ROUTES.APPROVAL_RULES,
    ])
  })

  it('normalizes trailing slashes and falls back without inventing route metadata', () => {
    expect(routeMetadataForPath('/reports/')).toBe(routeRegistry[ROUTES.REPORTS])
    expect(routeMetadataForPath('/missing')).toBeUndefined()
  })
})

describe('route registry children (nested sidebar leaves)', () => {
  const routesWithChildren: ReadonlyArray<{ path: RoutePath; expectedGroupId: string; expectedCount: number }> = [
    { path: ROUTES.WEEKLY_MENU, expectedGroupId: 'weekly-menu', expectedCount: 3 },
    { path: ROUTES.WAREHOUSE, expectedGroupId: 'warehouse', expectedCount: 4 },
    { path: ROUTES.APPROVALS, expectedGroupId: 'approvals', expectedCount: 2 },
    { path: ROUTES.PURCHASING, expectedGroupId: 'purchasing', expectedCount: 3 },
    { path: ROUTES.CHEF_DASHBOARD, expectedGroupId: 'chef', expectedCount: 2 },
    { path: ROUTES.REPORTS, expectedGroupId: 'reports', expectedCount: 9 },
    { path: ROUTES.ADMIN_DATA, expectedGroupId: 'admin-data', expectedCount: 7 },
  ]

  it('populates children for every multi-tab primary route from pageTabGroups', () => {
    for (const { path, expectedGroupId, expectedCount } of routesWithChildren) {
      const children = routeRegistry[path].children
      const navItem = navigationRoutes.find((item) => item.path === path)
      expect(children, `route ${path}`).toBeDefined()
      expect(navItem?.children, `navigationRoutes ${path}`).toEqual(children)
      expect(children, `route ${path}`).toHaveLength(expectedCount)
      const group = pageTabGroups.find((g) => g.id === expectedGroupId)
      expect(group, `pageTabGroup ${expectedGroupId}`).toBeDefined()
      expect(children!.map((c: NavChild) => c.id)).toEqual(group!.tabs.map(([id]) => id))
      expect(children!.map((c: NavChild) => c.label)).toEqual(group!.tabs.map(([, label]) => label))
    }
  })

  it('does not duplicate leaf ids within a single route', () => {
    for (const { path } of routesWithChildren) {
      const ids = routeRegistry[path].children!.map((c: NavChild) => c.id)
      expect(new Set(ids).size, `route ${path}`).toBe(ids.length)
    }
  })

  it('omits children for routes with a single tab (or no tabs)', () => {
    // 5 single-tab primary: DASHBOARD, MEAL_ORDERS, RECONCILIATION, APPROVAL_RULES, ADVANCED_SETTINGS, plus LOGIN/FORBIDDEN
    for (const path of [ROUTES.DASHBOARD, ROUTES.MEAL_ORDERS, ROUTES.RECONCILIATION, ROUTES.APPROVAL_RULES, ROUTES.ADVANCED_SETTINGS, ROUTES.LOGIN, ROUTES.FORBIDDEN]) {
      expect(routeRegistry[path].children, `route ${path}`).toBeUndefined()
      expect(getRouteLeafIds(path), `getRouteLeafIds(${path})`).toBeUndefined()
    }
  })

  it('getRouteLeafIds returns flat ids in declared order', () => {
    expect(getRouteLeafIds(ROUTES.WEEKLY_MENU)).toEqual(['schedule', 'demand', 'production-plan'])
    expect(getRouteLeafIds(ROUTES.WAREHOUSE)).toEqual(['receiving', 'demand', 'exceptions', 'movement'])
    expect(getRouteLeafIds(ROUTES.ADMIN_DATA)).toEqual(['bom-import', 'contracts', 'cleanup', 'inventory', 'statistics', 'audit', 'employees'])
  })

  it('preserves route-scoped query params when building sibling leaf hrefs on the active route', () => {
    expect(buildRouteLeafHref(ROUTES.WAREHOUSE, 'movement', ROUTES.WAREHOUSE, '?batchId=batch-99&view=demand&page=2'))
      .toBe('/warehouse?view=movement&batchId=batch-99')
    expect(buildRouteLeafHref(ROUTES.WEEKLY_MENU, 'demand', ROUTES.WEEKLY_MENU, '?customerId=c1&weekStartDate=2026-09-21'))
      .toBe('/weekly-menu?view=demand&customerId=c1&weekStartDate=2026-09-21')
    expect(buildRouteLeafHref(ROUTES.WAREHOUSE, 'movement', ROUTES.DASHBOARD, '?batchId=batch-99'))
      .toBe('/warehouse?view=movement')
  })

  it('resolves mode-aware and permission-aware visible children and default active leaf', () => {
    const mrxWarehouse = getVisibleRouteChildren(ROUTES.WAREHOUSE, { mode: 'MATERIAL_RECONCILIATION' })
    expect(mrxWarehouse).toEqual([
      { id: 'demand', label: 'Danh sách cần xuất' },
      { id: 'movement', label: 'Lịch sử xuất kho' },
    ])
    const defaultApprovals = getVisibleRouteChildren(ROUTES.APPROVALS, { mode: 'DEFAULT' })
    expect(defaultApprovals.map((c) => c.id)).toEqual(['amendments', 'queue', 'history'])
    expect(resolveActiveRouteLeafId(ROUTES.APPROVALS, null, defaultApprovals)).toBe('queue')
    expect(resolveActiveRouteLeafId(ROUTES.APPROVALS, 'amendments', defaultApprovals)).toBe('amendments')
  })
})
