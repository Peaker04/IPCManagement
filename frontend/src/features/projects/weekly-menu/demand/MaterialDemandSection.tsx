import { Fragment, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, PackageSearch, Scale, TriangleAlert, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { ConfirmDialog, DocumentRail, EmptyState, InlineAlert, PaginationBar, StatusBadge, TableViewport } from '@/components/common'
import { InfoNote } from '@/components/common/InfoNote'
import { DemandSummary } from '@/components/common/DemandSummary'
import { ActionGuard } from '@/components/common/ActionGuard'
import { Button } from '@/components/ui/button'
import { QuickServingCell } from '../schedule/QuickServingCell'
import type { WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from '../schedule/types'
import type { MaterialDemandWorkflow } from './useMaterialDemand'
import { getDemandActionPresentation } from './demandModel'
import { typography } from '@/lib/typography'
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
  const [showWeeklyDocuments, setShowWeeklyDocuments] = useState(false)
  const [isRegenerateSubmitting, setIsRegenerateSubmitting] = useState(false)
  const { state, status, actions, presentation } = workflow
  const demandView = workflow.dataState
  const { activeDay, dayPages, dayIndex, activeRows, activeQuickServingRows, inventoryStatus, inventoryGroups } = presentation
  const servingBusy = status.isSavingQuickServings || scheduleWorkflow.status.isSavingQuickServings
  const isStalenessUnavailable = status.stalenessState === 'loading' || status.stalenessState === 'error'
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
  const isDemandReady = demandView.phase === 'ready'
  const hasMaterials = isDemandReady && inventoryStatus.totalCount > 0
  const handoffText = demandView.phase === 'loading' ? 'Đang tải' : demandView.phase === 'error' || demandView.phase === 'forbidden' ? 'Chưa xác định' : !hasMaterials ? 'Chưa có nguyên liệu' : inventoryStatus.shortageCount > 0 && inventoryStatus.pendingKitchenCount > 0 ? `Kho còn xuất ${inventoryStatus.shortageCount} · Bếp còn nhận ${inventoryStatus.pendingKitchenCount}` : inventoryStatus.shortageCount > 0 ? `Kho còn xuất ${inventoryStatus.shortageCount}/${inventoryStatus.totalCount}` : inventoryStatus.pendingKitchenCount > 0 ? `Bếp còn nhận ${inventoryStatus.pendingKitchenCount}/${inventoryStatus.totalCount}` : 'Bếp đã nhận đủ'
  const sourceFirst = isDemandReady && !hasMaterials && !isKhsxComplete
  const khsxSource = (
        <details key={presentation.activeDate} className="ipc-demand-khsx-disclosure" open={!isKhsxComplete && !hasMaterials}>
          <summary>
            <span>
              <ClipboardList size={18} aria-hidden="true" />
              <span><strong>KHSX nguồn trong ngày</strong></span>
            </span>
            <span className="ipc-demand-disclosure-state">{isKhsxComplete ? 'Đã hoàn tất' : 'Cần xử lý'}<ChevronDown size={16} aria-hidden="true" /></span>
          </summary>
          {activeQuickServingRows.length > 0 && (
            <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['coordination.order.lock']}>
              <div className="ipc-demand-serving-actions">
                {activeQuickServingRows.map((row) => {
                  const disabled = servingBusy || row.isCompleted || Number(row.inputValue) <= 0
                  return <Button key={`complete-${row.key}`} type="button" variant={row.isCompleted ? 'outline' : 'default'} size="sm" className="min-w-[132px]" disabled={disabled} onClick={() => void scheduleWorkflow.actions.completeQuickServing(row)}>
                    {row.isCompleted ? `Đã hoàn tất ${row.shiftLabel}` : `Hoàn tất ${row.shiftLabel}`}
                  </Button>
                })}
              </div>
            </ActionGuard>
          )}
          <TableViewport caption={`Kế hoạch sản xuất ngày ${activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}`} ariaLabel="Kế hoạch sản xuất theo ngày từ thực đơn tuần">
          <table className="ipc-data-table ipc-erp-grid-table ipc-material-demand-table table-fixed w-full">
            <thead><tr>
              <th scope="col" style={{ width: '16%' }} className="sticky top-0 z-10 whitespace-nowrap text-center">Nhóm</th>
              <th scope="col" style={{ width: '16%' }} className="sticky top-0 z-10 whitespace-nowrap text-left">Dòng</th>
              <th scope="col" style={{ width: '36%' }} className="sticky top-0 z-10 whitespace-nowrap text-left">Món theo kế hoạch tuần</th>
              <th scope="col" style={{ width: '18%' }} className="sticky top-0 z-10 whitespace-nowrap text-center">Suất</th>
              <th scope="col" style={{ width: '14%' }} className="sticky top-0 z-10 whitespace-nowrap text-center">BOM</th>
            </tr></thead>
            <tbody>
              {activeShiftGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="ipc-demand-shift-row bg-slate-100/70 font-semibold">
                    <td colSpan={5} className="px-3 py-2 text-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span><strong>{group.label}</strong><span className="ml-2 text-xs font-normal text-slate-500">{group.rows.length} dòng · {(group.quickServingRow?.isCompleted ?? group.rows.every((row) => row.portions > 0)) ? 'Đã hoàn tất số suất' : 'Chưa hoàn tất số suất'}</span></span>
                        {group.quickServingRow && !group.quickServingRow.isCompleted && <QuickServingCell row={group.quickServingRow} workflow={scheduleWorkflow} />}
                      </div>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                      <tr key={row.key}>
                    <td className="text-center">{row.menuTypeLabel}</td>
                    <td className="text-left text-slate-600">{row.slotLabel}</td>
                    <td className="text-left font-medium text-slate-900">{row.dishName}</td>
                    <td data-cell-role="numeric" className="text-center" title={row.servingsStatusLabel}>
                      {row.servingsStatus === 'missing' ? <span className="font-semibold text-amber-700">Chưa chốt</span> : (
                        <span className="inline-flex flex-col items-center gap-0.5"><span className="tabular-nums">{formatNumber(row.portions)}</span>{row.servingsStatus === 'import-default' && <span className="text-xs font-normal text-amber-700">Tạm từ tệp</span>}</span>
                      )}
                    </td>
                    <td className={cn('text-center font-medium', row.hasCatalogBom ? 'text-slate-700' : 'text-amber-700')}>{row.hasCatalogBom ? 'Đã có' : 'Chưa có'}</td>
                  </tr>
                  ))}
                </Fragment>
              ))}
              {activeRows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={5}>Chưa có kế hoạch sản xuất trong ngày đang xem.</td></tr>}
            </tbody>
          </table>
          </TableViewport>
        </details>
  )
  return (
    <section className="ipc-demand-workspace" aria-label="Nhu cầu và tiến độ nguyên liệu">
      {demandView.phase === 'uninitialized' ? (
        <div className="py-2 text-sm text-slate-600">
          <h2 className="text-base font-semibold text-slate-800">Nhu cầu và tiến độ nguyên liệu</h2>
          Chọn khách hàng và tuần để xem KHSX và tiến độ bàn giao nguyên liệu.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
        <section className="ipc-demand-day-command" aria-label="Điều hướng và trạng thái ngày đang xem">
          <div className="ipc-demand-context-heading">
            <h2>Nhu cầu và tiến độ nguyên liệu</h2>
            <span className="text-xs font-semibold text-slate-500">Phê duyệt nhu cầu</span>
            <StatusBadge variant={presentation.demandApprovalStatus.tone}>{presentation.demandApprovalStatus.label}</StatusBadge>
            {presentation.demandApprovalStatus.documentCode && (
              <span className={cn(typography.code, 'max-w-[220px] truncate text-xs font-semibold text-slate-600')} title={presentation.demandApprovalStatus.documentCode}>{presentation.demandApprovalStatus.documentCode}</span>
            )}
          </div>
          <div className="ipc-demand-day-object">
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Ngày đang xem</span>
              <strong>{activeDay ? `${activeDay.label} ${activeDay.date}` : 'Chưa có ngày'}</strong>
              <small>{dayPages.length > 0 ? `Ngày ${dayIndex + 1}/${dayPages.length} trong tuần vận hành` : 'Chưa có KHSX theo ngày'}</small>
            </div>
          </div>
          <nav className="ipc-demand-day-buttons" aria-label="Chuyển ngày KHSX">
            <Button type="button" variant="outline" size="sm" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</Button>
            <Button type="button" variant="outline" size="sm" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</Button>
          </nav>
          <dl className="ipc-demand-day-checkpoints" aria-label="Tóm tắt vận hành ngày đang xem">
            <div><ClipboardList size={16} aria-hidden="true" /><dt>KHSX trong ngày</dt><dd>{activeRows.length} dòng</dd></div>
            <div className={completedShiftCount === activeShiftGroups.length && activeShiftGroups.length > 0 ? 'is-complete' : 'is-warning'}><CheckCircle2 size={16} aria-hidden="true" /><dt>Số suất theo ca</dt><dd>{completedShiftCount}/{activeShiftGroups.length} ca hoàn tất</dd></div>
            <div className={hasMaterials ? inventoryStatus.shortageCount > 0 || inventoryStatus.pendingKitchenCount > 0 ? 'is-warning' : 'is-complete' : undefined}><PackageSearch size={16} aria-hidden="true" /><dt>Bàn giao nguyên liệu</dt><dd>{handoffText}</dd></div>
          </dl>
          {actionPresentation.showGenerate && (
            <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
              <div className="ipc-demand-day-action"><Button variant="outline" size="sm" type="button" onClick={handleGenerate}
                disabled={status.isGenerating || servingBusy || isStalenessUnavailable || presentation.weeklyPlanRows.length === 0}>
                <Scale size={16} />{generateLabel}
              </Button></div>
            </ActionGuard>
          )}
        </section>

        {servingFeedback && <InlineAlert title={servingFeedback.title} variant={servingFeedback.variant}>{servingFeedback.message}</InlineAlert>}
        {state.feedback && <InlineAlert title={state.feedback.title} variant={state.feedback.variant}>{state.feedback.message}</InlineAlert>}
        {presentation.activeStaleness?.isStale && presentation.activeStaleness.canRegenerate !== false && (
          <InlineAlert title="Nhu cầu nguyên liệu đã lỗi thời, cần tính lại" variant="warning">{presentation.activeStaleness.reasons.join(' | ')}</InlineAlert>
        )}
        {presentation.activeStaleness?.canRegenerate === false && (
          <InlineAlert title="Nhu cầu đã khóa, chỉ có thể xem" variant="info" className="ipc-demand-lock-notice">
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

        {sourceFirst && khsxSource}

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
        {demandView.phase === 'loading' ? (
          <div className="ipc-demand-summary is-empty" role="status">Đang tải nhu cầu nguyên liệu...</div>
        ) : demandView.phase === 'forbidden' ? (
          <InlineAlert title="Không có quyền xem nhu cầu nguyên liệu" variant="danger">
            {demandView.message}
          </InlineAlert>
        ) : demandView.phase === 'error' ? (
          <EmptyState
            variant="error"
            title="Không tải được nhu cầu nguyên liệu"
            description="Vui lòng thử tải lại hoặc kiểm tra kết nối mạng."
            onRetry={demandView.retry}
            isRetrying={demandView.isRetrying}
          />
        ) : presentation.demandLines.length > 0 || presentation.aggregateLines.length > 0 || (demandView.phase === 'ready' && Boolean(presentation.aggregatePage)) ? (
          <section className="ipc-demand-inventory-section" aria-label="Phạm vi ngày đang xem: tổng hợp nguyên liệu">
          <div className="ipc-demand-inventory-heading flex min-h-[34px] items-center justify-between px-2 py-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Nguyên liệu trong ngày</span>
                <InfoNote title="Tổng hợp nguyên liệu theo ngày" content="Theo dõi nhu cầu, xuất kho và Bếp nhận theo ngày. Chưa xuất không đồng nghĩa cần mua." />
              </div>
              {inventoryStatus.totalCount > 0 && <span className="shrink-0 text-xs font-medium text-slate-600">{inventoryStatus.totalCount} nguyên liệu</span>}
            </div>
            {demandView.phase === 'ready' && inventoryStatus.totalCount === 0 && !status.isFetchingAggregate && (
              <p className="ipc-demand-empty-note">{presentation.demandApprovalStatus.status === 'not-created' ? 'Chưa tạo nhu cầu cho ngày này. Kiểm tra KHSX và số suất trước khi tính nguyên liệu.' : 'Không có dòng nguyên liệu trong phạm vi ngày đang xem.'}</p>
            )}
            {status.isFetchingAggregate && !presentation.aggregatePage ? <div className="ipc-demand-summary is-empty">Đang tải nguyên liệu ngày đang xem...</div> : (
              <>
                {inventoryGroups.exceptionLines.length > 0 && (
                  <div className="ipc-demand-exception-block">
                    <div><TriangleAlert size={17} aria-hidden="true" /><strong>{inventoryGroups.exceptionLines.length} nguyên liệu cần xử lý trước</strong></div>
                    <DemandSummary lines={inventoryGroups.exceptionLines} sourceLabel="Nguồn" showAction={false} />
                  </div>
                )}
                {inventoryGroups.sufficientLines.length > 0 && (
                  <details className="ipc-demand-sufficient-disclosure" open={inventoryGroups.exceptionLines.length === 0}>
                    <summary><span>{inventoryGroups.sufficientLines.length} nguyên liệu đã nhận</span><span>Xem chi tiết <ChevronDown size={16} aria-hidden="true" /></span></summary>
                    <DemandSummary lines={inventoryGroups.sufficientLines} sourceLabel="Nguồn" showAction={false} />
                  </details>
                )}
              </>
            )}
            {presentation.aggregatePage && <PaginationBar page={presentation.aggregatePage.pageNumber} pageSize={presentation.aggregatePage.pageSize} totalItems={presentation.aggregatePage.totalCount} onPageChange={actions.setAggregatePage} />}
          </section>
        ) : presentation.weeklyPlanRows.length > 0 && demandView.phase === 'ready' && inventoryStatus.totalCount === 0 ? null : (
          <InlineAlert title="Chưa tính nhu cầu nguyên liệu" variant="info">Chưa có dòng KHSX từ thực đơn đang chọn.</InlineAlert>
        )}
        {!sourceFirst && khsxSource}

        <section className="ipc-demand-document-lineage" aria-label="Dòng chứng từ ngày đang xem">
          <details className="ipc-demand-weekly-documents">
            <summary><span>Chứng từ {showWeeklyDocuments ? 'trong tuần' : 'ngày đang xem'}</span><span>{showWeeklyDocuments ? presentation.weeklyDocuments.length : presentation.documents.length} mục <ChevronDown size={16} aria-hidden="true" /></span></summary>
            <DocumentRail documents={showWeeklyDocuments ? presentation.weeklyDocuments : presentation.documents} title={null} />
          </details>
          {presentation.weeklyDocuments.some((document) => !presentation.documents.some((daily) => daily.id === document.id)) && (
            <button type="button" className="ipc-demand-document-scope" onClick={() => setShowWeeklyDocuments((value) => !value)}>
              {showWeeklyDocuments ? 'Chỉ xem ngày đang chọn' : 'Xem chứng từ cả tuần'}
            </button>
          )}
        </section>
      </div>
      {isRegenerateConfirmOpen && (
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
      )}
    </>
  )}
    </section>
  )
}
