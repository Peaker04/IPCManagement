import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary, type StateBoundaryProps } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ApiError } from '../../api/client';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import { ReconciliationReportTables } from './ReconciliationReportTables';
import { ReconciliationBatchPicker } from '../../components/workbench/ReconciliationBatchPicker';
import { ReconciliationLifecycleStrip } from './ReconciliationLifecycleStrip';
import { ReconciliationBlockerStrip } from './ReconciliationBlockerStrip';
import { ReconciliationCompletionModal } from './ReconciliationCompletionModal';
import { ReconciliationLinesBranch } from './branches/ReconciliationLinesBranch';
import { ReconciliationHeaderBranch } from './branches/ReconciliationHeaderBranch';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';
import { toVietnameseDate } from '../../utils/dates';
import { useReconciliationWorkspace } from './hooks/useReconciliationWorkspace';
import { useAuth } from '../../store/useAuth';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';
import { HistoricalScopeFilter } from '../../components/workbench/HistoricalScopeFilter';
import { useHistoricalScope } from '../../hooks/useHistoricalScope';
import { Select } from '../../components/ui/select';

const STATUS_LABELS: Record<string, string> = {
  ...MRX_STATUS_LABELS,
  MATCHED: 'Khớp định mức', EXACT: 'Khớp', NEEDS_REVIEW: 'Cần giải trình',
  DISPOSED: 'Đã giải trình', UNDER_ISSUED: 'Chờ xuất đủ', OVER_ISSUED: 'Xuất vượt',
};

export function ReconciliationPage() {
  const navigate = useNavigate();
  const { canNavigate } = useAuth();
  const canOpenKitchen = canNavigate('/chef', '?view=mrx-cooking');
  const canOpenWarehouse = canNavigate('/warehouse', '?view=mrx-daily');
  const canOpenSource = canNavigate('/weekly-menu', '?view=mrx-batch');
  const [params, setParams] = useSearchParams();
  const completedScope = useHistoricalScope('completed');
  const completedCustomer = params.get('completedCustomerId') || '';
  const completedExportParams = new URLSearchParams({ ...(completedCustomer ? { customerId: completedCustomer } : {}), ...completedScope.range });
  const [auditSubTab, setAuditSubTab] = useState<'warehouse' | 'source'>('warehouse');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBatchPickerOpen, setIsBatchPickerOpen] = useState(false);

  const {
    isAdmin,
    customerCode,
    customers,
    batches,
    selectedWeek,
    selectedMonth,
    handleSelectMonth,
    catalogInfo,
    catalogLoading,
    catalogError,
    retryCatalog,
    batchId,
    serviceDate,
    data,
    isPreviousData,
    isLoading,
    isFetching,
    error,
    displayedError,
    mutationError,
    setMutationError,
    isForbidden,
    isModeConflict,
    isConflict,
    isBootstrapping,
    hasHydratedData,
    hasBatchesLoaded,
    canComplete,
    needsReviewCount,
    activeReportTab,
    isCompleteOpen,
    setIsCompleteOpen,
    isDishesModalOpen,
    setIsDishesModalOpen,
    isSubmitting,
    lineStatusFilter,
    setLineStatusFilter,
    isRefreshing,
    handleRefresh,
    handleComplete,
    handleSelectCustomer,
    handleSelectBatch,
    handleSelectDate,
    loadData,
    reports,
  } = useReconciliationWorkspace(auditSubTab);

  const isReportUnavailable = reports.isReportLoading || Boolean(reports.reportError) || (activeReportTab !== 'completed' && (catalogLoading || Boolean(catalogError) || !hasBatchesLoaded || isPreviousData));
  const batchCount = catalogInfo?.totalCount ?? 0;
  const selectedCustomerId = customers.find(customer => customer.customerCode === customerCode)?.customerId;

  async function downloadReport(url: string, filename: string) {
    if (isDownloading || isReportUnavailable) return;
    setIsDownloading(true);
    setMutationError(null);
    try { await downloadAuthenticatedFile(url, filename); }
    catch (cause) { setMutationError(cause instanceof Error ? cause : new Error('Không thể tải báo cáo. Vui lòng thử lại.')); }
    finally { setIsDownloading(false); }
  }

  const isScopePending = !error && Boolean((data ? data.batchId !== batchId : isLoading) || (!batchId && catalogLoading));
  const currentData = data?.batchId === batchId ? data : null;
  const isDayPending = isPreviousData || isLoading;
  const effectiveBatchStatus = isScopePending ? undefined : data?.status ?? batches.find(b => b.batchId === batchId)?.status;
  const dayNavigation = (batchId || data) && <div role="group" aria-label="Ngày đối soát" className="flex shrink-0 gap-1 overflow-x-auto no-scrollbar px-3 py-1">
    {Array.from({ length: 6 }, (_, index) => {
      const day = new Date(`${selectedWeek}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return <Button key={date} variant="outline" size="sm" className="reconciliation-day-filter shrink-0"
        aria-label={isScopePending ? `T${index + 2} · Đang xác minh tuần` : `T${index + 2} · ${toVietnameseDate(date)}`} aria-pressed={!isScopePending && date === serviceDate}
        disabled={isScopePending || catalogLoading || Boolean(catalogError)} onClick={() => handleSelectDate(date)}>
        T{index + 2} · {isScopePending ? '—/—' : toVietnameseDate(date).slice(0, 5)}
      </Button>;
    })}
  </div>;
  const bodyState: Omit<StateBoundaryProps, 'children'> = {
    isLoading: activeReportTab === 'lines' && !hasHydratedData && (isBootstrapping || (Boolean(batchId) && isLoading)),
    isFetching: isFetching && hasHydratedData,
    isPreviousData: activeReportTab === 'lines' && isPreviousData,
    loadingGeometry: { kind: 'table', columns: 8, rows: 10, columnWidths: ['16%', '28%', '10%', '14%', '14%', '14%', '14%', '14%'] },
    hasExistingData: activeReportTab === 'lines' ? hasHydratedData : true,
    error: displayedError, isForbidden, isModeConflict, isConflict,
    modeConflictMessage: isAdmin ? 'Cần bật chế độ MRX tại Thiết lập nâng cao.' : 'Cần chế độ MRX. Liên hệ Quản trị viên để bật.',
    onSwitchMode: isAdmin ? () => navigate('/settings/advanced?view=mode') : undefined,
    conflictDetails: (error ?? catalogError)?.message,
    onResolveConflict: () => catalogError ? retryCatalog() : loadData(),
    onRetry: () => catalogError ? retryCatalog() : loadData(),
    isPartial: false,
    partialMessage: 'Chưa có số liệu rà soát cho ngày đã chọn.',
    isEmpty: activeReportTab === 'lines' && ((!hasHydratedData && !isBootstrapping && !isLoading && !isFetching && hasBatchesLoaded && !batchId)
      || (hasHydratedData && !isBootstrapping && !isLoading && !isFetching && (!data || data.lines.length === 0))),
    emptyScenario: data?.status === 'COMPLETED' ? 'true-empty' : 'prerequisite-blocked',
    emptyTitle: !batchId ? `Chưa có lô đối soát cho tháng ${selectedMonth.slice(5)}/${selectedMonth.slice(0, 4)}` : 'Chưa có dữ liệu rà soát dòng ngày',
    emptyDescription: !batchId ? 'Tháng này chưa có lô đối soát. Chọn tháng khác hoặc tạo lô tại Thực đơn tuần.'
      : data?.status === 'COMPLETED' ? 'Ngày này không có dòng đối soát. Chọn ngày khác để xem.' : 'Không có dòng nguyên liệu nào cần rà soát cho ngày phục vụ này.',
    actionLabel: !batchId && batchCount > 1 ? 'Mở danh sách lô' : data?.status !== 'COMPLETED' && canOpenSource ? 'Chuyển đến Chuẩn bị lô đối soát' : undefined,
    onAction: !batchId && batchCount > 1 ? () => setIsBatchPickerOpen(true) : data?.status !== 'COMPLETED' && canOpenSource ? () => {
      const customerId = customers.find(c => c.customerCode === customerCode)?.customerId || '';
      navigate(`/weekly-menu?view=mrx-batch${customerId ? '&customerId=' + customerId : ''}`);
    } : undefined,
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <ReconciliationHeaderBranch
        completedFilters={<>
          <div className="w-52"><Select aria-label="Khách hàng hồ sơ hoàn tất" value={completedCustomer}
            options={[{ value: '', label: 'Tất cả khách hàng' }, ...customers.map(customer => ({ value: customer.customerId, label: `${customer.customerCode} · ${customer.customerName}` }))]}
            onChange={event => setParams(current => { const next = new URLSearchParams(current); if (event.target.value) next.set('completedCustomerId', event.target.value); else next.delete('completedCustomerId'); return next; })} /></div>
          <HistoricalScopeFilter prefix="completed" />
        </>}
        isPending={isScopePending}
        activeReportTab={activeReportTab}
        catalogLoading={catalogLoading || Boolean(catalogError)}
        customerCode={customerCode}
        customers={customers}
        onSelectCustomer={handleSelectCustomer}
        batchId={batchId}
        batches={batches}
        selectedBatch={batches.find(batch => batch.batchId === batchId)}
        selectedWeek={data?.batchId === batchId ? data?.weekStartDate : undefined}
        batchCount={batchCount}
        selectedMonth={selectedMonth}
        onSelectMonth={handleSelectMonth}
        onSelectBatch={handleSelectBatch}
        onOpenBatchPicker={() => setIsBatchPickerOpen(true)}
        batchStatus={effectiveBatchStatus}
        statusLabels={STATUS_LABELS}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        canComplete={Boolean(canComplete)}
        onOpenComplete={() => setIsCompleteOpen(true)}
        needsReviewCount={needsReviewCount}
      />

      <TelemetrySubbar
        responsive
        className="mrx-tools-subbar"
        leftControls={
          activeReportTab === 'lines' ? (
            <ReconciliationLifecycleStrip status={effectiveBatchStatus} isPending={isScopePending} />
          ) : activeReportTab === 'audit' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Nhật ký kiểm toán đối soát nguyên liệu:</span>
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setAuditSubTab('warehouse')}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    auditSubTab === 'warehouse'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kho ({reports.auditReport?.totalCount ?? '—'})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditSubTab('source')}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    auditSubTab === 'source'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nguồn & BOM ({reports.sourceTotalCount ?? '—'})
                </button>
              </div>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-700">
              {activeReportTab === 'variances'
                ? 'Sổ theo dõi chênh lệch & quyết định xử lý tuần'
                : activeReportTab === 'transactions'
                ? 'Lịch sử giao dịch kho (Xuất / Nhập trả)'
                : 'Danh bạ lô đối soát đã hoàn tất'}
            </span>
          )
        }
        telemetryPills={
          activeReportTab === 'lines' ? (
            <div className="mrx-metadata-slot flex items-center gap-2">
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Phiên bản lô:</span><strong className="inline-block min-w-[3ch] text-right text-slate-900 font-mono tabular-nums">{currentData?.version ?? '—'}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Trạng thái tuần:</span><strong className="inline-block min-w-[13ch] text-slate-900">{STATUS_LABELS[currentData?.weeklyStatus || ''] || currentData?.weeklyStatus || '—'}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Dòng ngày:</span><strong className="inline-block min-w-[3ch] text-right text-slate-900 font-mono tabular-nums">{!isDayPending ? currentData?.lines.length ?? '—' : '—'}</strong></span>
            </div>
          ) : activeReportTab === 'variances' ? (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Tổng chênh lệch: <strong className="inline-block min-w-[3ch] text-right text-slate-900">{reports.variancesReport?.totalCount ?? '—'} dòng</strong>
            </span>
          ) : activeReportTab === 'transactions' ? (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Dòng giao dịch: <strong className="inline-block min-w-[3ch] text-right text-slate-900">{reports.transactionsReport?.totalCount ?? '—'} dòng</strong>
            </span>
          ) : activeReportTab === 'audit' ? (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Sự kiện kiểm toán: <strong className="inline-block min-w-[3ch] text-right text-slate-900"><Num value={auditSubTab === 'warehouse' ? reports.auditReport?.totalCount : reports.sourceTotalCount} /></strong>
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Tổng hồ sơ: <strong className="inline-block min-w-[3ch] text-right text-slate-900">{reports.completedReport?.totalCount ?? '—'} lô</strong>
            </span>
          )
        }
        rightActions={
          activeReportTab === 'lines' ? (
            <div className="flex items-center gap-1.5">
              {canOpenKitchen && <Button
                variant="outline"
                size="xs"
                disabled={!batchId}
                onClick={() => batchId && navigate(`/chef?view=mrx-cooking&batchId=${batchId}`)}
                className="h-7 text-xs font-medium"
              >
                Phiếu nấu Bếp →
              </Button>}
              <Button
                variant="outline"
                size="xs"
                disabled={!batchId}
                onClick={() => setIsDishesModalOpen(true)}
                className="h-7 text-xs font-medium"
              >
                Món & BOM đã đóng băng
              </Button>
            </div>
          ) : activeReportTab === 'variances' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || isReportUnavailable || !batchId || (reports.variancesReport?.rows?.length ?? 0) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/variance-register/xlsx?batchId=${batchId}`, `so-chenh-lech-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Sổ chênh lệch
            </Button>
          ) : activeReportTab === 'transactions' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || isReportUnavailable || !batchId || (reports.transactionsReport?.items?.length ?? 0) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/transactions-history/xlsx?batchId=${batchId}`, `lich-su-kho-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Lịch sử kho
            </Button>
          ) : activeReportTab === 'audit' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || isReportUnavailable || !batchId || ((reports.auditReport?.rows?.length ?? 0) + (reports.sourceChanges?.length ?? 0)) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/audit-trail/xlsx?batchId=${batchId}`, `nhat-ky-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Nhật ký
            </Button>
          ) : activeReportTab === 'completed' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || isReportUnavailable || (reports.completedReport?.rows?.length ?? 0) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/completed-register/xlsx${completedExportParams.size ? `?${completedExportParams}` : ''}`, 'danh-ba-hoan-tat.xlsx')}
            >
              Tải Excel Danh bạ hoàn tất
            </Button>
          ) : null
        }
      />

      {mutationError && (
        <InlineBanner
          variant={mutationError instanceof ApiError && mutationError.status === 409 ? 'conflict' : 'error'}
          title={mutationError instanceof ApiError && mutationError.status === 409 ? 'Xung đột dữ liệu đồng thời' : mutationError instanceof ApiError && mutationError.status === 403 ? 'Không có quyền thực hiện thao tác' : 'Lỗi xử lý'}
          actionLabel={mutationError instanceof ApiError && mutationError.status === 409 ? 'Tải lại dữ liệu mới nhất' : undefined}
          onAction={mutationError instanceof ApiError && mutationError.status === 409 ? () => { setMutationError(null); void loadData(); } : undefined}
          onClose={() => setMutationError(null)}
          className="shrink-0 rounded-none border-x-0"
        >
          {mutationError.message}
        </InlineBanner>
      )}

      <WorkspaceFrame.Body>
        {activeReportTab === 'lines' && (data || isScopePending) && <ReconciliationBlockerStrip
          isPending={isScopePending || isDayPending}
          hasResolvedStatus={Boolean(data)}
          isPreviousScope={isScopePending}
          pendingMessage={isScopePending ? 'Đang xác minh trạng thái lô đã chọn…' : 'Đang xác minh ngày đối soát…'}
          isBlocked={data?.status !== 'COMPLETED' && !(data?.status === 'IN_PROGRESS' && data?.weeklyStatus === 'WEEK_COMPLETE')}
          isCompleted={data?.status === 'COMPLETED'}
          needsReviewCount={needsReviewCount}
          onFilterNeedsReview={() => setLineStatusFilter('NEEDS_REVIEW')}
          onNavigateWarehouse={data && canOpenWarehouse ? () => navigate(`/warehouse?view=mrx-daily&batchId=${data.batchId}&date=${serviceDate}`) : undefined}
        />}
        {activeReportTab === 'lines' ? <ReconciliationLinesBranch
          resolvedBatchId={!isScopePending ? data?.batchId ?? '' : undefined}
          bodyState={bodyState}
          dayNavigation={dayNavigation}
          lines={data?.lines ?? []}
          statusLabels={STATUS_LABELS}
          isCompleted={data?.status === 'COMPLETED'}
          onReloadData={loadData}
          statusFilter={lineStatusFilter}
          onStatusFilterChange={setLineStatusFilter}
          hasBatch={Boolean(batchId || data)}
        /> : <StateBoundary {...bodyState}>

          <ReconciliationReportTables
              activeTab={activeReportTab}
              batchId={batchId}
              isReportLoading={reports.isReportLoading}
              hasExactReport={reports.hasExactReport}
              reportError={reports.reportError}
              onRetry={() => { void reports.reloadReport(); }}
              variancesReport={reports.variancesReport}
              transactionsReport={reports.transactionsReport}
              transactionPage={reports.transactionPage}
              onTransactionPageChange={reports.setTransactionPage}
              auditReport={reports.auditReport}
              auditPage={reports.auditPage}
              auditSearch={reports.auditSearch}
              onAuditSearchChange={reports.setAuditSearch}
              sourceTotalCount={reports.sourceTotalCount}
              onAuditPageChange={reports.setAuditPage}
              completedReport={reports.completedReport}
              completedPage={reports.completedPage}
              onCompletedPageChange={reports.setCompletedPage}
              sourceChanges={reports.sourceChanges}
              auditSubTab={auditSubTab}
            />
        </StateBoundary>}
      </WorkspaceFrame.Body>

      {isBatchPickerOpen && selectedCustomerId && <ReconciliationBatchPicker key={`${selectedCustomerId}_${selectedMonth}`}
        customerId={selectedCustomerId} month={selectedMonth} selectedBatchId={batchId}
        onClose={() => setIsBatchPickerOpen(false)} onSelect={batch => { handleSelectBatch(batch); setIsBatchPickerOpen(false); }} />}

      <MrxBatchDishesModal
        isOpen={isDishesModalOpen}
        onClose={() => setIsDishesModalOpen(false)}
        batchId={batchId}
        customerName={data?.customerName}
      />

      <ReconciliationCompletionModal
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        data={data}
        customerCode={customerCode}
        weekStartDate={batches.find((item) => item.batchId === data?.batchId)?.weekStartDate ?? data?.weekStartDate}
        isSubmitting={isSubmitting}
        onConfirm={handleComplete}
        statusLabels={STATUS_LABELS}
        error={mutationError}
        needsReviewCount={needsReviewCount}
        onViewNeedsReview={() => {
          setIsCompleteOpen(false);
          setLineStatusFilter('NEEDS_REVIEW');
        }}
      />
    </WorkspaceFrame.Root>
  );
}
