import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InfoNote, KeepAliveTabPanel, QueryViewBoundary } from '@/components/common'
import { toQueryView } from '@/lib/queryView'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useListReconciliationBatchesQuery } from '@/api/reconciliationApi'
import { formatDateTime } from '@/lib/formatters'
import { getReconciliationLifecyclePresentation } from '@/lib/reconciliationLifecyclePresentation'
import { readReconciliationSelection, writeReconciliationSelection } from '@/lib/navigationPreferences'
import { ReconciliationSourceChangeLog } from '@/features/reconciliation/ReconciliationSourceChangeLog'
import type { AdminView } from './adminDataPageTypes'

interface AdminSourceChangesPanelProps {
  model?: {
    effectiveActiveView: AdminView
  }
}

export function AdminSourceChangesPanel({ model }: AdminSourceChangesPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const batchesQuery = useListReconciliationBatchesQuery()
  const batchesView = toQueryView(batchesQuery, {
    instruction: 'Mở lịch sử thay đổi nguồn để tải danh sách lô.',
    retry: () => batchesQuery.refetch(),
    errorMessage: 'Không tải được danh sách lô đối chiếu.',
    forbiddenMessage: 'Bạn không có quyền xem lịch sử thay đổi nguồn.',
  })
  const batches = useMemo(() => batchesView.phase === 'ready' ? batchesView.data : [], [batchesView])

  const persisted = readReconciliationSelection()
  const requestedBatchId = searchParams.get('batchId') ?? persisted.batchId ?? ''

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(persisted.customerId ?? 'ALL')
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
      const year = new Date(b.createdAt).getFullYear()
      if (year && !isNaN(year)) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [batches])

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (selectedCustomerId !== 'ALL' && b.customerId !== selectedCustomerId) return false
      const date = new Date(b.createdAt)
      if (selectedYear !== 'ALL' && date.getFullYear().toString() !== selectedYear) return false
      if (selectedMonth !== 'ALL' && (date.getMonth() + 1).toString() !== selectedMonth) return false
      if (batchStatusFilter !== 'ALL' && b.status !== batchStatusFilter) return false
      return true
    })
  }, [batches, selectedCustomerId, selectedYear, selectedMonth, batchStatusFilter])

  const effectiveBatchId = useMemo(() => {
    if (!batchesQuery.isSuccess) return requestedBatchId
    if (filteredBatches.length === 0) return ''
    if (filteredBatches.some((b) => b.batchId === requestedBatchId)) return requestedBatchId
    return filteredBatches[0]?.batchId ?? ''
  }, [batchesQuery.isSuccess, filteredBatches, requestedBatchId])

  const handleBatchChange = (newBatchId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('batchId', newBatchId)
    setSearchParams(next, { replace: true })
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: newBatchId,
      customerId: selectedCustomerId !== 'ALL' ? selectedCustomerId : undefined,
    })
  }

  const selectedBatch = filteredBatches.find((b) => b.batchId === effectiveBatchId)
  const batchLabel = (item: typeof batches[number]) => {
    const cust = item.customerName ? `[${item.customerName}] ` : item.customerCode ? `[${item.customerCode}] ` : ''
    return `${cust}${formatDateTime(item.createdAt)} · ${getReconciliationLifecyclePresentation(item.status).label}`
  }

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

  const isActive = !model || model.effectiveActiveView === 'source-changes'

  return (
    <KeepAliveTabPanel id="admin-source-changes" active={isActive} className="space-y-4">
      <QueryViewBoundary queries={[{ label: 'danh sách lô đối chiếu', view: batchesView }]} geometry="workspace" minHeight="min-h-[24rem]">
      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs" data-ui-work-surface="admin-source-changes-scope">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Phạm vi lô đối chiếu</h3>
            <InfoNote
              title="Lịch sử thay đổi nguồn"
              content="Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng."
            />
          </div>

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
                <Select value={effectiveBatchId || null} onValueChange={(val) => val && handleBatchChange(val)}>
                  <SelectTrigger className="h-8 min-w-[280px] max-w-sm sm:max-w-md w-auto text-xs" aria-label="Chọn lô đối chiếu">
                    <SelectValue placeholder="Chọn lô" className="whitespace-nowrap">
                      {selectedBatch ? batchLabel(selectedBatch) : filteredBatches.length === 0 ? 'Không có lô phù hợp' : 'Chọn lô'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBatches.map((item) => (
                      <SelectItem key={item.batchId} value={item.batchId}>
                        {batchLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          )}
        </div>
      </div>

      {effectiveBatchId ? (
        <ReconciliationSourceChangeLog batchId={effectiveBatchId} standalone />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-sm font-semibold text-slate-900">
            {batches.length === 0 ? 'Chưa có lô đối chiếu' : 'Không có lô phù hợp với bộ lọc'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {batches.length === 0
              ? 'Cần có ít nhất một lô đối chiếu để xem nhật ký thay đổi nguồn.'
              : 'Hãy điều chỉnh bộ lọc khách hàng, thời gian hoặc trạng thái để xem lô tương ứng.'}
          </p>
        </section>
      )}
      </QueryViewBoundary>
    </KeepAliveTabPanel>
  )
}
