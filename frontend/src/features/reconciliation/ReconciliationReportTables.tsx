import { FileText } from 'lucide-react';
import { LocalizedBoundary } from '../../components/workbench/LocalizedBoundary';
import { ReconciliationVariancesBranch } from './branches/ReconciliationVariancesBranch';
import { ReconciliationTransactionsBranch } from './branches/ReconciliationTransactionsBranch';
import { ReconciliationAuditBranch } from './branches/ReconciliationAuditBranch';
import { ReconciliationCompletedBranch } from './branches/ReconciliationCompletedBranch';
import type {
  MrxVarianceRegisterReport,
  MrxTransactionHistoryReport,
  MrxAuditTrailReport,
  MrxCompletedRegisterReport,
  MrxSourceChangeItem,
} from '../../api/mrxApi';

interface ReconciliationReportTablesProps {
  activeTab: 'variances' | 'transactions' | 'audit' | 'completed';
  batchId: string;
  isReportLoading?: boolean;
  hasExactReport?: boolean;
  reportError?: Error | null;
  onRetry?: () => void;
  variancesReport: MrxVarianceRegisterReport | null;
  transactionsReport: MrxTransactionHistoryReport | null;
  transactionPage: number;
  onTransactionPageChange: (page: number) => void;
  auditReport: MrxAuditTrailReport | null;
  auditPage?: number;
  onAuditPageChange?: (page: number) => void;
  completedReport?: MrxCompletedRegisterReport | null;
  completedPage?: number;
  onCompletedPageChange?: (page: number) => void;
  sourceChanges?: MrxSourceChangeItem[] | null;
  auditSubTab?: 'warehouse' | 'source';
  auditSearch?: string;
  onAuditSearchChange?: (value: string) => void;
  sourceTotalCount?: number;
}

export function ReconciliationReportTables({
  activeTab,
  batchId,
  isReportLoading = false,
  hasExactReport = false,
  reportError,
  onRetry,
  variancesReport,
  transactionsReport,
  transactionPage,
  onTransactionPageChange,
  auditReport,
  auditPage,
  onAuditPageChange,
  completedReport,
  completedPage,
  onCompletedPageChange,
  sourceChanges,
  auditSubTab = 'warehouse',
  auditSearch,
  onAuditSearchChange,
  sourceTotalCount,
}: ReconciliationReportTablesProps) {
  const hasExactTabReport = Boolean(
    (activeTab === 'variances' && variancesReport) ||
    (activeTab === 'transactions' && transactionsReport) ||
    (activeTab === 'audit' && (auditSubTab === 'source' ? sourceChanges : auditReport)) ||
    (activeTab === 'completed' && completedReport)
  );
  const hasCurrentReport = hasExactTabReport;

  if (!batchId && !isReportLoading && !hasCurrentReport && activeTab !== 'completed') {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 bg-white text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
          <FileText className="size-6 text-slate-400" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Chưa chọn lô đối soát</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Vui lòng chọn lô đối soát trong danh sách phía trên để xem {activeTab === 'variances' ? 'sổ theo dõi chênh lệch' : activeTab === 'transactions' ? 'lịch sử giao dịch kho' : 'nhật ký kiểm toán'}.
        </p>
      </div>
    );
  }

  const columnWidths = activeTab === 'completed' ? ['21%', '21%', '12%', '12%', '10%', '12%', '12%']
    : activeTab === 'variances' ? ['12%', '10%', '24%', '8%', '10%', '10%', '10%', '18%']
    : activeTab === 'transactions' ? ['14%', '16%', '12%', '18%', '14%', '16%', '10%']
    : auditSubTab === 'source' ? ['16%', '14%', '14%', '16%', '16%', '24%']
    : ['16%', '14%', '12%', '18%', '20%', '20%'];

  return (
    <LocalizedBoundary
      loadingGeometry={{ kind: 'table', columns: columnWidths.length, columnWidths, rows: 10 }}
      isLoading={activeTab !== 'audit' && isReportLoading && !hasCurrentReport}
      hasExistingData={hasExactReport}
      error={reportError}
      onRetry={onRetry}
      retryPending={isReportLoading}
      emptyTitle="Chưa có dữ liệu báo cáo"
      emptyDescription="Không có bản ghi báo cáo nào khả dụng cho lô đối soát đã chọn."
    >
      <div aria-busy={isReportLoading || undefined} inert={isReportLoading || undefined} className="relative flex-1 min-h-0 flex flex-col">
      {isReportLoading && <span role="status" className="sr-only">Đang tải trang báo cáo</span>}
      {activeTab === 'variances' && <ReconciliationVariancesBranch batchId={batchId} report={variancesReport} />}
      {activeTab === 'transactions' && (
        <ReconciliationTransactionsBranch
          batchId={batchId}
          report={transactionsReport}
          page={transactionPage}
          onPageChange={onTransactionPageChange}
          pending={isReportLoading}
        />
      )}
      {activeTab === 'audit' && <ReconciliationAuditBranch batchId={batchId} auditReport={auditReport} sourceChanges={sourceChanges ?? null} auditSubTab={auditSubTab} page={auditPage} onPageChange={onAuditPageChange} pending={isReportLoading} searchTerm={auditSearch} onSearchChange={onAuditSearchChange} sourceTotalCount={sourceTotalCount} />}
      {activeTab === 'completed' && <ReconciliationCompletedBranch report={completedReport ?? null} page={completedPage} onPageChange={onCompletedPageChange} pending={isReportLoading} />}
      </div>
    </LocalizedBoundary>
  );
}
