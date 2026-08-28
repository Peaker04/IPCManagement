import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, OperationalFrame, QueryViewBoundary, SectionPanel } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime, formatUnit } from '@/lib/formatters'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { ReconciliationComparisonTable } from '../ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from '../ReconciliationDispositionDrawer'
import { useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, type ReconciliationLine } from '../reconciliationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'

export default function ReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const batchesQuery = useListReconciliationBatchesQuery()
  const requestedId = searchParams.get('batchId') ?? ''
  const batches = useMemo(() => batchesQuery.currentData ?? batchesQuery.data ?? [], [batchesQuery.currentData, batchesQuery.data])
  const selectedId = batches.some((item) => item.batchId === requestedId) ? requestedId : ''
  const batchesView = toLabeledQueryView(batchesQuery, 'danh sách lô đối chiếu', { instruction: 'Tải lại danh sách lô để chọn đúng phạm vi cần đối chiếu.' })
  const batchQuery = useGetReconciliationBatchQuery(selectedId, { skip: !selectedId })
  const batchView = toLabeledQueryView(batchQuery, 'lô đối chiếu đã chọn', { instruction: 'Chọn một lô để xem số cần xuất và số kho đã xuất.' })

  useEffect(() => {
    if (!batchesQuery.isSuccess || requestedId || batches.length === 0) return
    setSearchParams({ batchId: batches[0].batchId }, { replace: true })
  }, [batches, batchesQuery.isSuccess, requestedId, setSearchParams])
  const [showAll, setShowAll] = useState(false)
  const [detailLine, setDetailLine] = useState<ReconciliationLine>()
  const [disposingLine, setDisposingLine] = useState<ReconciliationLine>()
  const batch = batchQuery.currentData ?? batchQuery.data
  const actionableCount = useMemo(() => batch?.lines.filter((line) => line.status !== 'MATCHED').length ?? 0, [batch?.lines])

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
              <SelectTrigger className="min-w-72" aria-label="Chọn lô đối chiếu"><SelectValue placeholder="Chọn lô" /></SelectTrigger>
              <SelectContent>{batches.map((item) => { const status = getWorkflowStatusPresentation(item.status); return <SelectItem key={item.batchId} value={item.batchId}>{formatDateTime(item.createdAt)} · {status.label}</SelectItem> })}</SelectContent>
            </Select>
          </label>}
        </QueryViewBoundary>
      </div>

      {batchesView.phase === 'ready' && batches.length === 0 ? <EmptyState
        variant="uncreated"
        title="Chưa có lô đối chiếu"
        description="Hoàn tất định lượng nguyên liệu và chuyển danh sách cần xuất sang Kho trước khi đối chiếu số đã xuất."
        action={<Link className={buttonVariants()} to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở định lượng xuất kho</Link>}
      /> : <QueryViewBoundary geometry={selectedId ? 'table' : 'compact'} queries={[{ label: 'lô đối chiếu đã chọn', view: batchView }]}>
        {batch && <SectionPanel title="Đối chiếu theo nguyên liệu" description={`${actionableCount} dòng cần xử lý · số liệu kho chỉ đọc`}>
          <div className="mb-2 flex justify-end"><Button type="button" variant="link" className="h-auto p-0" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả'}</Button></div>
          <ReconciliationComparisonTable lines={batch.lines} showAll={showAll} onDetail={setDetailLine} onDisposition={setDisposingLine} />
        </SectionPanel>}
      </QueryViewBoundary>}
    </section>

    <Dialog open={Boolean(detailLine)} onOpenChange={(open) => { if (!open) setDetailLine(undefined) }}>
      <DialogContent aria-label="Chi tiết nguyên liệu" className="ml-auto mr-0 min-h-[60vh] max-w-md rounded-none">
        <DialogHeader><DialogTitle>{detailLine?.ingredientName || 'Chi tiết nguyên liệu'}</DialogTitle></DialogHeader>
        {detailLine && <><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><dt>Mã nguyên liệu</dt><dd>{detailLine.ingredientCode || 'Chưa có mã'}</dd><dt>Đơn vị</dt><dd>{formatUnit(detailLine.canonicalUnitName || '') || 'Chưa có tên đơn vị'}</dd><dt>Nguồn số đã xuất</dt><dd>Phiếu xuất kho liên kết</dd><dt>Ngưỡng sai lệch</dt><dd>{detailLine.frozenTolerance}</dd></dl><div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={() => setDetailLine(undefined)}>Đóng</Button></div></>}
      </DialogContent>
    </Dialog>
    {disposingLine && <ReconciliationDispositionDrawer line={disposingLine} onClose={() => setDisposingLine(undefined)} onRefetch={() => batchQuery.refetch()} />}
  </OperationalFrame>
}
