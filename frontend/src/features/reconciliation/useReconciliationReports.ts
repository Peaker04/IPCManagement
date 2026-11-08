import { useState, useEffect, useCallback, useRef } from 'react';
import { serverStateCache } from '../../store/serverStateCache';
import { useAuth } from '../../store/useAuth';
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
  auditSubTab?: 'warehouse' | 'source';
}

type ReportData = {
  variancesReport?: MrxVarianceRegisterReport;
  transactionsReport?: MrxTransactionHistoryReport;
  auditReport?: MrxAuditTrailReport;
  sourceChanges?: MrxSourceChangeItem[];
  completedReport?: MrxCompletedRegisterReport;
};

type ReportState = { key: string; scope: string; page: number; data: ReportData | null; error: Error | null; loading: boolean };

export function useReconciliationReports({ activeReportTab, batchId, auditSubTab = 'warehouse' }: UseReconciliationReportsOptions) {
  const { user, operationalMode } = useAuth();
  const [completedPage, setCompletedPage] = useState(1);
  const [auditPageState, setAuditPageState] = useState({ batchId, page: 1 });
  const auditPage = auditPageState.batchId === batchId ? auditPageState.page : 1;
  const [transactionPageState, setTransactionPageState] = useState({ batchId, page: 1 });
  const transactionPage = transactionPageState.batchId === batchId ? transactionPageState.page : 1;
  const enabled = activeReportTab !== 'lines' && (activeReportTab === 'completed' || Boolean(batchId));
  const reportScope = `mrx_report_${user?.userId}_${operationalMode}_${activeReportTab}_${activeReportTab === 'audit' ? auditSubTab : ''}_${activeReportTab === 'completed' ? 'all' : batchId}`;
  const page = activeReportTab === 'transactions' ? transactionPage : activeReportTab === 'completed' ? completedPage : activeReportTab === 'audit' && auditSubTab === 'warehouse' ? auditPage : 1;
  const cacheKey = `${reportScope}_${page}`;
  const [state, setState] = useState<ReportState | null>(null);
  const requestId = useRef(0);

  const readReport = useCallback(async (force: boolean): Promise<ReportData> => {
    const cached = !force ? serverStateCache.get<ReportData>(cacheKey) : null;
    if (cached && !cached.isStale) return cached.data;
    if (activeReportTab === 'completed') return { completedReport: await mrxApi.getCompletedRegister(completedPage, 50) };
    if (activeReportTab === 'variances') return { variancesReport: await mrxApi.getVarianceRegister(batchId) };
    if (activeReportTab === 'transactions') return { transactionsReport: await mrxApi.getTransactionsHistory({ batchId, pageNumber: transactionPage, pageSize: 25 }) };
    if (auditSubTab === 'source') return { sourceChanges: await mrxApi.getSourceChanges(batchId) };
    return { auditReport: await mrxApi.getAuditTrail(batchId, auditPage, 50) };
  }, [cacheKey, activeReportTab, batchId, transactionPage, completedPage, auditPage, auditSubTab]);

  const fetchReport = useCallback(async (force = false) => {
    if (!enabled) return;
    const id = ++requestId.current;
    const cached = serverStateCache.get<ReportData>(cacheKey)?.data ?? null;
    try {
      const data = await readReport(force);
      if (id !== requestId.current) return;
      if (serverStateCache.get<ReportData>(cacheKey)?.data !== data) serverStateCache.set(cacheKey, data);
      setState({ key: cacheKey, scope: reportScope, page, data, error: null, loading: false });
    } catch (cause) {
      if (id !== requestId.current) return;
      setState({ key: cacheKey, scope: reportScope, page, data: cached, error: cause instanceof Error ? cause : new Error('Không thể tải báo cáo đối soát.'), loading: false });
    }
  }, [enabled, cacheKey, readReport, reportScope, page]);

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    readReport(false).then((data) => {
      if (id !== requestId.current) return;
      if (serverStateCache.get<ReportData>(cacheKey)?.data !== data) serverStateCache.set(cacheKey, data);
      setState({ key: cacheKey, scope: reportScope, page, data, error: null, loading: false });
    }).catch((cause: unknown) => {
      if (id !== requestId.current) return;
      setState({ key: cacheKey, scope: reportScope, page, data: serverStateCache.get<ReportData>(cacheKey)?.data ?? null,
        error: cause instanceof Error ? cause : new Error('Không thể tải báo cáo đối soát.'), loading: false });
    });
    return () => { requestId.current += 1; };
  }, [enabled, cacheKey, readReport, reportScope, page]);

  const current = state?.key === cacheKey ? state : null;
  const currentData = current?.data ?? serverStateCache.get<ReportData>(cacheKey)?.data;
  const previous = !currentData && !current?.error && state?.scope === reportScope ? state : null;
  const data = enabled ? currentData ?? previous?.data : null;
  return {
    variancesReport: data?.variancesReport ?? null,
    transactionsReport: data?.transactionsReport ?? null,
    transactionPage: previous?.page ?? transactionPage,
    setTransactionPage: (page: number) => setTransactionPageState({ batchId, page }),
    auditReport: data?.auditReport ?? null,
    auditPage: previous?.page ?? auditPage,
    setAuditPage: (page: number) => setAuditPageState({ batchId, page }),
    completedReport: data?.completedReport ?? null,
    completedPage: previous?.page ?? completedPage,
    setCompletedPage,
    sourceChanges: data?.sourceChanges ?? null,
    isReportLoading: enabled && (current ? current.loading : !currentData),
    reportError: current?.error ?? null,
    reloadReport: useCallback(() => {
      setState({ key: cacheKey, scope: reportScope, page, data: serverStateCache.get<ReportData>(cacheKey)?.data ?? null, error: null, loading: true });
      return fetchReport(true);
    }, [cacheKey, fetchReport, reportScope, page]),
  };
}
