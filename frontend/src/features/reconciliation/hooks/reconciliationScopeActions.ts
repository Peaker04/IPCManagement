import type { Dispatch, SetStateAction } from 'react';
import type { useSearchParams } from 'react-router-dom';
import { getCachedArray, serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import type { MrxBatchSummary, ReconciliationBatchSummary } from '../../../api/mrxApi';
import { isServiceDate, weekStartFor } from '../../../utils/dates';
import type { CustomerOption } from '../../../types';
import type { LineStatusFilter } from '../ReconciliationLinesFilterToolbar';

type Setter<T> = Dispatch<SetStateAction<T>>;

interface ScopeActionDeps {
  customers: CustomerOption[];
  customerCode: string;
  selectedMonth: string;
  selectedWeek: string;
  serviceDate: string;
  batchId: string;
  activeReportTab: string;
  catalogLoading: boolean;
  catalogError: Error | null | undefined;
  clearExplicitBatchId: () => void;
  setHasUserSwitchedScope: Setter<boolean>;
  setError: Setter<Error | null>;
  setLineStatusFilter: (filter: LineStatusFilter) => void;
  setCustomerCode: Setter<string>;
  setBatches: Setter<MrxBatchSummary[]>;
  setHasBatchesLoaded: Setter<boolean>;
  setIsLoading: Setter<boolean>;
  setIsFetching: Setter<boolean>;
  setBatchId: (id: string) => void;
  setServiceDate: (date: string) => void;
  setData: Setter<ReconciliationBatchSummary | null>;
  setLoadedScope: Setter<string>;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  setSelectedWeek: Setter<string>;
  setSelectedMonth: Setter<string>;
}

export function useReconciliationScopeActions({
  customers, customerCode, selectedMonth, selectedWeek, serviceDate, batchId, activeReportTab,
  catalogLoading, catalogError, clearExplicitBatchId, setHasUserSwitchedScope, setError,
  setLineStatusFilter, setCustomerCode, setBatches, setHasBatchesLoaded, setIsLoading,
  setIsFetching, setBatchId, setServiceDate, setData, setLoadedScope, setSearchParams,
  setSelectedWeek, setSelectedMonth,
}: ScopeActionDeps) {  const handleSelectCustomer = (nextCode: string) => {
    const c = customers.find((item) => item.customerCode === nextCode);
    clearExplicitBatchId();
    setHasUserSwitchedScope(true);
    setError(null);
    setLineStatusFilter('ALL');
    setCustomerCode(nextCode);
    const warmBatches = c?.customerId
      ? (getCachedArray<MrxBatchSummary>(`mrx_recon_month_batches_${c.customerId}_${selectedMonth}`) ?? null)
      : null;
    const warmTargetBatch = warmBatches?.[0];
    const warmMatchedByWeek = warmTargetBatch?.weekStartDate === weekStartFor(serviceDate);
    const warmBatchId = warmTargetBatch?.batchId || '';
    const warmDate = warmMatchedByWeek && isServiceDate(serviceDate)
      ? serviceDate
      : (warmTargetBatch?.weekStartDate || serviceDate);
    const warmSummaryKey = warmBatchId ? `mrx_recon_${warmBatchId}_${warmDate}` : '';
    const warmFallbackKey = warmBatchId && warmTargetBatch ? `mrx_recon_${warmBatchId}_${warmTargetBatch.weekStartDate}` : '';
    const warmSummary = (warmSummaryKey ? serverStateCache.get<ReconciliationBatchSummary>(warmSummaryKey)?.data : null)
      ?? (warmFallbackKey && warmFallbackKey !== warmSummaryKey ? serverStateCache.get<ReconciliationBatchSummary>(warmFallbackKey)?.data : null);
    const resolvedWarmDate = warmSummary && !serverStateCache.get<ReconciliationBatchSummary>(warmSummaryKey)?.data && warmTargetBatch
      ? warmTargetBatch.weekStartDate
      : warmDate;
    const resolvedWarmKey = warmBatchId ? `mrx_recon_${warmBatchId}_${resolvedWarmDate}` : '';

    if (warmBatches && warmTargetBatch && warmSummary) {
      setBatches(warmBatches);
      setHasBatchesLoaded(true);
      setIsLoading(false);
      setIsFetching(false);
      setBatchId(warmBatchId);
      setServiceDate(resolvedWarmDate);
      setData(warmSummary);
      setLoadedScope(resolvedWarmKey);
      if (c) {
        workspaceSessionStore.setScope({
          customerCode: nextCode,
          customerId: c.customerId,
          customerName: c.customerName,
          batchId: warmBatchId,
          serviceDate: resolvedWarmDate,
          weekStartDate: warmTargetBatch.weekStartDate,
        });
      }
      setSearchParams((curr) => {
        const next = new URLSearchParams(curr);
        if (c?.customerId) next.set('customerId', c.customerId);
        else if (nextCode) next.set('customerId', nextCode);
        next.set('batchId', warmBatchId);
        next.set('date', resolvedWarmDate);
        return next;
      }, { replace: true });
      return;
    }

    setHasBatchesLoaded(false);
    setIsLoading(activeReportTab === 'lines');
    setBatchId('');
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
      if (c?.customerId) next.set('customerId', c.customerId);
      else if (nextCode) next.set('customerId', nextCode);
      next.delete('batchId');
      return next;
    }, { replace: true });
  };

  const handleSelectBatch = (b: MrxBatchSummary) => {
    const nextId = b.batchId;
    const nextDate = b?.weekStartDate || serviceDate;
    const cached = serverStateCache.get<ReconciliationBatchSummary>(`mrx_recon_${nextId}_${nextDate}`)?.data;
    setHasUserSwitchedScope(true);
    if (!cached && activeReportTab === 'lines') setIsLoading(true);
    else if (activeReportTab !== 'lines') {
      setIsLoading(false);
      setIsFetching(false);
    }
    setError(null);
    setLineStatusFilter('ALL');
    setBatchId(nextId);
    if (b) {
      setSelectedWeek(b.weekStartDate);
      setServiceDate(b.weekStartDate);
      workspaceSessionStore.setScope({ batchId: nextId, serviceDate: b.weekStartDate, weekStartDate: b.weekStartDate });
    }
    if (cached) {
      setData(cached);
      setLoadedScope(`mrx_recon_${nextId}_${nextDate}`);
      setIsLoading(false);
      setIsFetching(false);
    }
    serverStateCache.set('snapshot:mrx_reconciliation', { customerCode, batchId: nextId, serviceDate: nextDate, data: cached || null });
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.set('batchId', nextId);
      next.set('month', b.weekStartDate.slice(0, 7));
      if (b?.weekStartDate) next.set('date', b.weekStartDate);
      return next;
    }, { replace: true });
  };

  const handleSelectMonth = (month: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month === selectedMonth) return;
    clearExplicitBatchId();
    setSelectedMonth(month);
    setHasUserSwitchedScope(true);
    setHasBatchesLoaded(false);
    setIsLoading(activeReportTab === 'lines');
    setError(null);
    setBatchId('');
    setServiceDate(`${month}-01`);
    workspaceSessionStore.setScope({ batchId: '', serviceDate: `${month}-01` });
    setSearchParams(curr => {
      const next = new URLSearchParams(curr);
      next.delete('batchId');
      next.set('month', month);
      next.set('date', `${month}-01`);
      return next;
    });
  };

  const handleSelectDate = (date: string) => {
    if (!batchId || !isServiceDate(date) || weekStartFor(date) !== selectedWeek || catalogLoading || catalogError) return;
    setError(null);
    const nextKey = `mrx_recon_${batchId}_${date}`;
    const cached = serverStateCache.get<ReconciliationBatchSummary>(nextKey)?.data;
    if (cached) {
      setData(cached);
      setLoadedScope(nextKey);
    } else {
      setIsFetching(true);
    }
    workspaceSessionStore.setScope({ serviceDate: date });
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      next.set('date', date);
      next.set('month', selectedMonth);
      return next;
    });
    setServiceDate(date);
  };

  return { handleSelectCustomer, handleSelectBatch, handleSelectMonth, handleSelectDate };
}
