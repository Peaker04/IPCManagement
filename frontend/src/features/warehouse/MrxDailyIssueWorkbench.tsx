import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { Boxes } from 'lucide-react';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/button';
import { ActionGuard } from '../../components/ui/action-guard';
import { Num } from '../../components/ui/num';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { InlineBanner } from '../../components/ui/inline-banner';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkbenchSkeleton } from '../../components/workbench/WorkbenchSkeleton';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { LocalFindBar } from '../../components/workbench/LocalFindBar';
import { normalizeSearchText } from '../../utils/search';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { DocumentCodeCell } from '../../components/workbench/DocumentCodeCell';
import { useOptionalDirtyNavigation } from '../../components/workbench/dirty-navigation-context';
import { isIsoDate, isServiceDate, isWeekStartDate, weekStartFor, toVietnameseDate } from '../../utils/dates';
import { MrxSupplementalIssueModal } from './MrxSupplementalIssueModal';
import { MrxHistoricalPurposeModal } from './MrxHistoricalPurposeModal';
import { ReconciliationIssueDetailModal } from '../../components/workbench/ReconciliationIssueDetailModal';
import { MrxDailyDateTabsBranch } from './branches/MrxDailyDateTabsBranch';
import { MrxDailyHeaderBranch } from './branches/MrxDailyHeaderBranch';
import { MrxDailyLinesBranch } from './branches/MrxDailyLinesBranch';
import { serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useMrxDailyWorkspace } from './hooks/useMrxDailyWorkspace';
import { useAuth } from '../../store/useAuth';
import type { MrxWarehouseDaily, MrxIssuePage } from '../../api/mrxApi';
import type { MrxBatchSummary } from '../../api/mrxApi';
import { ReconciliationBatchPicker } from '../../components/workbench/ReconciliationBatchPicker';

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
    displayDate,
    setActiveDate,
    setDateValidationError,
    isWeeklyAll,
    daily,
    day,
    history,
    historyState,
    isHistoryPageStale,
    refetchHistory,
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
    canRecoverInitial,
    recoverInitial,
    setMutationError,
    issueSucceeded,
    isSupplementalOpen,
    setIsSupplementalOpen,
    isSubmittingSupp,
    suppError,
    suppOutcomeUnknown,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canIssueBatch,
    canSubmit,
    submit,
    handleSupplementalSubmit,
    recoverSupplemental,
  } = useMrxDailyWorkspace({ batchId: propBatchId, serviceDate: propServiceDate });

  const [supplementalDirty, setSupplementalDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'demand' | 'history'>('demand');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [purposeScope, setPurposeScope] = useState<{ batchId: string; date: string } | null>(null);
  const historyQuery = normalizeSearchText(historySearchTerm);
  const filteredHistoryItems = useMemo(() => {
    const items = history?.items ?? [];
    if (!historyQuery) return items;
    return items.filter((row) =>
      [row.issueCode, row.issueDate, toVietnameseDate(row.issueDate), row.issuedByName, row.shiftName ? getMrxShiftLabel(row.shiftName) : '']
        .some((val) => normalizeSearchText(String(val ?? '')).includes(historyQuery))
    );
  }, [history?.items, historyQuery]);
  const isIssueOutcomeUnknown = issueOutcomeUnknown;
  const isIssueConflict = mutationError instanceof ApiError && mutationError.status === 409;
  const isStaleIssue = isIssueConflict && mutationError.code === 'MRX_ISSUE_STALE';
  const displayWeekly = displayDate === 'ALL';
  const displayDay = displayDate === activeDate ? day : daily?.dates.find(item => item.serviceDate === displayDate);
  const displayLines = displayDay === day ? lines : displayDay?.lines.filter(line => line.requiredQuantity > 0) ?? [];
  const isOutsideBatchDate = Boolean(daily?.batchId === activeBatchId && daily?.dates.length && !isWeeklyAll && !day);
  const dirtyNavigation = useOptionalDirtyNavigation();
  const registerDirty = dirtyNavigation?.registerDirty;
  const hasUnsavedDraft = useMemo(() => (
    Object.values(quantities).some((val) => Boolean(val?.trim())) ||
    Object.values(reasons).some((val) => Boolean(val?.trim())) ||
    Boolean(isSupplementalOpen && supplementalDirty)
  ), [quantities, reasons, isSupplementalOpen, supplementalDirty]);

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

  const isScopePending = !stateProps.error && Boolean(activeBatchId && (daily?.batchId !== activeBatchId || stateProps.isLoading));
  const preparationRange = !isWeeklyAll && isServiceDate(activeDate) ? 'day' : 'week';
  const rememberedScope = workspaceSessionStore.getScope();
  const preparationDate = preparationRange === 'day' ? activeDate : [
    batches.find(batch => batch.batchId === activeBatchId)?.weekStartDate,
    daily?.batchId === activeBatchId && daily.dates[0] ? weekStartFor(daily.dates[0].serviceDate) : undefined,
    rememberedScope.batchId === activeBatchId ? rememberedScope.weekStartDate : undefined,
    isIsoDate(activeDate) ? weekStartFor(activeDate) : undefined,
  ].find(isWeekStartDate);

  const selectBatch = (newId: string, historicalBatch?: MrxBatchSummary) => {
    if (scopeLocked || newId === activeBatchId) return;
    guardScopeChange(() => {
      const b = historicalBatch ?? batches.find(item => item.batchId === newId);
      setActiveBatchId(newId);
      if (b) workspaceSessionStore.setScope({ batchId: newId, customerId: b.customerId, customerCode: b.customerCode || '',
        customerName: b.customerName || '', weekStartDate: b.weekStartDate || '' });
      const cachedForNew = serverStateCache.get<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>(`mrx_daily_${newId}`)?.data;
      const newDate = cachedForNew?.daily?.dates[0]?.serviceDate || b?.weekStartDate || '';
      setActiveDate(newDate);
      setSearchParams(curr => { const next = new URLSearchParams(curr); next.set('batchId', newId);
        if (newDate) next.set('date', newDate); else next.delete('date'); return next; });
    });
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDailyHeaderBranch
        isPending={isScopePending}
        retainPreviousPresentation={Boolean(daily) && !isLegacyMissing}
        scopeError={Boolean(stateProps.error)}
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
        onSelectBatch={selectBatch}
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
        canIssueBatch={canIssueBatch}
        onOpenSupplemental={() => {
          if (scopeLocked) return;
          setSuppError(null);
          setIsSupplementalOpen(true);
          void load(true);
        }}
        onFillAll={handleFillAll}
        onDateValidationChange={setDateValidationError}
        availableDates={daily?.batchId === activeBatchId ? daily.dates.map((date) => date.serviceDate) : undefined}
        onSubmit={submit}
        canSubmit={canSubmit}
        saving={saving}
        linesCount={lines.length}
        catalogNavigation={<><PaginationBar label="Phân trang danh sách lô xuất kho" placement="selector" page={catalogPaging?.pageNumber ?? catalogPage} pageSize={50}
          totalCount={catalogPaging?.totalCount} totalPages={catalogPaging?.totalPages}
          hasPrev={catalogPaging?.hasPrev ?? false} hasNext={catalogPaging?.hasNext ?? false}
          pending={scopeLocked || catalogLoading || Boolean(catalogError)} onPageChange={changeCatalogPage} />
          <Button variant="outline" size="sm" disabled={scopeLocked} onClick={() => setHistoryPickerOpen(true)}>Tìm lô cũ</Button></>}
      />

      {catalogError && activeBatchId && <InlineBanner variant="error" actionLabel="Tải lại danh sách lô" onAction={retryCatalog}>{catalogError.message}</InlineBanner>}
      {canIssueBatch && hasInitialIssue && daily?.batchId === activeBatchId && daily.batchStatus === 'IN_PROGRESS'
        && !isWeeklyAll && !scopeLocked && !isSupplementalOpen && !stateProps.isPreviousData && day
        && (activeTab === 'history' || day.lines.some(line => line.quantityStatus === 'ALLOCATION_REQUIRES_REVIEW')) && (
        <ActionGuard capabilityId="WH.ISSUE.CREATE" roles={['Admin', 'WarehouseManager', 'Warehouse Manager', 'WarehouseStaff', 'Warehouse Staff', 'Thủ kho']}
          allowedModes={['MATERIAL_RECONCILIATION']}>
          <InlineBanner variant="info" actionLabel="Đối chiếu phân bổ" onAction={() =>
            setPurposeScope({ batchId: activeBatchId, date: day.serviceDate })}>
            Kiểm tra phiếu xuất cũ chưa xác định mục đích của ngày đã chọn.
          </InlineBanner>
        </ActionGuard>
      )}

      <TelemetrySubbar
        responsive
        className="mrx-tools-subbar"
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
            <MrxDailyDateTabsBranch
              dates={daily?.dates}
              activeDate={displayDate}
              disabled={scopeLocked || isScopePending || activeTab === 'history'}
              onSelectDate={(newDate) => {
                if (scopeLocked || activeTab === 'history' || newDate === activeDate) return;
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
              isWeeklyAll={displayWeekly}
            />
          </div>
        }
        telemetryPills={<div className="mrx-metadata-slot mrx-metadata-slot-compact">{isScopePending ? <span role="status" className="text-xs">Đang xác minh dữ liệu lô mới…</span> :
          isWeeklyAll ? (
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span className="text-slate-500">Mã lô:</span>
              <strong className="font-mono text-slate-900">{daily?.batchId ? daily.batchId.slice(0, 8) : '—'}</strong>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Tổng nguyên liệu:</span>
              <strong className="inline-block min-w-[3ch] text-right font-mono text-slate-900">{daily ? weeklyAggregateLines.length : '—'}</strong>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span className="text-slate-500">Phiên bản:</span>
              <strong className="inline-block min-w-[3ch] text-right font-mono text-slate-900">{daily?.sourceVersion ? `v${daily.sourceVersion}` : '—'}</strong>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Mặt hàng ca:</span>
              <strong className="inline-block min-w-[3ch] text-right font-mono text-slate-900">{day ? lines.length : '—'}</strong>
            </div>
          )}
        </div>}
        rightActions={
          <Button
            variant="outline"
            size="xs"
            disabled={scopeLocked || isScopePending || !preparationDate}
            onClick={() => {
              if (!preparationDate) return;
              guardScopeChange(() => navigate(`/warehouse?${new URLSearchParams({
                view: 'mrx-preparation', date: preparationDate, range: preparationRange,
              })}`));
            }}
          >
            Chuẩn bị phối hợp
          </Button>
        }
      />

      {daily?.dates.some(date => !isServiceDate(date.serviceDate) && date.lines.length > 0) && <InlineBanner variant="info">
        Lô có dữ liệu Chủ nhật lịch sử. Tổng hợp lô giữ nguyên dữ liệu này; Chủ nhật chỉ xem, không tạo phiếu mới.
      </InlineBanner>}
      {daily?.batchId === activeBatchId && daily.batchStatus === 'READY' && (
        <InlineBanner variant="info" title="Lô chưa chuyển sang Kho"
          actionLabel={stateProps.isFetching ? undefined : 'Làm mới'} onAction={() => void load(true)}>
          Điều phối cần chọn “Chuyển sang Kho” ở màn chuẩn bị lô. Sau khi bàn giao, chọn “Làm mới” để xuất kho.
        </InlineBanner>
      )}
      {(mutationError || isIssueOutcomeUnknown) && (
        <InlineBanner
          variant={isIssueConflict ? 'conflict' : 'error'}
          title={isIssueOutcomeUnknown ? 'Chưa xác nhận được kết quả xuất kho' : isStaleIssue ? 'Dữ liệu xuất kho đã thay đổi' : 'Không thể ghi phiếu xuất'}
          actionLabel={isIssueOutcomeUnknown ? (canRecoverInitial ? 'Gửi lại cùng mã lệnh' : undefined) : isIssueConflict ? 'Tải lại dữ liệu mới nhất' : undefined}
          isActionLoading={isIssueOutcomeUnknown && saving}
          onAction={isIssueOutcomeUnknown ? recoverInitial : isIssueConflict ? () => {
            setMutationError(null);
            void load(true);
          } : undefined}
          onClose={isIssueOutcomeUnknown ? undefined : () => setMutationError(null)}
          className="shrink-0 rounded-none border-x-0"
        >
          {isIssueOutcomeUnknown
            ? canRecoverInitial
              ? (mutationError instanceof ApiError && mutationError.status < 500 && mutationError.code !== 'SESSION_CHANGED'
                ? mutationError.message : 'Phiếu có thể đã được ghi. Gửi lại cùng mã lệnh để kiểm tra kết quả.')
              : 'Hãy kiểm tra kết quả trong lịch sử phiếu. Chỉ có thể gửi lại lệnh ở đúng phiên bản chế độ đã dùng để ghi phiếu.'
            : mutationError?.message}
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

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          className={activeTab === 'demand' && isOutsideBatchDate ? 'justify-start! py-5!' : undefined}
          onRetry={() => { if (!activeBatchId && catalogError) retryCatalog(); else void load(true); }}
          error={stateProps.error || (!activeBatchId ? catalogError : null)}
          hasExistingData={Boolean(daily || history)}
          isPreviousData={stateProps.isPreviousData}
          isLoading={stateProps.isLoading || Boolean(!stateProps.error && activeBatchId && !daily && !history)}
          onResolveConflict={() => load(true)}
          loadingVariant="table"
          customSkeleton={<div className="flex-1 min-h-0 flex flex-col bg-white">
            {activeTab === 'demand' && <div aria-hidden="true" className="px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0"><div className="h-8 w-60 rounded bg-slate-200" /></div>}
            <WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 10,
              columnWidths: activeTab === 'history' ? ['24%', '18%', '16%', '18%', '24%']
                : isWeeklyAll ? ['26%', '12%', '20%', '20%', '22%'] : ['26%', '21%', '17%', '18%', '18%'],
            }} />
          </div>}
          emptyIcon={Boxes}
          isEmpty={activeTab === 'history' || (daily?.batchId === activeBatchId && day && !isLegacyMissing) ? false : stateProps.isEmpty || isLegacyMissing}
          emptyTitle={activeTab === 'history' ? 'Chưa có phiếu xuất kho nào cho lô này.' : isLegacyMissing ? "Lô đối soát chưa có phân rã định lượng theo ngày" : (!isWeeklyAll && lines.length === 0 ? "Không có định lượng cần xuất cho ngày đã chọn" : stateProps.emptyTitle)}
          emptyDescription={activeTab === 'history' ? 'Các phiếu xuất của lô đã chọn.' : isLegacyMissing ? "Lô thiếu dữ liệu theo ngày. Chọn lô khác để xuất kho." : isOutsideBatchDate ? 'Ngày đã chọn nằm ngoài tuần của lô. Chọn ngày trên lịch xuất ca hoặc xem tổng hợp cả tuần.' : (!isWeeklyAll && lines.length === 0 ? null : stateProps.emptyDescription)}
          isPartial={isLegacyMissing}
          partialMessage="Thiếu định lượng ca; chỉ xem được tổng hợp."
          actionLabel={isLegacyMissing ? (canOpenSource ? 'Xem màn hình Điều phối lô' : undefined) : isOutsideBatchDate ? 'Xem cả tuần của lô' : (!activeBatchId || batches.length === 0 ? 'Xem tiến độ tại Bàn điều hành' : undefined)}
          onAction={isLegacyMissing ? (canOpenSource ? () => navigate(`/weekly-menu?view=mrx-batch&batchId=${activeBatchId}`) : undefined) : isOutsideBatchDate ? () => {
            setActiveDate('ALL');
            setSearchParams(current => { const next = new URLSearchParams(current); next.set('date', 'ALL'); return next; }, { replace: true });
          } : (!activeBatchId || batches.length === 0 ? () => navigate('/') : undefined)}
        >
          {activeTab === 'demand' ? (
            <fieldset disabled={scopeLocked || isScopePending} className="flex-1 min-h-0 min-w-0 flex flex-col bg-white">
              <MrxDailyLinesBranch
                isWeeklyAll={displayWeekly}
                weeklyAggregateLines={weeklyAggregateLines}
                lines={displayLines}
                quantities={quantities}
                setQuantities={setQuantities}
                reasons={reasons}
                setReasons={setReasons}
                hasInitialIssue={hasInitialIssue}
                readOnly={!canIssueBatch || !isServiceDate(activeDate)}
                lastRevisionAt={displayDay?.lastRevisionAt}
                lastRevisionByName={displayDay?.lastRevisionByName}
                lastRevisionByRole={displayDay?.lastRevisionByRole}
              />
            </fieldset>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <LocalFindBar
                label="Tìm kiếm trong lịch sử phiếu xuất"
                value={historySearchTerm}
                onChange={setHistorySearchTerm}
                matched={filteredHistoryItems.length}
                total={history?.items.length ?? 0}
                clearLabel="Xóa tìm trong lịch sử phiếu"
                scope="Tìm trong trang lịch sử phiếu xuất hiện tại."
              />
              <StateBoundary
                isPreviousData={historyState.isFetching || historyState.isLoading}
                isFetching={historyState.isFetching}
                lockContent={isHistoryPageStale}
                hasExistingData={Boolean(history)}
                error={historyState.error}
                onRetry={() => void refetchHistory(true)}
              >
                <DataGrid
                  data={filteredHistoryItems}
                  columns={historyColumns}
                  keyExtractor={(row) => row.issueId}
                  emptyMessage={history ? (historyQuery ? "Không tìm thấy phiếu xuất nào khớp với từ khóa." : "Chưa có phiếu xuất kho nào cho lô này.") : undefined}
                />
              </StateBoundary>
              <PaginationBar label="Phân trang phiếu xuất MRX" page={history?.pageNumber ?? historyPage} pageSize={25}
                totalCount={history?.totalCount} totalPages={history?.totalPages}
                hasPrev={history?.hasPrev ?? false} hasNext={history?.hasNext ?? false}
                pending={historyState.isFetching || historyState.isLoading || isHistoryPageStale || stateProps.isPreviousData || scopeLocked}
                retainButtonFocus onPageChange={setHistoryPage} />
            </div>
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>
      {issueSucceeded && <InlineBanner variant="success" title="Xuất kho thành công."
        className="shrink-0 rounded-none border-x-0 py-2" />}

      <MrxSupplementalIssueModal
        isOpen={isSupplementalOpen}
        onClose={() => { if (!scopeLocked) setIsSupplementalOpen(false); }}
        activeBatchId={activeBatchId}
        activeDate={activeDate}
        lines={lines}
        suppError={suppError}
        isOutcomeUnknown={suppOutcomeUnknown}
        isSubmittingSupp={isSubmittingSupp}
        onDirtyChange={setSupplementalDirty}
        onSubmit={handleSupplementalSubmit}
        onRecover={() => { void recoverSupplemental(); }}
        onRefreshScope={async () => { setSuppError(null); await load(true); }}
        scopeReady={!stateProps.error && !stateProps.isPreviousData && !stateProps.isFetching}
        sourceVersion={daily?.sourceVersion}
      />

      <ReconciliationIssueDetailModal
        isOpen={Boolean(inspectedIssueId)}
        onClose={() => setInspectedIssueId(null)}
        issueId={inspectedIssueId}
      />
      {purposeScope && <MrxHistoricalPurposeModal batchId={purposeScope.batchId} date={purposeScope.date}
        onClose={() => { setPurposeScope(null); void load(true); }} />}
      {historyPickerOpen && <ReconciliationBatchPicker selectedBatchId={activeBatchId} onClose={() => setHistoryPickerOpen(false)}
        onSelect={batch => { selectBatch(batch.batchId, batch); setHistoryPickerOpen(false); }} />}
    </WorkspaceFrame.Root>
  );
}
