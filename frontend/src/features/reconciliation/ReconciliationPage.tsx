import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ApiError } from '../../api/client';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import { ReconciliationReportTables } from './ReconciliationReportTables';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { ReconciliationLifecycleStrip } from './ReconciliationLifecycleStrip';
import { ReconciliationCompletionModal } from './ReconciliationCompletionModal';
import { ReconciliationLinesBranch } from './branches/ReconciliationLinesBranch';
import { ReconciliationHeaderBranch } from './branches/ReconciliationHeaderBranch';
import { MrxBatchDishesModal } from '../../components/workbench/MrxBatchDishesModal';
import { toVietnameseDate, weekStartFor } from '../../utils/dates';
import { useReconciliationWorkspace } from './hooks/useReconciliationWorkspace';
import { useAuth } from '../../store/useAuth';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';

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
  useSearchParams();
  const [auditSubTab, setAuditSubTab] = useState<'warehouse' | 'source'>('warehouse');
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    isAdmin,
    customerCode,
    customers,
    batches,
    catalogPage,
    catalogInfo,
    catalogLoading,
    catalogError,
    retryCatalog,
    setCatalogPage,
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

  async function downloadReport(url: string, filename: string) {
    if (isDownloading) return;
    setIsDownloading(true);
    setMutationError(null);
    try { await downloadAuthenticatedFile(url, filename); }
    catch (cause) { setMutationError(cause instanceof Error ? cause : new Error('Không thể tải báo cáo. Vui lòng thử lại.')); }
    finally { setIsDownloading(false); }
  }

  return (
    <WorkspaceFrame.Root className="select-text">
      <ReconciliationHeaderBranch
        activeReportTab={activeReportTab}
        catalogLoading={catalogLoading || Boolean(catalogError)}
        customerCode={customerCode}
        customers={customers}
        onSelectCustomer={handleSelectCustomer}
        batchId={batchId}
        batches={batches}
        onSelectBatch={handleSelectBatch}
        serviceDate={serviceDate}
        onSelectDate={handleSelectDate}
        batchStatus={data?.status}
        statusLabels={STATUS_LABELS}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        canComplete={Boolean(canComplete)}
        onOpenComplete={() => setIsCompleteOpen(true)}
        needsReviewCount={needsReviewCount}
        catalogNavigation={<PaginationBar label="Phân trang danh sách lô giám sát" placement="selector"
          page={catalogInfo?.pageNumber ?? catalogPage} pageSize={100}
          totalCount={catalogInfo?.totalCount} totalPages={catalogInfo?.totalPages}
          hasPrev={catalogInfo?.hasPrev ?? false} hasNext={catalogInfo?.hasNext ?? false}
          pending={catalogLoading || Boolean(catalogError)} onPageChange={setCatalogPage} />}
      />

      <TelemetrySubbar
        responsive
        leftControls={
          activeReportTab === 'lines' ? (
            <ReconciliationLifecycleStrip status={data?.status} />
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
                  Nguồn & BOM ({reports.sourceChanges?.length ?? '—'})
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
          activeReportTab === 'lines' && data ? (
            <>
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Phiên bản lô:</span><strong className="text-slate-900 font-mono">{data.version}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Trạng thái tuần:</span><strong className="text-slate-900">{STATUS_LABELS[data.weeklyStatus || ''] || data.weeklyStatus || '—'}</strong></span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1"><span className="text-slate-500">Dòng ngày:</span><strong className="text-slate-900 font-mono">{data.lines.length}</strong></span>
            </>
          ) : activeReportTab === 'variances' ? (
            <span className="text-xs text-slate-500 font-mono">
              Tổng chênh lệch: <strong className="text-slate-900">{reports.variancesReport?.totalCount ?? '—'} dòng</strong>
            </span>
          ) : activeReportTab === 'transactions' ? (
            <span className="text-xs text-slate-500 font-mono">
              Dòng giao dịch: <strong className="text-slate-900">{reports.transactionsReport?.totalCount ?? '—'} dòng</strong>
            </span>
          ) : activeReportTab === 'audit' ? (
            <span className="text-xs text-slate-500 font-mono">
              Sự kiện kiểm toán: <strong className="text-slate-900"><Num value={auditSubTab === 'warehouse' ? reports.auditReport?.totalCount : reports.sourceChanges?.length} /></strong>
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              Tổng hồ sơ: <strong className="text-slate-900">{reports.completedReport?.totalCount ?? '—'} lô</strong>
            </span>
          )
        }
        rightActions={
          activeReportTab === 'lines' && batchId ? (
            <div className="flex items-center gap-1.5">
              {canOpenKitchen && <Button
                variant="outline"
                size="xs"
                onClick={() => navigate(`/chef?view=mrx-cooking&batchId=${batchId}`)}
                className="h-7 text-xs font-medium"
              >
                Phiếu nấu Bếp →
              </Button>}
              <Button
                variant="outline"
                size="xs"
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
              disabled={isDownloading || !batchId || (reports.variancesReport?.rows?.length ?? 0) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/variance-register/xlsx?batchId=${batchId}`, `so-chenh-lech-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Sổ chênh lệch
            </Button>
          ) : activeReportTab === 'transactions' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || !batchId || (reports.transactionsReport?.items?.length ?? 0) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/transactions-history/xlsx?batchId=${batchId}`, `lich-su-kho-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Lịch sử kho
            </Button>
          ) : activeReportTab === 'audit' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || !batchId || ((reports.auditReport?.rows?.length ?? 0) + (reports.sourceChanges?.length ?? 0)) === 0}
              onClick={() => void downloadReport(`/api/reconciliation/reports/audit-trail/xlsx?batchId=${batchId}`, `nhat-ky-${batchId.slice(0, 8)}.xlsx`)}
            >
              Tải Excel Nhật ký
            </Button>
          ) : activeReportTab === 'completed' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={isDownloading || (reports.completedReport?.rows?.length ?? 0) === 0}
              onClick={() => void downloadReport('/api/reconciliation/reports/completed-register/xlsx', 'danh-ba-hoan-tat.xlsx')}
            >
              Tải Excel Danh bạ hoàn tất
            </Button>
          ) : null
        }
      />

      {catalogError && <InlineBanner variant="error" actionLabel="Tải lại danh sách lô giám sát" onAction={retryCatalog}>{catalogError.message}</InlineBanner>}
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
        <StateBoundary
          isLoading={activeReportTab === 'lines' ? (!hasHydratedData && (isBootstrapping || (Boolean(batchId) && isLoading))) : false}
          isFetching={isFetching && hasHydratedData}
          isPreviousData={activeReportTab === 'lines' && isPreviousData}
          loadingGeometry={{ kind: 'table', columns: 8, rows: 10, columnWidths: ['16%', '28%', '10%', '14%', '14%', '14%', '14%', '14%'] }}
          hasExistingData={activeReportTab === 'lines' ? hasHydratedData : true}
          error={displayedError}
          isForbidden={isForbidden}
          isModeConflict={isModeConflict}
          modeConflictMessage={isAdmin ? 'Cần bật chế độ MRX tại Thiết lập nâng cao.' : 'Cần chế độ MRX. Liên hệ Quản trị viên để bật.'}
          onSwitchMode={isAdmin ? () => navigate('/settings/advanced?view=mode') : undefined}
          isConflict={isConflict}
          conflictDetails={error?.message}
          onResolveConflict={() => catalogError ? retryCatalog() : loadData()}
          onRetry={() => catalogError ? retryCatalog() : loadData()}
          isPartial={activeReportTab === 'lines' && Boolean(data && data.lines.length === 0 && data.status !== 'COMPLETED')}
          partialMessage="Chưa có số liệu rà soát cho ngày đã chọn."
          isEmpty={
            activeReportTab === 'lines'
              ? ((!hasHydratedData && !isBootstrapping && !isLoading && !isFetching && hasBatchesLoaded && !batchId) ||
                 (hasHydratedData && !isBootstrapping && !isLoading && !isFetching && (!data || data.lines.length === 0)))
              : false
          }
          emptyScenario={data?.status === 'COMPLETED' ? 'true-empty' : 'prerequisite-blocked'}
          emptyTitle={
            !batchId
              ? (batches.length === 0 ? "Chưa có dữ liệu đối soát cho ngày đã chọn" : `Chưa có lô đối soát cho tuần ${toVietnameseDate(weekStartFor(serviceDate))}`)
              : "Chưa có dữ liệu rà soát dòng ngày"
          }
          emptyDescription={
            !batchId
              ? "Tuần này chưa có lô đối soát. Chọn tuần khác hoặc tạo lô tại Thực đơn tuần."
              : data?.status === 'COMPLETED'
                ? 'Ngày này không có dòng đối soát. Chọn ngày khác để xem.'
                : "Không có dòng nguyên liệu nào cần rà soát cho ngày phục vụ này."
          }
          actionLabel={data?.status !== 'COMPLETED' && canOpenSource ? 'Chuyển đến Chuẩn bị lô đối soát' : undefined}
          onAction={data?.status !== 'COMPLETED' && canOpenSource ? () => {
            const selectedCustomerId = customers.find((c) => c.customerCode === customerCode)?.customerId || '';
            navigate(`/weekly-menu?view=mrx-batch${selectedCustomerId ? '&customerId=' + selectedCustomerId : ''}`);
          } : undefined}
        >
          {activeReportTab === 'lines' && data && (
            <ReconciliationLinesBranch
              lines={data.lines}
              statusLabels={STATUS_LABELS}
              isCompleted={data.status === 'COMPLETED'}
              onReloadData={loadData}
              statusFilter={lineStatusFilter}
              onStatusFilterChange={setLineStatusFilter}
              showBlocker={Boolean(data.status === 'IN_PROGRESS' && data.weeklyStatus !== 'WEEK_COMPLETE')}
              onNavigateWarehouse={canOpenWarehouse ? () => navigate(`/warehouse?view=mrx-daily&batchId=${data.batchId}&date=${serviceDate}`) : undefined}
            />
          )}

          {activeReportTab !== 'lines' && (
            <ReconciliationReportTables
              activeTab={activeReportTab}
              batchId={batchId}
              isReportLoading={reports.isReportLoading}
              reportError={reports.reportError}
              onRetry={() => { void reports.reloadReport(); }}
              variancesReport={reports.variancesReport}
              transactionsReport={reports.transactionsReport}
              transactionPage={reports.transactionPage}
              onTransactionPageChange={reports.setTransactionPage}
              auditReport={reports.auditReport}
              auditPage={reports.auditPage}
              onAuditPageChange={reports.setAuditPage}
              completedReport={reports.completedReport}
              completedPage={reports.completedPage}
              onCompletedPageChange={reports.setCompletedPage}
              sourceChanges={reports.sourceChanges}
              auditSubTab={auditSubTab}
            />
          )}
        </StateBoundary>
      </WorkspaceFrame.Body>

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
        weekStartDate={batches.find((item) => item.batchId === data?.batchId)?.weekStartDate}
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
