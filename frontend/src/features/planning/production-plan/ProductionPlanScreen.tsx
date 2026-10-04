import { useState } from 'react'
import { useWeeklyProductionPlan } from '@/features/projects/weekly-menu/production-plan/useWeeklyProductionPlan'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'
import { EmptyState, TableViewport } from '@/components/common'
import { PageStepper } from '@/components/common/PageStepper'
import { Button } from '@/components/ui/button'
import { formatDateOnly, formatDateTime, formatNumber } from '@/lib/formatters'
import { getShiftLabel } from '@/features/projects/weekly-menu/model/formatters'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'

export function ProductionPlanScreen({ scope, enabled }: { scope: WeeklyMenuScope; enabled: boolean }) {
  const { state, actions, presentation, dataState } = useWeeklyProductionPlan(scope, enabled)
  const [selected, setSelected] = useState<string | null>(null)
  const plans = presentation.activePage?.plans ?? []
  const active = selected === null ? plans[0] : plans.find(plan => plan.planId === selected)
  const close = () => {
    document.getElementById(`production-select-${active?.planId}`)?.focus()
    setSelected('')
  }
  return <QueryViewBoundary queries={[{ label: 'kế hoạch sản xuất', view: dataState }]}><section aria-label="Kế hoạch sản xuất đã sinh" className="planning-ledger">
    <div className="planning-ledger-heading"><h2>Kế hoạch đã lưu</h2><label>Ngày phục vụ<select value={state.selectedDayKey ?? ''} onChange={event => { setSelected(null); actions.selectDay(event.target.value || null) }}><option value="">Cả tuần</option>{scope.displayDays.map(day => <option key={day.key} value={day.key}>{day.label} · {day.date}</option>)}</select></label>{presentation.pages.length > 0 && <PageStepper page={state.pageIndex + 1} totalPages={presentation.pages.length} label="Nhóm KHSX" ariaLabel="Điều hướng kế hoạch sản xuất" onPageChange={page => { setSelected(null); actions.setPage(page) }} />}</div>
    {presentation.pages.length === 0 ? <EmptyState title="Chưa có kế hoạch sản xuất trong tuần đã chọn" /> : <div className="planning-master-detail">
      <nav aria-label="Kế hoạch sản xuất đã lưu" className="planning-plan-list"><ul>{plans.map(plan => <li key={plan.planId}><button type="button" id={`production-select-${plan.planId}`} aria-pressed={active?.planId === plan.planId} onClick={() => setSelected(plan.planId)}><strong>{formatDateOnly(plan.planDate)}</strong><span>{[...new Set(plan.lines.map(line => getShiftLabel(line.shiftName ?? undefined)))].join(' · ')}</span><small>{plan.planCode}</small><span>{plan.sentToKitchenAt ? 'Đã gửi bếp' : getWorkflowStatusPresentation(plan.status ?? undefined).label}</span></button></li>)}</ul></nav>
      {active ? <section aria-label="Chi tiết kế hoạch đang chọn" onKeyDown={event => { if (event.key === 'Escape') close() }}>
        <div className="planning-ledger-heading"><div><h3>{formatDateOnly(active.planDate)}</h3><p>{active.planCode} · {active.lines.length} dòng món</p></div><Button type="button" variant="ghost" size="sm" onClick={close}>Đóng chi tiết</Button></div>
        {active.sentToKitchenAt && <p className="planning-help">Đã gửi bếp · {formatDateTime(active.sentToKitchenAt)}. Gửi kế hoạch thuộc Điều phối.</p>}
        <TableViewport ariaLabel="Dòng món kế hoạch đang chọn" appearance="quiet-operational" density="compact"><table className="ipc-data-table"><caption className="sr-only">Dòng món của {active.planCode}</caption><thead><tr><th scope="col">Ca</th><th scope="col">Món ăn</th><th scope="col" data-cell-role="numeric">Số suất</th></tr></thead><tbody>{active.lines.map(line => <tr key={line.planLineId}><td>{getShiftLabel(line.shiftName ?? undefined)}</td><th scope="row">{line.dishName ?? 'Chưa xác định món'}</th><td data-cell-role="numeric">{formatNumber(line.totalServings)}</td></tr>)}</tbody></table></TableViewport>
        <details className="planning-help"><summary>Nguồn kế hoạch đã lưu</summary><dl><dt>Phiên bản thực đơn</dt><dd>{active.menuVersionNo ?? 'Chưa có'}</dd><dt>Mã kế hoạch nguồn</dt><dd>{active.planId}</dd><dt>Mã phiên bản nguồn</dt><dd>{active.menuVersionId ?? 'Chưa có'}</dd></dl></details>
      </section> : <p className="planning-help">Chọn kế hoạch ở bên trái để xem món và số suất đã lưu.</p>}
    </div>}
  </section></QueryViewBoundary>
}
