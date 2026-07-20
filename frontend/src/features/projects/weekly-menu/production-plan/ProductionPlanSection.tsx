import { Scale } from 'lucide-react'
import { PageStepper, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { getShiftLabel } from '../model/formatters'
import type { WeeklyProductionPlanWorkflow } from './useWeeklyProductionPlan'

export function ProductionPlanSection({ workflow }: { workflow: WeeklyProductionPlanWorkflow }) {
  const { scope, state, status, actions, presentation } = workflow
  const activePage = presentation.activePage
  return (
    <SectionPanel title="Kế hoạch sản xuất chi tiết" icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[auto_minmax(220px,1fr)] items-center gap-3">
          <span className="whitespace-nowrap text-sm font-semibold text-slate-700">Ngày phục vụ:</span>
          <select className="ipc-input min-h-9 w-full text-sm" value={state.selectedDayKey || ''} onChange={(event) => actions.selectDay(event.target.value || null)}>
            <option value="">Cả tuần</option>
            {scope.displayDays.map((day) => <option key={day.key} value={day.key}>{day.label}</option>)}
          </select>
        </div>

        {!state.selectedServiceDate && status.isLoading ? (
          <div className="py-8 text-center text-slate-500">Đang tải kế hoạch sản xuất cả tuần...</div>
        ) : presentation.pages.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Chưa có kế hoạch sản xuất nào.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{activePage?.label} - {activePage?.dateLabel}</span>
                <span className="text-slate-500">{activePage?.plans.length ?? 0} KHSX / {activePage?.totalLines ?? 0} dòng / {(activePage?.totalServings ?? 0).toLocaleString('vi-VN')} suất</span>
              </div>
              <PageStepper page={state.pageIndex + 1} totalPages={presentation.pages.length} label="Kế hoạch sản xuất" ariaLabel="Điều hướng kế hoạch sản xuất" onPageChange={actions.setPage} />
            </div>

            {activePage?.plans.map((plan) => (
              <div key={plan.planId} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <h3 className="font-semibold text-slate-800">Mã KHSX: {plan.planCode}</h3>
                  <StatusBadge variant={plan.status === 'DRAFT' ? 'warning' : 'success'}>{plan.status}</StatusBadge>
                </div>
                <div className="mb-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-1"><span className="whitespace-nowrap font-medium">Ngày phục vụ:</span><span>{new Date(plan.planDate).toLocaleDateString('vi-VN')}</span></div>
                  <div className="flex min-w-0 items-center gap-1"><span className="whitespace-nowrap font-medium">Khách hàng:</span><span className="truncate" title={`${plan.customerName} (${plan.customerCode})`}>{plan.customerName} ({plan.customerCode})</span></div>
                </div>
                <TableViewport caption="Chi tiết kế hoạch sản xuất theo ca và món ăn" ariaLabel="Bảng chi tiết kế hoạch sản xuất">
                  <table className="ipc-data-table">
                    <thead><tr><th className="w-[20%] text-left">Ca</th><th className="w-[50%] text-left">Món ăn</th><th className="w-[30%] text-right">Số lượng (suất)</th></tr></thead>
                    <tbody>{plan.lines.map((line) => <tr key={line.planLineId}><td>{getShiftLabel(line.shiftName)}</td><td>{line.dishName ?? '-'}</td><td className="text-right font-medium">{line.totalServings}</td></tr>)}</tbody>
                  </table>
                </TableViewport>
              </div>
            ))}
          </>
        )}
      </div>
    </SectionPanel>
  )
}
