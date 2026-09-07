import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { EmptyState, IdentifierText, OperationalFrame, QueryViewBoundary, SectionPanel } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime, formatUnit } from '@/lib/formatters'
import { readReconciliationSelection, writeReconciliationSelection } from '@/lib/navigationPreferences'
import { ReconciliationComparisonTable } from '../ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from '../ReconciliationDispositionDrawer'
import { useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, type ReconciliationLine } from '@/api/reconciliationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'
import { ReconciliationSourceChangeLog } from '../ReconciliationSourceChangeLog'
import { dispositionCategoryLabel } from '../reconciliationIssueCorrelation'
import { ReconciliationLifecycleStrip } from '../ReconciliationLifecycleStrip'
import { ReconciliationIssueDetailDialog } from '../ReconciliationIssueDetailDialog'
import { getReconciliationLifecyclePresentation, getReconciliationResultPresentation } from '../reconciliationLifecyclePresentation'

export default function ReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const batchesQuery = useListReconciliationBatchesQuery()
  const persistedSelection = readReconciliationSelection()
  const requestedId = searchParams.get('batchId') ?? persistedSelection.batchId ?? ''
  const selectedIssueId = searchParams.get('issueId') ?? ''
  const batches = useMemo(() => batchesQuery.currentData ?? batchesQuery.data ?? [], [batchesQuery.currentData, batchesQuery.data])
  const selectedId = batches.some((item) => item.batchId === requestedId)
    ? requestedId
    : batches[0]?.batchId ?? ''
  const selectedBatchSummary = batches.find((item) => item.batchId === selectedId)
  const batchesView = toLabeledQueryView(batchesQuery, 'danh sách lô đối chiếu', { instruction: 'Tải lại danh sách lô để chọn đúng phạm vi cần đối chiếu.' })
  const batchQuery = useGetReconciliationBatchQuery(selectedId, { skip: !selectedId, refetchOnMountOrArgChange: true })
  const batchView = toLabeledQueryView(batchQuery, 'lô đối chiếu đã chọn', { instruction: 'Chọn một lô để xem số cần xuất và số kho đã xuất.' })

  useEffect(() => {
    if (!batchesQuery.isSuccess || !selectedId || searchParams.get('batchId') === selectedId) return
    const next = new URLSearchParams(searchParams)
    next.set('batchId', selectedId)
    setSearchParams(next, { replace: true })
  }, [batchesQuery.isSuccess, searchParams, selectedId, setSearchParams])

  useEffect(() => {
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: selectedId || undefined,
    })
  }, [selectedId])

  const [showAll, setShowAll] = useState(false)
  const [detailLine, setDetailLine] = useState<ReconciliationLine>()
  const [disposingLine, setDisposingLine] = useState<ReconciliationLine>()
  const batch = batchQuery.currentData ?? batchQuery.data
  const actionableCount = useMemo(() => batch?.lines.filter((line) => line.status !== 'MATCHED').length ?? 0, [batch?.lines])
  const resultPresentation = getReconciliationResultPresentation({ total: batch?.lines.length ?? 0, actionable: actionableCount, issueId: selectedIssueId, showAll })
  const batchLabel = (item: typeof batches[number]) => `${formatDateTime(item.createdAt)} · ${item.lines.length} nguyên liệu · ${getReconciliationLifecyclePresentation(item.status).label}`

  return <OperationalFrame>
    <section className="space-y-4" aria-label="Đối chiếu nguyên liệu">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4" data-ui-work-surface="reconciliation-scope">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Cần xuất và đã xuất kho</h2>
          <p className="mt-1 text-sm text-slate-600">Số đã xuất được đọc từ phiếu xuất kho liên kết; không nhập lại tại đây.</p>
        </div>
        <QueryViewBoundary geometry="compact" queries={[{ label: 'danh sách lô đối chiếu', view: batchesView }]}>
          {batches.length > 0 && <label className="grid gap-1 text-sm font-medium text-slate-800">
            Lô đối chiếu
            <Select value={selectedId || null} onValueChange={(value) => value && setSearchParams({ batchId: value })}>
              <SelectTrigger className="min-w-80" aria-label="Chọn lô đối chiếu"><SelectValue placeholder="Chọn lô">{selectedBatchSummary ? batchLabel(selectedBatchSummary) : 'Chọn lô'}</SelectValue></SelectTrigger>
              <SelectContent>{batches.map((item) => <SelectItem key={item.batchId} value={item.batchId}>{batchLabel(item)}</SelectItem>)}</SelectContent>
            </Select>
          </label>}
        </QueryViewBoundary>
      </div>

      {batchesView.phase === 'ready' && batches.length === 0 ? <EmptyState
        variant="uncreated"
        title="Chưa có lô đối chiếu"
        description="Hoàn tất định lượng nguyên liệu và chuyển danh sách cần xuất sang Kho trước khi đối chiếu số đã xuất."
        action={<Link className={buttonVariants()} to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở định lượng xuất kho</Link>}
      /> : batchesView.phase === 'ready' && selectedId ? <QueryViewBoundary geometry="table" queries={[{ label: 'lô đối chiếu đã chọn', view: batchView }]}>
        {batch && <div className="space-y-4">
          <ReconciliationLifecycleStrip status={batch.status} batchId={batch.batchId} showAction={false} />
          <SectionPanel title={resultPresentation.title} description={resultPresentation.description} actions={<Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện chênh lệch' : resultPresentation.showAllLabel}</Button>}>
            {resultPresentation.showTable ? <ReconciliationComparisonTable lines={batch.lines} showAll={showAll} onDetail={setDetailLine} onDisposition={batch.status === 'IN_PROGRESS' ? setDisposingLine : undefined} /> : <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />} title="Tất cả nguyên liệu đã khớp" description={`${batch.lines.length}/${batch.lines.length} nguyên liệu khớp giữa định lượng đã khóa và tổng phiếu xuất kho liên kết.`} />}
          </SectionPanel>
          <ReconciliationSourceChangeLog batchId={batch.batchId} />
        </div>}
      </QueryViewBoundary> : null}
    </section>

    <ReconciliationIssueDetailDialog issueId={selectedIssueId || null} open={Boolean(selectedIssueId)} expectedBatchId={selectedId} onClose={() => { const next = new URLSearchParams(searchParams); next.delete('issueId'); setSearchParams(next, { replace: true }) }} />
    <Dialog open={Boolean(detailLine)} onOpenChange={(open) => { if (!open) setDetailLine(undefined) }}>
      <DialogContent aria-label="Chi tiết nguyên liệu" size="md">
        <DialogHeader><DialogTitle>{detailLine?.ingredientName || 'Chi tiết nguyên liệu'}</DialogTitle></DialogHeader>
        {detailLine && <><dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm"><dt className="text-slate-600">ID dòng lô</dt><dd className="min-w-0"><IdentifierText value={detailLine.batchLineId} /></dd><dt className="text-slate-600">Mã nguyên liệu</dt><dd className="font-medium text-slate-950">{detailLine.ingredientCode || 'Chưa có mã'}</dd><dt className="text-slate-600">Đơn vị</dt><dd className="font-medium text-slate-950">{formatUnit(detailLine.canonicalUnitName || '') || 'Chưa có tên đơn vị'}</dd><dt className="text-slate-600">Nguồn số đã xuất</dt><dd className="font-medium text-slate-950">Phiếu xuất kho liên kết</dd><dt className="text-slate-600">Ngưỡng sai lệch</dt><dd className="font-medium tabular-nums text-slate-950">{detailLine.frozenTolerance}</dd>{detailLine.disposition ? <><dt className="text-slate-600">Kết luận xử lý</dt><dd><span className="font-medium text-slate-950">{dispositionCategoryLabel(detailLine.disposition.category)}</span><span className="mt-1 block text-slate-700">{detailLine.disposition.reason}</span></dd></> : null}{detailLine.issueNotes?.length ? <><dt className="text-slate-600">Lý do xuất thêm / xuất vượt</dt><dd><ul className="space-y-1 text-slate-950">{detailLine.issueNotes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul><p className="mt-2 text-xs text-slate-500">Ghi chú thuộc dòng lô; dữ liệu hiện tại không xác định ghi chú nào thuộc riêng từng phiếu.</p></dd></> : null}</dl><div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={() => setDetailLine(undefined)}>Đóng</Button></div></>}
      </DialogContent>
    </Dialog>
    {disposingLine && <ReconciliationDispositionDrawer line={disposingLine} onClose={() => setDisposingLine(undefined)} onRefetch={() => batchQuery.refetch()} />}
  </OperationalFrame>
}
