import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { ReconciliationLifecycleStrip } from '../../components/workbench/ReconciliationLifecycleStrip';
import { ActionGuard } from '../../components/ui/action-guard';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { InlineBanner } from '../../components/ui/inline-banner';
import { weekStartFor } from '../../utils/dates';
import { WeeklyMenuImportModal } from './WeeklyMenuImportModal';
import { MrxPendingRequestsPanel } from './MrxPendingRequestsPanel';
import { MrxSourceEditGrid } from './MrxSourceEditGrid';
import { MrxSourceChangePanel } from './MrxSourceChangePanel';
import { SplitView } from '../../components/workbench/SplitView';
import { useMrxSourceEdit } from './hooks/useMrxSourceEdit';
import { useAuth } from '../../store/useAuth';
import { MrxBatchPreviewSection } from './MrxBatchPreviewSection';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';
import { DishBomBatchImportModal } from '../../components/workbench/DishBomBatchImportModal';
import { MrxBatchHeaderBranch } from './branches/MrxBatchHeaderBranch';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxBatchWorkspace } from './hooks/useMrxBatchWorkspace';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';

const STATUS_LABELS: Record<string, string> = {
  ...MRX_STATUS_LABELS,
  DRAFT: 'Đang chuẩn bị',
  READY: 'Đã đóng băng',
  TRANSFERRED: 'Đã chuyển Kho',
  IN_PROGRESS: 'Đang xuất ca',
  COMPLETED: 'Hoàn tất',
};

export function MrxBatchWorkbench() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [sourceMode, setSourceMode] = useState<'completion' | 'dish-edit'>('completion');
  const [isBatchBomModalOpen, setIsBatchBomModalOpen] = useState(false);
  const [sourceChangeReason, setSourceChangeReason] = useState('');
  const [isSourceReviewOpen, setIsSourceReviewOpen] = useState(false);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreReviewFocusRef = useRef(false);
  const { hasRole } = useAuth();

  const {
    canReviewSourceChanges,
    customers,
    customerId,
    setCustomerId,
    weekStartDate,
    setWeekStartDate,
    source,
    batch,
    preview,
    stateProps,
    isSubmitting,
    actionError,
    setActionError,
    changeMessage,
    setChangeMessage,
    changeInbox,
    reviewRequest,
    setReviewRequest,
    isImportModalOpen,
    setIsImportModalOpen,
    isDishesModalOpen,
    setIsDishesModalOpen,
    isRefreshing,
    handleRefresh,
    decideSourceChange,
    invalidateQuantityPreview,
    loadSource,
    primaryAction,
  } = useMrxBatchWorkspace();
  const sourceEdit = useMrxSourceEdit({ customerId, weekStartDate, enabled: Boolean(source) });
  const actorRole = hasRole(['Admin', 'ADMIN']) ? 'ADMIN'
    : hasRole(['Manager', 'MANAGER', 'Quản lý']) ? 'MANAGER'
      : hasRole(['Coordinator', 'COORDINATOR', 'Điều phối']) ? 'COORDINATOR'
        : 'WAREHOUSE';
  const canEditSource = actorRole === 'ADMIN' || actorRole === 'MANAGER' || actorRole === 'COORDINATOR';
  const missingServingsCount = sourceEdit.editScope?.days.reduce((count, day) => count + day.shifts.reduce((shiftCount, shift) => {
    const next = sourceEdit.draft[day.serviceDate]?.[shift.shiftName];
    return shiftCount
      + Number((next ? next.savoryServings : shift.savoryServings) == null)
      + Number((next ? next.vegetarianServings : shift.vegetarianServings) == null);
  }, 0), 0) ?? 0;
  const hasMissingSplit = missingServingsCount > 0;
  const isSplitScopeUnavailable = Boolean(source && (sourceEdit.isLoading || !sourceEdit.editScope));
  const footerNeedsServings = primaryAction?.label === 'Kiểm tra định lượng';
  const footerPrimaryLabel = footerNeedsServings ? 'Lưu & kiểm tra định lượng' : primaryAction?.label;
  const changeServings = (date: string, shift: string, variant: 'savory' | 'vegetarian', value: number | null) => {
    if (!canEditSource) return;
    invalidateQuantityPreview();
    sourceEdit.setServings(date, shift, variant, value);
  };
  const changeDish = (date: string, shift: string, dishSlot: string, dishId: string) => {
    if (!canEditSource) return;
    invalidateQuantityPreview();
    sourceEdit.setDish(date, shift, dishSlot, dishId);
  };

  useEffect(() => {
    if (!isSourceReviewOpen && restoreReviewFocusRef.current) {
      reviewTriggerRef.current?.focus();
      restoreReviewFocusRef.current = false;
    }
  }, [isSourceReviewOpen]);

  const closeSourceReview = () => {
    restoreReviewFocusRef.current = true;
    setIsSourceReviewOpen(false);
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxBatchHeaderBranch
        customers={customers}
        customerId={customerId}
        onSelectCustomer={(nextId) => {
          if (nextId === customerId) return;
          setActionError(null);
          const matched = customers.find((c) => c.customerId === nextId);
          setCustomerId(nextId);
          workspaceSessionStore.setScope({
            customerId: nextId,
            customerCode: matched?.customerCode || '',
            customerName: matched?.customerName || '',
          });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('customerId', nextId);
            return next;
          }, { replace: true });
        }}
        weekStartDate={weekStartDate}
        onSelectWeekStartDate={(date) => {
          const monday = weekStartFor(date);
          if (monday === weekStartDate) return;
          setActionError(null);
          setWeekStartDate(monday);
          workspaceSessionStore.setScope({ weekStartDate: monday, serviceDate: monday });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('weekStartDate', monday);
            return next;
          }, { replace: true });
        }}
        batch={batch}
        source={source}
        statusLabels={STATUS_LABELS}
        isSubmitting={isSubmitting}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        primaryAction={source || isSourceReviewOpen || sourceEdit.changedLines.length > 0 || hasMissingSplit ? null : primaryAction}
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Vòng đời lô:</span>
            {batch ? (
              <ReconciliationLifecycleStrip status={batch.status} />
            ) : (
              <span className="text-xs font-medium text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Chưa khởi tạo lô đối soát
              </span>
            )}
          </div>
        }
        telemetryPills={
          source ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Phiên bản nguồn:</span>
              <strong className="font-mono text-slate-900">v{source.menuVersionNo ?? '—'}</strong>
              <span className="text-slate-300">·</span>
              <Badge
                variant={
                  source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE'
                    ? 'success'
                    : 'warning'
                }
                size="sm"
              >
                {source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE'
                  ? 'Đã xuất bản'
                  : 'Bản nháp'}
              </Badge>
              {missingServingsCount > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <Badge variant="warning" size="sm">Thiếu {missingServingsCount} ô số suất</Badge>
                </>
              )}
              {batch?.status === 'DRAFT' && (
                <span className="text-slate-500 hidden xl:inline">· Kiểm tra phân rã định lượng rồi bấm "Đóng băng lô"</span>
              )}
              {batch?.status === 'READY' && (
                <span className="text-slate-500 hidden xl:inline">· Lô đã đóng băng, bấm "Chuyển sang Kho" để bắt đầu xuất</span>
              )}
            </div>
          ) : null
        }
        rightActions={
          <div className="flex items-center gap-1.5">
            {batch && !isSourceReviewOpen && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => setIsDishesModalOpen(true)}
                aria-label="Món ăn trong lô"
                className="h-7 text-xs font-medium"
              >
                <span className="hidden 2xl:inline">Món ăn trong lô</span>
                <span className="2xl:hidden">Món trong lô</span>
              </Button>
            )}
            {source && !isSourceReviewOpen && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => setIsImportModalOpen(true)}
                aria-label="Nhập lại Excel"
                className="h-7 text-xs font-medium"
              >
                <span className="hidden 2xl:inline">Nhập lại Excel</span>
                <span className="2xl:hidden">Nhập Excel</span>
              </Button>
            )}
            {source && !isSourceReviewOpen && (
              <ActionGuard
                capabilityId="RECON.SOURCE_CHANGE.PREVIEW"
                roles={['ADMIN', 'MANAGER', 'Quản lý', 'COORDINATOR', 'Điều phối']}
                permissions="reconciliation.source.read"
                allowedModes={['MATERIAL_RECONCILIATION']}
                mode="hide"
                reason="Chỉ khả dụng cho nguồn MRX đã phát hành."
              >
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={() => setSourceMode((current) => current === 'dish-edit' ? 'completion' : 'dish-edit')}
                  aria-label={sourceMode === 'dish-edit' ? 'Xem menu đã gộp' : 'Chỉnh sửa món'}
                  className="h-7 text-xs font-medium"
                >
                  {sourceMode === 'dish-edit' ? 'Xem menu đã gộp' : 'Chỉnh sửa món'}
                </Button>
              </ActionGuard>
            )}
            {canReviewSourceChanges && changeInbox.length > 0 && !isSourceReviewOpen && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => {
                  setIsSourceReviewOpen(false);
                  setActionError(null);
                  setReviewRequest(changeInbox[0]);
                }}
                className="h-7 text-xs font-medium"
              >
                Yêu cầu chờ duyệt ({changeInbox.length})
              </Button>
            )}
          </div>
        }
      />

      {changeMessage && (
        <InlineBanner
          variant="success"
          title={changeMessage}
          actionLabel={batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS') ? 'Mở trạm Kho xuất ngày' : undefined}
          onAction={batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS')
            ? () => navigate(`/warehouse?view=mrx-daily&batchId=${batch.batchId}&date=${weekStartDate}`)
            : undefined}
          onClose={() => setChangeMessage('')}
          className="shrink-0 rounded-none border-x-0 py-1.5"
        />
      )}

      {actionError && (
        <InlineBanner
          variant="error"
          title="Lỗi thao tác"
          onClose={() => setActionError(null)}
          className="shrink-0 rounded-none border-x-0"
        >
          {actionError.message}
        </InlineBanner>
      )}

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          onRetry={() => loadSource(true)}
          loadingVariant="matrix"
          actionLabel="Nhập thực đơn Excel ngay"
          onAction={() => setIsImportModalOpen(true)}
        >
          {source && (sourceEdit.editScope ? (
            isSourceReviewOpen ? (
              <SplitView
                hasActiveDetail
                masterWidthClass="w-full lg:w-7/12"
                master={<MrxSourceEditGrid mode={sourceMode} readOnly={!canEditSource} editScope={sourceEdit.editScope} draft={sourceEdit.draft} dishOptions={sourceEdit.dishOptions} onServingsChange={changeServings} onDishChange={changeDish} lockedHighlight={sourceEdit.lockedHighlight} />}
                detail={<MrxSourceChangePanel previewResult={sourceEdit.previewResult} actorRole={actorRole} changedLinesCount={sourceEdit.changedLines.length} reason={sourceChangeReason} onReasonChange={setSourceChangeReason} onPreview={() => void sourceEdit.preview()} onApply={async () => { if (await sourceEdit.apply(sourceChangeReason)) { invalidateQuantityPreview(); await loadSource(true); setSourceMode('completion'); setIsSourceReviewOpen(false); setChangeMessage('Đã áp dụng thay đổi nguồn.'); } }} onSubmit={async () => { if (await sourceEdit.submit(sourceChangeReason)) { invalidateQuantityPreview(); setSourceMode('completion'); setIsSourceReviewOpen(false); setChangeMessage('Đã gửi yêu cầu thay đổi để duyệt.'); } }} isSubmitting={sourceEdit.isSubmitting} error={sourceEdit.error} />}
                onBackToMaster={closeSourceReview}
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col bg-white">
                {preview?.diagnostics.length && sourceEdit.changedLines.length === 0 ? (
                  <div role="alert" className="mx-3 mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="font-semibold">Chưa thể tạo lô đối soát</strong>
                      <span className="text-xs font-medium text-amber-800">Cần bổ sung định mức nguyên liệu</span>
                    </div>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {preview.diagnostics.map((item, idx) => <li key={idx} className="text-xs">{item}</li>)}
                    </ul>
                    <div className="mt-2 flex items-center justify-end gap-2 border-t border-amber-200/80 pt-2">
                      <Button size="xs" variant="default" onClick={() => setIsBatchBomModalOpen(true)} className="text-xs font-semibold">Nhập BOM Excel cho các món thiếu</Button>
                      <Button size="xs" variant="outline" onClick={() => navigate('/admin-data?view=bom')} className="text-xs">Mở quản lý định mức BOM →</Button>
                    </div>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1">
                  <MrxSourceEditGrid mode={sourceMode} readOnly={!canEditSource} editScope={sourceEdit.editScope} draft={sourceEdit.draft} dishOptions={sourceEdit.dishOptions} onServingsChange={changeServings} onDishChange={changeDish} lockedHighlight={sourceEdit.lockedHighlight} />
                </div>

                {preview && sourceEdit.changedLines.length === 0 && (
                  <details className="shrink-0 border-t border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Tóm tắt định lượng và nguyên liệu</summary>
                    <div className="max-h-72 overflow-auto border-t border-slate-200 bg-white">
                      <MrxBatchPreviewSection preview={preview} customerCode={source.customerCode} customerName={source.customerName} />
                    </div>
                  </details>
                )}

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
                  <span className="text-xs text-slate-600">
                    {sourceEdit.changedLines.length > 0
                      ? `${sourceEdit.changedLines.length} thay đổi chưa xem ảnh hưởng`
                      : hasMissingSplit ? `Thiếu ${missingServingsCount} ô số suất` : 'Nguồn tuần đã sẵn sàng kiểm tra định lượng'}
                  </span>
                  {canEditSource && (sourceEdit.changedLines.length > 0 ? (
                    <Button ref={reviewTriggerRef} variant="default" size="sm" onClick={() => setIsSourceReviewOpen(true)}>
                      Tiếp tục xem ảnh hưởng ({sourceEdit.changedLines.length})
                    </Button>
                  ) : primaryAction && footerPrimaryLabel ? (
                    <ActionGuard
                      capabilityId={primaryAction.capability}
                      roles={['ADMIN', 'MANAGER', 'COORDINATOR', 'Điều phối']}
                      permissions="reconciliation.source.read"
                      allowedModes={['MATERIAL_RECONCILIATION']}
                      mode="disable"
                      reason="Chỉ Điều phối được thực hiện bước này trong chế độ MRX."
                    >
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isSubmitting || (footerNeedsServings && (isSplitScopeUnavailable || hasMissingSplit))}
                        onClick={primaryAction.action}
                      >
                        {footerNeedsServings && isSplitScopeUnavailable
                          ? 'Đang kiểm tra dữ liệu…'
                          : footerNeedsServings && hasMissingSplit ? 'Cần nhập đủ suất Mặn và Chay' : footerPrimaryLabel}
                      </Button>
                    </ActionGuard>
                  ) : null)}
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p role={sourceEdit.error ? 'alert' : 'status'} className="text-sm text-slate-700">{sourceEdit.error?.message || 'Đang tải phạm vi nguồn tuần MRX…'}</p>
              {sourceEdit.error && <Button variant="outline" size="sm" onClick={() => void sourceEdit.reload()}>Thử lại</Button>}
            </div>
          ))}
        </StateBoundary>
      </WorkspaceFrame.Body>

      <WeeklyMenuImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        customers={customers}
        initialCustomerId={customerId}
        initialWeekStartDate={weekStartDate}
        mrxActorRole={actorRole}
        onImportSuccess={() => {
          invalidateQuantityPreview();
          void loadSource(true);
        }}
      />

      {reviewRequest && (
        <MrxPendingRequestsPanel
          requests={changeInbox}
          initialRequest={reviewRequest}
          isSubmitting={isSubmitting}
          error={actionError}
          onRequestChange={() => setActionError(null)}
          onClose={() => setReviewRequest(null)}
          onDecide={decideSourceChange}
        />
      )}

      <MrxBatchDishesModal
        isOpen={isDishesModalOpen}
        onClose={() => setIsDishesModalOpen(false)}
        batchId={batch?.batchId || ''}
        customerName={customers.find((c) => c.customerId === customerId)?.customerName || ''}
      />

      <DishBomBatchImportModal
        isOpen={isBatchBomModalOpen}
        onClose={() => setIsBatchBomModalOpen(false)}
        initialCustomerId={customerId}
        initialTemplateType="missing"
        missingDishesDiagnostics={preview?.diagnostics}
        onImportSuccess={() => void loadSource(true)}
      />
    </WorkspaceFrame.Root>
  );
}
