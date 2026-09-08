import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { EmptyState, IdentifierText, OperationalFrame, QueryViewBoundary, SectionPanel } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime, formatUnit } from '@/lib/formatters'
import { readReconciliationSelection, writeReconciliationSelection } from '@/lib/navigationPreferences'
import { ReconciliationComparisonTable } from '../ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from '../ReconciliationDispositionDrawer'
import { useCompleteReconciliationBatchMutation, useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, type ReconciliationLine } from '@/api/reconciliationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'
import { ReconciliationSourceChangeLog } from '../ReconciliationSourceChangeLog'
import { dispositionCategoryLabel } from '../reconciliationIssueCorrelation'
import { ReconciliationLifecycleStrip } from '../ReconciliationLifecycleStrip'
import { ReconciliationIssueDetailDialog } from '../ReconciliationIssueDetailDialog'
import { getReconciliationLifecyclePresentation, getReconciliationResultPresentation } from '../reconciliationLifecyclePresentation'
import { useHasRole } from '@/lib/useHasRole'

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
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [completionVersion, setCompletionVersion] = useState<number>()
  const [isRefreshingCompletion, setIsRefreshingCompletion] = useState(false)
  const completionSessionRef = useRef(0)
  const [completeBatch, { isLoading: isCompleting }] = useCompleteReconciliationBatchMutation()
  const canComplete = useHasRole(['quanly'])
  const batch = batchQuery.currentData ?? batchQuery.data
  const actionableCount = useMemo(() => batch?.lines.filter((line) => line.status !== 'MATCHED').length ?? 0, [batch?.lines])
  const resultPresentation = getReconciliationResultPresentation({ total: batch?.lines.length ?? 0, actionable: actionableCount, issueId: selectedIssueId, showAll })
  const completionReady = Boolean(batch && batch.status === 'IN_PROGRESS' && batch.lines.length > 0 && batch.lines.every((line) => line.issuedQuantity != null && (line.triggers.length === 0 || Boolean(line.disposition?.reason.trim()))))
  const batchLabel = (item: typeof batches[number]) => `${formatDateTime(item.createdAt)} · ${item.lines.length} nguyên liệu · ${getReconciliationLifecyclePresentation(item.status).label}`
  const closeCompletion = () => {
    completionSessionRef.current += 1
    setCompletionOpen(false)
    setCompletionError('')
    setCompletionVersion(undefined)
    setIsRefreshingCompletion(false)
  }
  const openCompletion = () => {
    completionSessionRef.current += 1
    setCompletionError('')
    setCompletionVersion(batch?.version)
    setIsRefreshingCompletion(false)
    setCompletionOpen(true)
  }
  const refreshCompletion = async () => {
    if (!batch) return
    const session = completionSessionRef.current
    setCompletionError('')
    setCompletionVersion(undefined)
    setIsRefreshingCompletion(true)
    try {
      const refreshed = await batchQuery.refetch()
      if (completionSessionRef.current !== session) return
      if ('data' in refreshed && refreshed.data?.batchId === batch.batchId) {
        setCompletionVersion(refreshed.data.version)
      } else {
        setCompletionError('Không thể tải lại lô đã chọn. Hãy thử lại trước khi hoàn tất.')
      }
    } catch {
      if (completionSessionRef.current === session) setCompletionError('Không thể tải lại lô đã chọn. Hãy thử lại trước khi hoàn tất.')
    } finally {
      if (completionSessionRef.current === session) setIsRefreshingCompletion(false)
    }
  }
  const complete = async () => {
    if (!batch || completionVersion == null || !completionReady || !canComplete) return
    const session = completionSessionRef.current
    setCompletionError('')
    try {
      await completeBatch({ id: batch.batchId, expectedVersion: completionVersion }).unwrap()
      if (completionSessionRef.current !== session) return
      closeCompletion()
      await batchQuery.refetch()
    } catch (error) {
      if (completionSessionRef.current !== session) return
      const message = typeof error === 'object' && error && 'data' in error && typeof (error as { data?: { message?: unknown } }).data?.message === 'string'
        ? (error as { data: { message: string } }).data.message
        : 'Không thể hoàn tất lô. Hãy tải lại dữ liệu và kiểm tra các dòng cần xử lý.'
      setCompletionError(message)
    }
  }

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
          <SectionPanel title={resultPresentation.title} description={resultPresentation.description} actions={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện chênh lệch' : resultPresentation.showAllLabel}</Button>{completionReady && canComplete && <Button type="button" size="sm" onClick={openCompletion}>Hoàn tất đối chiếu</Button>}</div>}>
            {resultPresentation.showTable ? <ReconciliationComparisonTable lines={batch.lines} showAll={showAll} onDetail={setDetailLine} onDisposition={batch.status === 'IN_PROGRESS' ? setDisposingLine : undefined} /> : <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />} title="Sẵn sàng hoàn tất" description={`${batch.lines.length}/${batch.lines.length} nguyên liệu đã khớp. Lô vẫn ở bước 4/5 cho đến khi người có thẩm quyền xác nhận hoàn tất.`} />}
            {completionReady && !canComplete && <p role="status" className="mt-3 text-sm text-slate-600">Lô đã đủ điều kiện; Quản trị hoặc Quản lý cần xác nhận hoàn tất đối chiếu.</p>}
          </SectionPanel>
          <ReconciliationSourceChangeLog batchId={batch.batchId} />
        </div>}
      </QueryViewBoundary> : null}
    </section>

    <ReconciliationIssueDetailDialog issueId={selectedIssueId || null} open={Boolean(selectedIssueId)} expectedBatchId={selectedId} onClose={() => { const next = new URLSearchParams(searchParams); next.delete('issueId'); setSearchParams(next, { replace: true }) }} />
    <Dialog open={completionOpen} onOpenChange={(open) => { if (!open) closeCompletion() }}>
      <DialogContent size="sm" aria-label="Xác nhận hoàn tất đối chiếu">
        <DialogHeader><DialogTitle>Hoàn tất đối chiếu?</DialogTitle><DialogDescription>Thao tác này chuyển lô từ bước 4/5 sang Hoàn tất. Hệ thống sẽ kiểm tra lại phiên bản lô và mọi dòng trước khi ghi nhận.</DialogDescription></DialogHeader>
        {completionError && <p role="alert" className="text-sm text-red-700">{completionError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={isCompleting || isRefreshingCompletion} onClick={() => void refreshCompletion()}>{isRefreshingCompletion ? 'Đang tải lại...' : 'Tải lại dữ liệu'}</Button><Button type="button" variant="outline" onClick={closeCompletion}>Hủy</Button><Button type="button" disabled={isCompleting || isRefreshingCompletion || completionVersion == null} onClick={() => void complete()}>{isCompleting ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(detailLine)} onOpenChange={(open) => { if (!open) setDetailLine(undefined) }}>
      <DialogContent aria-label="Chi tiết nguyên liệu" size="md">
        <DialogHeader><DialogTitle>{detailLine?.ingredientName || 'Chi tiết nguyên liệu'}</DialogTitle></DialogHeader>
        {detailLine && <><dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm"><dt className="text-slate-600">ID dòng lô</dt><dd className="min-w-0"><IdentifierText value={detailLine.batchLineId} /></dd><dt className="text-slate-600">Mã nguyên liệu</dt><dd className="font-medium text-slate-950">{detailLine.ingredientCode || 'Chưa có mã'}</dd><dt className="text-slate-600">Đơn vị</dt><dd className="font-medium text-slate-950">{formatUnit(detailLine.canonicalUnitName || '') || 'Chưa có tên đơn vị'}</dd><dt className="text-slate-600">Nguồn số đã xuất</dt><dd className="font-medium text-slate-950">Phiếu xuất kho liên kết</dd><dt className="text-slate-600">Ngưỡng sai lệch</dt><dd className="font-medium tabular-nums text-slate-950">{detailLine.frozenTolerance}</dd>{detailLine.disposition ? <><dt className="text-slate-600">Kết luận xử lý</dt><dd><span className="font-medium text-slate-950">{dispositionCategoryLabel(detailLine.disposition.category)}</span><span className="mt-1 block text-slate-700">{detailLine.disposition.reason}</span></dd></> : null}{detailLine.issueNotes?.length ? <><dt className="text-slate-600">Lý do xuất thêm / xuất vượt</dt><dd><ul className="space-y-1 text-slate-950">{detailLine.issueNotes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul><p className="mt-2 text-xs text-slate-500">Ghi chú thuộc dòng lô; dữ liệu hiện tại không xác định ghi chú nào thuộc riêng từng phiếu.</p></dd></> : null}</dl><div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={() => setDetailLine(undefined)}>Đóng</Button></div></>}
      </DialogContent>
    </Dialog>
    {disposingLine && <ReconciliationDispositionDrawer line={disposingLine} onClose={() => setDisposingLine(undefined)} onRefetch={() => batchQuery.refetch()} />}
  </OperationalFrame>
}
