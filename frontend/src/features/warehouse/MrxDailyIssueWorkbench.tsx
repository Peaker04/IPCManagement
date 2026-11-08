import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { Boxes } from 'lucide-react';
import { ApiError } from '../../api/client';
import { invalidateMrxCaches } from '../../api/mrxCacheInvalidation';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { InlineBanner } from '../../components/ui/inline-banner';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkbenchSkeleton } from '../../components/workbench/WorkbenchSkeleton';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { DocumentCodeCell } from '../../components/workbench/DocumentCodeCell';
import { useOptionalDirtyNavigation } from '../../components/workbench/dirty-navigation-context';
import { isServiceDate, weekStartFor, toVietnameseDate } from '../../utils/dates';
import { MrxSupplementalIssueModal } from './MrxSupplementalIssueModal';
import { ReconciliationIssueDetailModal } from '../../components/workbench/ReconciliationIssueDetailModal';
import { MrxDailyDateTabsBranch } from './branches/MrxDailyDateTabsBranch';
import { MrxDailyHeaderBranch } from './branches/MrxDailyHeaderBranch';
import { MrxDailyLinesBranch } from './branches/MrxDailyLinesBranch';
import { serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxDailyWorkspace } from './hooks/useMrxDailyWorkspace';
import { useAuth } from '../../store/useAuth';
import type { MrxWarehouseDaily, MrxIssuePage } from '../../api/mrxApi';

interface MrxDailyIssueWorkbenchProps {
  batchId?: string;
  serviceDate?: string;
}

export function MrxDailyIssueWorkbench({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: MrxDailyIssueWorkbenchProps) {
  const navigate = useNavigate();
  const { canNavigate } = useAuth();
  const canOpenSource = canNavigate('/weekly-menu', '?view=mrx-batch');
  const [, setSearchParams] = useSearchParams();

  const {
    batches,
    catalogError,
    catalogLoading,
    catalogPage,
    catalogPaging,
    changeCatalogPage,
    retryCatalog,
    scopeLocked,
    resetTransientScopeState,
    activeBatchId,
    setActiveBatchId,
    activeDate,
    setActiveDate,
    setDateValidationError,
    isWeeklyAll,
    daily,
    day,
    history,
    historyPage,
    setHistoryPage,
    lines,
    weeklyAggregateLines,
    hasInitialIssue,
    isLegacyMissing,
    stateProps,
    load,
    quantities,
    hasRestorableIssueDraft,
    restoreIssueDraft,
    setQuantities,
    reasons,
    setReasons,
    saving,
    mutationError,
    issueOutcomeUnknown,
    setMutationError,
    issueSucceeded,
    isSupplementalOpen,
    setIsSupplementalOpen,
    suppMaterialId,
    setSuppMaterialId,
    suppQuantity,
    setSuppQuantity,
    suppReason,
    setSuppReason,
    isSubmittingSupp,
    suppError,
    suppOutcomeUnknown,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canSubmit,
    submit,
    handleSupplementalSubmit,
  } = useMrxDailyWorkspace({ batchId: propBatchId, serviceDate: propServiceDate });

  const [activeTab, setActiveTab] = useState<'demand' | 'history'>('demand');
  const isIssueOutcomeUnknown = issueOutcomeUnknown;
  const isOutsideBatchDate = Boolean(daily?.dates.length && !isWeeklyAll && !day);
  const dirtyNavigation = useOptionalDirtyNavigation();
  const registerDirty = dirtyNavigation?.registerDirty;
  const hasUnsavedDraft = useMemo(() => (
    Object.values(quantities).some((val) => Boolean(val?.trim())) ||
    Object.values(reasons).some((val) => Boolean(val?.trim())) ||
    Boolean(isSupplementalOpen && (suppQuantity.trim() || suppReason.trim()))
  ), [quantities, reasons, isSupplementalOpen, suppQuantity, suppReason]);

  useEffect(() => {
    if (!registerDirty || (!hasUnsavedDraft && !scopeLocked)) return;
    return registerDirty(`mrx-daily:${activeBatchId}:${activeDate}`, { blockNavigation: scopeLocked });
  }, [registerDirty, hasUnsavedDraft, scopeLocked, activeBatchId, activeDate]);

  const guardScopeChange = (action: () => void) => {
    if (scopeLocked) return;
    const discardAndRun = () => {
      resetTransientScopeState();
      action();
    };
    if (dirtyNavigation) {
      if (dirtyNavigation.requestNavigation(discardAndRun)) discardAndRun();
    } else {
      discardAndRun();
    }
  };

  const historyColumns = useMemo<ColumnDef<MrxIssuePage['items'][number]>[]>(() => [
    {
      id: 'code',
      header: 'Mã phiếu xuất',
      width: '24%',
      minWidth: '220px',
      cell: (row) => <DocumentCodeCell code={row.issueCode} onOpenDetail={setInspectedIssueId} />,
    },
    {
      id: 'date',
      header: 'Ngày xuất',
      width: '18%',
      minWidth: '120px',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.issueDate)}</span>,
    },
    {
      id: 'shift',
      header: 'Ca',
      width: '16%',
      minWidth: '100px',
      cell: (row) => <span className="text-xs font-medium">{row.shiftName ? getMrxShiftLabel(row.shiftName) : '—'}</span>,
    },
    {
      id: 'items',
      header: 'Số mặt hàng',
      width: '18%',
      minWidth: '110px',
      align: 'right',
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.lines?.length ?? 0} mặt hàng</span>,
    },
    {
      id: 'actor',
      header: 'Thủ kho xuất',
      width: '24%',
      minWidth: '140px',
      cell: (row) => <span className="text-xs text-slate-700">{row.issuedByName || 'Thủ kho'}</span>,
    },
  ], [setInspectedIssueId]);

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDailyHeaderBranch
        batches={batches}
        activeBatchId={activeBatchId}
        activeBatchLabel={(() => {
          const scope = workspaceSessionStore.getScope();
          const week = daily?.batchId === activeBatchId && daily.dates[0]?.serviceDate
            ? weekStartFor(daily.dates[0].serviceDate)
            : (scope.batchId === activeBatchId ? scope.weekStartDate : '');
          const cust = scope.batchId === activeBatchId
            ? [scope.customerCode, scope.customerName].filter(Boolean).join(' - ')
            : '';
          return cust || week ? `${cust || 'Lô đã chọn'}${week ? ` (${toVietnameseDate(week)})` : ''}` : undefined;
        })()}
        batchStatus={daily?.batchId === activeBatchId ? daily.batchStatus : undefined}
        scopeLocked={scopeLocked}
        onSelectBatch={(newId) => {
          if (scopeLocked || newId === activeBatchId) return;
          guardScopeChange(() => {
            const b = batches.find((item) => item.batchId === newId);
            setActiveBatchId(newId);
            if (b) {
              workspaceSessionStore.setScope({
                batchId: newId,
                customerId: b.customerId,
                customerCode: b.customerCode || '',
                customerName: b.customerName || '',
                weekStartDate: b.weekStartDate || '',
              });
            }
            const cachedForNew = serverStateCache.get<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>(`mrx_daily_${newId}`)?.data;
            const newDate = cachedForNew?.daily?.dates[0]?.serviceDate || b?.weekStartDate || '';
            setActiveDate(newDate);
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('batchId', newId);
              if (newDate) next.set('date', newDate);
              else next.delete('date');
              return next;
            });
          });
        }}
        activeDate={activeDate}
        onSelectDate={(newDate) => {
          if (scopeLocked || newDate === activeDate) return;
          guardScopeChange(() => {
            setActiveDate(newDate);
            workspaceSessionStore.setScope({ serviceDate: newDate, weekStartDate: weekStartFor(newDate) });
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('date', newDate);
              return next;
            });
          });
        }}
        isWeeklyAll={isWeeklyAll}
        hasInitialIssue={hasInitialIssue}
        onOpenSupplemental={() => {
          if (scopeLocked) return;
          setSuppMaterialId(lines[0]?.dailyLineId || '');
          setSuppQuantity('');
          setSuppReason('');
          setSuppError(null);
          setIsSupplementalOpen(true);
        }}
        onFillAll={handleFillAll}
        onDateValidationChange={setDateValidationError}
        availableDates={daily?.batchId === activeBatchId ? daily.dates.map((date) => date.serviceDate) : undefined}
        onSubmit={submit}
        canSubmit={canSubmit}
        saving={saving}
        linesCount={lines.length}
        catalogNavigation={<PaginationBar label="Phân trang danh sách lô xuất kho" placement="selector" page={catalogPaging?.pageNumber ?? catalogPage} pageSize={50}
          totalCount={catalogPaging?.totalCount} totalPages={catalogPaging?.totalPages}
          hasPrev={catalogPaging?.hasPrev ?? false} hasNext={catalogPaging?.hasNext ?? false}
          pending={scopeLocked || catalogLoading || Boolean(catalogError)} onPageChange={changeCatalogPage} />}
      />

      {catalogError && activeBatchId && <InlineBanner variant="error" actionLabel="Tải lại danh sách lô" onAction={retryCatalog}>{catalogError.message}</InlineBanner>}

      <TelemetrySubbar
        responsive
        leftControls={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded">
              <button
                type="button"
                onClick={() => setActiveTab('demand')}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-colors', activeTab === 'demand' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900')}
              >
                Định lượng xuất ca
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={clsx('px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-colors', activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900')}
              >
                Lịch sử phiếu (<Num value={history?.totalCount} />)
              </button>
            </div>
            {activeTab === 'demand' && (
              <MrxDailyDateTabsBranch
                dates={daily?.dates}
                activeDate={activeDate}
                disabled={scopeLocked}
                onSelectDate={(newDate) => {
                  if (scopeLocked || newDate === activeDate) return;
                  guardScopeChange(() => {
                    setActiveDate(newDate);
                    workspaceSessionStore.setScope({ serviceDate: newDate, weekStartDate: newDate === 'ALL' ? undefined : weekStartFor(newDate) });
                    setSearchParams((curr) => {
                      const next = new URLSearchParams(curr);
                      next.set('date', newDate);
                      return next;
                    });
                  });
                }}
                isWeeklyAll={isWeeklyAll}
              />
            )}
          </div>
        }
        telemetryPills={
          isWeeklyAll ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Mã lô:</span>
              <strong className="font-mono text-slate-900">{daily?.batchId ? daily.batchId.slice(0, 8) : '—'}</strong>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Tổng nguyên liệu:</span>
              <strong className="font-mono text-slate-900">{weeklyAggregateLines.length}</strong>
            </div>
          ) : (
            day && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Phiên bản:</span>
                <strong className="font-mono text-slate-900">v{daily?.sourceVersion ?? '—'}</strong>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Mặt hàng ca:</span>
                <strong className="font-mono text-slate-900">{lines.length}</strong>
              </div>
            )
          )
        }
        rightActions={
          <Button
            variant="outline"
            size="xs"
            disabled={scopeLocked}
            onClick={() => guardScopeChange(() => navigate(`/warehouse?view=mrx-preparation&date=${activeDate}`))}
          >
            Chuẩn bị phối hợp
          </Button>
        }
      />

      {daily?.dates.some(date => !isServiceDate(date.serviceDate) && date.lines.length > 0) && <InlineBanner variant="info">
        Lô có dữ liệu Chủ nhật lịch sử. Tổng hợp lô giữ nguyên dữ liệu này; Chủ nhật chỉ xem, không tạo phiếu mới.
      </InlineBanner>}
      {mutationError && (
        <InlineBanner
          variant={mutationError instanceof ApiError && mutationError.status === 409 ? 'conflict' : 'error'}
          title={isIssueOutcomeUnknown ? 'Chưa xác nhận được kết quả xuất kho' : mutationError instanceof ApiError && mutationError.status === 409 ? 'Dữ liệu xuất kho đã thay đổi' : 'Không thể ghi phiếu xuất'}
          actionLabel={isIssueOutcomeUnknown ? 'Tải lại để kiểm tra kết quả' : mutationError instanceof ApiError && mutationError.status === 409 ? 'Tải lại dữ liệu mới nhất' : undefined}
          onAction={isIssueOutcomeUnknown ? () => { invalidateMrxCaches(); window.location.reload(); } : mutationError instanceof ApiError && mutationError.status === 409 ? () => {
            setMutationError(null);
            void load(true);
          } : undefined}
          onClose={isIssueOutcomeUnknown ? undefined : () => setMutationError(null)}
          className="shrink-0 rounded-none border-x-0"
        >
          {isIssueOutcomeUnknown ? 'Kết nối bị gián đoạn; phiếu có thể đã được ghi. Hãy tải lại để kiểm tra lịch sử trước khi xuất thêm.' : mutationError.message}
        </InlineBanner>
      )}

      {hasRestorableIssueDraft && (
        <InlineBanner
          variant="info"
          title="Có bản nháp xuất kho chưa hoàn tất cho lô và ngày này."
          actionLabel="Khôi phục bản nháp"
          onAction={restoreIssueDraft}
          className="shrink-0 rounded-none border-x-0"
        />
      )}

      {issueSucceeded && (
        <InlineBanner
          variant="success"
          title="Xuất kho thành công."
          className="shrink-0 rounded-none border-x-0 py-2"
        />
      )}

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          onRetry={() => { if (!activeBatchId && catalogError) retryCatalog(); else void load(true); }}
          error={stateProps.error || (!activeBatchId ? catalogError : null)}
          hasExistingData={Boolean(activeTab === 'history' ? history : daily)}
          isLoading={stateProps.isLoading || Boolean(!stateProps.error && activeBatchId && (!daily || (activeTab === 'history' && !history)))}
          onResolveConflict={() => load(true)}
          loadingVariant="table"
          customSkeleton={<div className="flex-1 min-h-0 flex flex-col bg-white">
            {activeTab === 'demand' && <div aria-hidden="true" className="px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0"><div className="h-8 w-60 rounded bg-slate-200 animate-pulse" /></div>}
            <WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 10,
              columnWidths: activeTab === 'history' ? ['24%', '18%', '16%', '18%', '24%']
                : isWeeklyAll ? ['34%', '10%', '18%', '18%', '20%'] : ['30%', '16%', '20%', '20%', '14%'],
            }} />
          </div>}
          emptyIcon={Boxes}
          className={stateProps.isEmpty || isLegacyMissing ? '[&]:justify-start' : undefined}
          isEmpty={activeTab === 'history' ? Boolean(history && history.items.length === 0) : stateProps.isEmpty || isLegacyMissing}
          emptyTitle={activeTab === 'history' ? 'Chưa có phiếu xuất kho nào cho lô này.' : isLegacyMissing ? "Lô đối soát chưa có phân rã định lượng theo ngày" : (!isWeeklyAll && lines.length === 0 ? "Không có định lượng cần xuất cho ngày đã chọn" : stateProps.emptyTitle)}
          emptyDescription={activeTab === 'history' ? 'Các phiếu xuất của lô đã chọn.' : isLegacyMissing ? "Lô thiếu dữ liệu theo ngày. Chọn lô khác để xuất kho." : isOutsideBatchDate ? 'Ngày đã chọn nằm ngoài tuần của lô. Chọn ngày trên lịch xuất ca hoặc xem tổng hợp cả tuần.' : (!isWeeklyAll && lines.length === 0 ? "Ngày này không có định mức cần xuất." : stateProps.emptyDescription)}
          isPartial={isLegacyMissing}
          partialMessage="Thiếu định lượng ca; chỉ xem được tổng hợp."
          actionLabel={isLegacyMissing ? (canOpenSource ? 'Xem màn hình Điều phối lô' : undefined) : isOutsideBatchDate ? 'Xem cả tuần của lô' : (!activeBatchId || batches.length === 0 ? 'Xem tiến độ tại Bàn điều hành' : undefined)}
          onAction={isLegacyMissing ? (canOpenSource ? () => navigate(`/weekly-menu?view=mrx-batch&batchId=${activeBatchId}`) : undefined) : isOutsideBatchDate ? () => {
            setActiveDate('ALL');
            setSearchParams(current => { const next = new URLSearchParams(current); next.set('date', 'ALL'); return next; }, { replace: true });
          } : (!activeBatchId || batches.length === 0 ? () => navigate('/') : undefined)}
        >
          {activeTab === 'demand' ? (
            <fieldset disabled={scopeLocked} className="flex-1 min-h-0 flex flex-col bg-white">
              <MrxDailyLinesBranch
                isWeeklyAll={isWeeklyAll}
                weeklyAggregateLines={weeklyAggregateLines}
                lines={lines}
                quantities={quantities}
                setQuantities={setQuantities}
                reasons={reasons}
                setReasons={setReasons}
                hasInitialIssue={hasInitialIssue}
                readOnly={!isServiceDate(activeDate)}
                lastRevisionAt={day?.lastRevisionAt}
                lastRevisionByName={day?.lastRevisionByName}
                lastRevisionByRole={day?.lastRevisionByRole}
              />
            </fieldset>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <DataGrid
                data={history?.items ?? []}
                columns={historyColumns}
                keyExtractor={(row) => row.issueId}
                emptyMessage="Chưa có phiếu xuất kho nào cho lô này."
              />
              <PaginationBar label="Phân trang phiếu xuất MRX" page={history?.pageNumber ?? historyPage} pageSize={25}
                totalCount={history?.totalCount} totalPages={history?.totalPages}
                hasPrev={history?.hasPrev ?? false} hasNext={history?.hasNext ?? false}
                pending={stateProps.isFetching || stateProps.isPreviousData || scopeLocked} onPageChange={setHistoryPage} />
            </div>
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

      <MrxSupplementalIssueModal
        isOpen={isSupplementalOpen}
        onClose={() => { if (!scopeLocked) setIsSupplementalOpen(false); }}
        activeBatchId={activeBatchId}
        activeDate={activeDate}
        lines={lines}
        suppMaterialId={suppMaterialId}
        onSuppMaterialIdChange={setSuppMaterialId}
        suppQuantity={suppQuantity}
        onSuppQuantityChange={setSuppQuantity}
        suppReason={suppReason}
        onSuppReasonChange={setSuppReason}
        suppError={suppError}
        isOutcomeUnknown={suppOutcomeUnknown}
        isSubmittingSupp={isSubmittingSupp}
        onSubmit={handleSupplementalSubmit}
      />

      <ReconciliationIssueDetailModal
        isOpen={Boolean(inspectedIssueId)}
        onClose={() => setInspectedIssueId(null)}
        issueId={inspectedIssueId}
      />
    </WorkspaceFrame.Root>
  );
}
