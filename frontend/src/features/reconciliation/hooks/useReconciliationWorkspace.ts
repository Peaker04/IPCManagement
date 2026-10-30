import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../store/useAuth';
import { serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import {
  mrxApi,
  mapBatchDtoToSummary,
  type MrxBatchSummary,
  type MrxOperationalSummary,
  type ReconciliationBatchSummary,
} from '../../../api/mrxApi';
import { todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';
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

export function useReconciliationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const sessionScope = workspaceSessionStore.getScope();
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const snapshot = serverStateCache.get<ReconSnapshot>('snapshot:reconciliation')?.data;

  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const initialCode = searchParams.get('customerId') || snapshot?.customerCode || sessionScope.customerCode || cachedCustomers?.[0]?.customerCode || '';
  const [customerCode, setCustomerCode] = useState(() => initialCode);
  const initialCustomerId = (cachedCustomers ?? []).find((c) => c.customerCode === initialCode)?.customerId;
  const cachedBatches = initialCustomerId ? serverStateCache.get<MrxBatchSummary[]>(`mrx_batches_${initialCustomerId}`)?.data : null;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);

  const initialBatchId = searchParams.get('batchId') || snapshot?.batchId || sessionScope.batchId || '';
  const initialDate = searchParams.get('date') || snapshot?.serviceDate || sessionScope.serviceDate || todayInBusinessTimezone();
  const [internalBatchId, setInternalBatchId] = useState(() => initialBatchId);
  const [internalDate, setInternalDate] = useState(() => initialDate);

  const batchId = searchParams.get('batchId') || internalBatchId;
  const serviceDate = searchParams.get('date') || internalDate;

  const setBatchId = useCallback((id: string) => setInternalBatchId(id), []);
  const setServiceDate = useCallback((date: string) => setInternalDate(date), []);

  const batchIdRef = useRef(batchId);
  batchIdRef.current = batchId;
  const serviceDateRef = useRef(serviceDate);
  serviceDateRef.current = serviceDate;

  const reconCacheKey = `mrx_recon_${batchId}_${serviceDate}`;
  const initialReconCache = batchId
    ? (snapshot?.batchId === batchId ? snapshot.data : serverStateCache.get<ReconciliationBatchSummary>(reconCacheKey)?.data)
    : null;

  const [data, setData] = useState<ReconciliationBatchSummary | null>(() => initialReconCache || null);
  const hasHydratedData = Boolean(data);
  const [hasBatchesLoaded, setHasBatchesLoaded] = useState(() => Boolean(initialReconCache));
  const isBootstrapping = !hasHydratedData && (!hasBatchesLoaded || (customers.length === 0 && !cachedCustomers));
  const [isLoading, setIsLoading] = useState(() => Boolean(!hasHydratedData));
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const viewParam = searchParams.get('view');
  const activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed' =
    viewParam === 'variances' || viewParam === 'transactions' || viewParam === 'audit' || viewParam === 'completed'
      ? viewParam
      : 'lines';

  const cachedSummary = serverStateCache.get<MrxOperationalSummary>('mrx_operational_summary')?.data;
  const [operationalSummary, setOperationalSummary] = useState<MrxOperationalSummary | null>(() => cachedSummary ?? null);
  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [lineStatusFilter, setLineStatusFilter] = useState<LineStatusFilter>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reports = useReconciliationReports({
    activeReportTab,
    batchId,
    weekStartDate: weekStartFor(serviceDate),
  });

  const needsReviewCount = useMemo(
    () => (data?.lines ?? []).filter((l) => (l.issuedRequiredDifference ?? 0) !== 0 && !l.disposition).length,
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
      setData(summary);
      serverStateCache.set(key, summary);
      serverStateCache.set('snapshot:reconciliation', { customerCode, batchId: id, serviceDate: date, data: summary });
      if (summary.weekStartDate && weekStartFor(date) !== summary.weekStartDate) {
        setServiceDate(summary.weekStartDate);
        workspaceSessionStore.setScope({ batchId: id, serviceDate: summary.weekStartDate, weekStartDate: summary.weekStartDate });
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải lô đối soát nguyên liệu.'));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [batchId, customerCode, data, serviceDate, setServiceDate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    mrxApi.getOperationalSummary().then((s) => {
      if (!ignore) {
        setOperationalSummary(s);
        serverStateCache.set('mrx_operational_summary', s);
      }
    }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((list) => {
      if (ignore) return;
      setCustomers(list);
      serverStateCache.set('catalog_customers', list);
      const existing = customerCode && list.find((item) => item.customerCode === customerCode);
      if (existing) {
        workspaceSessionStore.setScope({ customerCode: existing.customerCode, customerId: existing.customerId, customerName: existing.customerName });
        return;
      }
      const resolvedCode = customerCode || sessionScope.customerCode || list[0]?.customerCode || '';
      setCustomerCode(resolvedCode);
      const c = list.find((item) => item.customerCode === resolvedCode);
      if (c) workspaceSessionStore.setScope({ customerCode: resolvedCode, customerId: c.customerId, customerName: c.customerName });
    }).catch((cause: unknown) => {
      if (!ignore) setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
    });
    return () => { ignore = true; };
  }, [customerCode, sessionScope.customerCode]);

  useEffect(() => {
    const customerId = customers.find((c) => c.customerCode === customerCode)?.customerId;
    if (!customerId) return;
    const bKey = `mrx_batches_${customerId}`;
    let ignore = false;
    mrxApi.getBatchPage({ customerId, pageSize: 100 })
      .then((page) => {
        if (ignore) return;
        const sortedItems = [...(page?.items ?? [])].sort(
          (a, b) => new Date(b.weekStartDate || 0).getTime() - new Date(a.weekStartDate || 0).getTime()
        );
        setBatches(sortedItems);
        setHasBatchesLoaded(true);
        serverStateCache.set(bKey, sortedItems);
        const currentBatchId = batchIdRef.current;
        const isBatchInPage = sortedItems.some((b) => b.batchId === currentBatchId);
        if (isBatchInPage) {
          const currentBatch = sortedItems.find((b) => b.batchId === currentBatchId);
          if (currentBatch && currentBatch.weekStartDate && weekStartFor(serviceDateRef.current) !== currentBatch.weekStartDate) {
            setServiceDate(currentBatch.weekStartDate);
            workspaceSessionStore.setScope({ serviceDate: currentBatch.weekStartDate, weekStartDate: currentBatch.weekStartDate, batchId: currentBatch.batchId });
          }
          return;
        }
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
        setSearchParams((curr) => { const next = new URLSearchParams(curr); if (selected) next.set('batchId', selected); else next.delete('batchId'); return next; }, { replace: true });
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setHasBatchesLoaded(true);
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách lô đối soát.'));
        }
      });
    return () => { ignore = true; };
  }, [customerCode, customers, setSearchParams, setBatchId, setServiceDate]);

  useEffect(() => {
    if (!batchId) return;
    let ignore = false;
    const key = `mrx_recon_${batchId}_${serviceDate}`;
    const cached = serverStateCache.get<ReconciliationBatchSummary>(key)?.data;
    if (cached && !data) setData(cached);
    mrxApi.getBatchSummary(batchId, serviceDate)
      .then((result) => {
        if (!ignore) {
          setData(result);
          setError(null);
          if (result.customerCode && !customerCode) {
            setCustomerCode(result.customerCode);
          }
          serverStateCache.set(key, result);
          serverStateCache.set('snapshot:reconciliation', { customerCode: result.customerCode || customerCode, batchId, serviceDate, data: result });
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
  }, [batchId, serviceDate, customerCode]);

  const canComplete = data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';

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

  const selectBatch = (b?: MrxBatchSummary) => {
    if (!b) return;
    setBatchId(b.batchId);
    setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('batchId', b.batchId); return next; });
  };

  const handleSelectCustomer = (nextCode: string) => {
    const c = customers.find((item) => item.customerCode === nextCode);
    setError(null);
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
    const cached = serverStateCache.get<ReconciliationBatchSummary>(`mrx_recon_${nextId}_${serviceDate}`)?.data;
    if (!cached) setIsLoading(true);
    setError(null);
    setBatchId(nextId);
    if (b) workspaceSessionStore.setScope({ batchId: nextId, weekStartDate: b.weekStartDate });
    serverStateCache.set('snapshot:reconciliation', { customerCode, batchId: nextId, serviceDate, data: cached || null });
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.set('batchId', nextId);
      return next;
    }, { replace: true });
  };

  const handleSelectDate = (date: string) => {
    const currentWeek = weekStartFor(serviceDate);
    const nextWeek = weekStartFor(date);
    setError(null);
    if (currentWeek !== nextWeek) {
      setBatchId('');
      workspaceSessionStore.setScope({ batchId: '', serviceDate: date, weekStartDate: nextWeek });
      setSearchParams((curr) => {
        const next = new URLSearchParams(curr);
        next.delete('batchId');
        return next;
      });
    } else {
      workspaceSessionStore.setScope({ serviceDate: date });
    }
    setServiceDate(date);
  };

  return {
    isAdmin,
    customerCode,
    customers,
    batches,
    batchId,
    serviceDate,
    data,
    operationalSummary,
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
    selectBatch,
    reports,
  };
}
