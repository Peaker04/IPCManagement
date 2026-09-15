import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, Layers, Scale, Warehouse } from 'lucide-react'
import { CommandBar, InfoNote, OperationalFrame, PaginationBar, StatusBadge } from '@/components/common'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROUTES } from '@/lib/routeConfig'
import { useListReconciliationBatchesQuery } from '@/api/reconciliationApi'
import { getReconciliationLifecyclePresentation } from '@/features/reconciliation/reconciliationLifecyclePresentation'
import { formatDateTime } from '@/lib/formatters'
import { useLocalPagination } from '@/lib/useLocalPagination'
import { readReconciliationSelection, writeReconciliationSelection } from '@/lib/navigationPreferences'

const steps = [
  { order: '01', title: 'Kế hoạch tuần', route: ROUTES.WEEKLY_MENU, icon: CalendarDays },
  { order: '02', title: 'Định lượng xuất kho', route: `${ROUTES.WEEKLY_MENU}?view=demand`, icon: Layers },
  { order: '03', title: 'Kho xuất thực tế', route: ROUTES.WAREHOUSE, icon: Warehouse },
  { order: '04', title: 'Đối chiếu', route: ROUTES.RECONCILIATION, icon: Scale },
] as const

export function ReconciliationDashboardPage() {
  const persistedSelection = readReconciliationSelection()
  const batchesQuery = useListReconciliationBatchesQuery()
  const batches = batchesQuery.data ?? []

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(persistedSelection.customerId ?? 'ALL')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL')

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

  const handleCustomerChange = (newCustomerId: string) => {
    setSelectedCustomerId(newCustomerId)
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      customerId: newCustomerId !== 'ALL' ? newCustomerId : undefined,
    })
  }

  const scopedBatches = useMemo(() => {
    const now = new Date()
    return batches.filter((b) => {
      if (selectedCustomerId !== 'ALL' && b.customerId !== selectedCustomerId) return false
      const date = new Date(b.createdAt)
      if (selectedPeriod === 'THIS_YEAR' && date.getFullYear() !== now.getFullYear()) return false
      if (selectedPeriod === 'THIS_MONTH' && (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth())) return false
      return true
    })
  }, [batches, selectedCustomerId, selectedPeriod])

  const totalBatches = scopedBatches.length
  const waitingWarehouseCount = scopedBatches.filter((b) => b.status === 'TRANSFERRED' || b.status === 'READY').length
  const inProgressCount = scopedBatches.filter((b) => b.status === 'IN_PROGRESS').length
  const completedCount = scopedBatches.filter((b) => b.status === 'COMPLETED').length

  const [batchPageSize, setBatchPageSize] = useState(4)
  const batchPagination = useLocalPagination(scopedBatches, batchPageSize)

  const selectedCustomerLabel = selectedCustomerId === 'ALL'
    ? 'Tất cả khách hàng'
    : customers.find((c) => c.customerId === selectedCustomerId)?.customerName ?? 'Khách hàng'

  const periodLabels: Record<string, string> = {
    ALL: 'Toàn thời gian',
    THIS_YEAR: 'Năm nay',
    THIS_MONTH: 'Tháng này',
  }
  const selectedPeriodLabel = periodLabels[selectedPeriod] ?? 'Toàn thời gian'

  return (
    <OperationalFrame
      className="ipc-dashboard-frame"
      command={
        <CommandBar
          className="ipc-dashboard-command-bar"
          actions={<Link to={ROUTES.WEEKLY_MENU} className="ipc-button ipc-button-primary">Bắt đầu từ Thực đơn tuần</Link>}
        >
          <div className="ipc-dashboard-command-main"><span>Quy trình đối chiếu nguyên liệu khép kín</span></div>
        </CommandBar>
      }
    >
      <div className="space-y-4">
        {/* Scope Control: Khách hàng & Kỳ Vận Hành */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs" data-ui-work-surface="dashboard-scope">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900">Phạm vi theo dõi vận hành</h2>
              <InfoNote
                title="Phạm vi theo dõi"
                content="Lọc số liệu KPI và danh sách lô theo khách hàng và kỳ thời gian."
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {customers.length > 0 && (
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Khách hàng
                <Select value={selectedCustomerId} onValueChange={(val) => handleCustomerChange(val ?? 'ALL')}>
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

            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Kỳ thời gian
              <Select value={selectedPeriod} onValueChange={(val) => setSelectedPeriod(val ?? 'ALL')}>
                <SelectTrigger className="h-8 min-w-[140px] w-auto text-xs" aria-label="Lọc theo kỳ">
                  <SelectValue placeholder="Kỳ" className="whitespace-nowrap">{selectedPeriodLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toàn thời gian</SelectItem>
                  <SelectItem value="THIS_YEAR">Năm nay</SelectItem>
                  <SelectItem value="THIS_MONTH">Tháng này</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>

        {/* KPI Operational Metrics Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số vận hành đối chiếu">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tổng số lô</span>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{totalBatches}</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chờ Kho xuất</span>
            <div className="mt-2 text-2xl font-bold tabular-nums text-amber-700">{waitingWarehouseCount}</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Đang đối chiếu</span>
            <div className="mt-2 text-2xl font-bold tabular-nums text-sky-700">{inProgressCount}</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Đã hoàn tất</span>
            <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">{completedCount}</div>
          </div>
        </div>

        {/* 4-Step Interactive Pipeline */}
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs" aria-labelledby="reconciliation-workflow-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 id="reconciliation-workflow-title" className="text-base font-bold text-slate-900">Quy trình 4 bước</h2>
            </div>
          </div>
          <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Các bước đối chiếu nguyên liệu">
            {steps.map((step) => {
              const StepIcon = step.icon
              return (
                <li key={step.order} className="min-w-0">
                  <Link to={step.route} className="group flex h-full min-h-24 flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-left no-underline transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                          <StepIcon size={14} className="text-blue-600" />
                          BƯỚC {step.order}
                        </span>
                        <ArrowRight size={15} className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-700" aria-hidden="true" />
                      </div>
                      <strong className="mt-2 block text-sm font-bold text-slate-900">{step.title}</strong>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Scoped Batches Card Grid with Pagination */}
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs" aria-labelledby="recent-batches-title">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 id="recent-batches-title" className="text-sm font-bold text-slate-900">
                Lô đối chiếu đang theo dõi ({scopedBatches.length})
              </h3>
            </div>
            <Link to={ROUTES.RECONCILIATION} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
              Xem bàn đối chiếu <ArrowUpRight size={14} />
            </Link>
          </div>
          {scopedBatches.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Không có lô đối chiếu nào trong phạm vi khách hàng và kỳ thời gian đã chọn.
            </p>
          ) : (
            <>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {batchPagination.rows.map((item) => {
                  const targetRoute = item.status === 'TRANSFERRED'
                    ? `/warehouse?view=demand&batchId=${encodeURIComponent(item.batchId)}`
                    : ['IN_PROGRESS', 'COMPLETED'].includes(item.status)
                    ? `/reconciliation?batchId=${encodeURIComponent(item.batchId)}`
                    : `${ROUTES.WEEKLY_MENU}?view=demand&batchId=${encodeURIComponent(item.batchId)}`
                  return (
                    <Link
                      key={item.batchId}
                      to={targetRoute}
                      className="flex flex-col justify-between rounded-lg border border-slate-200/70 bg-slate-50/40 p-3 text-left no-underline transition hover:border-slate-300"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-slate-800">{formatDateTime(item.createdAt)}</span>
                          <StatusBadge size="sm" variant={item.status === 'COMPLETED' ? 'success' : item.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>
                            {getReconciliationLifecyclePresentation(item.status).label}
                          </StatusBadge>
                        </div>
                        {item.customerName && (
                          <span className="mt-1.5 inline-block max-w-full truncate rounded bg-slate-200/60 px-1.5 py-0.5 text-caption text-slate-700" title={item.customerName}>
                            {item.customerName}
                          </span>
                        )}
                        <p className="mt-1 text-xs text-slate-500">{item.lines.length} mặt hàng nguyên liệu</p>
                      </div>
                      <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                        Mở xử lý <ArrowRight size={12} />
                      </span>
                    </Link>
                  )
                })}
              </div>
              {scopedBatches.length > 4 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <PaginationBar
                    page={batchPagination.page}
                    pageSize={batchPagination.pageSize}
                    totalItems={batchPagination.totalItems}
                    pageSizeOptions={[4, 8, 12, 24]}
                    onPageChange={batchPagination.setPage}
                    onPageSizeChange={(newSize) => {
                      setBatchPageSize(newSize)
                      batchPagination.resetPage()
                    }}
                    itemLabel="lô"
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </OperationalFrame>
  )
}
