import { useState, useEffect, useCallback } from 'react';
import { serverStateCache } from '../../store/serverStateCache';
import {
  mrxApi,
  type MrxVarianceRegisterReport,
  type MrxTransactionHistoryReport,
  type MrxAuditTrailReport,
  type MrxCompletedRegisterReport,
  type MrxSourceChangeItem,
} from '../../api/mrxApi';

export interface UseReconciliationReportsOptions {
  activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed';
  batchId: string;
  weekStartDate: string;
}

/**
 * Custom Hook managing Reconciliation Report views (variances, transactions, audit, completed)
 * Isolates report state and background fetching, preventing unnecessary re-renders in the main workbench.
 */
export function useReconciliationReports({
  activeReportTab,
  batchId,
  weekStartDate,
}: UseReconciliationReportsOptions) {
  const [variancesReport, setVariancesReport] = useState<MrxVarianceRegisterReport | null>(
    () => (batchId ? serverStateCache.get<MrxVarianceRegisterReport>(`mrx_variance_${batchId}_${weekStartDate}`)?.data ?? null : null)
  );
  const [transactionsReport, setTransactionsReport] = useState<MrxTransactionHistoryReport | null>(
    () => (batchId ? serverStateCache.get<MrxTransactionHistoryReport>(`mrx_tx_${batchId}`)?.data ?? null : null)
  );
  const [auditReport, setAuditReport] = useState<MrxAuditTrailReport | null>(
    () => (batchId ? serverStateCache.get<{ audit: MrxAuditTrailReport; sources: MrxSourceChangeItem[] }>(`mrx_audit_${batchId}`)?.data?.audit ?? null : null)
  );
  const [completedReport, setCompletedReport] = useState<MrxCompletedRegisterReport | null>(
    () => serverStateCache.get<MrxCompletedRegisterReport>('mrx_completed_register')?.data ?? null
  );
  const [sourceChanges, setSourceChanges] = useState<MrxSourceChangeItem[] | null>(
    () => (batchId ? serverStateCache.get<{ audit: MrxAuditTrailReport; sources: MrxSourceChangeItem[] }>(`mrx_audit_${batchId}`)?.data?.sources ?? null : null)
  );
  const [reportError, setReportError] = useState<Error | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const fetchReport = useCallback(async (force = false) => {
    if (activeReportTab === 'lines') return;
    if (activeReportTab !== 'completed' && !batchId) {
      setIsReportLoading(false);
      setVariancesReport(null);
      setTransactionsReport(null);
      setAuditReport(null);
      setSourceChanges(null);
      return;
    }

    const cacheKey = activeReportTab === 'completed'
      ? 'mrx_completed_register'
      : activeReportTab === 'variances'
      ? `mrx_variance_${batchId}_${weekStartDate}`
      : activeReportTab === 'transactions'
      ? `mrx_tx_${batchId}`
      : `mrx_audit_${batchId}`;

    const cached = !force ? serverStateCache.get(cacheKey)?.data : null;
    if (cached) {
      if (activeReportTab === 'completed') setCompletedReport(cached as MrxCompletedRegisterReport);
      else if (activeReportTab === 'variances') setVariancesReport(cached as MrxVarianceRegisterReport);
      else if (activeReportTab === 'transactions') setTransactionsReport(cached as MrxTransactionHistoryReport);
      else if (activeReportTab === 'audit') {
        const c = cached as { audit: MrxAuditTrailReport; sources: MrxSourceChangeItem[] };
        setAuditReport(c.audit);
        setSourceChanges(c.sources);
      }
      setIsReportLoading(false);
      return;
    }

    setReportError(null);
    setIsReportLoading(true);
    try {
      if (activeReportTab === 'completed') {
        const res = await mrxApi.getCompletedRegister();
        setCompletedReport(res);
        serverStateCache.set('mrx_completed_register', res);
      } else if (batchId) {
        if (activeReportTab === 'variances') {
          const res = await mrxApi.getVarianceRegister(batchId, weekStartDate);
          setVariancesReport(res);
          serverStateCache.set(`mrx_variance_${batchId}_${weekStartDate}`, res);
        } else if (activeReportTab === 'transactions') {
          const res = await mrxApi.getTransactionsHistory(batchId);
          setTransactionsReport(res);
          serverStateCache.set(`mrx_tx_${batchId}`, res);
        } else if (activeReportTab === 'audit') {
          const [audit, sources] = await Promise.all([
            mrxApi.getAuditTrail(batchId),
            mrxApi.getSourceChanges(batchId),
          ]);
          setAuditReport(audit);
          setSourceChanges(sources);
          serverStateCache.set(`mrx_audit_${batchId}`, { audit, sources });
        }
      }
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err : new Error('Không thể tải báo cáo đối soát.'));
    } finally {
      setIsReportLoading(false);
    }
  }, [activeReportTab, batchId, weekStartDate]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const currentVariance = variancesReport ?? (batchId ? serverStateCache.get<MrxVarianceRegisterReport>(`mrx_variance_${batchId}_${weekStartDate}`)?.data ?? null : null);
  const currentTransactions = transactionsReport ?? (batchId ? serverStateCache.get<MrxTransactionHistoryReport>(`mrx_tx_${batchId}`)?.data ?? null : null);
  const currentAudit = auditReport ?? (batchId ? serverStateCache.get<{ audit: MrxAuditTrailReport; sources: MrxSourceChangeItem[] }>(`mrx_audit_${batchId}`)?.data?.audit ?? null : null);
  const currentCompleted = completedReport ?? (serverStateCache.get<MrxCompletedRegisterReport>('mrx_completed_register')?.data ?? null);
  const currentSourceChanges = sourceChanges ?? (batchId ? serverStateCache.get<{ audit: MrxAuditTrailReport; sources: MrxSourceChangeItem[] }>(`mrx_audit_${batchId}`)?.data?.sources ?? null : null);

  return {
    variancesReport: currentVariance,
    transactionsReport: currentTransactions,
    auditReport: currentAudit,
    completedReport: currentCompleted,
    sourceChanges: currentSourceChanges,
    isReportLoading,
    reportError,
    reloadReport: fetchReport,
  };
}
