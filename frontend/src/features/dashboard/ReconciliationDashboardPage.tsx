import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Layers, Scale, Warehouse, ArrowRight, RefreshCw } from 'lucide-react';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
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

const PIPELINE_STEPS = [
  { step: '01', title: 'Lập lô & Nguồn thực đơn', desc: 'Khóa định mức BOM và chốt số suất tuần', route: '/weekly-menu?view=mrx-batch', icon: CalendarDays, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { step: '02', title: 'Kho xuất định lượng ngày', desc: 'Thực xuất nguyên liệu theo ngày phục vụ', route: '/warehouse?view=mrx-daily', icon: Warehouse, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { step: '03', title: 'Phân rã phiếu nấu Bếp', desc: 'Định lượng đóng băng theo ca cho Bếp trưởng', route: '/chef?view=mrx-cooking', icon: Layers, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { step: '04', title: 'Giám sát đối soát & Quyết toán', desc: 'Rà soát chênh lệch, xử lý và chốt lô', route: '/reconciliation', icon: Scale, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
] as const;

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
  const updateFilters = useCallback((nextValues: { customerId?: string; period?: string; page?: number }) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextValues.customerId !== undefined) {
        if (nextValues.customerId && nextValues.customerId !== 'ALL') next.set('customerId', nextValues.customerId);
        else next.delete('customerId');
        next.delete('page');
        next.delete('queuePage');
      }
      if (nextValues.period !== undefined) {
        if (nextValues.period && nextValues.period !== 'ALL') next.set('period', nextValues.period);
        else next.delete('period');
        next.delete('page');
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
  const requestId = useRef(0);
  const lastReadScope = useRef<string | null>(null);
  const current = state?.key === cacheKey ? state : null;
  const exactData = current?.data ?? cachedEntry?.data ?? null;
  const isTransitioning = !exactData && Boolean(state?.data) && !current?.error;
  const data = exactData ?? (isTransitioning ? state?.data ?? null : null);
  const customers = data?.customers ?? getCachedArray<CustomerOption>(customersKey) ?? [];

  const refreshing = isTransitioning || (current?.refreshing ?? Boolean(exactData));
  const read = useCallback(async (forceSummary = false): Promise<DashboardData> => {
    if (historicalScope.error) throw new Error(historicalScope.error);
    const summaryKey = `mrx_dashboard_summary_${scope}_${queuePage}`;
    const cachedSummary = serverStateCache.get<MrxOperationalSummary>(summaryKey);
    const summaryRequest = !forceSummary && cachedSummary && !cachedSummary.isStale
      ? Promise.resolve(cachedSummary.data)
      : mrxApi.getOperationalSummary(queuePage > 1 ? { ...filters, queuePage } : filters).then(summary => { serverStateCache.set(summaryKey, summary); return summary; });
    const batchKey = `mrx_dashboard_batches_${scope}_${page}`;
    const cachedBatches = serverStateCache.get<MrxBatchPage>(batchKey);
    const [summary, batches] = await Promise.all([
      summaryRequest,
      !forceSummary && cachedBatches && !cachedBatches.isStale ? Promise.resolve(cachedBatches.data)
        : mrxApi.getBatchPage({ ...filters, pageNumber: page, pageSize: 20 }).then(batches => { serverStateCache.set(batchKey, batches); return batches; }),
    ]);
    return { summary, customers: summary.customerOptions, batches };
  }, [filters, page, scope, historicalScope.error, queuePage]);

  useEffect(() => {
    const id = ++requestId.current;
    const revalidateScope = lastReadScope.current !== scope;
    lastReadScope.current = scope;
    read(revalidateScope).then((result) => {
      if (id !== requestId.current) return;
      serverStateCache.set(cacheKey, result);
      serverStateCache.set(customersKey, result.customers);
      setState({ key: cacheKey, data: result, error: null, refreshing: false });
    }).catch((cause: unknown) => {
      if (id !== requestId.current) return;
      setState({ key: cacheKey, data: serverStateCache.get<DashboardData>(cacheKey)?.data ?? null, error: cause instanceof Error ? cause : new Error('Không thể tải tổng quan đối soát.'), refreshing: false });
    });
    return () => { requestId.current += 1; };
  }, [cacheKey, customersKey, read, scope]);

  const refresh = async () => {
    const id = ++requestId.current;
    setState({ key: cacheKey, data, error: null, refreshing: true });
    try {
      const result = await read(true);
      if (id !== requestId.current) return;
      serverStateCache.set(cacheKey, result);
      serverStateCache.set(customersKey, result.customers);
      setState({ key: cacheKey, data: result, error: null, refreshing: false });
    } catch (cause) {
      if (id !== requestId.current) return;
      setState({ key: cacheKey, data, error: cause instanceof Error ? cause : new Error('Không thể tải tổng quan đối soát.'), refreshing: false });
    }
  };

  const canOpen = useCallback((url: string) => {
    const [pathname, search] = url.split('?');
    return canNavigate(pathname, search ? `?${search}` : '');
  }, [canNavigate]);
  const batchTarget = useCallback((batch: MrxBatchSummary) => [
    `/reconciliation?batchId=${encodeURIComponent(batch.batchId)}`,
    `/warehouse?view=mrx-daily&batchId=${encodeURIComponent(batch.batchId)}`,
    `/chef?view=mrx-cooking&batchId=${encodeURIComponent(batch.batchId)}`,
    `/weekly-menu?view=mrx-batch&customerId=${encodeURIComponent(batch.customerId)}&weekStartDate=${batch.weekStartDate}`,
  ].find(canOpen), [canOpen]);
  const batchColumns = useMemo<ColumnDef<MrxBatchSummary>[]>(() => [
    { id: 'batchId', header: 'Mã lô đối soát', width: '20%', minWidth: '150px', cell: (row) => <IdentifierText value={row.batchId} displayValue={row.batchId.length > 12 ? row.batchId.slice(0, 8) : row.batchId} /> },
    { id: 'customer', header: 'Khách hàng', width: '24%', minWidth: '160px', cell: (row) => <span className="font-semibold text-slate-900">{row.customerCode ? `${row.customerCode} · ` : ''}{row.customerName || 'Chưa xác định khách hàng'}</span> },
    { id: 'week', header: 'Tuần bắt đầu', width: '18%', minWidth: '120px', cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.weekStartDate)}</span> },
    { id: 'status', header: 'Trạng thái', width: '18%', minWidth: '130px', align: 'center', cell: (row) => <Badge variant={row.status === 'COMPLETED' ? 'neutral' : row.status === 'TRANSFERRED' ? 'info' : 'warning'}>{MRX_STATUS_LABELS[row.status] ?? 'Trạng thái chưa nhận diện'}</Badge> },
    { id: 'action', header: 'Thao tác', width: '20%', minWidth: '140px', align: 'right', cell: (row) => {
      const target = batchTarget(row);
      return target ? <Button variant="outline" size="xs" onClick={() => {
        workspaceSessionStore.setScope({ customerId: row.customerId, customerCode: row.customerCode, customerName: row.customerName, batchId: row.batchId, weekStartDate: row.weekStartDate });
        navigate(target);
      }}>Mở trạm làm việc<ArrowRight size={12} aria-hidden="true" /></Button> : 'Chỉ xem thông tin';
    } },
  ], [batchTarget, navigate]);
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
  const nextAction = !current?.error && data
    ? data.summary.items.find((item) => item.actionKind === 'OWN_ACTION' && item.targetUrl && canOpen(item.targetUrl)) : undefined;

  const pipeline = <section aria-label="Sơ đồ quy trình đối chiếu 4 bước" className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
    <h2 className="mb-3 text-sm font-semibold text-slate-900">Sơ đồ quy trình đối chiếu 4 bước</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {PIPELINE_STEPS.map((step) => {
        const Icon = step.icon;
        const cardClassName = 'h-auto rounded-lg border border-slate-200 p-3 flex flex-col items-stretch justify-between gap-2 text-left whitespace-normal';
        const content = <>
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-slate-400">BƯỚC {step.step}</span>
            <span className={`size-7 rounded-md border flex items-center justify-center shrink-0 ${step.color}`}><Icon size={14} aria-hidden="true" /></span>
          </span>
          <span>
            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900"><span>{step.title}</span><ArrowRight size={12} aria-hidden="true" className="shrink-0 text-slate-400" /></span>
            <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{step.desc}</span>
          </span>
        </>;
        return canOpen(step.route)
          ? <Button key={step.step} variant="outline" className={`${cardClassName} hover:border-blue-400`} onClick={() => navigate(step.route)}>{content}</Button>
          : <div key={step.step} className={cardClassName}>{content}<span className="text-xs text-slate-500">Chỉ xem quy trình</span></div>;
      })}
    </div>
  </section>;

  return (
    <WorkspaceFrame.Root className="select-text">
      <WorkspaceHeader responsive title="Bàn điều hành đối soát" breadcrumb="Tổng quan MRX · Đài chỉ huy"
        contextSelectors={<>
          <div className="w-64 max-w-full"><Select aria-label="Lọc theo khách hàng" options={[{ value: 'ALL', label: 'Tất cả khách hàng' }, ...customers.map((customer) => ({ value: customer.customerId, label: `${customer.customerCode} · ${customer.customerName}` }))]} value={selectedCustomerId} onChange={(event) => updateFilters({ customerId: event.target.value })} className="h-9 w-full" /></div>
          <HistoricalScopeFilter />
        </>}
        actions={<WorkspaceHeader.Actions>
          <Button variant="outline" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Làm mới</Button>
          {nextAction?.targetUrl && <Button variant={canPrepareSource ? 'outline' : 'default'} disabled={refreshing} onClick={() => navigate(nextAction.targetUrl!)}>Mở việc tiếp theo</Button>}
          {canPrepareSource && <Button aria-label="Lập lô đối soát mới" onClick={() => navigate(`/weekly-menu?view=mrx-batch&action=import${selectedCustomerId !== 'ALL' ? `&customerId=${encodeURIComponent(selectedCustomerId)}` : ''}`)}>Lập lô mới</Button>}
        </WorkspaceHeader.Actions>} />
      <TelemetrySubbar responsive telemetryPills={<span className="text-xs text-slate-600">{isTransitioning ? 'Số lô phạm vi trước (đang tải): ' : 'Tổng số lô theo bộ lọc: '}<Num className="min-w-[4ch]" value={data?.batches.totalCount} /></span>} />
      <WorkspaceFrame.Body className="mrx-dashboard-scroll overflow-y-auto p-4 sm:p-5">
        <div className="space-y-5">
          {(pendingMetricCount > 0 || metrics.length > 0) && <StateBoundary scope="widget" isLoading={!data && !current?.error} hasExistingData={Boolean(data)} isPreviousData={isTransitioning} isEmpty={false}
            customSkeleton={<div role="status" aria-label="Đang tải chỉ số điều hành" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: pendingMetricCount }, (_, index) => <div key={index} aria-hidden="true" className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><div className="h-4 w-3/4 rounded bg-slate-200" /><div className="mt-1 h-8 w-12 rounded bg-slate-200" /></div>)}
            </div>}
          >
            {metrics.length > 0 && <dl aria-label="Chỉ số điều hành đối soát" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"><dt className="text-xs font-medium text-slate-500">{metric.label}</dt><dd className={`mt-1 text-2xl font-bold font-mono tracking-tight tabular-nums ${metric.color}`}><Num value={metric.value} /></dd></div>)}
            </dl>}
          </StateBoundary>}
          {pipeline}
          <StateBoundary isLoading={!data && !current?.error} hasExistingData={Boolean(data)} isFetching={refreshing} isPreviousData={isTransitioning} error={current?.error} onRetry={() => void refresh()} isEmpty={false}
            customSkeleton={<WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 4, columnWidths: ['20%', '24%', '18%', '18%', '20%'] }} />}
          >
          {data && <div className="space-y-5">
            <section aria-label="Danh sách lô theo bộ lọc" className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900">Danh sách lô đối soát theo bộ lọc</h2>
                <span className="text-xs text-slate-500">Tổng theo bộ lọc: <Num value={data.batches.totalCount} /> lô</span>
              </div>
              <div className="min-h-[280px] flex flex-col">
                <DataGrid data={data.batches.items} columns={batchColumns} minWidth="min-w-[900px]" keyExtractor={(row) => row.batchId} emptyMessage="Không có lô trong phạm vi đã chọn." />
              </div>
              <PaginationBar label="Phân trang lô đối soát" page={data.batches.pageNumber} pageSize={20}
                totalCount={data.batches.totalCount} totalPages={data.batches.totalPages}
                hasPrev={data.batches.hasPrev} hasNext={data.batches.hasNext} pending={refreshing}
                onPageChange={next => updateFilters({ page: next })} />
            </section>
            {(data.summary.items.length > 0 || (data.summary.queueTotalCount ?? 0) > 0) && <section aria-label="Công việc theo vai trò" className="space-y-3">
              <p className="text-xs text-slate-600">Tối đa {data.summary.queuePageSize ?? 10} việc mỗi nhóm trên một trang.</p>
              <ul className="divide-y divide-slate-100 border-y border-slate-200">
                {data.summary.items.map((item) => <li key={`${item.queueType}_${item.workObjectId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-600">{item.subtitle} · {item.ownerRole === 'WAREHOUSE' ? 'Kho' : 'Quản lý'}{item.actionKind === 'WAITING' ? ' đang xử lý' : item.actionKind === 'READ_ONLY' ? ' · Chỉ xem lịch sử' : ''}</p></div>
                  {item.targetUrl && canOpen(item.targetUrl) && <Button variant="outline" size="sm" onClick={() => navigate(item.targetUrl!)}>{item.actionKind === 'READ_ONLY' ? 'Xem lịch sử' : 'Mở công việc'}</Button>}
                </li>)}
              </ul>
              <PaginationBar label="Phân trang công việc" placement="toolbar" page={data.summary.queuePageNumber ?? queuePage}
                pageSize={data.summary.queuePageSize ?? 10} totalCount={data.summary.queueTotalCount ?? data.summary.items.length}
                totalPages={data.summary.queueTotalPages ?? 1} hasPrev={queuePage > 1} hasNext={queuePage < (data.summary.queueTotalPages ?? 1)} pending={refreshing}
                onPageChange={nextPage => setSearchParams(current => { const next = new URLSearchParams(current); next.set('queuePage', String(nextPage)); return next; })} />
            </section>}
          </div>}
          </StateBoundary>
        </div>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
