import { CalendarDays, Scale } from 'lucide-react'
import { EmptyState, PageStepper, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { getShiftLabel } from '../model/formatters'
import type { WeeklyProductionPlanWorkflow } from './useWeeklyProductionPlan'

export function ProductionPlanSection({ workflow }: { workflow: WeeklyProductionPlanWorkflow }) {
  const { scope, state, status, actions, presentation } = workflow
  const activePage = presentation.activePage
  return (
    <SectionPanel title="Kế hoạch sản xuất" headingLevel={2} icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
      <div className="flex flex-col gap-3">
        <section className="ipc-fiori-command" aria-label="Phạm vi kế hoạch sản xuất đang xem">
          <div className="ipc-fiori-object">
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Ngày phục vụ</span>
              <strong>{activePage ? `${activePage.label} ${activePage.dateLabel}` : 'Chưa có kế hoạch'}</strong>
              <small>{activePage ? `${activePage.plans.length} KHSX · ${activePage.totalLines} dòng · ${activePage.totalServings.toLocaleString('vi-VN')} suất` : 'Chọn khách hàng và tuần để xem dữ liệu'}</small>
            </div>
          </div>
          <div className="ipc-fiori-command-actions">
            <label className="ipc-fiori-field">
              <span>Phạm vi</span>
              <select className="ipc-input" value={state.selectedDayKey || ''} onChange={(event) => actions.selectDay(event.target.value || null)}>
                <option value="">Cả tuần</option>
                {scope.displayDays.map((day) => <option key={day.key} value={day.key}>{day.label}</option>)}
              </select>
            </label>
            {presentation.pages.length > 0 && <PageStepper page={state.pageIndex + 1} totalPages={presentation.pages.length} label="Nhóm KHSX" ariaLabel="Điều hướng kế hoạch sản xuất" onPageChange={actions.setPage} />}
          </div>
        </section>

        {status.isError ? (
          <EmptyState
            variant="error"
            title="Không tải được kế hoạch sản xuất"
            description="Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì tuần này chưa có kế hoạch sản xuất. Hãy tải lại trước khi kết luận."
            onRetry={actions.retry}
            isRetrying={status.isRetrying}
          />
        ) : !state.selectedServiceDate && status.isLoading ? (
          <div className="py-8 text-center text-slate-500">Đang tải kế hoạch sản xuất cả tuần...</div>
        ) : presentation.pages.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Chưa có kế hoạch sản xuất nào.</div>
        ) : (
          <>
            {activePage?.plans.map((plan) => {
              const planStatus = getWorkflowStatusPresentation(plan.status ?? undefined)
              return <article key={plan.planId} className="ipc-fiori-object-card">
                <div className="ipc-fiori-object-card__header">
                  <div><span>Mã KHSX</span><h3>{plan.planCode}</h3></div>
                  <StatusBadge variant={planStatus.tone}>{planStatus.label}</StatusBadge>
                </div>
                <dl className="ipc-fiori-meta">
                  <div><dt>Ngày phục vụ</dt><dd>{new Date(plan.planDate).toLocaleDateString('vi-VN')}</dd></div>
                  <div><dt>Khách hàng</dt><dd title={`${plan.customerName} (${plan.customerCode})`}>{plan.customerName} ({plan.customerCode})</dd></div>
                  <div><dt>Số dòng món</dt><dd>{plan.lines.length}</dd></div>
                  <div><dt>Tổng số suất</dt><dd>{plan.lines.reduce((total, line) => total + line.totalServings, 0).toLocaleString('vi-VN')}</dd></div>
                </dl>
                <TableViewport
                  caption="Chi tiết kế hoạch sản xuất theo ca và món ăn"
                  ariaLabel="Bảng chi tiết kế hoạch sản xuất"
                  className="ipc-production-plan-table"
                  size="weekly"
                >
                  <table className="ipc-data-table">
                    <thead><tr><th className="w-[20%] text-left">Ca</th><th className="w-[50%] text-left">Món ăn</th><th className="w-[30%] text-right">Số lượng (suất)</th></tr></thead>
                    <tbody>{plan.lines.map((line) => <tr key={line.planLineId}><td>{getShiftLabel(line.shiftName ?? undefined)}</td><td>{line.dishName ?? '-'}</td><td className="text-right font-medium">{line.totalServings}</td></tr>)}</tbody>
                  </table>
                </TableViewport>
              </article>
            })}
          </>
        )}
      </div>
    </SectionPanel>
  )
}
