import { describe, expect, it } from 'vitest'
import weeklyMenuSource from '@/features/projects/pages/ReconciliationWeeklyMenuPage.tsx?raw'
import warehouseSource from '@/features/warehouse/pages/ReconciliationWarehousePage.tsx?raw'
import reconciliationSource from '@/features/reconciliation/pages/ReconciliationPage.tsx?raw'
import adminBomSource from '@/app/pages/admin-data/AdminBomPanel.tsx?raw'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'

describe('material reconciliation UI contracts', () => {
  it('owns the weekly-menu work object in validated URL query state', () => {
    expect(buildWeeklyMenuRoute({ view: 'demand', customerId: 'customer 1', weekStartDate: '2026-08-24' }))
      .toBe('/weekly-menu?view=demand&customerId=customer+1&weekStartDate=2026-08-24')
    expect(weeklyMenuSource).toContain("value === 'schedule' || value === 'demand'")
    expect(weeklyMenuSource).toContain("searchParams.get('customerId')")
    expect(weeklyMenuSource).toContain("searchParams.get('weekStartDate')")
  })

  it('renders reason-specific schedule recovery outside the generic table empty row', () => {
    expect(weeklyMenuSource).toContain('getReconciliationScheduleEmptyState')
    expect(weeklyMenuSource).toContain('<EmptyState')
    expect(weeklyMenuSource).toContain('scheduleEmptyState.actionLabel')
  })

  it('keeps warehouse tab semantics and the prerequisite action unambiguous', () => {
    expect(warehouseSource).toContain('id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"')
    expect(warehouseSource).toContain('id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab"')
    expect(warehouseSource).toContain("buildWeeklyMenuRoute({ view: 'demand' })")
    expect(warehouseSource).toContain("activeView === 'demand' && batch && <Button")
    expect(warehouseSource).toContain("searchParams.get('batchId') ?? persistedSelection.batchId ?? ''")
    expect(warehouseSource).toContain('Số xuất được lấy đúng bằng số còn lại của lô đã khóa.')
  })

  it('keeps reconciliation scope controls compact and makes the no-batch prerequisite actionable', () => {
    expect(reconciliationSource).toContain('<QueryViewBoundary geometry="compact"')
    expect(reconciliationSource).toContain("geometry={selectedId ? 'table' : 'compact'}")
    expect(reconciliationSource).toContain('data-ui-work-surface="reconciliation-scope"')
    expect(reconciliationSource).toContain("batchesView.phase === 'ready' && batches.length === 0")
    expect(reconciliationSource).toContain('title="Chưa có lô đối chiếu"')
    expect(reconciliationSource).toContain("buildWeeklyMenuRoute({ view: 'demand' })")
  })

  it('uses canonical dialogs and shared user-language presentation seams', () => {
    expect(reconciliationSource).toContain('<Dialog open={Boolean(detailLine)}')
    expect(reconciliationSource).toContain('getWorkflowStatusPresentation(item.status)')
    expect(warehouseSource).toContain('getWorkflowStatusPresentation(issue.status)')
    expect(adminBomSource).toContain('formatUnit(line.unit)')
    expect(adminBomSource).not.toContain('line.bomStatusLabel || line.bomStatus')
  })
})
