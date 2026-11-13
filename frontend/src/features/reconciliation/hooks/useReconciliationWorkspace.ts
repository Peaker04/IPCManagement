import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../store/useAuth';
import { getCachedArray, serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import {
  mrxApi,
  mapBatchDtoToSummary,
  type MrxBatchSummary,
  type MrxBatchPage,
  type ReconciliationBatchSummary,
} from '../../../api/mrxApi';
import { invalidateMrxCaches } from '../../../api/mrxCacheInvalidation';
import { businessMonthRange, isServiceDate, todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';
import { weeklyMenuApi } from '../../../api/weeklyMenuApi';
import { ApiError } from '../../../api/client';
import type { CustomerOption } from '../../../types';
import { reconciliationReportScope } from '../reconciliationReportScope';
import type { LineStatusFilter } from '../ReconciliationLinesFilterToolbar';
import { useReconciliationReports } from '../useReconciliationReports';
import { useReconciliationScopeActions } from './reconciliationScopeActions';

interface ReconSnapshot {
  customerCode: string;
  batchId: string;
  serviceDate: string;
  data: ReconciliationBatchSummary | null;
}

export function useReconciliationWorkspace(auditSubTab: 'warehouse' | 'source' = 'warehouse') {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole, user, operationalMode } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const sessionScope = workspaceSessionStore.getScope();
  const cachedCustomers = getCachedArray<CustomerOption>('catalog_customers');
  const snapshot =
    serverStateCache.get<ReconSnapshot>('snapshot:mrx_reconciliation')?.data ??
    serverStateCache.get<ReconSnapshot>('snapshot:reconciliation')?.data;

  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const urlCustomerParam = searchParams.get('customerId');
  const matchedInitialCustomer = urlCustomerParam
    ? (cachedCustomers ?? []).find((c) => c.customerCode === urlCustomerParam || c.customerId === urlCustomerParam)
    : undefined;
  const initialCode = matchedInitialCustomer?.customerCode || urlCustomerParam || sessionScope.customerCode || sessionScope.customerId
    || cachedCustomers?.[0]?.customerCode || '';
  const [customerCode, setCustomerCode] = useState(() => initialCode);
  const rawInitialDate = searchParams.get('date') || sessionScope.serviceDate || todayInBusinessTimezone();
  const initialDate = !searchParams.get('date') && !isServiceDate(rawInitialDate) ? weekStartFor(rawInitialDate) : rawInitialDate;
  const initialWeek = weekStartFor(initialDate);
  const urlMonth = searchParams.get('month');
  const initialMonth = urlMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(urlMonth) ? urlMonth : initialWeek.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const initialCustomerId = (cachedCustomers ?? []).find((c) => c.customerCode === initialCode || c.customerId === initialCode)?.customerId;
  const cachedBatches = initialCustomerId ? getCachedArray<MrxBatchSummary>(`mrx_recon_month_batches_${initialCustomerId}_${initialMonth}`) : null;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const catalogKey = JSON.stringify([customerCode, selectedMonth]);
  const [catalogState, setCatalogState] = useState<{ key: string; page: MrxBatchPage | null; error: Error | null } | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const catalogCurrent = catalogState?.key === catalogKey ? catalogState : null;
  const catalogError = catalogCurrent?.error;
  const catalogLoading = !catalogCurrent;

  const initialBatchId = searchParams.get('batchId') ||
    (!urlCustomerParam && (sessionScope.customerCode === initialCode || sessionScope.customerId === initialCode) && sessionScope.serviceDate && weekStartFor(sessionScope.serviceDate).slice(0, 7) === initialMonth ? sessionScope.batchId : '') || '';
  const [internalBatchId, setInternalBatchId] = useState(() => initialBatchId);
  const [internalDate, setInternalDate] = useState(() => initialDate);

  const batchId = searchParams.get('batchId') || internalBatchId;
  const serviceDate = searchParams.get('date') || internalDate;

  const setBatchId = useCallback((id: string) => setInternalBatchId(id), []);
  const setServiceDate = useCallback((date: string) => setInternalDate(date), []);

  const batchIdRef = useRef(batchId);
  const customerCodeRef = useRef(customerCode);
  const explicitBatchIdRef = useRef(searchParams.get('batchId'));
  const setSearchParamsRef = useRef(setSearchParams);
  const serviceDateRef = useRef(serviceDate);
  const [resolvedLink, setResolvedLink] = useState('');
  const prefetchedKeyRef = useRef('');
  const linkedBatchId = searchParams.get('batchId');
  const urlDate = searchParams.get('date');
  const [syncedUrlDate, setSyncedUrlDate] = useState(urlDate);
  const [syncedUrlMonth, setSyncedUrlMonth] = useState(urlMonth);
  if (urlMonth !== syncedUrlMonth || urlDate !== syncedUrlDate) {
    setSyncedUrlMonth(urlMonth);
    setSyncedUrlDate(urlDate);
    if (urlMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(urlMonth)) setSelectedMonth(urlMonth);
    else if (urlDate) setSelectedMonth(weekStartFor(urlDate).slice(0, 7));
    if (urlDate) setSelectedWeek(weekStartFor(urlDate));
  }

  const reconCacheKey = `mrx_recon_${batchId}_${serviceDate}`;
  const cachedReconEntry = batchId ? serverStateCache.get<ReconciliationBatchSummary>(reconCacheKey) : null;
  const initialReconCache = batchId
    ? (cachedReconEntry?.data ??
       (snapshot?.batchId === batchId && snapshot.serviceDate === serviceDate ? snapshot.data : null))
    : null;

  const [storedData, setData] = useState<ReconciliationBatchSummary | null>(() => initialReconCache || null);
  const [loadedScope, setLoadedScope] = useState(() => initialReconCache ? reconCacheKey : '');
  const [hasBatchesLoaded, setHasBatchesLoaded] = useState(() => Boolean(initialReconCache));
  const [isLoading, setIsLoading] = useState(() => Boolean(!initialReconCache));
  const [isFetching, setIsFetching] = useState(() => Boolean(initialReconCache));
  const [error, setError] = useState<Error | null>(null);
  const [hasUserSwitchedScope, setHasUserSwitchedScope] = useState(false);
  if (batchId && cachedReconEntry && !cachedReconEntry.isStale && (loadedScope !== reconCacheKey || storedData !== cachedReconEntry.data)) {
    setData(cachedReconEntry.data);
    setLoadedScope(reconCacheKey);
    setError(null);
    setIsLoading(false);
    setIsFetching(false);
  }
  const isSameBatchDateSwitch = Boolean(batchId && storedData?.batchId === batchId && loadedScope !== reconCacheKey);
  const isTransitioningScope = !batchId
    ? (!hasBatchesLoaded || isLoading)
    : (loadedScope !== reconCacheKey || storedData?.batchId !== batchId);
  const data = storedData?.batchId === batchId
    ? storedData
    : (storedData && hasUserSwitchedScope && isTransitioningScope && !error ? storedData : null);
  const isPreviousData = Boolean(data && (isSameBatchDateSwitch || (hasUserSwitchedScope && isTransitioningScope)));
  const hasHydratedData = Boolean(data);
  const isBootstrapping = !hasHydratedData && (!hasBatchesLoaded || (customers.length === 0 && !cachedCustomers));
  const retryCatalog = () => { setError(null); setCatalogState(null); setCatalogRetry(value => value + 1); };
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const viewParam = searchParams.get('view');
  const activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed' =
    viewParam === 'variances' || viewParam === 'transactions' || viewParam === 'audit' || viewParam === 'completed'
      ? viewParam
      : 'lines';
  const hasUserSwitchedScopeRef = useRef(hasUserSwitchedScope);
  const activeReportTabRef = useRef(activeReportTab);
  const auditSubTabRef = useRef(auditSubTab);
  const userIdRef = useRef(user?.userId);
  const operationalModeRef = useRef(operationalMode);
  useEffect(() => {
    batchIdRef.current = batchId;
    customerCodeRef.current = customerCode;
    explicitBatchIdRef.current = searchParams.get('batchId');
    setSearchParamsRef.current = setSearchParams;
    serviceDateRef.current = serviceDate;
    hasUserSwitchedScopeRef.current = hasUserSwitchedScope;
    activeReportTabRef.current = activeReportTab;
    auditSubTabRef.current = auditSubTab;
    userIdRef.current = user?.userId;
    operationalModeRef.current = operationalMode;
  }, [batchId, serviceDate, customerCode, searchParams, setSearchParams, hasUserSwitchedScope, activeReportTab, auditSubTab, user?.userId, operationalMode]);

  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [lineStatusState, setLineStatusState] = useState<{ batchId: string; filter: LineStatusFilter }>({
    batchId,
    filter: 'ALL',
  });
  const lineStatusFilter: LineStatusFilter = lineStatusState.batchId === batchId ? lineStatusState.filter : 'ALL';
  const setLineStatusFilter = useCallback(
    (filter: LineStatusFilter) => setLineStatusState({ batchId, filter }),
    [batchId]
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [syncedUrlCustomer, setSyncedUrlCustomer] = useState(urlCustomerParam);
  if (urlCustomerParam !== syncedUrlCustomer && customers.length > 0) {
    setSyncedUrlCustomer(urlCustomerParam);
    if (urlCustomerParam) {
      const matched = customers.find((c) => c.customerCode === urlCustomerParam || c.customerId === urlCustomerParam);
      if (matched && matched.customerCode !== customerCode) {
        setCustomerCode(matched.customerCode);
        setHasBatchesLoaded(false);
        setIsLoading(true);
      }
    }
  }

  const reports = useReconciliationReports({
    activeReportTab,
    batchId,
    auditSubTab,
    isCatalogTransitioning: !hasBatchesLoaded || catalogLoading || Boolean(catalogError) || (activeReportTab === 'lines' && isLoading),
  });

  const needsReviewCount = useMemo(
    () => (data?.lines ?? []).filter((l) => (l.issuedRequiredDifference ?? 0) > 0 && !l.disposition).length,
    [data]
  );

  const loadData = useCallback(async (id = batchId, date = serviceDate) => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    const key = `mrx_recon_${id}_${date}`;
    const cached = serverStateCache.get<ReconciliationBatchSummary>(key);
    if (cached || data) setIsFetching(true); else setIsLoading(true);
    setError(null);
    try {
      const summary = await mrxApi.getBatchSummary(id, date);
      if (id !== batchIdRef.current || date !== serviceDateRef.current) return;
      setData(summary);
      setLoadedScope(key);
      serverStateCache.set(key, summary);
      serverStateCache.set('snapshot:mrx_reconciliation', { customerCode, batchId: id, serviceDate: date, data: summary });
      if (summary.weekStartDate && (weekStartFor(date) !== summary.weekStartDate || !isServiceDate(date))) {
        const snappedKey = `mrx_recon_${id}_${summary.weekStartDate}`;
        setLoadedScope(snappedKey);
        serverStateCache.set(snappedKey, summary);
        setServiceDate(summary.weekStartDate);
        workspaceSessionStore.setScope({ batchId: id, serviceDate: summary.weekStartDate, weekStartDate: summary.weekStartDate });
      }
    } catch (cause: unknown) {
      if (id === batchIdRef.current && date === serviceDateRef.current) {
        setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
      }
    } finally {
      if (id === batchIdRef.current && date === serviceDateRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [batchId, customerCode, data, serviceDate, setServiceDate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      serverStateCache.delete(`mrx_raw_batch_${batchId}`);
      serverStateCache.delete(`mrx_recon_${batchId}_${serviceDate}`);
      serverStateCache.delete('snapshot:mrx_reconciliation');
      serverStateCache.deletePrefix('mrx_report_');
      serverStateCache.invalidate('mrx_');
      if (catalogError) retryCatalog();
      else if (activeReportTab === 'lines') await loadData();
      else await reports.reloadReport();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((list) => {
      if (ignore) return;
      setCustomers(list);
      serverStateCache.set('catalog_customers', list);
      const currentKey = customerCodeRef.current;
      const matched = list.find((item) => item.customerCode === currentKey || item.customerId === currentKey);
      const resolvedCode = matched?.customerCode || currentKey || list[0]?.customerCode || '';
      setCustomerCode(resolvedCode);
      const c = matched ?? list.find((item) => item.customerCode === resolvedCode);
      if (c) workspaceSessionStore.setScope({ customerCode: resolvedCode, customerId: c.customerId, customerName: c.customerName });
    }).catch((cause: unknown) => {
      if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const customerId = customers.find((c) => c.customerCode === customerCode)?.customerId;
    if (!customerId) return;
    const bKey = `mrx_recon_month_batches_${customerId}_${selectedMonth}`;
    let ignore = false;
    mrxApi.getBatchPage({ customerId, ...businessMonthRange(selectedMonth), pageSize: 5, pageNumber: 1 })
      .then(async (page) => {
        if (ignore) return;
        const sortedItems = page.items;
        serverStateCache.set(bKey, sortedItems);
        const currentBatchId = batchIdRef.current;
        const isBatchInPage = sortedItems.some((b) => b.batchId === currentBatchId);
        if (isBatchInPage) {
          setBatches(sortedItems);
          setCatalogState({ key: catalogKey, page, error: null });
          setHasBatchesLoaded(true);
          if (activeReportTabRef.current !== 'lines') {
            setIsLoading(false);
            setIsFetching(false);
          }
          const currentBatch = sortedItems.find((b) => b.batchId === currentBatchId);
          if (currentBatch && currentBatch.weekStartDate && (weekStartFor(serviceDateRef.current) !== currentBatch.weekStartDate || !isServiceDate(serviceDateRef.current))) {
            setServiceDate(currentBatch.weekStartDate);
            workspaceSessionStore.setScope({ serviceDate: currentBatch.weekStartDate, weekStartDate: currentBatch.weekStartDate, batchId: currentBatch.batchId });
          }
          return;
        }
        // An explicit batch link owns scope; a remembered customer's page cannot replace it.
        if (currentBatchId && (explicitBatchIdRef.current === currentBatchId || workspaceSessionStore.getScope().batchId === currentBatchId)) {
          setBatches(sortedItems);
          setCatalogState({ key: catalogKey, page, error: null });
          setHasBatchesLoaded(true);
          if (activeReportTabRef.current !== 'lines') {
            setIsLoading(false);
            setIsFetching(false);
          }
          return;
        }
        const selectedBatch = sortedItems[0];
        const matchedByWeek = selectedBatch?.weekStartDate === weekStartFor(serviceDateRef.current);
        const selected = selectedBatch?.batchId || '';
        const nextServiceDate = selectedBatch?.weekStartDate
          ? (matchedByWeek && isServiceDate(serviceDateRef.current)
              ? serviceDateRef.current
              : selectedBatch.weekStartDate)
          : serviceDateRef.current;
        let prefetchedSummary: ReconciliationBatchSummary | null = null;
        let prefetchedError: Error | null = null;
        if (selected && hasUserSwitchedScopeRef.current && activeReportTabRef.current === 'lines') {
          try {
            prefetchedSummary = await mrxApi.getBatchSummary(selected, nextServiceDate);
          } catch (err: unknown) {
            prefetchedError = err instanceof Error ? err : new Error('Không thể tải lô đối soát nguyên liệu.');
          }
          if (ignore) return;
        } else if (
          selected &&
          hasUserSwitchedScopeRef.current &&
          (activeReportTabRef.current === 'variances' ||
            activeReportTabRef.current === 'transactions' ||
            activeReportTabRef.current === 'audit')
        ) {
          const reportTab = activeReportTabRef.current;
          const subTab = reportTab === 'audit' ? auditSubTabRef.current : '';
          const { reportScope } = reconciliationReportScope(`mrx_report_${userIdRef.current}_${operationalModeRef.current}_`, reportTab, selected, subTab);
          const reportCacheKey = `${reportScope}_1`;
          if (!serverStateCache.get(reportCacheKey)?.data) {
            try {
              if (reportTab === 'variances') {
                serverStateCache.set(reportCacheKey, { variancesReport: await mrxApi.getVarianceRegister(selected) });
              } else if (reportTab === 'transactions') {
                serverStateCache.set(reportCacheKey, {
                  transactionsReport: await mrxApi.getTransactionsHistory({ batchId: selected, pageNumber: 1, pageSize: 25 }),
                });
              } else if (subTab === 'source') {
                serverStateCache.set(reportCacheKey, { sourceReport: await mrxApi.getSourceChangesPage(selected, 1, 50, '') });
              } else {
                serverStateCache.set(reportCacheKey, { auditReport: await mrxApi.getAuditTrail(selected, 1, 50) });
              }
            } catch {
              // Let useReconciliationReports surface report fetch errors
            }
          }
          if (ignore) return;
        }
        setBatches(sortedItems);
        setCatalogState({ key: catalogKey, page, error: null });
        setHasBatchesLoaded(true);
        setBatchId(selected);
        if (!selected) {
          setData(null);
          setIsLoading(false);
          workspaceSessionStore.setScope({ batchId: '' });
        } else {
          let effectiveDate = nextServiceDate;
          if (prefetchedSummary) {
            const nextKey = `mrx_recon_${selected}_${nextServiceDate}`;
            if (prefetchedSummary.weekStartDate && (weekStartFor(nextServiceDate) !== prefetchedSummary.weekStartDate || !isServiceDate(nextServiceDate))) {
              effectiveDate = prefetchedSummary.weekStartDate;
            }
            const effectiveKey = `mrx_recon_${selected}_${effectiveDate}`;
            prefetchedKeyRef.current = effectiveKey;
            setData(prefetchedSummary);
            setLoadedScope(effectiveKey);
            setError(null);
            setIsLoading(false);
            setIsFetching(false);
            serverStateCache.set(nextKey, prefetchedSummary);
            serverStateCache.set(effectiveKey, prefetchedSummary);
            serverStateCache.set('snapshot:mrx_reconciliation', { customerCode: prefetchedSummary.customerCode || customerCodeRef.current, batchId: selected, serviceDate: effectiveDate, data: prefetchedSummary });
          } else if (prefetchedError) {
            prefetchedKeyRef.current = `mrx_recon_${selected}_${nextServiceDate}`;
            setError(prefetchedError);
            setIsLoading(false);
            setIsFetching(false);
          } else if (activeReportTabRef.current !== 'lines') {
            setIsLoading(false);
            setIsFetching(false);
          }
          if (selectedBatch?.weekStartDate) {
            setSelectedWeek(selectedBatch.weekStartDate);
            setServiceDate(effectiveDate);
            workspaceSessionStore.setScope({
              batchId: selected,
              serviceDate: effectiveDate,
              weekStartDate: selectedBatch.weekStartDate,
            });
          }
        }
        setSearchParamsRef.current((curr) => {
          const next = new URLSearchParams(curr);
          next.set('month', selectedMonth);
          if (selected) {
            next.set('batchId', selected);
            const selectedWeek = selectedBatch?.weekStartDate;
            if (selectedWeek && weekStartFor(serviceDateRef.current) !== selectedWeek) next.set('date', selectedWeek);
          } else next.delete('batchId');
          return next;
        }, { replace: true });
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setHasBatchesLoaded(true);
          const failure = cause instanceof Error ? cause : new Error('Không thể tải danh sách lô đối soát.');
          setCatalogState({ key: catalogKey, page: null, error: failure });
          setIsLoading(false);
        }
      });
    return () => { ignore = true; };
  }, [customerCode, customers, setBatchId, setServiceDate, selectedMonth, catalogKey, catalogRetry]);

  const needsLinkedMetadata = activeReportTab !== 'lines' && Boolean(linkedBatchId && resolvedLink !== batchId &&
    hasBatchesLoaded && !catalogLoading && !catalogError && !batches.some(item => item.batchId === batchId));
  const lastValidatedBatchRef = useRef('');
  useEffect(() => {
    if (!batchId) return;
    if (activeReportTab !== 'lines' && !needsLinkedMetadata) return;
    const key = `mrx_recon_${batchId}_${serviceDate}`;
    if (prefetchedKeyRef.current === key) {
      prefetchedKeyRef.current = '';
      return;
    }
    let ignore = false;
    const needsFreshBatch = lastValidatedBatchRef.current !== batchId;
    lastValidatedBatchRef.current = batchId;
    if (needsFreshBatch) setIsFetching(true);
    mrxApi.getBatchSummary(batchId, serviceDate, needsFreshBatch)
      .then((result) => {
        if (!ignore) {
          setResolvedLink(batchId);
          const resolvedDate = result.weekStartDate && (weekStartFor(serviceDate) !== result.weekStartDate || !isServiceDate(serviceDate)) ? result.weekStartDate : serviceDate;
          const resolvedKey = `mrx_recon_${batchId}_${resolvedDate}`;
          setData(result);
          setLoadedScope(resolvedKey);
          setError(null);
          if (result.batchId === batchId && result.customerCode) {
            customerCodeRef.current = result.customerCode;
            setCustomerCode(result.customerCode);
          }
          if (result.weekStartDate) setSelectedWeek(result.weekStartDate);
          if (resolvedDate !== serviceDate || result.weekStartDate) {
            setServiceDate(resolvedDate);
            setSearchParamsRef.current(curr => {
              const next = new URLSearchParams(curr);
              next.set('batchId', batchId);
              next.set('date', resolvedDate);
              if (result.weekStartDate) next.set('month', result.weekStartDate.slice(0, 7));
              return next;
            }, { replace: true });
          }
          workspaceSessionStore.setScope({ batchId, serviceDate: resolvedDate, weekStartDate: result.weekStartDate || weekStartFor(resolvedDate) });
          serverStateCache.set(resolvedKey, result);
          serverStateCache.set('snapshot:mrx_reconciliation', { customerCode: result.customerCode || customerCodeRef.current, batchId, serviceDate: resolvedDate, data: result });
        }
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
          setIsFetching(false);
        }
      });
    return () => { ignore = true; };
  }, [batchId, serviceDate, setServiceDate, activeReportTab, needsLinkedMetadata]);

  const canComplete = !catalogLoading && !catalogError && !isFetching && !isPreviousData && data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';

  const handleComplete = async () => {
    if (!data || !canComplete) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const completed = await mrxApi.completeBatch(data.batchId, data.version);
      invalidateMrxCaches();
      const summary = mapBatchDtoToSummary(completed, serviceDate);
      setData(summary);
      setBatches((current) => {
        const next = current.map((item) =>
          item.batchId === completed.batchId
            ? { ...item, status: completed.status, version: completed.version }
            : item
        );
        const customerId = customers.find((c) => c.customerCode === customerCode)?.customerId || completed.customerId;
        if (customerId) {
          serverStateCache.set(`mrx_recon_month_batches_${customerId}_${selectedMonth}`, next);
        }
        return next;
      });
      serverStateCache.set(`mrx_raw_batch_${completed.batchId}`, completed);
      serverStateCache.set(`mrx_recon_${completed.batchId}_${serviceDate}`, summary);
      serverStateCache.set('snapshot:mrx_reconciliation', { customerCode, batchId: completed.batchId, serviceDate, data: summary });
      setMutationError(null);
      setIsCompleteOpen(false);
    } catch (cause: unknown) {
      setMutationError(cause instanceof Error ? cause : new Error('Không thể hoàn tất lô đối soát.'));
      setIsCompleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scopeError = error ?? catalogError;
  const isForbidden = scopeError instanceof ApiError && scopeError.status === 403;
  const isModeConflict = scopeError instanceof ApiError && scopeError.status === 409 && (scopeError.message.includes('chế độ') || scopeError.message.includes('Đối chiếu') || scopeError.message.includes('MRX') || scopeError.message.includes('DEFAULT'));
  const isConflict = scopeError instanceof ApiError && scopeError.status === 409 && !isModeConflict;
  const displayedError = isForbidden || isConflict || isModeConflict ? null : scopeError;

  const clearExplicitBatchId = useCallback(() => { explicitBatchIdRef.current = null; }, []);
  const { handleSelectCustomer, handleSelectBatch, handleSelectMonth, handleSelectDate } = useReconciliationScopeActions({
    customers, customerCode, selectedMonth, selectedWeek, serviceDate, batchId, activeReportTab,
    catalogLoading, catalogError, clearExplicitBatchId, setHasUserSwitchedScope, setError,
    setLineStatusFilter, setCustomerCode, setBatches, setHasBatchesLoaded, setIsLoading,
    setIsFetching, setBatchId, setServiceDate, setData, setLoadedScope, setSearchParams,
    setSelectedWeek, setSelectedMonth,
  });

  return {
    isAdmin,
    customerCode,
    customers,
    batches,
    selectedWeek,
    selectedMonth,
    handleSelectMonth,
    catalogInfo: catalogCurrent?.page,
    catalogLoading,
    catalogError,
    retryCatalog,
    batchId,
    serviceDate,
    data,
    isPreviousData,
    isLoading: isLoading || Boolean(batchId && !data && !error),
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
  };
}
