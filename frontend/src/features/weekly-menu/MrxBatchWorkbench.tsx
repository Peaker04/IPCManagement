import { useEffect, useId, useRef, useState } from 'react';
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
import { useMrxSourceEdit } from './hooks/useMrxSourceEdit';
import { useAuth } from '../../store/useAuth';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';
import { DishBomBatchImportModal } from '../../components/workbench/DishBomBatchImportModal';
import { MrxBatchHeaderBranch } from './branches/MrxBatchHeaderBranch';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxBatchWorkspace } from './hooks/useMrxBatchWorkspace';
import { useOptionalDirtyNavigation } from '../../components/workbench/dirty-navigation-context';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceMode, setSourceMode] = useState<'completion' | 'dish-edit'>('completion');
  const [isBatchBomModalOpen, setIsBatchBomModalOpen] = useState(false);
  const [sourceChangeReason, setSourceChangeReason] = useState('');
  const [isSourceReviewOpen, setIsSourceReviewOpen] = useState(false);
  const sourceGridRef = useRef<HTMLDivElement>(null);
  const servingErrorId = useId();
  const [showServingErrors, setShowServingErrors] = useState(false);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const inboxTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreReviewFocusRef = useRef(false);
  const { hasRole, canNavigate, operationalMode } = useAuth();

  const {
    canOpenWarehouse,
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
    handleImportSuccess,
    decideSourceChange,
    invalidateQuantityPreview,
    loadSource,
    primaryAction,
  } = useMrxBatchWorkspace();
  const sourceEdit = useMrxSourceEdit({ customerId, weekStartDate, enabled: Boolean(source) });
  const dirtyNavigation = useOptionalDirtyNavigation();
  const registerDirty = dirtyNavigation?.registerDirty;
  const sourceDirty = sourceEdit.changedLines.length > 0 || Boolean(sourceChangeReason.trim());
  const busy = isSubmitting || sourceEdit.isSubmitting || sourceEdit.reloadRequired;
  useEffect(() => {
    if (!registerDirty || (!sourceDirty && !busy)) return;
    return registerDirty(`mrx-source:${customerId}:${weekStartDate}`, { blockNavigation: busy });
  }, [registerDirty, sourceDirty, busy, customerId, weekStartDate]);
  const guardScopeChange = (action: () => void) => {
    const discardAndNavigate = () => {
      sourceEdit.reset();
      setSourceChangeReason('');
      setIsSourceReviewOpen(false);
      setSourceMode('completion');
      action();
    };
    if (dirtyNavigation) {
      if (dirtyNavigation.requestNavigation(discardAndNavigate)) discardAndNavigate();
    } else if (!sourceDirty && !busy) discardAndNavigate();
  };
  const actorRole = hasRole(['Admin', 'ADMIN']) ? 'ADMIN'
    : hasRole(['Manager', 'MANAGER', 'Quản lý']) ? 'MANAGER'
      : hasRole(['Coordinator', 'COORDINATOR', 'Điều phối']) ? 'COORDINATOR'
        : 'WAREHOUSE';
  const isCompleted = batch?.status === 'COMPLETED' || sourceEdit.editScope?.batchStatus === 'COMPLETED';
  const canImportMenus = operationalMode === 'MATERIAL_RECONCILIATION'
    && actorRole !== 'WAREHOUSE' && canNavigate('/weekly-menu', '?view=mrx-batch');
  const canEditSource = canImportMenus && !isCompleted;
  const isNewImport = searchParams.get('action') === 'import';
  const importDisabledReason = customers.length === 0
    ? 'Cần tải được danh sách khách hàng trước khi nhập thực đơn.'
    : sourceDirty || isSourceReviewOpen
      ? 'Hãy lưu hoặc hủy thay đổi nguồn đang chỉnh sửa trước khi nhập thực đơn mới.'
      : undefined;
  const canOpenImport = canImportMenus && !busy && !importDisabledReason
    && !reviewRequest && !isDishesModalOpen && !isBatchBomModalOpen;
  const openNewImport = () => {
    if (!canOpenImport) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('action', 'import');
      return next;
    }, { replace: true });
  };
  const closeImport = () => {
    setIsImportModalOpen(false);
    if (isNewImport) setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('action');
      return next;
    }, { replace: true });
  };
  const missingServingsCount = sourceEdit.missingServingsCount;
  const initialEntry = Boolean(sourceEdit.editScope?.days.some(day => !day.isLocked))
    && sourceEdit.editScope!.days.filter(day => !day.isLocked).every(day => day.shifts.every(shift => shift.savoryServings == null && shift.vegetarianServings == null));
  const reviewSource = async () => {
    setShowServingErrors(true);
    const missing = sourceEdit.firstMissingServing;
    if (missing) {
      const inputs = sourceGridRef.current?.querySelectorAll<HTMLInputElement>('input[data-serving-date]');
      Array.from(inputs ?? []).find(input => input.dataset.servingDate === missing.serviceDate
        && input.dataset.servingShift === missing.shiftName && input.dataset.servingVariant === missing.variant)?.focus();
      return;
    }
    if (await sourceEdit.preview()) setIsSourceReviewOpen(true);
  };
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

  useEffect(() => { if (!reviewRequest) inboxTriggerRef.current?.focus(); }, [reviewRequest]);

  const closeSourceReview = () => {
    restoreReviewFocusRef.current = true;
    setIsSourceReviewOpen(false);
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      {!reviewRequest && <>
      <MrxBatchHeaderBranch
        customers={customers}
        customerId={customerId}
        onSelectCustomer={(nextId) => {
          if (nextId === customerId) return;
          guardScopeChange(() => {
            setActionError(null);
            const matched = customers.find((c) => c.customerId === nextId);
            setCustomerId(nextId);
            workspaceSessionStore.setScope({ customerId: nextId, customerCode: matched?.customerCode || '', customerName: matched?.customerName || '' });
            setSearchParams(curr => { const next = new URLSearchParams(curr); next.set('customerId', nextId); next.delete('batchId'); return next; }, { replace: true });
          });
        }}
        weekStartDate={weekStartDate}
        onSelectWeekStartDate={(date) => {
          const monday = weekStartFor(date);
          if (monday === weekStartDate) return;
          guardScopeChange(() => {
            setActionError(null);
            setWeekStartDate(monday);
            workspaceSessionStore.setScope({ weekStartDate: monday, serviceDate: monday });
            setSearchParams(curr => { const next = new URLSearchParams(curr); next.set('weekStartDate', monday); next.delete('batchId'); return next; }, { replace: true });
          });
        }}
        batch={batch}
        source={source}
        statusLabels={STATUS_LABELS}
        isSubmitting={busy || Boolean(reviewRequest)}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onOpenImport={canImportMenus ? () => {
          if (!source || isCompleted) openNewImport();
          else if (canOpenImport) setIsImportModalOpen(true);
        } : undefined}
        importDisabledReason={importDisabledReason}
        primaryAction={canImportMenus || source || batch || isSourceReviewOpen || sourceEdit.changedLines.length > 0 || hasMissingSplit ? null : primaryAction}
      />

      <TelemetrySubbar
        responsive
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
                <span className="text-slate-500 hidden xl:inline">· Sẵn sàng chuyển sang Kho</span>
              )}
            </div>
          ) : null
        }
        rightActions={
          <div className="flex items-center gap-1.5">
            {sourceDirty && <Button variant="outline" size="xs" disabled={busy} onClick={() => guardScopeChange(() => sourceGridRef.current?.focus())}>Bỏ sửa nguồn</Button>}
            {batch && !isSourceReviewOpen && (
              <Button
                variant="outline"
                size="xs"
                disabled={isSubmitting}
                onClick={() => setIsDishesModalOpen(true)}
                aria-label="Món & BOM đã đóng băng"
                className="h-7 text-xs font-medium"
              >
                Món & BOM đã đóng băng
              </Button>
            )}
            {source && canEditSource && !isSourceReviewOpen && (
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
                ref={inboxTriggerRef}
                variant="outline"
                size="xs"
                disabled={busy || sourceDirty || Boolean(reviewRequest)}
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
      </>}

      {changeMessage && !reviewRequest && (
        <InlineBanner
          variant="success"
          title={changeMessage}
          actionLabel={canOpenWarehouse && batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS') ? 'Mở trạm Kho xuất ngày' : undefined}
          onAction={canOpenWarehouse && batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS')
            ? () => navigate(`/warehouse?view=mrx-daily&batchId=${batch.batchId}&date=${weekStartDate}`)
            : undefined}
          onClose={() => setChangeMessage('')}
          className="shrink-0 rounded-none border-x-0 py-1.5"
        />
      )}

      {batch && !canOpenWarehouse && !reviewRequest && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS') && (
        <InlineBanner variant="info" title={batch.status === 'TRANSFERRED' ? 'Đã bàn giao · Chờ Kho xuất nguyên liệu.' : 'Kho đang xử lý xuất nguyên liệu cho lô.'} />
      )}

      {actionError && !reviewRequest && (
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
        {sourceEdit.reloadRequired && <InlineBanner variant="warning" title="Thay đổi đã được tiếp nhận. Tải lại nguồn trước khi thao tác tiếp; không gửi lại."
          actionLabel="Tải lại nguồn đã lưu" isActionLoading={sourceEdit.isLoading || sourceEdit.isSubmitting}
          onAction={async () => {
            if (!await sourceEdit.reload()) return;
            setSourceChangeReason(''); setIsSourceReviewOpen(false); setSourceMode('completion');
            invalidateQuantityPreview(); await loadSource(true);
            setChangeMessage('Đã tải lại nguồn sau thay đổi được tiếp nhận.');
          }} />}
        {reviewRequest ? (
          <MrxPendingRequestsPanel
            requests={changeInbox}
            initialRequest={reviewRequest}
            isSubmitting={isSubmitting}
            error={actionError}
            onRequestChange={() => setActionError(null)}
            onClose={() => setReviewRequest(null)}
            onDecide={decideSourceChange}
          />
        ) : <StateBoundary
          {...stateProps}
          onRetry={() => loadSource(true)}
          loadingVariant="matrix"
          loadingGeometry={{ kind: 'matrix', columns: 8, rows: 10, columnWidths: ['160px', '14%', '14%', '14%', '14%', '14%', '14%', '14%'] }}
          isEmpty={stateProps.isEmpty || Boolean(batch && !source)}
          emptyTitle={batch && !source ? 'Không có nguồn thực đơn để hiển thị' : stateProps.emptyTitle}
          emptyDescription={batch && !source ? 'Lô đối soát vẫn được giữ nguyên. Chỉ có thể tra cứu dữ liệu đã đóng băng; không thể dựng lại nguồn từ BOM hiện tại.' : stateProps.emptyDescription}
          actionLabel={batch && !source ? 'Món & BOM đã đóng băng' : undefined}
          onAction={batch && !source ? () => setIsDishesModalOpen(true) : undefined}
        >
          {source && (sourceEdit.editScope ? (
            isSourceReviewOpen ? (
              <MrxSourceChangePanel
                initialEntry={initialEntry}
                previewResult={sourceEdit.previewResult}
                actorRole={actorRole}
                changedLinesCount={sourceEdit.changedLines.length}
                reason={sourceChangeReason}
                onReasonChange={setSourceChangeReason}
                onBack={closeSourceReview}
                onPreview={() => void sourceEdit.preview()}
                onApply={async () => {
                  if (!await sourceEdit.apply(sourceChangeReason)) return false;
                  invalidateQuantityPreview();
                  await loadSource(true);
                  setSourceMode('completion');
                  setIsSourceReviewOpen(false);
                  setSourceChangeReason('');
                  setChangeMessage('Đã áp dụng thay đổi nguồn.');
                  return true;
                }}
                onSubmit={async () => {
                  if (!await sourceEdit.submit(sourceChangeReason)) return;
                  invalidateQuantityPreview();
                  setSourceMode('completion');
                  setIsSourceReviewOpen(false);
                  setSourceChangeReason('');
                  setChangeMessage('Đã gửi yêu cầu thay đổi để duyệt.');
                }}
                isSubmitting={busy}
                reloadRequired={sourceEdit.reloadRequired}
                error={sourceEdit.error}
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

                {showServingErrors && hasMissingSplit && <p id={servingErrorId} role="alert" className="px-3 py-2 text-xs text-slate-700">Cần nhập đủ suất Mặn và Chay. Còn thiếu {missingServingsCount} ô số suất.</p>}
                {sourceEdit.error && <InlineBanner variant="error">{sourceEdit.error.message}</InlineBanner>}
                <div ref={sourceGridRef} tabIndex={-1} className="min-h-0 flex-1">
                  <MrxSourceEditGrid disabled={busy} servingErrorId={showServingErrors && hasMissingSplit ? servingErrorId : undefined} mode={sourceMode} readOnly={!canEditSource} editScope={sourceEdit.editScope} draft={sourceEdit.draft} dishOptions={sourceEdit.dishOptions} onServingsChange={changeServings} onDishChange={changeDish} lockedHighlight={sourceEdit.lockedHighlight} />
                </div>

                {!isCompleted && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2">
                  <span className="text-xs text-slate-600">
                    {sourceEdit.changedLines.length > 0
                      ? `${sourceEdit.changedLines.length} thay đổi chưa xem ảnh hưởng`
                      : hasMissingSplit ? `Thiếu ${missingServingsCount} ô số suất`
                        : batch?.status === 'TRANSFERRED' || batch?.status === 'IN_PROGRESS' ? 'Đã bàn giao Kho; ngày đã xuất được khóa sửa'
                            : 'Nguồn tuần đã sẵn sàng kiểm tra định lượng'}
                  </span>
                  {canEditSource && (sourceEdit.changedLines.length > 0 ? (
                    <Button ref={reviewTriggerRef} variant="default" size="sm" disabled={busy} onClick={() => void reviewSource()}>
                      {sourceEdit.isSubmitting ? 'Đang kiểm tra…' : initialEntry ? 'Kiểm tra số suất' : 'Tiếp tục xem ảnh hưởng'} ({sourceEdit.changedLines.length})
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
                        disabled={busy || (footerNeedsServings && (isSplitScopeUnavailable || hasMissingSplit))}
                        onClick={primaryAction.action}
                      >
                        {footerNeedsServings && isSplitScopeUnavailable
                          ? 'Đang kiểm tra dữ liệu…'
                          : footerNeedsServings && hasMissingSplit ? 'Cần nhập đủ suất Mặn và Chay' : footerPrimaryLabel}
                      </Button>
                    </ActionGuard>
                  ) : null)}
                </div>}
              </div>
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p role={sourceEdit.error ? 'alert' : 'status'} className="text-sm text-slate-700">{sourceEdit.error?.message || 'Đang tải phạm vi nguồn tuần MRX…'}</p>
              {sourceEdit.error && <Button variant="outline" size="sm" onClick={() => void sourceEdit.reload()}>Thử lại</Button>}
            </div>
          ))}
        </StateBoundary>}
      </WorkspaceFrame.Body>

      {canOpenImport && (isImportModalOpen || isNewImport) && <WeeklyMenuImportModal
        isOpen
        onClose={closeImport}
        customers={customers}
        initialCustomerId={customers.some((item) => item.customerId === customerId) ? customerId : undefined}
        initialWeekStartDate={isNewImport ? '' : weekStartDate}
        initialScopeIntent={isNewImport ? 'new-week' : 'current-week'}
        currentWeekStartDate={isCompleted ? undefined : weekStartDate}
        mrxActorRole={actorRole}
        onImportSuccess={handleImportSuccess}
      />}

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
