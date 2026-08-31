import { CalendarDays, Scale } from 'lucide-react'
import { EmptyState, InlineAlert, SectionPanel, StatusBadge, TableViewport, TableSkeleton } from '@/components/common'
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
      icon={<Scale size={18} color="var(--ipc-slate-600)" />}
      description="Kế hoạch sản xuất được sinh từ thực đơn tuần, phân bổ số suất theo từng ca và món ăn."
    >
      <div className="relative flex flex-col gap-3">
        {status.isRefreshing && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm" role="status">
            Đang cập nhật kế hoạch sản xuất
          </span>
        )}
        <section className="ipc-fiori-command" aria-label="Phạm vi kế hoạch sản xuất đang xem">
          <div className="ipc-fiori-object">
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Ngày phục vụ</span>
              <strong>{activePage ? `${activePage.label} ${activePage.dateLabel}` : 'Chưa có kế hoạch'}</strong>
              <small>{activePage ? `${activePage.plans.length} KHSX · ${activePage.totalLines} dòng · ${formatNumber(activePage.totalServings)} suất` : 'Chọn khách hàng và tuần để xem dữ liệu'}</small>
            </div>
          </div>
          <div className="ipc-fiori-command-actions">
            <label className="ipc-fiori-field">
              <span>Phạm vi</span>
              <Select value={state.selectedDayKey || ALL_DAYS_VALUE} onValueChange={(value) => actions.selectDay(value === ALL_DAYS_VALUE || value === null ? null : value)}>
                <SelectTrigger className="w-full"><SelectValue>{selectedDayLabel}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DAYS_VALUE}>Cả tuần</SelectItem>
                  {scope.displayDays.map((day) => <SelectItem key={day.key} value={day.key}>{day.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            {presentation.pages.length > 0 && <PageStepper page={state.pageIndex + 1} totalPages={presentation.pages.length} label="Nhóm KHSX" ariaLabel="Điều hướng kế hoạch sản xuất" onPageChange={actions.setPage} />}
          </div>
        </section>

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
            title="Chưa có kế hoạch sản xuất nào."
            className="!min-h-0 !py-8"
          />
        ) : (
          <>
            {activePage?.plans.map((plan) => {
              const planStatus = getWorkflowStatusPresentation(plan.status ?? undefined)
              return (
                <article key={plan.planId} className="ipc-fiori-object-card">
                  <div className="ipc-fiori-object-card__header">
                    <div><span>Mã KHSX</span><h3>{plan.planCode}</h3></div>
                    <StatusBadge variant={planStatus.tone}>{planStatus.label}</StatusBadge>
                  </div>
                  <dl className="ipc-fiori-meta">
                    <div><dt>Ngày phục vụ</dt><dd>{formatDateOnly(plan.planDate)}</dd></div>
                    <div><dt>Khách hàng</dt><dd title={`${plan.customerName} (${plan.customerCode})`}>{plan.customerName} ({plan.customerCode})</dd></div>
                    <div><dt>Số dòng món</dt><dd>{plan.lines.length}</dd></div>
                    <div><dt>Tổng số suất</dt><dd>{formatNumber(plan.lines.reduce((total, line) => total + line.totalServings, 0))} suất</dd></div>
                  </dl>
                  <TableViewport
                    caption="Chi tiết kế hoạch sản xuất theo ca và món ăn"
                    ariaLabel="Bảng chi tiết kế hoạch sản xuất"
                    className="ipc-production-plan-table"
                    size="weekly"
                  >
                    <table className="ipc-erp-grid-table w-full">
                      <thead>
                        <tr>
                          <th className="w-[20%] text-left">Ca</th>
                          <th className="w-[50%] text-left">Món ăn</th>
                          <th className="w-[30%] text-right">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.lines.map((line) => (
                          <tr key={line.planLineId}>
                            <td className="text-slate-600">{getShiftLabel(line.shiftName ?? undefined)}</td>
                            <td className="font-medium text-slate-900">{line.dishName ?? '-'}</td>
                            <td className="text-right tabular-nums font-semibold text-slate-800">{formatNumber(line.totalServings)} suất</td>
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
