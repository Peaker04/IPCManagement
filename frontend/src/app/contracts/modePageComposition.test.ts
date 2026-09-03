import { describe, expect, it } from 'vitest'
import weeklyRouter from '@/features/projects/pages/WeeklyMenuPage.tsx?raw'
import warehouseRouter from '@/features/warehouse/pages/WarehousePage.tsx?raw'
import reconciliationWarehouse from '@/features/warehouse/pages/ReconciliationWarehousePage.tsx?raw'
import adminRouter from '@/app/pages/AdminDataPage.tsx?raw'
import reconciliationAdmin from '@/app/pages/admin-data/useReconciliationAdminDataPageModel.ts?raw'
import reconciliationPage from '@/features/reconciliation/pages/ReconciliationPage.tsx?raw'
import dashboardRouter from '@/features/dashboard/pages/DashboardPage.tsx?raw'
import reconciliationDashboard from '@/features/dashboard/pages/ReconciliationDashboardPage.tsx?raw'
import contractsModel from '@/app/pages/admin-data/useAdminContractsPanelModel.ts?raw'
import routePreloaders from '@/routes/routeDataPreloaders.ts?raw'

describe('operation-mode page composition boundaries', () => {
  it('retains source authoring and completed serving owners in reconciliation Weekly Menu', () => {
    expect(weeklyRouter).toContain("isMaterialReconciliationMode")
    expect(weeklyRouter).toContain("label: isMaterialReconciliationMode ? 'Tổng hợp mua' : 'Nhu cầu'")
    expect(weeklyRouter).toContain("enabled: !isMaterialReconciliationMode && activeView === 'demand'")
    expect(weeklyRouter).toContain("isMaterialReconciliationMode && activeView === 'demand' ? <ClosedLoopTransferPanel")
    expect(weeklyRouter).toContain('useWeeklyMenuImport')
    expect(weeklyRouter).toContain('useWeeklyScheduleEditor')
    expect(weeklyRouter).toContain('useGetMenuSchedulesQuery')
    expect(weeklyRouter).toContain('useGetMealQuantityPlansQuery')
  })

  it('keeps Warehouse, Reconciliation and Admin Data dedicated', () => {
    expect(warehouseRouter).toContain('<ReconciliationWarehousePage />')
    expect(reconciliationWarehouse).not.toContain('DefaultWarehousePage')
    expect(reconciliationPage).not.toContain('WarehousePage')
    expect(adminRouter).toContain('<ReconciliationAdminDataPage />')
    expect(reconciliationAdmin).toContain('useAdminBomPanelModel')
    expect(reconciliationAdmin).toContain('useAdminAuditPanelModel')
    expect(reconciliationAdmin).not.toMatch(/useAdmin(?:Cleanup|Employees|Inventory|Statistics)PanelModel/)
    expect(reconciliationAdmin).toContain('useAdminContractsPanelModel(activeView, false)')
    expect(contractsModel).toContain('skip: !enabled ||')
  })

  it('routes Dashboard before legacy reports owners mount and disables reconciliation preloading', () => {
    expect(dashboardRouter).toContain('<ReconciliationDashboardPage />')
    expect(reconciliationDashboard).not.toMatch(/useWorkflowOverview|useGetOperationalKpisQuery|workflowApi|reportsApi/)
    expect(reconciliationDashboard).not.toMatch(/purchasing|reports/i)
    expect(reconciliationDashboard).toContain('md:grid-cols-2 xl:grid-cols-4')
    expect(reconciliationDashboard).toContain('aria-label="Các bước đối chiếu nguyên liệu"')
    expect(reconciliationDashboard).not.toContain('ipc-dashboard-gates')
    expect(routePreloaders).toContain("mode === 'MATERIAL_RECONCILIATION' && path === ROUTES.DASHBOARD")
  })
})
