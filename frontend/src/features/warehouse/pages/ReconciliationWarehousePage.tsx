import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OperationalFrame, SectionPanel, StatusBadge, TableViewport, ViewSwitcher } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useGetWarehouseSelectorQuery } from '@/api/warehouseApi'
import { resolveOperationalWarehouseContext } from '@/lib/operationalWarehouseContext'
import { formatQuantityWithUnit } from '@/lib/formatters'
import { buildWeeklyMenuRoute, ROUTES } from '@/lib/routeConfig'
import { readReconciliationSelection, type ReconciliationWarehouseView, writeReconciliationSelection, visibleTabIds } from '@/lib/navigationPreferences'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { eligiblePageTabs } from '@/features/system-operation/systemOperationEligibility'
import { useSystemOperation } from '@/features/system-operation/systemOperationContext'
import { useCreateReconciliationIssueMutation, useGetReconciliationBatchQuery, useListReconciliationIssueHistoryQuery } from '@/features/reconciliation/reconciliationApi'

const isReconciliationWarehouseView = (value: string | null | undefined): value is ReconciliationWarehouseView => value === 'demand' || value === 'movement'

export default function ReconciliationWarehousePage() {
  const operation = useSystemOperation()
  const [searchParams, setSearchParams] = useSearchParams()
  const batchId = searchParams.get('batchId') ?? ''
  const tabs = eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', operation?.capabilities.pageTabs.warehouse ?? [], visibleTabIds('warehouse'))
  const persistedSelection = readReconciliationSelection()
  const requestedView = searchParams.get('view') ?? persistedSelection.warehouseView
  const activeView = tabs.includes(requestedView ?? '') && isReconciliationWarehouseView(requestedView)
    ? requestedView
    : (tabs[0] as ReconciliationWarehouseView | undefined)
  const batchQuery = useGetReconciliationBatchQuery(batchId, { skip: !batchId })
  const historyQuery = useListReconciliationIssueHistoryQuery(batchId, { skip: !batchId || activeView !== 'movement' })
  const { data: warehouses = [], isError: warehouseError } = useGetWarehouseSelectorQuery()
  const warehouse = resolveOperationalWarehouseContext(warehouses)
  const [createIssue, { isLoading: isCreating }] = useCreateReconciliationIssueMutation()
  const batch = batchQuery.currentData ?? batchQuery.data
  const remainingLines = useMemo(() => batch?.lines.filter((line) => line.requiredQuantity - (line.issuedQuantity ?? 0) > 0) ?? [], [batch?.lines])
  const [feedback, setFeedback] = useState<string>()

  const updateRoute = (updates: { view?: ReconciliationWarehouseView; batchId?: string }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.batchId !== undefined) {
      if (updates.batchId) next.set('batchId', updates.batchId)
      else next.delete('batchId')
    }
    if (updates.view !== undefined) {
      next.set('view', updates.view)
    }
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!activeView || searchParams.get('view') === activeView) return
    const next = new URLSearchParams(searchParams)
    next.set('view', activeView)
    setSearchParams(next, { replace: true })
  }, [activeView, searchParams, setSearchParams])

  useEffect(() => {
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: batchId || undefined,
      warehouseView: activeView,
    })
  }, [activeView, batchId])

  const create = async () => {
    if (!batch || !warehouse.warehouse?.warehouseId || remainingLines.length === 0) return
    setFeedback(undefined)
    try {
      await createIssue({
        commandId: `reconciliation-issue-${batch.batchId}`,
        expectedVersion: batch.version,
        issueDate: new Date().toISOString().slice(0, 10),
        warehouseId: warehouse.warehouse.warehouseId,
        reconciliationBatchId: batch.batchId,
        lines: remainingLines.map((line) => ({
          ingredientId: line.ingredientId,
          unitId: line.canonicalUnitId,
          reconciliationBatchLineId: line.batchLineId,
          requestedQty: line.requiredQuantity,
          issuedQty: line.requiredQuantity - (line.issuedQuantity ?? 0),
        })),
      }).unwrap()
      setFeedback('Đã tạo phiếu xuất kho từ đúng lô đối chiếu. Số đã xuất đang được cập nhật từ phiếu liên kết.')
      await batchQuery.refetch()
      updateRoute({ view: 'movement' })
    } catch {
      setFeedback('Chưa tạo được phiếu xuất. Kiểm tra tồn kho vận hành và tải lại lô trước khi thử lại.')
    }
  }

  if (tabs.length === 0) return <OperationalFrame><section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Không còn khu vực Kho đang hiển thị</h2><p className="mt-2 text-sm text-slate-600">Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.</p><Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>Mở thiết lập hiển thị</Link></section></OperationalFrame>

  return <OperationalFrame>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div><h2 className="text-lg font-semibold">Xuất kho theo định lượng đã chốt</h2><p className="mt-1 text-sm text-slate-600">Kho vận hành: {warehouse.warehouse?.warehouseName ?? 'Chưa xác định'}.</p></div>
        {activeView === 'demand' && batch && <Button type="button" disabled={remainingLines.length === 0 || warehouse.state !== 'ready' || isCreating} onClick={() => void create()}>{isCreating ? 'Đang tạo phiếu...' : `Tạo phiếu xuất ${remainingLines.length} dòng`}</Button>}
      </div>
      {feedback && <p role="status" className="rounded-md border border-slate-200 bg-white p-3 text-sm">{feedback}</p>}
      {warehouseError && <p role="alert" className="text-sm text-red-700">Không tải được kho vận hành. Chưa thể tạo phiếu xuất.</p>}
      {!batchId && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Chưa chọn lô cần xuất</h2><p className="mt-2 text-sm text-slate-600">Mở Định lượng xuất kho từ Thực đơn tuần để giữ đúng phạm vi khách hàng và tuần.</p><Link className="ipc-button ipc-button-primary mt-4" to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở Định lượng xuất kho</Link></section>}
      {batchId && activeView && <>
        <ViewSwitcher compact ariaLabel="Chọn góc nhìn kho đối chiếu" tabs={tabs.map((id) => ({ id: `warehouse-${id}`, label: id === 'demand' ? 'Danh sách cần xuất' : 'Lịch sử xuất kho' }))} activeTab={`warehouse-${activeView}`} onTabChange={(id) => updateRoute({ view: id.replace('warehouse-', '') as ReconciliationWarehouseView })} />
        {activeView === 'demand' && <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"><SectionPanel title="Danh sách cần xuất" description="Số còn lại được tính từ định lượng chốt trừ số trên phiếu xuất liên kết.">
          <TableViewport ariaLabel="Danh sách nguyên liệu cần xuất" caption="Danh sách nguyên liệu của đúng lô đối chiếu">
            <table className="ipc-data-table"><thead><tr><th>Nguyên liệu</th><th className="text-right">Cần xuất</th><th className="text-right">Đã xuất</th><th className="text-right">Còn lại</th><th>Trạng thái</th></tr></thead><tbody>{(batch?.lines ?? []).map((line) => { const remaining = line.requiredQuantity - (line.issuedQuantity ?? 0); return <tr key={line.batchLineId}><td><span className="block font-medium">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span><span className="text-xs text-slate-600">{line.ingredientCode || ''}</span></td><td className="text-right tabular-nums">{formatQuantityWithUnit(line.requiredQuantity, line.canonicalUnitName ?? '')}</td><td className="text-right tabular-nums">{formatQuantityWithUnit(line.issuedQuantity ?? 0, line.canonicalUnitName ?? '')}</td><td className="text-right tabular-nums">{formatQuantityWithUnit(remaining, line.canonicalUnitName ?? '')}</td><td><StatusBadge variant={remaining <= 0 ? 'success' : 'warning'}>{remaining <= 0 ? 'Đã xuất đủ' : 'Cần xuất'}</StatusBadge></td></tr> })}</tbody></table>
          </TableViewport>
        </SectionPanel></div>}
        {activeView === 'movement' && <div id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab"><SectionPanel title="Lịch sử xuất kho" description="Chỉ các phiếu xuất có liên kết chính xác với lô đang chọn.">
          {historyQuery.isLoading ? <p>Đang tải lịch sử xuất kho...</p> : historyQuery.isError ? <p role="alert">Không tải được lịch sử xuất kho.</p> : (historyQuery.data?.items.length ?? 0) === 0 ? <p>Chưa có phiếu xuất kho liên kết.</p> : <ul className="divide-y divide-slate-200">{historyQuery.data?.items.map((issue) => { const status = getWorkflowStatusPresentation(issue.status); return <li key={issue.issueId} className="flex items-center justify-between gap-3 py-3"><span className="font-medium">{issue.issueCode}</span><StatusBadge variant={status.tone}>{status.label}</StatusBadge></li> })}</ul>}
          <div className="mt-4 flex justify-end"><Link className="ipc-button ipc-button-primary" to={`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(batchId)}`}>Mở đối chiếu</Link></div>
        </SectionPanel></div>}
      </>}
    </div>
  </OperationalFrame>
}
