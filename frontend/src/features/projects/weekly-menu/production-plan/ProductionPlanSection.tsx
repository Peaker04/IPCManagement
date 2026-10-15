import { CalendarDays, ClipboardList } from 'lucide-react'
import { EmptyState, IdentifierText, InlineAlert, Num, SectionPanel, StatusBadge, TableViewport, TableSkeleton, RefreshStatus } from '@/components/common';
import { PageStepper } from '@/components/common/PageStepper'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { getShiftLabel } from '../model/formatters'
import { formatDateOnly, formatNumber } from '@/lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WeeklyProductionPlanWorkflow } from './useWeeklyProductionPlan'

const ALL_DAYS_VALUE = '__all-days__'

export function ProductionPlanSection({ workflow }: { workflow: WeeklyProductionPlanWorkflow }) {
  const { scope, state, status, actions, presentation } = workflow
  const activePage = presentation.activePage
  const selectedDayLabel = state.selectedDayKey
    ? scope.displayDays.find((day) => day.key === state.selectedDayKey)?.label ?? 'Chọn ngày'
    : 'Cả tuần'
  return (
    <SectionPanel
      title="Kế hoạch sản xuất"
      headingLevel={2}
      icon={<ClipboardList size={18} />}
      description="Kế hoạch sản xuất được sinh từ thực đơn tuần, phân bổ số suất theo từng ca và món ăn."
    >
      <div className="relative flex flex-col gap-3">
        {status.isRefreshing && (
          <RefreshStatus>Đang cập nhật kế hoạch sản xuất</RefreshStatus>
        )}
        {!status.isForbidden && <section className="ipc-fiori-command flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between" aria-label="Phạm vi kế hoạch sản xuất đang xem">
          <div className="ipc-fiori-object flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs">
              <CalendarDays size={18} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-slate-500 leading-tight">Ngày phục vụ</span>
              <strong className="text-sm font-semibold text-slate-900 leading-tight">{activePage ? `${activePage.label} ${activePage.dateLabel}` : 'Chưa có kế hoạch'}</strong>
              <small className="text-xs text-slate-500 leading-tight">{activePage ? `${activePage.plans.length} KHSX · ${activePage.totalLines} dòng · ${formatNumber(activePage.totalServings)} suất` : scope.customerId && scope.weekStartDate ? 'Chưa có KHSX trong phạm vi tuần đã chọn' : 'Chọn khách hàng và tuần để xem dữ liệu'}</small>
            </div>
          </div>
          <div className="ipc-fiori-command-actions flex flex-wrap items-center gap-3">
            <label className="ipc-fiori-field flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Phạm vi:</span>
              <div className="w-44">
                <Select value={state.selectedDayKey || ALL_DAYS_VALUE} onValueChange={(value) => actions.selectDay(value === ALL_DAYS_VALUE || value === null ? null : value)}>
                  <SelectTrigger className="w-full"><SelectValue>{selectedDayLabel}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DAYS_VALUE}>Cả tuần</SelectItem>
                    {scope.displayDays.map((day) => <SelectItem key={day.key} value={day.key}>{day.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </label>
            {presentation.pages.length > 0 && <PageStepper page={state.pageIndex + 1} totalPages={presentation.pages.length} label="Nhóm KHSX" ariaLabel="Điều hướng kế hoạch sản xuất" onPageChange={actions.setPage} />}
          </div>
        </section>}

        {status.isForbidden ? (
          <InlineAlert title="Không có quyền xem kế hoạch sản xuất" variant="danger">
            <span role="alert">{status.forbiddenMessage}</span>
          </InlineAlert>
        ) : status.isUninitialized ? (
          <InlineAlert title="Chưa khởi tạo kế hoạch sản xuất" variant="info">
            {status.instruction}
          </InlineAlert>
        ) : status.isError ? (
          <EmptyState
            variant="error"
            title="Không tải được kế hoạch sản xuất"
            description={status.errorMessage ?? 'Vui lòng thử tải lại hoặc kiểm tra kết nối mạng.'}
            onRetry={actions.retry}
            isRetrying={status.isRetrying}
          />
        ) : !state.selectedServiceDate && status.isLoading ? (
          <TableSkeleton
            columns={[
              { width: '20%', align: 'left' },
              { width: '50%', align: 'left' },
              { width: '30%', align: 'right' },
            ]}
            rows={4}
            ariaLabel="Đang tải kế hoạch sản xuất..."
          />
        ) : presentation.pages.length === 0 ? (
          <EmptyState
            title={scope.customerId && scope.weekStartDate ? 'Chưa có kế hoạch sản xuất trong tuần đã chọn' : 'Chọn khách hàng và tuần để xem kế hoạch sản xuất'}
            className="!min-h-0 !py-8"
          />
        ) : (
          <>
            {activePage?.plans.map((plan) => {
              const planStatus = getWorkflowStatusPresentation(plan.status ?? undefined)
              const totalServings = plan.lines.reduce((total, line) => total + line.totalServings, 0)
              return (
                <article key={plan.planId} className="ipc-fiori-object-card mt-0 rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-wider text-slate-500">Mã KHSX:</span>
                      <h3 className="text-sm font-bold text-slate-900">
                        <IdentifierText value={plan.planCode} />
                      </h3>
                      <StatusBadge variant={planStatus.tone}>{planStatus.label}</StatusBadge>
                    </div>
                    <dl className="ipc-fiori-meta flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
                      <div className="flex items-baseline gap-1.5"><dt className="text-slate-500">Ngày phục vụ:</dt><dd className="font-medium text-slate-800">{formatDateOnly(plan.planDate)}</dd></div>
                      <div className="flex items-baseline gap-1.5"><dt className="text-slate-500">Khách hàng:</dt><dd className="font-medium text-slate-800" title={`${plan.customerName} (${plan.customerCode})`}>{plan.customerName} ({plan.customerCode})</dd></div>
                      <div className="flex items-baseline gap-1.5"><dt className="text-slate-500">Số dòng món:</dt><dd className="font-semibold text-slate-800"><Num value={plan.lines.length} type="number" /></dd></div>
                      <div className="flex items-baseline gap-1.5"><dt className="text-slate-500">Tổng số suất:</dt><dd className="font-bold text-primary"><Num value={totalServings} type="number" /> suất</dd></div>
                    </dl>
                  </div>
                  <TableViewport
                    caption="Dòng món của từng KHSX theo ngày phục vụ, ca và số suất"
                    ariaLabel="Bảng chi tiết kế hoạch sản xuất"
                    className="ipc-production-plan-table rounded-none border-0 shadow-none"
                    size="weekly"
                  >
                    <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
                      <thead>
                        <tr>
                          <th scope="col" className="w-[20%] text-left">Ca</th>
                          <th scope="col" className="w-[50%] text-left">Món ăn</th>
                          <th scope="col" className="w-[30%] text-right">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.lines.map((line) => (
                          <tr key={line.planLineId}>
                            <td className="text-slate-600 font-medium">{getShiftLabel(line.shiftName ?? undefined)}</td>
                            <td className="font-semibold text-slate-900">{line.dishName ?? '-'}</td>
                            <td data-cell-role="numeric" className="text-right tabular-nums font-bold text-slate-800">{formatNumber(line.totalServings)} suất</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableViewport>
                </article>
              )
            })}
          </>
        )}
      </div>
    </SectionPanel>
  )
}
