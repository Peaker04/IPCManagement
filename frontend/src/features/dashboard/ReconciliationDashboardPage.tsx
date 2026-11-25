import { subscribeMrxReads } from '../../api/mrxCacheInvalidation';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { WorkbenchSkeleton } from '../../components/workbench/WorkbenchSkeleton';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { mrxApi, type MrxBatchPage, type MrxBatchSummary, type MrxOperationalSummary } from '../../api/mrxApi';
import { getCachedArray, serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useAuth } from '../../store/useAuth';
import { MRX_STATUS_LABELS } from '../../constants/mrxConstants';
import { toVietnameseDate } from '../../utils/dates';
import { HistoricalScopeFilter } from '../../components/workbench/HistoricalScopeFilter';
import { useHistoricalScope } from '../../hooks/useHistoricalScope';
import type { CustomerOption } from '../../types';

const QUEUE_ACTION_LABELS: Record<string, string> = {
  PENDING_SOURCE_CHANGE: 'Xem yêu cầu đổi nguồn',
  AWAITING_WAREHOUSE: 'Mở phiếu xuất ngày',
  UNRESOLVED_VARIANCE: 'Rà soát chênh lệch',
  COMPLETION_READY: 'Xem lô để chốt sổ',
};

type DashboardData = { summary: MrxOperationalSummary; customers: readonly CustomerOption[]; batches: MrxBatchPage };
type DashboardState = { key: string; data: DashboardData | null; error: Error | null; refreshing: boolean };

export function ReconciliationDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, operationalMode, canNavigate, hasRole } = useAuth();
  const selectedCustomerId = searchParams.get('customerId') || 'ALL';
  const historicalScope = useHistoricalScope();
  const { weekFrom, weekTo } = historicalScope.range;
  const page = Math.max(1, Math.trunc(Number(searchParams.get('page')) || 1));
  const queuePage = Math.max(1, Math.trunc(Number(searchParams.get('queuePage')) || 1));
  const updateFilters = useCallback((nextValues: { customerId?: string; page?: number }) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextValues.customerId !== undefined) {
        if (nextValues.customerId && nextValues.customerId !== 'ALL') next.set('customerId', nextValues.customerId);
        else next.delete('customerId');
        next.delete('page');
        next.delete('queuePage');
      }
      if (nextValues.page !== undefined) {
        if (nextValues.page > 1) next.set('page', String(nextValues.page));
        else next.delete('page');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const filters = useMemo(() => {
    return {
      ...(selectedCustomerId !== 'ALL' ? { customerId: selectedCustomerId } : {}),
      ...(weekFrom ? { weekFrom } : {}),
      ...(weekTo ? { weekTo } : {}),
    };
  }, [selectedCustomerId, weekFrom, weekTo]);
  const actorKey = JSON.stringify([user?.userId, user?.roleCode, user?.roleName, user?.permissions, operationalMode]);
  const scope = `${actorKey}_${JSON.stringify(filters)}`;
  const cacheKey = `mrx_dashboard_${scope}_${page}${queuePage > 1 ? `_queue_${queuePage}` : ''}`;
  const customersKey = `mrx_dashboard_customers_${actorKey}`;
  const cachedEntry = serverStateCache.get<DashboardData>(cacheKey);
  const [state, setState] = useState<DashboardState | null>(() => {
    return cachedEntry && !cachedEntry.isStale
      ? { key: cacheKey, data: cachedEntry.data, error: null, refreshing: false }
      : null;
  });
  if (cachedEntry && !cachedEntry.isStale && state?.key !== cacheKey) {
    setState({ key: cacheKey, data: cachedEntry.data, error: null, refreshing: false });
  }
  const readController = useRef<AbortController | null>(null);
  const lastReadScope = useRef<string | null>(null);
  const current = state?.key === cacheKey ? state : null;
  const exactData = current?.data ?? cachedEntry?.data ?? null;
  const isTransitioning = !exactData && Boolean(state?.data) && !current?.error;
  const workActionsDisabled = isTransitioning || Boolean(current?.error);
  const data = exactData ?? (isTransitioning ? state?.data ?? null : null);
  const customers = data?.customers ?? getCachedArray<CustomerOption>(customersKey) ?? [];

  const refreshing = isTransitioning || (current?.refreshing ?? Boolean(exactData));
  const read = useCallback(async (force: boolean, signal: AbortSignal): Promise<DashboardData> => {
    if (historicalScope.error) throw new Error(historicalScope.error);
    const summaryKey = `mrx_dashboard_summary_${scope}_${queuePage}`;
    const cachedSummary = serverStateCache.get<MrxOperationalSummary>(summaryKey);
    const summaryRequest = !force && cachedSummary && !cachedSummary.isStale
      ? Promise.resolve(cachedSummary.data)
      : mrxApi.getOperationalSummary(queuePage > 1 ? { ...filters, queuePage } : filters, signal).then(summary => {
        signal.throwIfAborted();
        serverStateCache.set(summaryKey, summary);
        return summary;
      });
    const batchKey = `mrx_dashboard_batches_${scope}_${page}`;
    const cachedBatches = serverStateCache.get<MrxBatchPage>(batchKey);
    const [summary, batches] = await Promise.allSettled([
      summaryRequest,
      !force && cachedBatches && !cachedBatches.isStale ? Promise.resolve(cachedBatches.data)
        : mrxApi.getBatchPage({ ...filters, pageNumber: page, pageSize: 20 }, signal).then(batches => {
          signal.throwIfAborted();
          serverStateCache.set(batchKey, batches);
          return batches;
        }),
    ]);
    signal.throwIfAborted();
    if (summary.status === 'rejected') serverStateCache.delete(summaryKey);
    if (batches.status === 'rejected') serverStateCache.delete(batchKey);
    if (summary.status === 'rejected') throw summary.reason;
    if (batches.status === 'rejected') throw batches.reason;
    return { summary: summary.value, customers: summary.value.customerOptions, batches: batches.value };
  }, [filters, page, scope, historicalScope.error, queuePage]);

  const fetchDashboard = useCallback(async (force: boolean, retained: DashboardData | null) => {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    try {
      const result = await read(force, controller.signal);
      if (controller.signal.aborted) return;
      serverStateCache.set(cacheKey, result);
      serverStateCache.set(customersKey, result.customers);
      setState({ key: cacheKey, data: result, error: null, refreshing: false });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState({ key: cacheKey, data: retained, error: cause instanceof Error ? cause : new Error('Không thể tải tổng quan đối soát.'), refreshing: false });
    } finally {
      if (readController.current === controller) readController.current = null;
    }
  }, [cacheKey, customersKey, read]);

  useEffect(() => {
    const revalidateScope = lastReadScope.current !== scope;
    lastReadScope.current = scope;
    void fetchDashboard(revalidateScope, serverStateCache.get<DashboardData>(cacheKey)?.data ?? null);
    return () => readController.current?.abort();
  }, [cacheKey, fetchDashboard, scope]);

  const refresh = useCallback(() => {
    setState({ key: cacheKey, data: exactData, error: null, refreshing: true });
    return fetchDashboard(true, exactData);
  }, [cacheKey, exactData, fetchDashboard]);

  const retry = () => {
    setState({ key: cacheKey, data: exactData, error: null, refreshing: true });
    return fetchDashboard(false, exactData);
  };

  useEffect(() => {
    if (operationalMode !== 'MATERIAL_RECONCILIATION') return;
    return subscribeMrxReads(() => { void refresh(); });
  }, [operationalMode, refresh]);

  const canOpen = useCallback((url: string) => {
    const [pathname, search] = url.split('?');
    return canNavigate(pathname, search ? `?${search}` : '');
  }, [canNavigate]);
  const batchTarget = useCallback((batch: MrxBatchSummary) => {
    const batchId = encodeURIComponent(batch.batchId);
    const reconciliation = { to: '/reconciliation?batchId=' + batchId, label: batch.status === 'COMPLETED' ? 'Xem hồ sơ đã chốt' : 'Rà soát dòng ngày' };
    const warehouse = { to: '/warehouse?view=mrx-daily&batchId=' + batchId, label: batch.status === 'TRANSFERRED' ? 'Mở phiếu xuất ngày' : 'Xem định lượng xuất kho' };
    const kitchen = { to: '/chef?view=mrx-cooking&batchId=' + batchId, label: 'Xem phiếu nấu' };
    const source = { to: '/weekly-menu?view=mrx-batch&customerId=' + encodeURIComponent(batch.customerId) + '&weekStartDate=' + batch.weekStartDate, label: batch.status === 'DRAFT' || batch.status === 'READY' ? 'Mở chuẩn bị lô' : 'Xem nguồn của lô' };
    const targets = batch.status === 'DRAFT' || batch.status === 'READY' ? [source, reconciliation, warehouse, kitchen]
      : batch.status === 'TRANSFERRED' ? [warehouse, reconciliation, kitchen, source] : [reconciliation, warehouse, kitchen, source];
    return targets.find(target => canOpen(target.to));
  }, [canOpen]);
  const batchColumns = useMemo<ColumnDef<MrxBatchSummary>[]>(() => [
    { id: 'batchId', header: 'Mã lô đối soát', width: '20%', minWidth: '150px', cell: (row) => <IdentifierText value={row.batchId} displayValue={row.batchId.length > 12 ? row.batchId.slice(0, 8) : row.batchId} /> },
    { id: 'customer', header: 'Khách hàng', width: '24%', minWidth: '160px', cell: (row) => <span className="block whitespace-normal wrap-anywhere font-semibold text-slate-900">{row.customerCode ? `${row.customerCode} · ` : ''}{row.customerName || 'Chưa xác định khách hàng'}</span> },
    { id: 'week', header: 'Tuần bắt đầu', width: '18%', minWidth: '120px', cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.weekStartDate)}</span> },
    { id: 'status', header: 'Trạng thái', width: '18%', minWidth: '130px', align: 'center', cell: (row) => <Badge variant={row.status === 'COMPLETED' ? 'success' : row.status === 'TRANSFERRED' ? 'info' : 'warning'}>{MRX_STATUS_LABELS[row.status] ?? 'Trạng thái chưa nhận diện'}</Badge> },
    { id: 'action', header: 'Thao tác', width: '20%', minWidth: '140px', align: 'right', cell: (row) => {
      const target = batchTarget(row);
      return target ? <Button variant="outline" size="xs" disabled={workActionsDisabled} onClick={() => {
        workspaceSessionStore.setScope({ customerId: row.customerId, customerCode: row.customerCode, customerName: row.customerName, batchId: row.batchId, weekStartDate: row.weekStartDate });
        navigate(target.to);
      }}>{target.label}<ArrowRight size={12} aria-hidden="true" /></Button> : 'Chỉ xem thông tin';
    } },
  ], [batchTarget, workActionsDisabled, navigate]);
  const queueColumns = useMemo<ColumnDef<MrxOperationalSummary['items'][number]>[]>(() => [
    { id: 'work', header: 'Công việc', width: 'var(--mrx-queue-work-width, 32%)', minWidth: 'var(--mrx-queue-work-width, 150px)', cell: (item) => (
      <span className="block whitespace-normal wrap-anywhere font-medium text-slate-900">{item.title}</span>
    ) },
    { id: 'scope', header: 'Phạm vi', width: 'var(--mrx-queue-scope-width, 26%)', minWidth: '145px', cell: (item) => (
      <span className="block whitespace-normal wrap-anywhere">{item.subtitle}</span>
    ) },
    { id: 'owner', header: 'Phụ trách', width: '18%', minWidth: '105px', cell: (item) => (
      <span>{item.ownerRole === 'WAREHOUSE' ? 'Kho' : 'Quản lý'}{item.actionKind === 'WAITING' ? ' đang xử lý' : ''}</span>
    ) },
    { id: 'action', header: 'Thao tác', width: '24%', minWidth: '170px', align: 'right', cell: (item) => {
      const target = item.targetUrl;
      if (!target || !canOpen(target)) return item.actionKind === 'READ_ONLY' ? 'Chỉ xem lịch sử' : null;
      const label = item.actionKind === 'READ_ONLY' ? 'Xem lịch sử' : QUEUE_ACTION_LABELS[item.queueType] ?? 'Xem hồ sơ';
      return <Button variant="outline" size="xs" disabled={workActionsDisabled} onClick={() => navigate(target)}>{label}</Button>;
    } },
  ], [canOpen, navigate, workActionsDisabled]);
  const metrics = data ? [
    { label: 'Đổi nguồn chờ duyệt', value: data.summary.pendingSourceChangesCount, color: 'text-slate-900' },
    { label: 'Lô chờ Kho xuất', value: data.summary.awaitingWarehouseBatchesCount, color: 'text-amber-700' },
    { label: 'Dòng lệch cần xử lý', value: data.summary.unresolvedVariancesCount, color: 'text-sky-700' },
    { label: 'Lô sẵn sàng chốt', value: data.summary.completionReadyBatchesCount, color: 'text-emerald-700' },
  ].filter((metric) => metric.value != null) : [];
  const canPrepareSource = canOpen('/weekly-menu?view=mrx-batch');
  // shortcut: loading shape mirrors report-role visibility; update with backend report-policy changes.
  const hasDecisionRole = hasRole(['Admin', 'Manager', 'Quản trị', 'Quản lý']);
  const hasIssueRole = hasRole(['WarehouseManager', 'Warehouse Manager', 'WarehouseStaff', 'Warehouse Staff', 'Thủ kho']);
  const pendingMetricCount = hasDecisionRole ? 4 : hasIssueRole || hasRole(['Coordinator', 'Điều phối']) ? 1 : 0;
  const showQueue = Boolean(data && (data.summary.items.length > 0 || (data.summary.queueTotalCount ?? 0) > 0));

  return (
    <WorkspaceFrame.Root className="select-text">
      <WorkspaceHeader responsive className="mrx-dashboard-header [&_h1]:text-lg" title="Bàn điều hành đối soát"
        contextSelectors={<>
          <div className="w-64 max-w-full"><Select aria-label="Lọc theo khách hàng" options={[{ value: 'ALL', label: 'Tất cả khách hàng' }, ...customers.map((customer) => ({ value: customer.customerId, label: `${customer.customerCode} · ${customer.customerName}` }))]} value={selectedCustomerId} onChange={(event) => updateFilters({ customerId: event.target.value })} className="h-9 w-full" /></div>
          <HistoricalScopeFilter />
        </>}
        actions={<WorkspaceHeader.Actions>
          <Button variant="outline" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Làm mới</Button>
          {canPrepareSource && <Button aria-label="Lập lô đối soát mới" onClick={() => navigate(`/weekly-menu?view=mrx-batch&action=import${selectedCustomerId !== 'ALL' ? `&customerId=${encodeURIComponent(selectedCustomerId)}` : ''}`)}>Lập lô mới</Button>}
        </WorkspaceHeader.Actions>} />
      <WorkspaceFrame.Body className="mrx-dashboard-scroll overflow-y-auto p-4 sm:p-5">
        <div className="space-y-3">
          {(pendingMetricCount > 0 || metrics.length > 0) && <StateBoundary scope="widget" isLoading={!data && !current?.error} hasExistingData={Boolean(data)} isPreviousData={isTransitioning} isEmpty={false}
            customSkeleton={<div role="status" aria-label="Đang tải chỉ số điều hành" className="mrx-dashboard-metrics">
              {Array.from({ length: pendingMetricCount }, (_, index) => <div key={index} aria-hidden="true" className="min-w-0 px-3 py-2"><div className="h-4 w-3/4 rounded bg-slate-200" /><div className="mt-1 h-5 w-12 rounded bg-slate-200" /></div>)}
            </div>}
          >
            {metrics.length > 0 && <dl aria-label="Chỉ số điều hành đối soát" className="mrx-dashboard-metrics">
              {metrics.map((metric) => <div key={metric.label} className="min-w-0 px-3 py-2"><dt className="text-xs font-medium text-slate-500">{metric.label}</dt><dd className={`text-lg font-semibold tabular-nums ${metric.color}`}><Num value={metric.value} /></dd></div>)}
            </dl>}
          </StateBoundary>}
          <StateBoundary isLoading={!data && !current?.error} hasExistingData={Boolean(data)} isFetching={refreshing} isPreviousData={isTransitioning} error={current?.error} onRetry={() => void retry()} isEmpty={false}
            customSkeleton={<WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 4, columnWidths: ['20%', '24%', '18%', '18%', '20%'] }} />}
          >
          {data && <div className="space-y-3">
            <section aria-label="Danh sách lô theo bộ lọc" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-base font-semibold text-slate-900">Lô đối soát</h2>
                {isTransitioning && <span role="status" className="text-xs text-slate-600">Đang tải phạm vi mới</span>}
              </div>
              <div className="flex max-h-[min(55dvh,32rem)] flex-col">
                <DataGrid data={data.batches.items} columns={batchColumns} minWidth="min-w-[740px]" scrollLabel="Bảng lô đối soát" keyExtractor={(row) => row.batchId} emptyMessage="Không có lô trong phạm vi đã chọn." />
              </div>
              <PaginationBar label="Phân trang lô đối soát" placement={showQueue ? "toolbar" : "footer"} page={data.batches.pageNumber} pageSize={20}
                totalCount={data.batches.totalCount} totalPages={data.batches.totalPages}
                hasPrev={data.batches.hasPrev} hasNext={data.batches.hasNext} pending={refreshing}
                onPageChange={next => updateFilters({ page: next })} />
            </section>
            {showQueue && <section aria-label="Công việc theo vai trò" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900">Công việc theo vai trò</h2>
              <DataGrid data={data.summary.items} columns={queueColumns} className="mrx-dashboard-queue-grid" minWidth="min-w-[720px]"
                scrollLabel="Bảng công việc theo vai trò" keyExtractor={(item) => `${item.queueType}_${item.workObjectId}`}
                emptyMessage="Không có công việc trên trang này." />
              {(data.summary.queueTotalPages ?? 1) > 1 && <PaginationBar label="Phân trang công việc" page={data.summary.queuePageNumber ?? queuePage}
                pageSize={data.summary.queuePageSize ?? 10} totalCount={data.summary.queueTotalCount ?? data.summary.items.length}
                totalPages={data.summary.queueTotalPages ?? 1} hasPrev={queuePage > 1} hasNext={queuePage < (data.summary.queueTotalPages ?? 1)} pending={refreshing}
                onPageChange={nextPage => setSearchParams(current => { const next = new URLSearchParams(current); next.set('queuePage', String(nextPage)); return next; })} />}
            </section>}
          </div>}
          </StateBoundary>
        </div>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
