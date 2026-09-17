import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { EmptyState, IdentifierText, OperationalFrame, QueryViewBoundary, SectionPanel } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateOnly, formatQuantity, formatQuantityWithUnit, formatUnit } from '@/lib/formatters'
import { readReconciliationSelection, writeReconciliationSelection } from '@/lib/navigationPreferences'
import { ReconciliationComparisonTable } from '../ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from '../ReconciliationDispositionDrawer'
import { useCompleteReconciliationBatchMutation, useGetReconciliationBatchQuery, useListReconciliationBatchesQuery, type ReconciliationLine } from '@/api/reconciliationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { buildWeeklyMenuRoute } from '@/lib/routeConfig'
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

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(persistedSelection.customerId ?? 'ALL')
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [batchStatusFilter, setBatchStatusFilter] = useState<string>('ALL')

  const customers = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; customerCode?: string }>()
    batches.forEach((b) => {
      if (b.customerId) {
        map.set(b.customerId, {
          customerId: b.customerId,
          customerName: b.customerName || b.customerCode || b.customerId,
          customerCode: b.customerCode || undefined,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [batches])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    batches.forEach((b) => {
      const year = Number(b.weekStartDate?.slice(0, 4))
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [batches])

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (selectedCustomerId !== 'ALL' && b.customerId !== selectedCustomerId) return false
      const serviceYear = b.weekStartDate?.slice(0, 4)
      const serviceMonth = b.weekStartDate ? String(Number(b.weekStartDate.slice(5, 7))) : undefined
      if (selectedYear !== 'ALL' && serviceYear !== selectedYear) return false
      if (selectedMonth !== 'ALL' && serviceMonth !== selectedMonth) return false
      if (batchStatusFilter !== 'ALL' && b.status !== batchStatusFilter) return false
      return true
    })
  }, [batches, selectedCustomerId, selectedYear, selectedMonth, batchStatusFilter])

  const selectedId = useMemo(() => {
    if (!batchesQuery.isSuccess) return requestedId
    if (filteredBatches.length === 0) return ''
    if (filteredBatches.some((item) => item.batchId === requestedId)) return requestedId
    return filteredBatches[0]?.batchId ?? ''
  }, [batchesQuery.isSuccess, filteredBatches, requestedId])

  const batchesView = toLabeledQueryView(batchesQuery, 'danh sách lô đối chiếu', { instruction: 'Tải lại danh sách lô để chọn đúng phạm vi cần đối chiếu.' })
  const batchQuery = useGetReconciliationBatchQuery(selectedId, { skip: !selectedId, refetchOnMountOrArgChange: true })
  const batchView = toLabeledQueryView(batchQuery, 'lô đối chiếu đã chọn', { instruction: 'Chọn một lô để xem số cần xuất và số kho đã xuất.' })

  useEffect(() => {
    if (!batchesQuery.isSuccess) return
    const currentBatchId = searchParams.get('batchId') ?? ''
    if (selectedId) {
      if (currentBatchId !== selectedId) {
        const next = new URLSearchParams(searchParams)
        next.set('batchId', selectedId)
        setSearchParams(next, { replace: true })
      }
    } else {
      if (currentBatchId) {
        const next = new URLSearchParams(searchParams)
        next.delete('batchId')
        next.delete('issueId')
        setSearchParams(next, { replace: true })
      }
    }
  }, [batchesQuery.isSuccess, searchParams, selectedId, setSearchParams])

  useEffect(() => {
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: selectedId || undefined,
      customerId: selectedCustomerId !== 'ALL' ? selectedCustomerId : undefined,
    })
  }, [selectedId, selectedCustomerId])

  const [showAll, setShowAll] = useState(false)
  const [detailLine, setDetailLine] = useState<ReconciliationLine>()
  const [disposingLine, setDisposingLine] = useState<ReconciliationLine>()
  const [bulkDispositionOpen, setBulkDispositionOpen] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [completionVersion, setCompletionVersion] = useState<number>()
  const [isRefreshingCompletion, setIsRefreshingCompletion] = useState(false)
  const [isCompletionPending, setIsCompletionPending] = useState(false)
  const completionSessionRef = useRef(0)
  const [completeBatch] = useCompleteReconciliationBatchMutation()
  const canComplete = useHasRole(['quanly'])
  const canSetDisposition = canComplete
  const batch = selectedId ? (batchQuery.currentData ?? batchQuery.data) : undefined
  const actionableLines = useMemo(() => batch?.lines.filter((line) => line.status === 'NEEDS_REVIEW' && !line.disposition) ?? [], [batch?.lines])
  const actionableCount = actionableLines.length
  const resultPresentation = getReconciliationResultPresentation({ total: batch?.lines.length ?? 0, actionable: actionableCount, issueId: selectedIssueId, showAll })
  const completionReady = Boolean(batch && batch.status === 'IN_PROGRESS' && batch.lines.length > 0 && batch.lines.every((line) => line.issuedQuantity != null && (line.triggers.length === 0 || Boolean(line.disposition?.reason.trim()))))
  const batchLabel = (item: typeof batches[number]) => {
    const customerPrefix = item.customerName ? `[${item.customerName}] ` : item.customerCode ? `[${item.customerCode}] ` : ''
    return `${customerPrefix}${item.weekStartDate ? `Tuần ${formatDateOnly(item.weekStartDate)}` : 'Chưa xác định tuần'} · ${item.lines.length} nguyên liệu · ${getReconciliationLifecyclePresentation(item.status).label}`
  }
  const closeCompletion = () => {
    completionSessionRef.current += 1
    setCompletionOpen(false)
    setCompletionError('')
    setCompletionVersion(undefined)
    setIsRefreshingCompletion(false)
    setIsCompletionPending(false)
  }
  const openCompletion = () => {
    completionSessionRef.current += 1
    setCompletionError('')
    setCompletionVersion(batch?.version)
    setIsRefreshingCompletion(false)
    setIsCompletionPending(false)
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
    setIsCompletionPending(true)
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
    } finally {
      if (completionSessionRef.current === session) setIsCompletionPending(false)
    }
  }

  const selectedBatchSummary = filteredBatches.find((item) => item.batchId === selectedId)

  const selectedCustomerLabel = selectedCustomerId === 'ALL'
    ? 'Tất cả khách hàng'
    : customers.find((c) => c.customerId === selectedCustomerId)?.customerName ?? 'Khách hàng'

  const selectedYearLabel = selectedYear === 'ALL'
    ? 'Tất cả năm'
    : `Năm ${selectedYear}`

  const selectedMonthLabel = selectedMonth === 'ALL'
    ? 'Tất cả tháng'
    : `Tháng ${Number(selectedMonth) < 10 ? `0${Number(selectedMonth)}` : selectedMonth}`

  const batchStatusLabels: Record<string, string> = {
    ALL: 'Tất cả trạng thái',
    IN_PROGRESS: 'Đang đối chiếu',
    COMPLETED: 'Đã hoàn tất',
    TRANSFERRED: 'Chờ Kho xuất',
  }
  const selectedStatusLabel = batchStatusLabels[batchStatusFilter] ?? 'Tất cả trạng thái'

  return <OperationalFrame>
    <section className="space-y-4" aria-label="Đối chiếu nguyên liệu">
      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs" data-ui-work-surface="reconciliation-scope">
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <QueryViewBoundary geometry="compact" queries={[{ label: 'danh sách lô đối chiếu', view: batchesView }]}>
            {batches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {customers.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Khách hàng:</span>
                    <Select value={selectedCustomerId} onValueChange={(val) => setSelectedCustomerId(val ?? 'ALL')}>
                      <SelectTrigger className="h-8 min-w-[180px] w-auto text-xs" aria-label="Lọc theo khách hàng">
                        <SelectValue placeholder="Khách hàng" className="whitespace-nowrap">{selectedCustomerLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tất cả khách hàng</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.customerId} value={c.customerId}>
                            {c.customerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Năm:</span>
                  <Select value={selectedYear} onValueChange={(val) => setSelectedYear(val ?? 'ALL')}>
                    <SelectTrigger className="h-8 min-w-[125px] w-auto text-xs" aria-label="Lọc theo năm">
                      <SelectValue placeholder="Năm" className="whitespace-nowrap">{selectedYearLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả năm</SelectItem>
                      {availableYears.map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>Năm {yr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Tháng:</span>
                  <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val ?? 'ALL')}>
                    <SelectTrigger className="h-8 min-w-[130px] w-auto text-xs" aria-label="Lọc theo tháng">
                      <SelectValue placeholder="Tháng" className="whitespace-nowrap">{selectedMonthLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả tháng</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>Tháng {m < 10 ? `0${m}` : m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Trạng thái:</span>
                  <Select value={batchStatusFilter} onValueChange={(val) => setBatchStatusFilter(val ?? 'ALL')}>
                    <SelectTrigger className="h-8 min-w-[170px] w-auto text-xs" aria-label="Lọc theo trạng thái">
                      <SelectValue placeholder="Trạng thái" className="whitespace-nowrap">{selectedStatusLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                      <SelectItem value="IN_PROGRESS">Đang đối chiếu</SelectItem>
                      <SelectItem value="COMPLETED">Đã hoàn tất</SelectItem>
                      <SelectItem value="TRANSFERRED">Chờ Kho xuất</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-800 font-semibold">
                  <span className="text-slate-700 text-xs whitespace-nowrap">Lô:</span>
                  <Select value={selectedId || null} onValueChange={(value) => value && setSearchParams({ batchId: value })}>
                    <SelectTrigger className="h-8 min-w-[280px] max-w-sm sm:max-w-md w-auto text-xs" aria-label="Chọn lô đối chiếu">
                      <SelectValue placeholder="Chọn lô" className="whitespace-nowrap">{selectedBatchSummary ? batchLabel(selectedBatchSummary) : filteredBatches.length === 0 ? 'Không có lô phù hợp' : 'Chọn lô'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBatches.map((item) => (
                        <SelectItem key={item.batchId} value={item.batchId}>{batchLabel(item)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
          </QueryViewBoundary>
        </div>
      </div>

      {batchesView.phase === 'ready' && batches.length > 0 && filteredBatches.length === 0 && (
        <EmptyState
          variant="filtered"
          title="Không có lô đối chiếu nào phù hợp với bộ lọc"
          description="Thử thay đổi hoặc đặt lại bộ lọc khách hàng, năm, tháng hoặc trạng thái."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setSelectedCustomerId('ALL')
                setSelectedYear('ALL')
                setSelectedMonth('ALL')
                setBatchStatusFilter('ALL')
              }}
            >
              Đặt lại bộ lọc
            </Button>
          }
        />
      )}

      {batchesView.phase === 'ready' && batches.length === 0 ? <EmptyState
        variant="uncreated"
        title="Chưa có lô đối chiếu"
        description="Hoàn tất định lượng nguyên liệu và chuyển danh sách cần xuất sang Kho trước khi đối chiếu số đã xuất."
        action={<Link className={buttonVariants()} to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở định lượng xuất kho</Link>}
      /> : batchesView.phase === 'ready' && selectedId ? <QueryViewBoundary geometry="table" queries={[{ label: 'lô đối chiếu đã chọn', view: batchView }]}>
        {batch && <div className="space-y-4">
          <ReconciliationLifecycleStrip status={batch.status} batchId={batch.batchId} showAction={false} />
          <SectionPanel
            title={resultPresentation.title}
            description={batch.customerName ? `Khách hàng: ${batch.customerName} · ${resultPresentation.description}` : resultPresentation.description}
            actions={<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện chênh lệch' : resultPresentation.showAllLabel}</Button>{batch.status === 'IN_PROGRESS' && canSetDisposition && actionableLines.length > 1 && <Button type="button" variant="secondary" size="sm" onClick={() => setBulkDispositionOpen(true)}>Xử lý hàng loạt ({actionableLines.length})</Button>}{completionReady && canComplete && <Button type="button" size="sm" onClick={openCompletion}>Hoàn tất đối chiếu</Button>}</div>}
          >
            {resultPresentation.showTable ? <ReconciliationComparisonTable lines={batch.lines} showAll={showAll} onDetail={setDetailLine} onDisposition={batch.status === 'IN_PROGRESS' && canSetDisposition ? setDisposingLine : undefined} /> : <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />} title={batch.status === 'COMPLETED' ? 'Đã hoàn tất đối chiếu' : 'Sẵn sàng hoàn tất'} description={batch.status === 'COMPLETED' ? `${batch.lines.length}/${batch.lines.length} nguyên liệu đã khớp và lô đã hoàn tất đối chiếu thành công.` : `${batch.lines.length}/${batch.lines.length} nguyên liệu đã khớp. Lô vẫn ở bước 4/5 cho đến khi người có thẩm quyền xác nhận hoàn tất.`} />}
            {batch.status === 'IN_PROGRESS' && actionableCount > 0 && !canSetDisposition && <p role="status" className="mt-3 text-sm text-slate-600">Quản trị hoặc Quản lý cần xử lý chênh lệch trước khi lô có thể hoàn tất.</p>}
            {completionReady && !canComplete && <p role="status" className="mt-3 text-sm text-slate-600">Lô đã đủ điều kiện; Quản trị hoặc Quản lý cần xác nhận hoàn tất đối chiếu.</p>}
          </SectionPanel>
        </div>}
      </QueryViewBoundary> : null}
    </section>

    <ReconciliationIssueDetailDialog
      issueId={selectedIssueId || null}
      open={Boolean(selectedIssueId)}
      expectedBatchId={selectedId}
      showOpenBatch={false}
      onClose={() => { const next = new URLSearchParams(searchParams); next.delete('issueId'); setSearchParams(next, { replace: true }) }}
    />
    <Dialog open={completionOpen} onOpenChange={(open) => { if (!open) closeCompletion() }}>
      <DialogContent size="sm" aria-label="Xác nhận hoàn tất đối chiếu">
        <DialogHeader><DialogTitle>Hoàn tất đối chiếu?</DialogTitle></DialogHeader>
        {completionError && <p role="alert" className="text-sm text-red-700">{completionError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={isCompletionPending || isRefreshingCompletion} onClick={() => void refreshCompletion()}>{isRefreshingCompletion ? 'Đang tải lại...' : 'Tải lại dữ liệu'}</Button><Button type="button" variant="outline" onClick={closeCompletion}>Hủy</Button><Button type="button" disabled={isCompletionPending || isRefreshingCompletion || completionVersion == null} onClick={() => void complete()}>{isCompletionPending ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Drawer open={Boolean(detailLine)} onOpenChange={(open) => { if (!open) setDetailLine(undefined) }}>
      <DrawerContent aria-label="Chi tiết nguyên liệu">
        <DrawerHeader><DrawerTitle>{detailLine?.ingredientName || 'Chi tiết nguyên liệu'}</DrawerTitle></DrawerHeader>
        <DrawerBody>
        {detailLine && <>
          <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <dt className="text-slate-600">Mã nguyên liệu</dt>
            <dd className="font-medium text-slate-950">{detailLine.ingredientCode || 'Chưa có mã'}</dd>
            <dt className="text-slate-600">Đơn vị</dt>
            <dd className="font-medium text-slate-950">{formatUnit(detailLine.canonicalUnitName || '') || 'Chưa có tên đơn vị'}</dd>
            <dt className="text-slate-600">Cần xuất (BOM)</dt>
            <dd className="font-semibold tabular-nums text-slate-950">{formatQuantityWithUnit(detailLine.requiredQuantity, detailLine.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</dd>
            <dt className="text-slate-600">Thực tế đã xuất</dt>
            <dd className="font-semibold tabular-nums text-slate-950">{detailLine.issuedQuantity != null ? formatQuantityWithUnit(detailLine.issuedQuantity, detailLine.canonicalUnitName ?? '', { maximumFractionDigits: 6 }) : 'Chưa xuất'}</dd>
            <dt className="text-slate-600">Sai lệch</dt>
            <dd className="font-semibold tabular-nums">
              {detailLine.issuedQuantity == null ? (
                <span className="text-slate-500">Chưa xuất</span>
              ) : (() => {
                const diff = detailLine.issuedRequiredDifference ?? (detailLine.issuedQuantity - detailLine.requiredQuantity)
                return (
                  <span className={diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {diff > 0 ? `+${formatQuantity(diff)}` : formatQuantity(diff)} {formatUnit(detailLine.canonicalUnitName || '')}
                  </span>
                )
              })()}
            </dd>
            <dt className="text-slate-600">Ngưỡng sai lệch</dt>
            <dd className="font-medium tabular-nums text-slate-950">{detailLine.frozenTolerance}</dd>
            {detailLine.disposition ? (
              <>
                <dt className="text-slate-600">Kết luận xử lý</dt>
                <dd>
                  <span className="font-medium text-slate-950">{dispositionCategoryLabel(detailLine.disposition.category)}</span>
                  <span className="mt-1 block text-slate-700">{detailLine.disposition.reason}</span>
                </dd>
              </>
            ) : null}
            {detailLine.issueNotes?.length ? (
              <>
                <dt className="text-slate-600">Lý do xuất thêm / xuất vượt</dt>
                <dd>
                  <ul className="space-y-1 text-slate-950">{detailLine.issueNotes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul>
                </dd>
              </>
            ) : null}
            <dt className="text-slate-400 text-xs pt-1 border-t border-slate-200">ID dòng lô</dt>
            <dd className="min-w-0 text-xs text-slate-500 pt-1 border-t border-slate-200"><IdentifierText value={detailLine.batchLineId} /></dd>
          </dl>
        </>}
        </DrawerBody>
        <DrawerFooter><Button type="button" variant="outline" onClick={() => setDetailLine(undefined)}>Đóng</Button></DrawerFooter>
      </DrawerContent>
    </Drawer>
    {disposingLine && <ReconciliationDispositionDrawer line={disposingLine} onClose={() => setDisposingLine(undefined)} onRefetch={() => batchQuery.refetch()} />}
    {bulkDispositionOpen && <ReconciliationDispositionDrawer lines={actionableLines} onClose={() => setBulkDispositionOpen(false)} onRefetch={() => batchQuery.refetch()} />}
  </OperationalFrame>
}
