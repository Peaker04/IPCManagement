import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, PackageSearch, Scale, ShoppingCart, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { ConfirmDialog, DemandSummary, DocumentRail, EmptyState, InlineAlert, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { ActionGuard } from '@/components/common/ActionGuard'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routeConfig'
import { QuickServingCell } from '../schedule/QuickServingCell'
import type { WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from '../schedule/types'
import type { DemandLine } from '@/types/workflow'
import type { MaterialDemandWorkflow } from './useMaterialDemand'
import { getDemandActionPresentation } from './demandModel'
import { typography } from '@/lib/typography'
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
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false)
  const [isRegenerateSubmitting, setIsRegenerateSubmitting] = useState(false)
  const { state, status, actions, presentation } = workflow
  const demandView = workflow.dataState
  const { activeDay, dayPages, dayIndex, activeRows, activeQuickServingRows, inventoryStatus, inventoryGroups } = presentation
  const servingBusy = status.isSavingQuickServings || scheduleWorkflow.status.isSavingQuickServings
  const isStalenessUnavailable = status.stalenessState === 'loading' || status.stalenessState === 'error'
  const purchasingHref = `${ROUTES.PURCHASING}?week=${encodeURIComponent(workflow.scope.weekStartDate)}&date=${encodeURIComponent(presentation.activeDate)}`
  const renderPurchaseAction = (line: DemandLine) => line.tone === 'danger' && line.serviceDate
    ? <Link className="ipc-button ipc-button-warning ipc-button-bounded whitespace-nowrap" to={`${ROUTES.PURCHASING}?week=${encodeURIComponent(workflow.scope.weekStartDate)}&date=${encodeURIComponent(line.serviceDate)}`}>Đề xuất mua</Link>
    : undefined
  const activeShiftGroups = Array.from(new Set(activeRows.map((row) => row.shiftLabel))).map((shiftLabel) => {
    const rows = activeRows.filter((row) => row.shiftLabel === shiftLabel)
    return {
      key: shiftLabel,
      label: shiftLabel,
      rows,
      quickServingRow: scheduleWorkflow.presentation.getQuickServingRow(activeQuickServingRows, rows[0]),
    }
  })
  const completedShiftCount = activeShiftGroups.filter((group) => group.quickServingRow?.isCompleted ?? group.rows.every((row) => row.portions > 0)).length
  const isKhsxComplete = activeRows.length > 0 && completedShiftCount === activeShiftGroups.length
  const actionPresentation = getDemandActionPresentation(
    presentation.demandApprovalStatus.status,
    presentation.activeStaleness?.isStale,
    presentation.activeStaleness?.canRegenerate !== false,
  )
  const generateLabel = servingBusy
    ? 'Đang lưu suất...'
    : status.isGenerating
      ? 'Đang tính nhu cầu...'
      : status.stalenessState === 'loading' ? 'Đang kiểm tra độ mới...'
        : status.stalenessState === 'error'
          ? 'Chưa xác minh được độ mới'
          : presentation.demandApprovalStatus.status === 'pending' || presentation.demandApprovalStatus.status === 'rejected' || presentation.demandApprovalStatus.status === 'cancelled' || presentation.activeStaleness?.isStale
            ? 'Tính lại nhu cầu'
            : 'Tạo nhu cầu từ KHSX'
  const handleGenerate = () => {
    if (actionPresentation.requiresRegenerateConfirmation) {
      setIsRegenerateConfirmOpen(true)
      return
    }
    void actions.generate()
  }
  const regenerateConfirmationBusy = isRegenerateSubmitting || status.isGenerating
  const handleConfirmRegenerate = async () => {
    if (regenerateConfirmationBusy) return
    setIsRegenerateSubmitting(true)
    try {
      await actions.generate()
    } finally {
      setIsRegenerateSubmitting(false)
      setIsRegenerateConfirmOpen(false)
    }
  }
  return (
    <SectionPanel
      title="KHSX, kiểm tồn kho và nhu cầu xuất"
      icon={<Scale size={18} color="var(--ipc-slate-600)" />}
      badge={(
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-semibold text-slate-500">Phê duyệt nhu cầu</span>
          <StatusBadge variant={presentation.demandApprovalStatus.tone}>
            {presentation.demandApprovalStatus.label}
          </StatusBadge>
          {presentation.demandApprovalStatus.documentCode && (
            <span className={cn(typography.code, 'max-w-[220px] truncate text-xs font-semibold text-slate-600')} title={presentation.demandApprovalStatus.documentCode}>
              {presentation.demandApprovalStatus.documentCode}
            </span>
          )}
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <section className="ipc-demand-day-command" aria-label="Điều hướng và trạng thái ngày đang xem">
          <div className="ipc-demand-day-object">
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Ngày đang xem</span>
              <strong>{activeDay ? `${activeDay.label} ${activeDay.date}` : 'Chưa có ngày'}</strong>
              <small>{dayPages.length > 0 ? `Ngày ${dayIndex + 1}/${dayPages.length} trong tuần vận hành` : 'Chưa có KHSX theo ngày'}</small>
            </div>
          </div>
          <div className="ipc-demand-primary-actions">
            {presentation.demandApprovalStatus.status === 'pending' && presentation.approvalHref && (
              <ActionGuard allowedRoles={['quanly']}>
                <Link className="ipc-button ipc-button-primary whitespace-nowrap" to={presentation.approvalHref}>{presentation.demandApprovalStatus.actionLabel}</Link>
              </ActionGuard>
            )}
            {presentation.demandApprovalStatus.status === 'approved' && (
              <ActionGuard requiredPermissions={['purchase.read']}>
                <Link className="ipc-button ipc-button-primary whitespace-nowrap" to={purchasingHref}><ShoppingCart size={16} />Mở thu mua</Link>
              </ActionGuard>
            )}
            {actionPresentation.showGenerate && (
              <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
                <Button
                  variant={actionPresentation.generateIsSecondary ? 'outline' : 'default'}
                  size="sm"
                  type="button"
                  onClick={handleGenerate}
                  disabled={status.isGenerating || servingBusy || isStalenessUnavailable || presentation.weeklyPlanRows.length === 0}
                >
                  <Scale size={16} />
                  {generateLabel}
                </Button>
              </ActionGuard>
            )}
          </div>
          <nav className="ipc-demand-day-buttons" aria-label="Chuyển ngày KHSX">
            <Button type="button" variant="outline" size="sm" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</Button>
            <Button type="button" variant="outline" size="sm" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</Button>
          </nav>
        </section>

        <dl className="ipc-demand-day-checkpoints" aria-label="Tóm tắt vận hành ngày đang xem">
          <div>
            <ClipboardList size={18} aria-hidden="true" />
            <dt>KHSX trong ngày</dt>
            <dd>{activeRows.length} dòng</dd>
          </div>
          <div className={completedShiftCount === activeShiftGroups.length && activeShiftGroups.length > 0 ? 'is-complete' : 'is-warning'}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <dt>Số suất theo ca</dt>
            <dd>{completedShiftCount}/{activeShiftGroups.length} ca hoàn tất</dd>
          </div>
          <div>
            <PackageSearch size={18} aria-hidden="true" />
            <dt>Vật tư đã đáp ứng</dt>
            <dd>{status.isDemandError ? 'Chưa xác định' : `${inventoryStatus.enoughCount}/${inventoryStatus.totalCount} nguyên liệu`}</dd>
          </div>
          <div className={status.isDemandError || inventoryStatus.shortageCount > 0 ? 'is-danger' : inventoryStatus.pendingKitchenCount > 0 ? 'is-warning' : 'is-complete'}>
            <TriangleAlert size={18} aria-hidden="true" />
            <dt>Phần còn phải xử lý</dt>
            <dd>{status.isDemandError
              ? 'Chưa xác định được'
              : inventoryStatus.shortageCount > 0
                ? `Còn ${inventoryStatus.shortageCount} nguyên liệu chưa xuất`
                : inventoryStatus.pendingKitchenCount > 0
                  ? `${inventoryStatus.pendingKitchenCount} nguyên liệu chờ Bếp nhận`
                  : 'Đã hoàn tất vật tư'}</dd>
          </div>
        </dl>

        {presentation.missingBomRows.length > 0 && (
          <InlineAlert title="Một số món từ tệp chưa có định lượng BOM" variant="warning">
            Các món này vẫn được đưa vào KHSX theo tên trong tệp Excel, nhưng chưa thể tính nguyên liệu cho đến khi được gắn với món và định lượng trong danh mục.
          </InlineAlert>
        )}
        {presentation.importDefaultRows.length > 0 && (
          <InlineAlert title="Đang dùng số suất tạm từ tệp" variant="warning">
            Tạm thời hệ thống dùng số suất trong tệp nhập để lập KHSX, tính nhu cầu và đề xuất mua. Khi số suất vận hành được chốt, hệ thống sẽ tự ưu tiên dữ liệu đó.
          </InlineAlert>
        )}
        {servingFeedback && <InlineAlert title={servingFeedback.title} variant={servingFeedback.variant}>{servingFeedback.message}</InlineAlert>}
        {state.feedback && <InlineAlert title={state.feedback.title} variant={state.feedback.variant}>{state.feedback.message}</InlineAlert>}
        {presentation.activeStaleness?.isStale && presentation.activeStaleness.canRegenerate !== false && (
          <InlineAlert title="Nhu cầu nguyên liệu đã lỗi thời, cần tính lại" variant="warning">{presentation.activeStaleness.reasons.join(' | ')}</InlineAlert>
        )}
        {presentation.activeStaleness?.canRegenerate === false && (
          <InlineAlert title="Nhu cầu đã khóa, chỉ có thể xem" variant="info">
            {presentation.activeStaleness.regenerationBlockReason ?? 'Nhu cầu đã có chứng từ nghiệp vụ phía sau. Hãy dùng luồng điều chỉnh riêng thay vì tính đè.'}
          </InlineAlert>
        )}
        {status.stalenessState === 'loading' && (
          <InlineAlert title="Đang kiểm tra độ mới nhu cầu" variant="info">Đã kiểm tra {status.stalenessCompletedDateCount}/{status.stalenessExpectedDateCount} ngày trong tuần.</InlineAlert>
        )}
        {status.stalenessState === 'error' && (
          <InlineAlert title="Không kiểm tra đủ độ mới nhu cầu" variant="warning">
            Chỉ kiểm tra được {status.stalenessCompletedDateCount}/{status.stalenessExpectedDateCount} ngày. Tạm dừng tạo nhu cầu để tránh ghi đè dữ liệu chưa xác minh.
          </InlineAlert>
        )}

        {presentation.demandApprovalStatus.status === 'rejected' && (
          <InlineAlert title="Nhu cầu nguyên liệu đã bị từ chối" variant="danger">
            {presentation.demandApprovalStatus.reason
              ? `Lý do của quản lý: ${presentation.demandApprovalStatus.reason} Hãy cập nhật dữ liệu nguồn rồi tính lại nhu cầu.`
              : status.isApprovalHistoryError
                ? 'Không tải được lịch sử phê duyệt nên chưa hiển thị được lý do từ chối. Hãy tải lại trước khi tính lại nhu cầu.'
                : 'Hãy xem lịch sử phê duyệt, cập nhật dữ liệu nguồn rồi tính lại nhu cầu.'}
          </InlineAlert>
        )}

        <details className="ipc-demand-khsx-disclosure" open={!isKhsxComplete}>
          <summary>
            <span>
              <ClipboardList size={18} aria-hidden="true" />
              <span><strong>KHSX nguồn trong ngày</strong><small>{activeRows.length} dòng · {completedShiftCount}/{activeShiftGroups.length} ca hoàn tất</small></span>
            </span>
            <span className="ipc-demand-disclosure-state">{isKhsxComplete ? 'Đã hoàn tất' : 'Cần xử lý'}<ChevronDown size={16} aria-hidden="true" /></span>
          </summary>
          <TableViewport caption={`Kế hoạch sản xuất ngày ${activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}`} size="weekly" ariaLabel="Bảng KHSX sinh từ kế hoạch tuần">
          <table className="ipc-data-table ipc-material-demand-table table-fixed w-full">
            <thead><tr>
              <th style={{ width: '16%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Nhóm</th>
              <th style={{ width: '16%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
              <th style={{ width: '36%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món theo kế hoạch tuần</th>
              <th style={{ width: '18%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
              <th style={{ width: '14%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>BOM</th>
            </tr></thead>
            <tbody>
              {activeShiftGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="ipc-demand-shift-row">
                    <td colSpan={5}><strong>{group.label}</strong><span>{group.rows.length} dòng · {(group.quickServingRow?.isCompleted ?? group.rows.every((row) => row.portions > 0)) ? 'Đã hoàn tất số suất' : 'Chưa hoàn tất số suất'}</span></td>
                  </tr>
                  {group.rows.map((row) => {
                    const quickServingRow = scheduleWorkflow.presentation.getQuickServingRow(presentation.activeQuickServingRows, row)
                    return (
                      <tr key={row.key} className="table-row">
                    <td className={tableCellClass}>{row.menuTypeLabel}</td>
                    <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                    <td className={`${tableCellClass} text-left font-semibold text-slate-900`}>{row.dishName}</td>
                    <td className={tableCellClass} title={quickServingRow?.statusLabel ?? row.servingsStatusLabel}>
                      {quickServingRow?.isCompleted ? <span className="font-semibold text-slate-800">{formatNumber(row.portions)}</span> : quickServingRow ? <QuickServingCell row={quickServingRow} workflow={scheduleWorkflow} /> : row.servingsStatus === 'missing' ? (
                        <span className="inline-flex flex-col items-center gap-0.5"><span className="font-semibold text-amber-700">Chưa chốt</span></span>
                      ) : (
                        <span className="inline-flex flex-col items-center gap-0.5"><span>{formatNumber(row.portions)}</span>{row.servingsStatus === 'import-default' && <span className="text-xs font-normal text-amber-700">Tạm từ tệp</span>}</span>
                      )}
                    </td>
                    <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>{row.hasCatalogBom ? 'Đã có' : 'Chưa gắn'}</td>
                  </tr>
                    )
                  })}
                </Fragment>
              ))}
              {activeRows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={5}>Chưa có kế hoạch ngày để sinh KHSX.</td></tr>}
            </tbody>
          </table>
          </TableViewport>
          <div className="flex min-h-[38px] flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {activeQuickServingRows.map((row) => {
              const disabled = servingBusy || row.isCompleted || Number(row.inputValue) <= 0
              return (
                <ActionGuard key={`complete-${row.key}`} allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['coordination.order.lock']}>
                  <Button type="button" variant={row.isCompleted ? 'outline' : 'default'} size="sm" className="min-w-[132px]" disabled={disabled} onClick={() => void scheduleWorkflow.actions.completeQuickServing(row)}>
                    {row.isCompleted ? `Đã hoàn tất ${row.shiftLabel}` : `Hoàn tất ${row.shiftLabel}`}
                  </Button>
                </ActionGuard>
              )
            })}
          </div>
        </div>
        </details>

        {demandView.phase === 'ready' && demandView.isRefreshing && (
          <InlineAlert title="Đang cập nhật nhu cầu nguyên liệu" variant="info">
            Dữ liệu hiện tại vẫn được giữ trong khi hệ thống tải bản mới.
          </InlineAlert>
        )}
        {demandView.phase === 'ready' && demandView.truncation && (
          <InlineAlert title="Dữ liệu nhu cầu chưa đầy đủ" variant="warning">
            Đang hiển thị {formatNumber(demandView.truncation.shown)}
            {demandView.truncation.total !== undefined ? `/${formatNumber(demandView.truncation.total)}` : ''} dòng. Hãy thu hẹp bộ lọc trước khi ra quyết định.
          </InlineAlert>
        )}
        {demandView.phase === 'uninitialized' ? (
          <InlineAlert title="Chưa có phạm vi nhu cầu" variant="info">
            {demandView.instruction}
          </InlineAlert>
        ) : demandView.phase === 'loading' ? (
          <div className="ipc-demand-summary is-empty" role="status">Đang tải nhu cầu nguyên liệu...</div>
        ) : demandView.phase === 'forbidden' ? (
          <InlineAlert title="Không có quyền xem nhu cầu nguyên liệu" variant="danger">
            {demandView.message}
          </InlineAlert>
        ) : demandView.phase === 'error' ? (
          <EmptyState
            variant="error"
            title="Không tải được nhu cầu nguyên liệu"
            description="Máy chủ chưa trả được dòng nhu cầu cho ngày đang xem, nên không thể kết luận là tuần này không cần mua gì. Hãy tải lại rồi mới lập đề xuất mua hoặc phiếu xuất."
            onRetry={demandView.retry}
            isRetrying={demandView.isRetrying}
          />
        ) : presentation.demandLines.length > 0 || presentation.aggregateLines.length > 0 ? (
          <section className="ipc-demand-inventory-section">
            <div className="flex min-h-[34px] items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-800">Nguyên liệu trong ngày {activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}</span>
                <span className="text-xs font-medium text-slate-500">Phạm vi ngày đang xem: hoàn tất {inventoryStatus.enoughCount}/{inventoryStatus.totalCount}; chưa xuất {inventoryStatus.shortageCount}; chờ Bếp nhận {inventoryStatus.pendingKitchenCount}; cần tính lại {inventoryStatus.staleCount}</span>
              </div>
              <StatusBadge variant={inventoryStatus.tone} className="shrink-0 whitespace-nowrap">{inventoryStatus.label}</StatusBadge>
            </div>
            {status.isFetchingAggregate && !presentation.aggregatePage ? <div className="ipc-demand-summary is-empty">Đang tải nguyên liệu ngày đang xem...</div> : (
              <>
                {inventoryGroups.exceptionLines.length > 0 ? (
                  <div className="ipc-demand-exception-block">
                    <div><TriangleAlert size={17} aria-hidden="true" /><strong>{inventoryGroups.exceptionLines.length} nguyên liệu cần xử lý trước</strong><span>Thiếu hàng hoặc dữ liệu cần tính lại</span></div>
                    <DemandSummary lines={inventoryGroups.exceptionLines} sourceLabel="Món ăn" renderAction={renderPurchaseAction} />
                  </div>
                ) : <InlineAlert title="Không có thiếu hụt trong ngày" variant="info">Tất cả nguyên liệu ngày đang xem đã đủ theo dữ liệu tồn khả dụng.</InlineAlert>}
                {inventoryGroups.sufficientLines.length > 0 && (
                  <details className="ipc-demand-sufficient-disclosure">
                    <summary><span>{inventoryGroups.sufficientLines.length} nguyên liệu đã đủ</span><span>Xem chi tiết <ChevronDown size={16} aria-hidden="true" /></span></summary>
                    <DemandSummary lines={inventoryGroups.sufficientLines} sourceLabel="Món ăn" />
                  </details>
                )}
              </>
            )}
            {presentation.aggregatePage && <PaginationBar page={presentation.aggregatePage.pageNumber} pageSize={presentation.aggregatePage.pageSize} totalItems={presentation.aggregatePage.totalCount} onPageChange={actions.setAggregatePage} />}
          </section>
        ) : (
          <InlineAlert title="Chưa tính nhu cầu nguyên liệu" variant={presentation.weeklyPlanRows.length > 0 ? 'warning' : 'info'}>
            {presentation.weeklyPlanRows.length > 0 ? 'Bảng KHSX phía trên đã có dữ liệu từ thực đơn. Bấm Tạo nhu cầu từ KHSX để tính các dòng nguyên liệu; kế hoạch thu mua sẽ dựa trên nhu cầu, tồn kho và phiếu nhập đang chờ.' : 'Chưa có dòng KHSX từ thực đơn đang chọn.'}
          </InlineAlert>
        )}
        <section className="ipc-demand-document-lineage" aria-label="Dòng chứng từ ngày đang xem">
          <DocumentRail documents={presentation.documents} title={`Dòng chứng từ ngày ${activeDay ? activeDay.date : 'đang xem'}`} />
          {presentation.weeklyDocuments.length > presentation.documents.length && (
            <details className="ipc-demand-weekly-documents">
              <summary><span>Xem tất cả chứng từ trong tuần</span><span>{presentation.weeklyDocuments.length} chứng từ <ChevronDown size={16} aria-hidden="true" /></span></summary>
              <DocumentRail documents={presentation.weeklyDocuments} title={null} />
            </details>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={isRegenerateConfirmOpen}
        ariaLabel="Xác nhận tính lại nhu cầu"
        title="Tính lại nhu cầu đã duyệt?"
        description="Nhu cầu ngày đang xem đã được duyệt. Tính lại sẽ cập nhật dữ liệu nguồn cho quy trình thu mua. Bạn có muốn tiếp tục?"
        confirmLabel="Tiếp tục tính lại"
        busy={regenerateConfirmationBusy}
        busyLabel="Đang tính nhu cầu..."
        onConfirm={handleConfirmRegenerate}
        onOpenChange={(open) => {
          if (!regenerateConfirmationBusy) setIsRegenerateConfirmOpen(open)
        }}
      />
    </SectionPanel>
  )
}
