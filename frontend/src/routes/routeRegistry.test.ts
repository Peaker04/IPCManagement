import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { navigationRoutes, routeRegistry, routeMetadataForPath } from './routeRegistry'

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
