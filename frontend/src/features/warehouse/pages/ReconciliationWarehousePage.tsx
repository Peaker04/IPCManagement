import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { OperationalFrame, SectionPanel, StatusBadge, TableViewport, ViewSwitcher } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGetWarehouseSelectorQuery } from '@/api/warehouseApi'
import { resolveOperationalWarehouseContext } from '@/lib/operationalWarehouseContext'
import { formatDateTime, formatQuantityWithUnit } from '@/lib/formatters'
import { compareIssueQuantity, issueQuantityDifference } from './reconciliationIssueQuantity'
import { buildWeeklyMenuRoute, ROUTES } from '@/lib/routeConfig'
import { readReconciliationSelection, type ReconciliationWarehouseView, writeReconciliationSelection, visibleTabIds } from '@/lib/navigationPreferences'
import { eligiblePageTabs } from '@/lib/systemOperationEligibility'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { useCreateReconciliationIssueMutation, useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, useListReconciliationIssueHistoryQuery, type ReconciliationIssueHistoryItem } from '@/api/reconciliationApi'
import { ReconciliationIssueDetailDialog } from '@/features/reconciliation/ReconciliationIssueDetailDialog'
import { ReconciliationIssueHistoryTable } from '@/features/reconciliation/ReconciliationIssueHistoryTable'
import { ReconciliationLifecycleStrip } from '@/features/reconciliation/ReconciliationLifecycleStrip'
import { getReconciliationLifecyclePresentation } from '@/features/reconciliation/reconciliationLifecyclePresentation'

const isReconciliationWarehouseView = (value: string | null | undefined): value is ReconciliationWarehouseView => value === 'demand' || value === 'movement'

const errorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return 'Không tạo được phiếu xuất. Hãy tải lại danh sách cần xuất rồi thử lại.'
}

export default function ReconciliationWarehousePage() {
  const operation = useSystemOperation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const persistedSelection = readReconciliationSelection()
  const batchId = searchParams.get('batchId') ?? persistedSelection.batchId ?? ''
  const tabs = eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', operation?.capabilities.pageTabs.warehouse ?? [], visibleTabIds('warehouse'))
  const requestedView = searchParams.get('view') ?? persistedSelection.warehouseView
  const activeView = tabs.includes(requestedView ?? '') && isReconciliationWarehouseView(requestedView)
    ? requestedView
    : (tabs[0] as ReconciliationWarehouseView | undefined)
  const batchesQuery = useListReconciliationBatchesQuery()
  const batchQuery = useGetReconciliationBatchQuery(batchId, { skip: !batchId, refetchOnMountOrArgChange: true })
  const historyQuery = useListReconciliationIssueHistoryQuery(batchId, { skip: !batchId || activeView !== 'movement', refetchOnMountOrArgChange: true })
  const { data: warehouses = [], isError: warehouseError } = useGetWarehouseSelectorQuery()
  const warehouse = resolveOperationalWarehouseContext(warehouses)
  const [createIssue, { isLoading: isCreating }] = useCreateReconciliationIssueMutation()
  const batch = batchQuery.currentData ?? batchQuery.data
  const hasLinkedIssue = Boolean(batch && ['IN_PROGRESS', 'COMPLETED'].includes(batch.status) && batch.lines.some((line) => line.issuedQuantity != null))
  const remainingLines = useMemo(() => hasLinkedIssue ? [] : batch?.lines ?? [], [batch?.lines, hasLinkedIssue])
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, string>>({})
  const [varianceReasons, setVarianceReasons] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string>()
  const selectedIssueId = searchParams.get('issueId')
  const selectedIssue = historyQuery.data?.items.find((issue) => issue.issueId === selectedIssueId)
  const [supplementalOpen, setSupplementalOpen] = useState(false)
  const [supplementalLineId, setSupplementalLineId] = useState('')
  const [supplementalQuantity, setSupplementalQuantity] = useState('')
  const [supplementalReason, setSupplementalReason] = useState('')
  const issueInputInvalid = remainingLines.some((line) => {
    const quantity = Number(issuedQuantities[line.batchLineId] ?? line.requiredQuantity - (line.issuedQuantity ?? 0))
    const relation = compareIssueQuantity(quantity, line.requiredQuantity)
    return relation === 'invalid' || (relation === 'over' && !varianceReasons[line.batchLineId]?.trim())
  })

  const fillExactRequiredQuantities = () => {
    setIssuedQuantities(Object.fromEntries(remainingLines.map((line) => [line.batchLineId, String(line.requiredQuantity)])))
    setVarianceReasons({})
  }

  const updateRoute = (updates: { view?: ReconciliationWarehouseView; batchId?: string }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.batchId !== undefined) {
      if (updates.batchId) next.set('batchId', updates.batchId)
      else next.delete('batchId')
      next.delete('issueId')
    }
    if (updates.view !== undefined) {
      next.set('view', updates.view)
      if (updates.view !== 'movement') next.delete('issueId')
    }
    setSearchParams(next, { replace: true })
  }

  const openIssue = (issue: ReconciliationIssueHistoryItem) => {
    const next = new URLSearchParams(searchParams)
    next.set('issueId', issue.issueId)
    setSearchParams(next)
  }

  const closeIssue = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('issueId')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!activeView) return
    const hasCorrectView = searchParams.get('view') === activeView
    const hasCorrectBatch = !batchId || searchParams.get('batchId') === batchId
    if (hasCorrectView && hasCorrectBatch) return
    const next = new URLSearchParams(searchParams)
    next.set('view', activeView)
    if (batchId) next.set('batchId', batchId)
    setSearchParams(next, { replace: true })
  }, [activeView, batchId, searchParams, setSearchParams])

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
          issuedQty: Number(issuedQuantities[line.batchLineId] ?? line.requiredQuantity - (line.issuedQuantity ?? 0)),
          varianceReason: varianceReasons[line.batchLineId]?.trim() || undefined,
        })),
      }).unwrap()
      setFeedback('Đã tạo phiếu xuất kho từ đúng lô đối chiếu. Số đã xuất đang được cập nhật từ phiếu liên kết.')
      await batchQuery.refetch()
      updateRoute({ view: 'movement' })
    } catch (error) {
      setFeedback(errorMessage(error))
    }
  }

  const createSupplemental = async () => {
    const line = batch?.lines.find((item) => item.batchLineId === supplementalLineId)
    const quantity = Number(supplementalQuantity)
    if (!batch || !line || !warehouse.warehouse?.warehouseId || !Number.isFinite(quantity) || quantity <= 0 || !supplementalReason.trim()) return
    setFeedback(undefined)
    try {
      await createIssue({
        commandId: `reconciliation-supplemental-${crypto.randomUUID()}`,
        expectedVersion: batch.version,
        issueDate: new Date().toISOString().slice(0, 10),
        warehouseId: warehouse.warehouse.warehouseId,
        reconciliationBatchId: batch.batchId,
        isSupplemental: true,
        lines: [{ ingredientId: line.ingredientId, unitId: line.canonicalUnitId, reconciliationBatchLineId: line.batchLineId, requestedQty: quantity, issuedQty: quantity, varianceReason: supplementalReason.trim() }],
      }).unwrap()
      setSupplementalOpen(false); setSupplementalLineId(''); setSupplementalQuantity(''); setSupplementalReason('')
      setFeedback('Đã tạo phiếu xuất thêm và cộng số lượng vào dòng nguyên liệu tương ứng.')
      await batchQuery.refetch()
    } catch (error) { setFeedback(errorMessage(error)) }
  }

  if (tabs.length === 0) return <OperationalFrame><section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Không còn khu vực Kho đang hiển thị</h2><p className="mt-2 text-sm text-slate-600">Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.</p><Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>Mở thiết lập hiển thị</Link></section></OperationalFrame>

  return <OperationalFrame>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div><h2 className="text-lg font-semibold">Xuất kho theo định lượng đã chốt</h2><p className="mt-1 text-sm text-slate-600">Kho vận hành: {warehouse.warehouse?.warehouseName ?? 'Chưa xác định'}.</p></div>
        {activeView === 'demand' && batch?.status === 'IN_PROGRESS' && hasLinkedIssue && <Button type="button" onClick={() => setSupplementalOpen(true)}>Xuất thêm nguyên liệu</Button>}
        {activeView === 'demand' && batch?.status === 'TRANSFERRED' && !hasLinkedIssue && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={remainingLines.length === 0 || isCreating} onClick={fillExactRequiredQuantities}>Điền đủ toàn bộ</Button><Button type="button" disabled={remainingLines.length === 0 || warehouse.state !== 'ready' || isCreating || issueInputInvalid} onClick={() => void create()}>{isCreating ? 'Đang xác nhận xuất...' : `Xác nhận và tạo phiếu xuất (${remainingLines.length})`}</Button></div>}
      </div>
      {batch && <ReconciliationLifecycleStrip status={batch.status} batchId={batch.batchId} showAction={false} />}
      {feedback && <p role="status" className="rounded-md border border-slate-200 bg-white p-3 text-sm">{feedback}</p>}
      {warehouseError && <p role="alert" className="text-sm text-red-700">Không tải được kho vận hành. Chưa thể tạo phiếu xuất.</p>}
      {(batchesQuery.data?.length ?? 0) > 1 && <label className="grid max-w-md gap-1 text-sm font-medium">Chọn lô của khách hàng<Select value={batchId || null} onValueChange={(value) => value && updateRoute({ batchId: value, view: 'demand' })}><SelectTrigger aria-label="Chọn lô cần xuất"><SelectValue placeholder="Chọn lô" /></SelectTrigger><SelectContent>{batchesQuery.data?.filter((item) => ['READY', 'TRANSFERRED', 'IN_PROGRESS'].includes(item.status)).map((item) => <SelectItem key={item.batchId} value={item.batchId}>{formatDateTime(item.createdAt)} · {getReconciliationLifecyclePresentation(item.status).label}</SelectItem>)}</SelectContent></Select></label>}
      {!batchId && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Chưa chọn lô cần xuất</h2><p className="mt-2 text-sm text-slate-600">Mở Định lượng xuất kho từ Thực đơn tuần để giữ đúng phạm vi khách hàng và tuần.</p><Link className="ipc-button ipc-button-primary mt-4" to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở Định lượng xuất kho</Link></section>}
      {batchId && activeView && <>
        <ViewSwitcher compact ariaLabel="Chọn góc nhìn kho đối chiếu" tabs={tabs.map((id) => ({ id: `warehouse-${id}`, label: id === 'demand' ? 'Danh sách cần xuất' : 'Lịch sử xuất kho' }))} activeTab={`warehouse-${activeView}`} onTabChange={(id) => updateRoute({ view: id.replace('warehouse-', '') as ReconciliationWarehouseView })} />
        {activeView === 'demand' && <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"><SectionPanel title="Danh sách cần xuất" description={hasLinkedIssue ? 'Phiếu xuất của lô đã được tạo. Số thực xuất bên dưới chỉ đọc và được dùng để đối chiếu.' : 'Nhập số thực tế xuất cho từng nguyên liệu. Nếu xuất vượt số cần, nhập lý do trước khi xác nhận phiếu.'}>
          <TableViewport ariaLabel="Danh sách nguyên liệu cần xuất" caption="Danh sách nguyên liệu của đúng lô đối chiếu">
            <table className="ipc-data-table">
              <thead><tr><th>Nguyên liệu</th><th className="text-right">Cần xuất</th><th className="text-right">Thực xuất</th><th>Lý do xuất vượt</th><th>Trạng thái</th></tr></thead>
              <tbody>{(batch?.lines ?? []).map((line) => {
                const remaining = line.requiredQuantity - (line.issuedQuantity ?? 0)
                const entered = Number(issuedQuantities[line.batchLineId] ?? remaining)
                const relation = compareIssueQuantity(entered, line.requiredQuantity)
                const committedRelation = line.issuedQuantity == null ? null : compareIssueQuantity(line.issuedQuantity, line.requiredQuantity)
                const difference = issueQuantityDifference(entered, line.requiredQuantity)
                const overIssued = relation === 'over'
                const statusRelation = committedRelation ?? relation
                const statusLabel = committedRelation
                  ? committedRelation === 'over' ? 'Đã xuất vượt' : committedRelation === 'under' ? 'Đã xuất thiếu' : 'Đã xuất đủ'
                  : relation === 'over' ? 'Dự kiến xuất vượt' : relation === 'under' ? 'Dự kiến xuất thiếu' : relation === 'exact' ? 'Dự kiến xuất đủ' : 'Chưa nhập'
                return <tr key={line.batchLineId}>
                  <td><span className="block font-medium">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span></td>
                  <td className="text-right tabular-nums">{formatQuantityWithUnit(line.requiredQuantity, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</td>
                  <td>
                    <label className="sr-only" htmlFor={`issued-${line.batchLineId}`}>Thực xuất {line.ingredientName}</label>
                    <div className="flex items-center justify-end gap-2">
                      <Input id={`issued-${line.batchLineId}`} aria-label={`Thực xuất ${line.ingredientName}`} type="number" min="0.000001" step="0.000001" inputMode="decimal" disabled={hasLinkedIssue} value={hasLinkedIssue ? String(line.issuedQuantity ?? 0) : issuedQuantities[line.batchLineId] ?? String(remaining)} onChange={(event) => setIssuedQuantities((current) => ({ ...current, [line.batchLineId]: event.target.value }))} className="w-36 text-right tabular-nums" />
                      <span className="w-16 text-xs text-slate-600">{line.canonicalUnitName}</span>
                    </div>
                  </td>
                  <td>{overIssued ? <Textarea aria-label={`Lý do xuất vượt ${line.ingredientName}`} value={varianceReasons[line.batchLineId] ?? ''} onChange={(event) => setVarianceReasons((current) => ({ ...current, [line.batchLineId]: event.target.value }))} placeholder="Nhập lý do" className="min-h-16 min-w-48" /> : <span className="text-sm text-slate-500">Không cần</span>}</td>
                  <td>
                    <StatusBadge variant={statusRelation === 'over' ? 'warning' : statusRelation === 'under' || statusRelation === 'invalid' ? 'danger' : 'success'}>{statusLabel}</StatusBadge>
                    {!committedRelation && (relation === 'under' || relation === 'over') && <span className="mt-1 block text-xs text-slate-600">{relation === 'under' ? 'Thiếu' : 'Vượt'} {formatQuantityWithUnit(Math.abs(difference), line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</span>}
                  </td>
                </tr>
              })}</tbody>
            </table>
          </TableViewport>
        </SectionPanel></div>}
        {activeView === 'movement' && <div id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab"><SectionPanel title="Lịch sử xuất kho" description="Chỉ các phiếu xuất có liên kết chính xác với lô đang chọn.">
          {historyQuery.isLoading ? <p role="status">Đang tải lịch sử xuất kho...</p> : historyQuery.isError ? <p role="alert">Không tải được lịch sử xuất kho.</p> : (historyQuery.data?.items.length ?? 0) === 0 ? <p>Chưa có phiếu xuất kho liên kết.</p> : <ReconciliationIssueHistoryTable issues={historyQuery.data?.items ?? []} batchLines={batch?.lines} onOpenIssue={openIssue} />}
          <div className="mt-4 flex justify-end"><Link className="ipc-button ipc-button-primary" to={`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(batchId)}`}>Mở đối chiếu nguyên liệu</Link></div>
        </SectionPanel></div>}
      </>}
    </div>
    <ReconciliationIssueDetailDialog
      issueId={selectedIssueId}
      open={Boolean(selectedIssueId)}
      expectedBatchId={batchId}
      initialIssue={selectedIssue}
      onClose={closeIssue}
      onOpenBatch={(selectedBatchId, issueId) => navigate(`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(selectedBatchId)}&issueId=${encodeURIComponent(issueId)}`)}
    />
    <Dialog open={supplementalOpen} onOpenChange={setSupplementalOpen}>
      <DialogContent size="sm" aria-label="Xuất thêm nguyên liệu">
        <DialogHeader><DialogTitle>Xuất thêm nguyên liệu</DialogTitle><DialogDescription>Chọn một nguyên liệu đã có trong lô. Số xuất thêm sẽ được cộng vào dòng đối chiếu hiện tại.</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm font-medium">Nguyên liệu<Select value={supplementalLineId || null} onValueChange={(value) => setSupplementalLineId(value ?? '')}><SelectTrigger aria-label="Chọn nguyên liệu xuất thêm"><SelectValue placeholder="Chọn nguyên liệu">{batch?.lines.find((line) => line.batchLineId === supplementalLineId)?.ingredientName}</SelectValue></SelectTrigger><SelectContent>{batch?.lines.map((line) => <SelectItem key={line.batchLineId} value={line.batchLineId}>{line.ingredientName}</SelectItem>)}</SelectContent></Select></label>
        <label className="grid gap-1 text-sm font-medium">Số lượng xuất thêm<Input type="number" min="0.000001" step="0.000001" value={supplementalQuantity} onChange={(event) => setSupplementalQuantity(event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-medium">Lý do<Textarea value={supplementalReason} onChange={(event) => setSupplementalReason(event.target.value)} placeholder="Ví dụ: Bếp đề nghị bổ sung cho ca trưa" /></label>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setSupplementalOpen(false)}>Hủy</Button><Button type="button" disabled={isCreating || !supplementalLineId || Number(supplementalQuantity) <= 0 || !supplementalReason.trim()} onClick={() => void createSupplemental()}>{isCreating ? 'Đang tạo phiếu...' : 'Xác nhận xuất thêm'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </OperationalFrame>
}
