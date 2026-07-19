import { Link } from 'react-router-dom'
import { Scale, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, DemandSummary, DocumentRail, InlineAlert, PaginationBar, SectionPanel, StatusBadge, TableViewport, Toolbar } from '@/components/common'
import { ActionGuard } from '@/routes/ActionGuard'
import { ROUTES } from '@/routes/routeConfig'
import { QuickServingCell } from '../schedule/QuickServingCell'
import type { WeeklyScheduleEditorWorkflow } from '../schedule/types'
import type { WeeklyScheduleFeedback } from '../schedule/types'
import type { MaterialDemandWorkflow } from './useMaterialDemand'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'

export function MaterialDemandSection({
  workflow,
  scheduleWorkflow,
  servingFeedback,
}: {
  workflow: MaterialDemandWorkflow
  scheduleWorkflow: WeeklyScheduleEditorWorkflow
  servingFeedback: WeeklyScheduleFeedback | null
}) {
  const { state, status, actions, presentation } = workflow
  const { activeDay, dayPages, dayIndex, activeRows, activeQuickServingRows, inventoryStatus } = presentation
  const servingBusy = status.isSavingQuickServings || scheduleWorkflow.status.isSavingQuickServings
  return (
    <SectionPanel title="KHSX, kiểm tồn kho và nhu cầu xuất" icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
      <div className="flex flex-col gap-3">
        <ContextStrip items={[
          { label: 'Nguồn menu', value: presentation.sourceMenuValue, tone: 'neutral' },
          { label: 'Dòng KHSX', value: presentation.weeklyPlanRows.length.toString(), tone: 'neutral' },
          { label: 'Đã có BOM/catalog', value: (presentation.weeklyPlanRows.length - presentation.missingBomRows.length).toString(), tone: 'success' },
          { label: 'Chưa tính được BOM', value: presentation.missingBomRows.length.toString(), tone: presentation.missingBomRows.length > 0 ? 'warning' : 'success' },
          { label: 'Nguyên liệu tổng hợp', value: presentation.materialSummaryCount.toString(), tone: 'info' },
        ]} />

        {presentation.missingBomRows.length > 0 && (
          <InlineAlert title="Một số món import chưa có BOM catalog" variant="warning">
            Các món này vẫn được đưa vào KHSX theo tên món trong Excel, nhưng chưa sinh định lượng nguyên liệu cho đến khi được gắn với món/BOM trong catalog.
          </InlineAlert>
        )}
        {presentation.importDefaultRows.length > 0 && (
          <InlineAlert title="Đang dùng số suất default từ import" variant="warning">
            Tạm thời hệ thống dùng số suất mặc định trong file import để chạy luồng KHSX, demand và mua thêm. Khi có dữ liệu suất chuẩn, Meal Quantity Plan đã chốt sẽ tự được ưu tiên.
          </InlineAlert>
        )}
        {servingFeedback && <InlineAlert title={servingFeedback.title} variant={servingFeedback.variant}>{servingFeedback.message}</InlineAlert>}
        {state.feedback && <InlineAlert title={state.feedback.title} variant={state.feedback.variant}>{state.feedback.message}</InlineAlert>}
        {presentation.staleness?.isStale && (
          <InlineAlert title="Demand đã lỗi thời, cần tính lại" variant="warning">{presentation.staleness.reasons.join(' | ')}</InlineAlert>
        )}

        <Toolbar className="justify-end">
          <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
            <button className="ipc-button ipc-button-primary" type="button" onClick={() => void actions.generate()} disabled={status.isGenerating || servingBusy || presentation.weeklyPlanRows.length === 0}>
              <Scale size={16} />
              {servingBusy ? 'Đang lưu suất...' : status.isGenerating ? 'Đang tạo demand...' : presentation.staleness?.isStale ? 'Tính lại demand (dữ liệu đã thay đổi)' : 'Tạo demand từ KHSX'}
            </button>
          </ActionGuard>
          <Link className="ipc-button ipc-button-warning" to={`${ROUTES.REPORTS}?view=purchase`}><ShoppingCart size={16} />Xem kế hoạch thu mua</Link>
        </Toolbar>

        <TableViewport caption="Kế hoạch sản xuất sinh từ kế hoạch tuần" className="h-[560px] max-h-[560px]" ariaLabel="Bảng KHSX sinh từ kế hoạch tuần">
          <table className="ipc-data-table table-fixed w-full">
            <thead><tr>
              <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Ngày</th>
              <th style={{ width: '9%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ca</th>
              <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Nhóm</th>
              <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
              <th style={{ width: '27%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món theo kế hoạch tuần</th>
              <th style={{ width: '18%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
              <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>BOM</th>
            </tr></thead>
            <tbody>
              {activeRows.map((row) => {
                const quickServingRow = scheduleWorkflow.presentation.getQuickServingRow(presentation.activeQuickServingRows, row)
                return (
                  <tr key={row.key} className="table-row">
                    <td className={`${tableCellClass} text-left font-semibold`}>{row.dayLabel}<div className="text-[12px] font-normal text-slate-500">{row.date}</div></td>
                    <td className={tableCellClass}>{row.shiftLabel}</td>
                    <td className={tableCellClass}>{row.menuTypeLabel}</td>
                    <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                    <td className={`${tableCellClass} text-left font-semibold text-slate-900`}>{row.dishName}</td>
                    <td className={tableCellClass} title={quickServingRow?.statusLabel ?? row.servingsStatusLabel}>
                      {quickServingRow ? <QuickServingCell row={quickServingRow} workflow={scheduleWorkflow} /> : row.servingsStatus === 'missing' ? (
                        <span className="inline-flex flex-col items-center gap-0.5"><span className="font-semibold text-amber-700">Chưa chốt</span></span>
                      ) : (
                        <span className="inline-flex flex-col items-center gap-0.5"><span>{row.portions.toLocaleString('vi-VN')}</span>{row.servingsStatus === 'import-default' && <span className="text-[11px] font-normal text-amber-700">Tạm từ import</span>}</span>
                      )}
                    </td>
                    <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>{row.hasCatalogBom ? 'Đã có' : 'Chưa gắn'}</td>
                  </tr>
                )
              })}
              {activeRows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có kế hoạch ngày để sinh KHSX.</td></tr>}
            </tbody>
          </table>
        </TableViewport>
        <div className="flex min-h-[38px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {activeQuickServingRows.map((row) => {
              const disabled = servingBusy || row.isCompleted || Number(row.inputValue) <= 0
              return (
                <ActionGuard key={`complete-${row.key}`} allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['orders.lock']}>
                  <button type="button" className={cn('ipc-button min-w-[132px] whitespace-nowrap', row.isCompleted ? 'ipc-button-ghost' : 'ipc-button-primary')} disabled={disabled} onClick={() => void scheduleWorkflow.actions.completeQuickServing(row)}>
                    {row.isCompleted ? `Đã hoàn tất ${row.shiftLabel}` : `Hoàn tất ${row.shiftLabel}`}
                  </button>
                </ActionGuard>
              )
            })}
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="mr-2 text-sm font-medium text-slate-600">{activeDay ? `${activeDay.label} ${activeDay.date} (${dayIndex + 1}/${dayPages.length})` : 'Chưa có ngày'}</span>
            <button type="button" className="ipc-button ipc-button-ghost" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</button>
            <button type="button" className="ipc-button ipc-button-primary" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</button>
          </div>
        </div>

        {presentation.demandLines.length > 0 || presentation.aggregateLines.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex min-h-[34px] items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-800">Nguyên liệu ngày {activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}</span>
                <span className="text-xs font-medium text-slate-500">Đủ {inventoryStatus.enoughCount}, thiếu {inventoryStatus.shortageCount}, tổng {presentation.aggregateLines.length} nguyên liệu</span>
              </div>
              <StatusBadge variant={inventoryStatus.tone} className="shrink-0 whitespace-nowrap">{inventoryStatus.label}</StatusBadge>
            </div>
            {status.isFetchingAggregate && !presentation.aggregatePage ? <div className="ipc-demand-summary is-empty">Đang tải nguyên liệu ngày đang xem...</div> : <DemandSummary lines={presentation.aggregateLines} />}
            {presentation.aggregatePage && <PaginationBar page={presentation.aggregatePage.pageNumber} pageSize={presentation.aggregatePage.pageSize} totalItems={presentation.aggregatePage.totalCount} onPageChange={actions.setAggregatePage} />}
          </div>
        ) : (
          <InlineAlert title="Chưa sinh nhu cầu nguyên liệu backend" variant={presentation.weeklyPlanRows.length > 0 ? 'warning' : 'info'}>
            {presentation.weeklyPlanRows.length > 0 ? 'Bảng KHSX phía trên đã có dữ liệu từ menu. Bấm Tạo demand từ KHSX để sinh dòng nguyên liệu; kế hoạch thu mua sẽ lấy trực tiếp từ demand, tồn kho và pending receipt.' : 'Chưa có dòng KHSX từ menu đang chọn.'}
          </InlineAlert>
        )}
        <DocumentRail documents={presentation.documents} title="KHSX và chứng từ đầu ra" />
      </div>
    </SectionPanel>
  )
}
