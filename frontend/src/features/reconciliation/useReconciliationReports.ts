import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '../../api/client';
import { serverStateCache } from '../../store/serverStateCache';
import { useAuth } from '../../store/useAuth';
import { useHistoricalScope } from '../../hooks/useHistoricalScope';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { reconciliationReportScope } from './reconciliationReportScope';
import {
  mrxApi,
  type MrxVarianceRegisterReport,
  type MrxTransactionHistoryReport,
  type MrxAuditTrailReport,
  type MrxCompletedRegisterReport,
  type MrxSourceChangePage,
} from '../../api/mrxApi';

export interface UseReconciliationReportsOptions {
  activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed';
  batchId: string;
  auditSubTab?: 'warehouse' | 'source';
  isCatalogTransitioning?: boolean;
}

type ReportData = {
  variancesReport?: MrxVarianceRegisterReport;
  transactionsReport?: MrxTransactionHistoryReport;
  auditReport?: MrxAuditTrailReport;
  sourceReport?: MrxSourceChangePage;
  completedReport?: MrxCompletedRegisterReport;
};

type ReportState = { key: string; scope: string; tabScope: string; page: number; data: ReportData | null; error: Error | null; loading: boolean };

export function useReconciliationReports({ activeReportTab, batchId, auditSubTab = 'warehouse', isCatalogTransitioning = false }: UseReconciliationReportsOptions) {
  const { user, operationalMode } = useAuth();
  const [params] = useSearchParams();
  const completedScope = useHistoricalScope('completed');
  const completedCustomer = params.get('completedCustomerId');
  const completedFilterKey = JSON.stringify({ ...(completedCustomer ? { customerId: completedCustomer } : {}), ...completedScope.range });
  const [completedPageState, setCompletedPageState] = useState({ key: completedFilterKey, page: 1 });
  const completedPage = completedPageState.key === completedFilterKey ? completedPageState.page : 1;
  const setCompletedPage = (page: number) => setCompletedPageState({ key: completedFilterKey, page });
  const auditTabKey = `${batchId}_${auditSubTab}`;
  const [auditSearchState, setAuditSearchState] = useState({ key: batchId, value: '' });
  const auditSearch = auditSearchState.key === batchId ? auditSearchState.value : '';
  const settledSearchState = useDebouncedValue(auditSearchState, 250);
  const settledSearch = settledSearchState.key === batchId ? settledSearchState.value : '';
  const auditScope = `${auditTabKey}_${settledSearch}`;
  const [auditPageState, setAuditPageState] = useState({ key: auditScope, page: 1 });
  const auditPage = auditPageState.key === auditScope ? auditPageState.page : 1;
  const [transactionPageState, setTransactionPageState] = useState({ batchId, page: 1 });
  const transactionPage = transactionPageState.batchId === batchId ? transactionPageState.page : 1;
  const enabled = activeReportTab !== 'lines' && (activeReportTab === 'completed' || Boolean(batchId));
  const userModeScope = `mrx_report_${user?.userId}_${operationalMode}_`;
  const { tabScope, reportScope } = reconciliationReportScope(userModeScope, activeReportTab, batchId, auditSubTab, settledSearch, completedFilterKey);
  const page = activeReportTab === 'transactions' ? transactionPage : activeReportTab === 'completed' ? completedPage : activeReportTab === 'audit' ? auditPage : 1;
  const cacheKey = `${reportScope}_${page}`;
  const warmEntry = enabled ? serverStateCache.get<ReportData>(cacheKey) : null;
  const [state, setState] = useState<ReportState | null>(() => {
    const warm = warmEntry?.data;
    return warm ? { key: cacheKey, scope: reportScope, tabScope, page, data: warm, error: null, loading: false } : null;
  });
  if (enabled && warmEntry && !warmEntry.isStale && state?.key !== cacheKey) {
    setState({ key: cacheKey, scope: reportScope, tabScope, page, data: warmEntry.data, error: null, loading: false });
  }
  const requestId = useRef(0);

  const readReport = useCallback(async (force: boolean): Promise<ReportData> => {
    const cached = !force ? serverStateCache.get<ReportData>(cacheKey) : null;
    if (cached && !cached.isStale) return cached.data;
    if (activeReportTab === 'completed') {
      if (completedScope.error) throw new Error(completedScope.error);
      const scope = JSON.parse(completedFilterKey) as { customerId?: string; weekFrom?: string; weekTo?: string };
      return { completedReport: await (Object.keys(scope).length ? mrxApi.getCompletedRegister(completedPage, 50, scope) : mrxApi.getCompletedRegister(completedPage, 50)) };
    }
    if (activeReportTab === 'variances') return { variancesReport: await mrxApi.getVarianceRegister(batchId) };
    if (activeReportTab === 'transactions') return { transactionsReport: await mrxApi.getTransactionsHistory({ batchId, pageNumber: transactionPage, pageSize: 25 }) };
    if (auditSubTab === 'source') return { sourceReport: await mrxApi.getSourceChangesPage(batchId, auditPage, 50, settledSearch) };
    return { auditReport: await (settledSearch ? mrxApi.getAuditTrail(batchId, auditPage, 50, settledSearch) : mrxApi.getAuditTrail(batchId, auditPage, 50)) };
  }, [cacheKey, activeReportTab, batchId, transactionPage, completedPage, auditPage, auditSubTab, completedFilterKey, completedScope.error, settledSearch]);

  const fetchReport = useCallback(async (force = false) => {
    if (!enabled) return;
    const id = ++requestId.current;
    const cached = (state?.key === cacheKey ? state.data : null) ?? serverStateCache.get<ReportData>(cacheKey)?.data ?? null;
    try {
      const data = await readReport(force);
      if (id !== requestId.current) return;
      if (serverStateCache.get<ReportData>(cacheKey)?.data !== data) serverStateCache.set(cacheKey, data);
      setState({ key: cacheKey, scope: reportScope, tabScope, page, data, error: null, loading: false });
    } catch (cause) {
      if (id !== requestId.current) return;
      const blocking = cause instanceof ApiError && cause.status < 500;
      if (blocking) serverStateCache.delete(cacheKey);
      setState({ key: cacheKey, scope: reportScope, tabScope, page, data: blocking ? null : cached, error: cause instanceof Error ? cause : new Error('Không thể tải báo cáo đối soát.'), loading: false });
    }
  }, [enabled, cacheKey, readReport, reportScope, tabScope, page, state]);

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    readReport(false).then((data) => {
      if (id !== requestId.current) return;
      if (serverStateCache.get<ReportData>(cacheKey)?.data !== data) serverStateCache.set(cacheKey, data);
      setState({ key: cacheKey, scope: reportScope, tabScope, page, data, error: null, loading: false });
    }).catch((cause: unknown) => {
      if (id !== requestId.current) return;
      const blocking = cause instanceof ApiError && cause.status < 500;
      if (blocking) serverStateCache.delete(cacheKey);
      setState({ key: cacheKey, scope: reportScope, tabScope, page, data: blocking ? null : serverStateCache.get<ReportData>(cacheKey)?.data ?? null,
        error: cause instanceof Error ? cause : new Error('Không thể tải báo cáo đối soát.'), loading: false });
    });
    return () => { requestId.current += 1; };
  }, [enabled, cacheKey, readReport, reportScope, tabScope, page]);

  const current = state?.key === cacheKey ? state : null;
  const currentData = current?.data ?? serverStateCache.get<ReportData>(cacheKey)?.data;
  const previous = !currentData && !current?.error && state?.tabScope === tabScope && (enabled || isCatalogTransitioning) ? state : null;
  const data = enabled ? (currentData ?? previous?.data) : (isCatalogTransitioning ? previous?.data ?? null : null);
  return {
    variancesReport: data?.variancesReport ?? null,
    transactionsReport: data?.transactionsReport ?? null,
    transactionPage: previous?.page ?? transactionPage,
    setTransactionPage: (page: number) => setTransactionPageState({ batchId, page }),
    auditReport: data?.auditReport ?? null,
    auditPage: previous?.page ?? auditPage,
    setAuditPage: (page: number) => setAuditPageState({ key: auditScope, page }),
    auditSearch,
    setAuditSearch: (value: string) => setAuditSearchState({ key: batchId, value }),
    completedReport: data?.completedReport ?? null,
    completedPage: previous?.page ?? completedPage,
    setCompletedPage,
    sourceChanges: data?.sourceReport?.items ?? null,
    sourceTotalCount: data?.sourceReport?.totalCount,
    isReportLoading: (enabled && (current ? current.loading : !currentData)) || (activeReportTab !== 'lines' && activeReportTab !== 'completed' && isCatalogTransitioning),
    hasExactReport: Boolean(currentData),
    reportError: current?.error ?? null,
    reloadReport: useCallback(() => {
      setState(previous => ({ key: cacheKey, scope: reportScope, tabScope, page,
        data: previous?.key === cacheKey ? previous.data : serverStateCache.get<ReportData>(cacheKey)?.data ?? null,
        error: previous?.key === cacheKey ? previous.error : null, loading: true }));
      return fetchReport(true);
    }, [cacheKey, fetchReport, reportScope, tabScope, page]),
  };
}
