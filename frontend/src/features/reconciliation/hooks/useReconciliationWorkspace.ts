import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../store/useAuth';
import { serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import {
  mrxApi,
  mapBatchDtoToSummary,
  type MrxBatchSummary,
  type MrxBatchPage,
  type ReconciliationBatchSummary,
} from '../../../api/mrxApi';
import { isServiceDate, todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';
import { weeklyMenuApi } from '../../../api/weeklyMenuApi';
import { ApiError } from '../../../api/client';
import type { CustomerOption } from '../../../types';
import type { LineStatusFilter } from '../ReconciliationLinesFilterToolbar';
import { useReconciliationReports } from '../useReconciliationReports';

interface ReconSnapshot {
  customerCode: string;
  batchId: string;
  serviceDate: string;
  data: ReconciliationBatchSummary | null;
}

export function useReconciliationWorkspace(auditSubTab: 'warehouse' | 'source' = 'warehouse') {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const sessionScope = workspaceSessionStore.getScope();
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const snapshot = serverStateCache.get<ReconSnapshot>('snapshot:reconciliation')?.data;

  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const urlCustomerParam = searchParams.get('customerId');
  const matchedInitialCustomer = urlCustomerParam
    ? (cachedCustomers ?? []).find((c) => c.customerCode === urlCustomerParam || c.customerId === urlCustomerParam)
    : undefined;
  const initialCode = matchedInitialCustomer?.customerCode || urlCustomerParam || snapshot?.customerCode || sessionScope.customerCode || cachedCustomers?.[0]?.customerCode || '';
  const [customerCode, setCustomerCode] = useState(() => initialCode);
  const initialCustomerId = (cachedCustomers ?? []).find((c) => c.customerCode === initialCode || c.customerId === initialCode)?.customerId;
  const cachedBatches = initialCustomerId ? serverStateCache.get<MrxBatchSummary[]>(`mrx_batches_${initialCustomerId}`)?.data : null;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const [catalogPageState, setCatalogPageState] = useState({ customerCode: initialCode, page: 1 });
  const catalogPage = catalogPageState.customerCode === customerCode ? catalogPageState.page : 1;
  const catalogKey = JSON.stringify([customerCode, catalogPage]);
  const [catalogState, setCatalogState] = useState<{ key: string; page: MrxBatchPage | null; error: Error | null } | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const catalogCurrent = catalogState?.key === catalogKey ? catalogState : null;
  const catalogError = catalogCurrent?.error;
  const catalogLoading = !catalogCurrent;

  const initialBatchId = searchParams.get('batchId') || snapshot?.batchId || sessionScope.batchId || '';
  const rawInitialDate = searchParams.get('date') || snapshot?.serviceDate || sessionScope.serviceDate || todayInBusinessTimezone();
  const initialDate = !searchParams.get('date') && !isServiceDate(rawInitialDate) ? weekStartFor(rawInitialDate) : rawInitialDate;
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
  useEffect(() => {
    batchIdRef.current = batchId;
    customerCodeRef.current = customerCode;
    explicitBatchIdRef.current = searchParams.get('batchId');
    setSearchParamsRef.current = setSearchParams;
    serviceDateRef.current = serviceDate;
  }, [batchId, serviceDate, customerCode, searchParams, setSearchParams]);

  const reconCacheKey = `mrx_recon_${batchId}_${serviceDate}`;
  const initialReconCache = batchId
    ? (snapshot?.batchId === batchId && snapshot.serviceDate === serviceDate ? snapshot.data : serverStateCache.get<ReconciliationBatchSummary>(reconCacheKey)?.data)
    : null;

  const [storedData, setData] = useState<ReconciliationBatchSummary | null>(() => initialReconCache || null);
  const [loadedScope, setLoadedScope] = useState(() => initialReconCache ? reconCacheKey : '');
  const data = storedData?.batchId === batchId ? storedData : null;
  const isPreviousData = Boolean(data && loadedScope !== reconCacheKey);
  const hasHydratedData = Boolean(data);
  const [hasBatchesLoaded, setHasBatchesLoaded] = useState(() => Boolean(initialReconCache));
  const isBootstrapping = !hasHydratedData && (!hasBatchesLoaded || (customers.length === 0 && !cachedCustomers));
  const [isLoading, setIsLoading] = useState(() => Boolean(!hasHydratedData));
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const retryCatalog = () => { setError(null); setCatalogState(null); setCatalogRetry(value => value + 1); };
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const viewParam = searchParams.get('view');
  const activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed' =
    viewParam === 'variances' || viewParam === 'transactions' || viewParam === 'audit' || viewParam === 'completed'
      ? viewParam
      : 'lines';

  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [lineStatusFilter, setLineStatusFilter] = useState<LineStatusFilter>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reports = useReconciliationReports({
    activeReportTab,
    batchId,
    auditSubTab,
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
      serverStateCache.set('snapshot:reconciliation', { customerCode, batchId: id, serviceDate: date, data: summary });
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
    const bKey = `mrx_batches_${customerId}${catalogPage > 1 ? `_page_${catalogPage}` : ''}`;
    let ignore = false;
    mrxApi.getBatchPage({ customerId, pageSize: 100, pageNumber: catalogPage })
      .then((page) => {
        if (ignore) return;
        const sortedItems = [...(page?.items ?? [])].sort(
          (a, b) => new Date(b.weekStartDate || 0).getTime() - new Date(a.weekStartDate || 0).getTime()
        );
        setBatches(sortedItems);
        setCatalogState({ key: catalogKey, page, error: null });
        setHasBatchesLoaded(true);
        serverStateCache.set(bKey, sortedItems);
        const currentBatchId = batchIdRef.current;
        const isBatchInPage = sortedItems.some((b) => b.batchId === currentBatchId);
        if (isBatchInPage) {
          const currentBatch = sortedItems.find((b) => b.batchId === currentBatchId);
          if (currentBatch && currentBatch.weekStartDate && (weekStartFor(serviceDateRef.current) !== currentBatch.weekStartDate || !isServiceDate(serviceDateRef.current))) {
            setServiceDate(currentBatch.weekStartDate);
            workspaceSessionStore.setScope({ serviceDate: currentBatch.weekStartDate, weekStartDate: currentBatch.weekStartDate, batchId: currentBatch.batchId });
          }
          return;
        }
        // An explicit batch link owns scope; a remembered customer's page cannot replace it.
        if (explicitBatchIdRef.current === currentBatchId && currentBatchId) return;
        const selected = sortedItems[0]?.batchId || '';
        setBatchId(selected);
        if (!selected) {
          setData(null);
          setIsLoading(false);
          workspaceSessionStore.setScope({ batchId: '' });
        } else {
          const selectedBatch = sortedItems[0];
          if (selectedBatch?.weekStartDate) {
            setServiceDate(selectedBatch.weekStartDate);
            workspaceSessionStore.setScope({ batchId: selected, serviceDate: selectedBatch.weekStartDate, weekStartDate: selectedBatch.weekStartDate });
          }
        }
        setSearchParamsRef.current((curr) => {
          const next = new URLSearchParams(curr);
          if (selected) {
            next.set('batchId', selected);
            const selectedWeek = sortedItems[0]?.weekStartDate;
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
  }, [customerCode, customers, setBatchId, setServiceDate, catalogPage, catalogKey, catalogRetry]);

  useEffect(() => {
    if (!batchId) return;
    let ignore = false;
    const key = `mrx_recon_${batchId}_${serviceDate}`;
    mrxApi.getBatchSummary(batchId, serviceDate)
      .then((result) => {
        if (!ignore) {
          setData(result);
          setLoadedScope(key);
          setError(null);
          if (result.customerCode) setCustomerCode(result.customerCode);
          if (result.weekStartDate && (weekStartFor(serviceDateRef.current) !== result.weekStartDate || !isServiceDate(serviceDateRef.current))) {
            const snappedKey = `mrx_recon_${batchId}_${result.weekStartDate}`;
            setLoadedScope(snappedKey);
            serverStateCache.set(snappedKey, result);
            setServiceDate(result.weekStartDate);
            workspaceSessionStore.setScope({ batchId, serviceDate: result.weekStartDate, weekStartDate: result.weekStartDate });
          }
          serverStateCache.set(key, result);
          serverStateCache.set('snapshot:reconciliation', { customerCode: result.customerCode || customerCodeRef.current, batchId, serviceDate, data: result });
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
  }, [batchId, serviceDate, setServiceDate]);

  const canComplete = !isPreviousData && data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';

  const handleComplete = async () => {
    if (!data || !canComplete) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const completed = await mrxApi.completeBatch(data.batchId, data.version);
      setData(mapBatchDtoToSummary(completed, serviceDate));
      setMutationError(null);
      setIsCompleteOpen(false);
    } catch (cause: unknown) {
      setMutationError(cause instanceof Error ? cause : new Error('Không thể hoàn tất lô đối soát.'));
      setIsCompleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isForbidden = error instanceof ApiError && error.status === 403;
  const isModeConflict = error instanceof ApiError && error.status === 409 && (error.message.includes('chế độ') || error.message.includes('Đối chiếu') || error.message.includes('MRX') || error.message.includes('DEFAULT'));
  const isConflict = error instanceof ApiError && error.status === 409 && !isModeConflict;
  const displayedError = isForbidden || isConflict || isModeConflict ? null : error;

  const handleSelectCustomer = (nextCode: string) => {
    const c = customers.find((item) => item.customerCode === nextCode);
    setError(null);
    setHasBatchesLoaded(false);
    setIsLoading(true);
    setBatchId('');
    setCustomerCode(nextCode);
    if (c) {
      workspaceSessionStore.setScope({
        customerCode: nextCode,
        customerId: c.customerId,
        customerName: c.customerName,
        batchId: '',
      });
    }
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.delete('batchId');
      return next;
    }, { replace: true });
  };

  const handleSelectBatch = (nextId: string) => {
    const b = batches.find((item) => item.batchId === nextId);
    const nextDate = b?.weekStartDate || serviceDate;
    const cached = serverStateCache.get<ReconciliationBatchSummary>(`mrx_recon_${nextId}_${nextDate}`)?.data;
    if (!cached) setIsLoading(true);
    setError(null);
    setBatchId(nextId);
    if (b) {
      setServiceDate(b.weekStartDate);
      workspaceSessionStore.setScope({ batchId: nextId, serviceDate: b.weekStartDate, weekStartDate: b.weekStartDate });
    }
    serverStateCache.set('snapshot:reconciliation', { customerCode, batchId: nextId, serviceDate: nextDate, data: cached || null });
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.set('batchId', nextId);
      if (b?.weekStartDate) next.set('date', b.weekStartDate);
      return next;
    }, { replace: true });
  };

  const handleSelectDate = (date: string) => {
    const currentWeek = weekStartFor(serviceDate);
    const nextWeek = weekStartFor(date);
    setError(null);
    if (currentWeek !== nextWeek) {
      setHasBatchesLoaded(false);
      setIsLoading(true);
      setBatchId('');
      workspaceSessionStore.setScope({ batchId: '', serviceDate: date, weekStartDate: nextWeek });
    } else {
      if (batchId) {
        const nextKey = `mrx_recon_${batchId}_${date}`;
        const cached = serverStateCache.get<ReconciliationBatchSummary>(nextKey)?.data;
        if (cached) {
          setData(cached);
          setLoadedScope(nextKey);
        } else {
          setIsFetching(true);
        }
      }
      workspaceSessionStore.setScope({ serviceDate: date });
    }
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.set('date', date);
      if (currentWeek !== nextWeek) next.delete('batchId');
      return next;
    });
    setServiceDate(date);
  };

  return {
    isAdmin,
    customerCode,
    customers,
    batches,
    catalogPage,
    catalogInfo: catalogCurrent?.page,
    catalogLoading,
    catalogError,
    retryCatalog,
    setCatalogPage: (page: number) => { setError(null); setCatalogPageState({ customerCode, page }); },
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
