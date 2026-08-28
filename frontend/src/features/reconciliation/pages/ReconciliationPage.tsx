import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { OperationalFrame, QueryViewBoundary, SectionPanel } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime } from '@/lib/formatters'
import { ReconciliationComparisonTable } from '../ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from '../ReconciliationDispositionDrawer'
import { useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, type ReconciliationLine } from '../reconciliationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'

export default function ReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const batchesQuery = useListReconciliationBatchesQuery()
  const selectedId = searchParams.get('batchId') ?? batchesQuery.data?.[0]?.batchId ?? ''
  const batchQuery = useGetReconciliationBatchQuery(selectedId, { skip: !selectedId })
  const batchView = toLabeledQueryView(batchQuery, 'lô đối chiếu đã chọn', { instruction: 'Chọn một lô để xem số cần xuất và số kho đã xuất.' })
  const [showAll, setShowAll] = useState(false)
  const [detailLine, setDetailLine] = useState<ReconciliationLine>()
  const [disposingLine, setDisposingLine] = useState<ReconciliationLine>()
  const batch = batchQuery.currentData ?? batchQuery.data
  const actionableCount = useMemo(() => batch?.lines.filter((line) => line.status !== 'MATCHED').length ?? 0, [batch?.lines])

  return <OperationalFrame>
    <section className="space-y-4" aria-label="Đối chiếu nguyên liệu">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Cần xuất và đã xuất kho</h2>
          <p className="mt-1 text-sm text-slate-600">Số đã xuất được đọc từ phiếu xuất kho liên kết; không nhập lại tại đây.</p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Lô đối chiếu
          <Select value={selectedId} onValueChange={(value) => value && setSearchParams({ batchId: value })}>
            <SelectTrigger className="min-w-72" aria-label="Chọn lô đối chiếu"><SelectValue placeholder="Chọn lô" /></SelectTrigger>
            <SelectContent>{(batchesQuery.data ?? []).map((item) => <SelectItem key={item.batchId} value={item.batchId}>{formatDateTime(item.createdAt)} · {item.status}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </div>

      <QueryViewBoundary queries={[{ label: 'lô đối chiếu đã chọn', view: batchView }]}>
        {batch && <SectionPanel title="Đối chiếu theo nguyên liệu" description={`${actionableCount} dòng cần xử lý · số liệu kho chỉ đọc`}>
          <div className="mb-2 flex justify-end"><Button type="button" variant="link" className="h-auto p-0" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả'}</Button></div>
          <ReconciliationComparisonTable lines={batch.lines} showAll={showAll} onDetail={setDetailLine} onDisposition={setDisposingLine} />
        </SectionPanel>}
      </QueryViewBoundary>
    </section>

    {detailLine && <aside role="dialog" aria-modal="true" aria-label="Chi tiết nguyên liệu" className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{detailLine.ingredientName || 'Chi tiết nguyên liệu'}</h2><Button type="button" variant="outline" onClick={() => setDetailLine(undefined)}>Đóng</Button></div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><dt>Mã nguyên liệu</dt><dd>{detailLine.ingredientCode || 'Chưa có mã'}</dd><dt>Đơn vị</dt><dd>{detailLine.canonicalUnitName || 'Chưa có tên đơn vị'}</dd><dt>Nguồn số đã xuất</dt><dd>Phiếu xuất kho liên kết</dd><dt>Ngưỡng sai lệch</dt><dd>{detailLine.frozenTolerance}</dd></dl>
    </aside>}
    {disposingLine && <ReconciliationDispositionDrawer line={disposingLine} onClose={() => setDisposingLine(undefined)} onRefetch={() => batchQuery.refetch()} />}
  </OperationalFrame>
}
