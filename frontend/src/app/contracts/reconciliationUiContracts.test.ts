import { describe, expect, it } from 'vitest'
import weeklyMenuSource from '@/features/projects/pages/WeeklyMenuPage.tsx?raw'
import warehouseSource from '@/features/warehouse/pages/ReconciliationWarehousePage.tsx?raw'
import reconciliationSource from '@/features/reconciliation/pages/ReconciliationPage.tsx?raw'
import issueHistorySource from '@/components/reconciliation/ReconciliationIssueHistoryTable.tsx?raw'
import drawerSource from '@/components/ui/drawer.tsx?raw'
import adminBomSource from '@/app/pages/admin-data/AdminBomPanel.tsx?raw'
import adminSourceChangesSource from '@/app/pages/admin-data/AdminSourceChangesPanel.tsx?raw'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'

describe('material reconciliation UI contracts', () => {
  it('keeps the mounted weekly-menu work object in validated URL query state', () => {
    expect(buildWeeklyMenuRoute({ view: 'demand', customerId: 'customer 1', weekStartDate: '2026-08-24' }))
      .toBe('/weekly-menu?view=demand&customerId=customer+1&weekStartDate=2026-08-24')
    expect(weeklyMenuSource).toContain('const [searchParams, setSearchParams] = useSearchParams()')
    expect(weeklyMenuSource).toContain('readReconciliationWeeklyMenuRoute(searchParams)')
    expect(weeklyMenuSource).toContain('reconciliationRouteScope.customerId')
    expect(weeklyMenuSource).toContain('reconciliationRouteScope.weekStartDate')
    expect(weeklyMenuSource).toContain('reconciliationRouteScope.view')
    expect(weeklyMenuSource).toContain('updateReconciliationScope({ view })')
    expect(weeklyMenuSource).toContain('selectedCustomerId={effectiveMenuCustomerId}')
  })

  it('keeps schedule readiness and query recovery on the mounted owner', () => {
    expect(weeklyMenuSource).toContain('<WeeklyMenuReadiness readiness={readiness} />')
    expect(weeklyMenuSource).toContain('<QueryViewBoundary preserveFallback')
  })

  it('keeps warehouse tab semantics and the prerequisite action unambiguous', () => {
    expect(warehouseSource).toContain('id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"')
    expect(warehouseSource).toContain('id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab"')
    expect(warehouseSource).toContain("buildWeeklyMenuRoute({ view: 'demand' })")
    expect(warehouseSource).toContain("const demandActions = canCreateIssue && dailyProjection?.compatibility.canIssueByDate")
    expect(warehouseSource).toContain("remainingLines.length > 0 && ['TRANSFERRED', 'IN_PROGRESS'].includes")
    expect(warehouseSource).toContain('Điền đủ ngày')
    expect(warehouseSource).toContain("'Dự kiến xuất đủ'")
    expect(warehouseSource).toContain('maximumFractionDigits: 6')
    expect(warehouseSource).toContain("hasLinkedIssue && batch?.status === 'IN_PROGRESS'")
    expect(warehouseSource).toContain("line.issuedQuantity == null ? <span className=\"text-slate-600\">Chưa xuất</span>")
    expect(warehouseSource).toContain('formatQuantityWithUnit(line.issuedQuantity,')
    expect(warehouseSource).not.toContain('formatQuantityWithUnit(line.issuedQuantity ?? 0')
    expect(warehouseSource).not.toContain('disabled={hasLinkedIssue}')
    expect(warehouseSource).toContain("'Đã xuất đủ'")
    expect(warehouseSource).toContain('Tạo phiếu xuất bổ sung')
    expect(warehouseSource).toContain('isSupplemental: true')
    expect(warehouseSource).toContain('Xác nhận xuất thêm')
    expect(warehouseSource).toContain("searchParams.get('batchId') ?? persistedSelection.batchId ?? ''")
    expect(warehouseSource).toContain('Nhập số thực tế xuất cho từng nguyên liệu.')
    expect(issueHistorySource).toContain('Lịch sử phiếu xuất của lô đối chiếu')
    expect(warehouseSource).toContain('showAction={false}')
    expect(warehouseSource).toContain('aria-label={`Thực xuất ${line.ingredientName}`}')
    expect(warehouseSource).toContain('aria-label={`Lý do xuất vượt ${line.ingredientName}`}')
    expect(warehouseSource).toContain('varianceReason: varianceReasons[line.dailyLineId]?.trim() || undefined')
  })

  it('keeps the issue drawer as a portal overlay without reflowing either master route', () => {
    expect(drawerSource).toContain('pointer-events-none')
    expect(drawerSource).toContain('absolute inset-y-0 right-0')
    expect(drawerSource).toContain('xl:w-2/5 xl:max-w-2xl')
    expect(warehouseSource).not.toContain('ipc-drawer-master')
    expect(reconciliationSource).not.toContain('ipc-drawer-master')
    expect(warehouseSource).not.toContain('data-drawer-open')
    expect(reconciliationSource).not.toContain('data-drawer-open')
  })

  it('keeps one batch-scoped source-change owner on the admin data workspace', () => {
    expect(adminSourceChangesSource).toContain('<ReconciliationSourceChangeLog batchId={effectiveBatchId} standalone />')
    expect(reconciliationSource).not.toContain('<ReconciliationSourceChangeLog')
    expect(warehouseSource).not.toContain('ReconciliationSourceChangeLog')
  })

  it('keeps reconciliation scope controls compact and makes the no-batch prerequisite actionable', () => {
    expect(reconciliationSource).toContain('<QueryViewBoundary geometry="compact"')
    expect(reconciliationSource).toContain("batchesView.phase === 'ready' && selectedId ? <QueryViewBoundary geometry=\"table\"")
    expect(reconciliationSource).toContain('data-ui-work-surface="reconciliation-scope"')
    expect(reconciliationSource).toContain("batchesView.phase === 'ready' && batches.length === 0")
    expect(reconciliationSource).toContain('title="Chưa có lô đối chiếu"')
    expect(reconciliationSource).toContain("buildWeeklyMenuRoute({ view: 'demand' })")
  })

  it('uses canonical dialogs and shared user-language presentation seams', () => {
    expect(reconciliationSource).toContain('<Dialog open={Boolean(detailLine)}')
    expect(reconciliationSource).toContain('getReconciliationLifecyclePresentation(item.status).label')
    expect(reconciliationSource).toContain('<ReconciliationIssueDetailDialog')
    expect(reconciliationSource).not.toContain("TRANSFERRED: { label: 'Hoàn tất'")
    expect(issueHistorySource).toContain('issueStatusLabel(issue)')
    expect(issueHistorySource).not.toContain('issueRoleLabel()')
    expect(adminBomSource).toContain('formatUnit(line.unit)')
    expect(adminBomSource).not.toContain('line.bomStatusLabel || line.bomStatus')
  })
})
