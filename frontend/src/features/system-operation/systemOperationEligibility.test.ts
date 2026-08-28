import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { eligiblePageTabs, getCapabilityConfigurationError, isRouteEligible, modeLabels, retainedRoutes } from './systemOperationEligibility'

describe('system operation route matrix', () => {
  it('keeps the explicit default golden path', () => {
    for (const path of Object.values(ROUTES)) expect(isRouteEligible('DEFAULT', path)).toBe(true)
  })

  it('keeps only the closed-loop workflow in reconciliation mode', () => {
    expect(retainedRoutes('MATERIAL_RECONCILIATION')).toEqual([
      ROUTES.DASHBOARD, ROUTES.WEEKLY_MENU, ROUTES.WAREHOUSE, ROUTES.RECONCILIATION, ROUTES.ADMIN_DATA,
    ])
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.PURCHASING)).toBe(false)
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.REPORTS)).toBe(false)
    expect(isRouteEligible('MATERIAL_RECONCILIATION', ROUTES.WAREHOUSE)).toBe(true)
  })

  it('keeps mandatory closed-loop steps visible and maps material demand identity', () => {
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'weekly-menu', ['schedule', 'material-demand'], ['schedule'])).toEqual(['schedule', 'demand'])
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', ['demand', 'movement'], [])).toEqual(['demand', 'movement'])
    expect(eligiblePageTabs('MATERIAL_RECONCILIATION', 'admin-data', ['bom-import', 'audit'], ['bom-import'])).toEqual(['bom-import', 'audit'])
    expect(eligiblePageTabs('DEFAULT', 'weekly-menu', ['schedule', 'demand'], ['schedule'])).toEqual(['schedule'])
  })

  it('fails closed when reconciliation capabilities come from a stale or mismatched backend', () => {
    expect(getCapabilityConfigurationError({ mode: 'MATERIAL_RECONCILIATION', capabilities: { navigation: ['dashboard', 'weekly-menu'], pageTabs: { 'weekly-menu': ['schedule'] } } })).toContain('Phiên bản máy chủ')
    expect(getCapabilityConfigurationError({ mode: 'MATERIAL_RECONCILIATION', capabilities: { navigation: ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'], pageTabs: { 'weekly-menu': ['schedule', 'material-demand'], warehouse: ['demand', 'movement'], 'admin-data': ['bom-import', 'audit'] } } })).toBeUndefined()
    expect(getCapabilityConfigurationError({ mode: 'DEFAULT', capabilities: { navigation: [], pageTabs: {} } })).toBeUndefined()
  })

  it('uses user labels', () => expect(modeLabels).toEqual({ DEFAULT: 'Mặc định', MATERIAL_RECONCILIATION: 'Đối chiếu nguyên liệu' }))
})
