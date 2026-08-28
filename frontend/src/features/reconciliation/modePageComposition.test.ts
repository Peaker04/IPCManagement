import { describe, expect, it } from 'vitest'
import weeklyRouter from '@/features/projects/pages/WeeklyMenuPage.tsx?raw'
import reconciliationWeekly from '@/features/projects/pages/ReconciliationWeeklyMenuPage.tsx?raw'
import warehouseRouter from '@/features/warehouse/pages/WarehousePage.tsx?raw'
import reconciliationWarehouse from '@/features/warehouse/pages/ReconciliationWarehousePage.tsx?raw'
import adminRouter from '@/app/pages/AdminDataPage.tsx?raw'
import reconciliationAdmin from '@/app/pages/admin-data/useReconciliationAdminDataPageModel.ts?raw'
import reconciliationPage from './pages/ReconciliationPage.tsx?raw'

describe('operation-mode page composition boundaries', () => {
  it('routes Weekly Menu before default query owners mount', () => {
    expect(weeklyRouter).toContain("operation?.mode === 'MATERIAL_RECONCILIATION'")
    expect(weeklyRouter).toContain('<ReconciliationWeeklyMenuPage />')
    expect(reconciliationWeekly).toContain("type ReconciliationView = 'schedule' | 'demand'")
    expect(reconciliationWeekly).toContain("label: 'Kế hoạch tuần'")
    expect(reconciliationWeekly).toContain("label: 'Định lượng xuất kho'")
    expect(reconciliationWeekly).not.toMatch(/use(?:GetCustomerContracts|GetMenuSchedules|GetMealQuantityPlans|MaterialDemand|PurchaseSummary|MenuCost|DishMaterials)/)
    expect(reconciliationWeekly).toMatch(/activeView === 'schedule'[\s\S]*ClosedLoopTransferPanel/)
  })

  it('keeps Warehouse, Reconciliation and Admin Data dedicated', () => {
    expect(warehouseRouter).toContain('<ReconciliationWarehousePage />')
    expect(reconciliationWarehouse).not.toContain('DefaultWarehousePage')
    expect(reconciliationPage).not.toContain('WarehousePage')
    expect(adminRouter).toContain('<ReconciliationAdminDataPage />')
    expect(reconciliationAdmin).toContain('useAdminBomPanelModel')
    expect(reconciliationAdmin).toContain('useAdminAuditPanelModel')
    expect(reconciliationAdmin).not.toMatch(/useAdmin(?:Cleanup|Employees|Inventory|Statistics)PanelModel/)
  })
})
