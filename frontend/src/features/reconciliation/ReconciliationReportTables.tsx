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
  variancesReport: MrxVarianceRegisterReport | null;
  transactionsReport: MrxTransactionHistoryReport | null;
  auditReport: MrxAuditTrailReport | null;
  completedReport?: MrxCompletedRegisterReport | null;
  sourceChanges?: MrxSourceChangeItem[] | null;
  auditSubTab?: 'warehouse' | 'source';
}

export function ReconciliationReportTables({
  activeTab,
  batchId,
  isReportLoading = false,
  variancesReport,
  transactionsReport,
  auditReport,
  completedReport,
  sourceChanges,
  auditSubTab = 'warehouse',
}: ReconciliationReportTablesProps) {
  if (!batchId && activeTab !== 'completed') {
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

  const hasCurrentReport = Boolean(
    (activeTab === 'variances' && variancesReport) ||
    (activeTab === 'transactions' && transactionsReport) ||
    (activeTab === 'audit' && auditReport) ||
    (activeTab === 'completed' && completedReport)
  );

  return (
    <LocalizedBoundary
      isLoading={isReportLoading && !hasCurrentReport}
      emptyTitle="Chưa có dữ liệu báo cáo"
      emptyDescription="Không có bản ghi báo cáo nào khả dụng cho lô đối soát đã chọn."
    >
      {activeTab === 'variances' && <ReconciliationVariancesBranch batchId={batchId} report={variancesReport} />}
      {activeTab === 'transactions' && <ReconciliationTransactionsBranch batchId={batchId} report={transactionsReport} />}
      {activeTab === 'audit' && <ReconciliationAuditBranch batchId={batchId} auditReport={auditReport} sourceChanges={sourceChanges ?? null} auditSubTab={auditSubTab} />}
      {activeTab === 'completed' && <ReconciliationCompletedBranch report={completedReport ?? null} />}
    </LocalizedBoundary>
  );
}
