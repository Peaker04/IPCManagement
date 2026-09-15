import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { eligibleCapabilityIds, eligiblePageTabs, getCapabilityConfigurationError, isRouteEligible, isRouteVisibleToPermissions, modeLabels, retainedRoutes } from '@/lib/systemOperationEligibility'

describe('system operation route matrix', () => {
  it('keeps the explicit default golden path without exposing the reconciliation-only route', () => {
    for (const path of Object.values(ROUTES).filter((path) => path !== ROUTES.RECONCILIATION)) {
      expect(isRouteEligible('DEFAULT', path)).toBe(true)
    }
    expect(isRouteEligible('DEFAULT', ROUTES.RECONCILIATION)).toBe(false)
    expect(retainedRoutes('DEFAULT')).not.toContain(ROUTES.RECONCILIATION)
  })

  it('keeps only the closed-loop workflow in reconciliation mode', () => {
    expect(retainedRoutes('MATERIAL_RECONCILIATION')).toEqual([
      ROUTES.DASHBOARD, ROUTES.WEEKLY_MENU, ROUTES.WAREHOUSE, ROUTES.RECONCILIATION, ROUTES.ADMIN_DATA,
    ])
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.PURCHASING)).toBe(false)
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.REPORTS)).toBe(false)
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.WAREHOUSE)).toBe(true)
  })

  it('combines operation mode and role permissions for the visible business surfaces', () => {
    expect(isRouteVisibleToPermissions('MATERIAL_RECONCILIATION', ROUTES.WAREHOUSE, ['warehouse.read'], ['warehouse.read'])).toBe(true)
    expect(isRouteVisibleToPermissions('MATERIAL_RECONCILIATION', ROUTES.WAREHOUSE, ['warehouse.read'], ['report.read'])).toBe(false)
    expect(isRouteVisibleToPermissions('MATERIAL_RECONCILIATION', ROUTES.RECONCILIATION, ['report.read'], ['report.read'])).toBe(true)
    expect(isRouteVisibleToPermissions('DEFAULT', ROUTES.RECONCILIATION, ['report.read'], ['report.read'])).toBe(false)
    expect(isRouteVisibleToPermissions('DEFAULT', ROUTES.PURCHASING, ['purchase.read'], [], true)).toBe(true)
  })

  it('respects page tab visibility preferences across modes and maps material demand identity', () => {
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'weekly-menu', ['schedule', 'material-demand'], ['schedule'])).toEqual(['schedule'])
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'weekly-menu', ['schedule', 'material-demand'], ['demand'])).toEqual(['demand'])
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', ['demand', 'movement'], ['movement'])).toEqual(['movement'])
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'admin-data', ['bom-import', 'audit'], ['bom-import'])).toEqual(['bom-import'])
    expect(eligiblePageTabs('DEFAULT', 'weekly-menu', ['schedule', 'demand'], ['schedule'])).toEqual(['schedule'])
  })

  it('filters capability ids by operation mode separating default from reconciliation', () => {
    expect(eligibleCapabilityIds('DEFAULT', ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'])).toEqual([
      'dashboard', 'weekly-menu', 'warehouse', 'admin-data',
    ])
    expect(eligibleCapabilityIds('MATERIAL_RECONCILIATION', ['dashboard', 'weekly-menu', 'purchasing', 'warehouse', 'reconciliation', 'admin-data'])).toEqual([
      'dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data',
    ])
  })

  it('fails closed when reconciliation capabilities come from a stale or mismatched backend', () => {
    expect(getCapabilityConfigurationError({ mode: 'MATERIAL_RECONCILIATION', capabilities: { navigation: ['dashboard', 'weekly-menu'], pageTabs: { 'weekly-menu': ['schedule'] } } })).toContain('Phiên bản máy chủ')
    expect(getCapabilityConfigurationError({ mode: 'MATERIAL_RECONCILIATION', capabilities: { navigation: ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'], pageTabs: { 'weekly-menu': ['schedule', 'material-demand'], warehouse: ['demand', 'movement'], 'admin-data': ['bom-import', 'audit'] } } })).toBeUndefined()
    expect(getCapabilityConfigurationError({ mode: 'DEFAULT', capabilities: { navigation: [], pageTabs: {} } })).toBeUndefined()
  })

  it('uses user labels', () => expect(modeLabels).toEqual({ DEFAULT: 'Mặc định', MATERIAL_RECONCILIATION: 'Đối chiếu nguyên liệu' }))
})
