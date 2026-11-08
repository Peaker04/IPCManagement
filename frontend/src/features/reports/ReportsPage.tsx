import { useEffect, useState } from 'react';
import { useScopedQuery } from '../../lib/scopedQuery';
import { useSearchParams } from 'react-router-dom';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { reportsApi, type ReportPage, type DemandReportItem, type PriceVarianceReportItem, type CurrentStockReportItem } from '../../api/reportsApi';
import { formatVietnameseDateTime } from '../../utils/dates';
import { serverStateCache } from '../../store/serverStateCache';
import { useAuth } from '../../store/useAuth';
import type { CustomerOption } from '../../types';

function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

const PAGE_SIZE = 25;

interface ReportsSnapshot {
  activeView: string;
  period: string;
  customerId: string;
  pageNumber: number;
}

export function ReportsPage() {
  const { user, operationalMode } = useAuth();
  const [searchParams] = useSearchParams();
  const snapshot = serverStateCache.get<ReportsSnapshot>('snapshot:reports')?.data;
  const view = searchParams.get('view');
  const activeView = view === 'demand' || view === 'prices' || view === 'stock' ? view : (snapshot?.activeView || 'demand');
  const [period, setPeriod] = useState(() => snapshot?.period || currentPeriod());
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const [isCustomersLoading, setIsCustomersLoading] = useState(cachedCustomers === undefined);
  const [customerRetry, setCustomerRetry] = useState(0);
  const [customerId, setCustomerId] = useState(() => snapshot?.customerId || cachedCustomers?.[0]?.customerId || '');
  const reportScope = `${activeView}|${activeView === 'stock' ? '' : period}|${activeView === 'demand' ? customerId : ''}`;
  const [pagination, setPagination] = useState(() => ({
    scope: reportScope,
    page: snapshot?.activeView === activeView ? snapshot.pageNumber || 1 : 1,
  }));
  const pageNumber = pagination.scope === reportScope ? pagination.page : 1;
  const setPageNumber = (next: number | ((page: number) => number)) => {
    setPagination((current) => {
      const currentPage = current.scope === reportScope ? current.page : 1;
      return {
        scope: reportScope,
        page: typeof next === 'function' ? next(currentPage) : next,
      };
    });
  };
  const [customerError, setCustomerError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((items) => {
      if (ignore) return;
      setCustomers(items);
      setCustomerError(null);
      serverStateCache.set('catalog_customers', items);
      setCustomerId((curr) => curr || items[0]?.customerId || "");
    }).catch((cause: unknown) => {
      if (!ignore && activeView === "demand") {
        setCustomerError(cause instanceof Error ? cause : new Error("Không thể tải danh sách khách hàng."));
      }
    }).finally(() => { if (!ignore) setIsCustomersLoading(false); });
    return () => { ignore = true; };
  }, [activeView, customerRetry]);

  const reportQuery = useScopedQuery<ReportPage<unknown>>({
    queryKey: ["reports", reportScope, pageNumber],
    queryFn: () => activeView === "demand"
      ? reportsApi.getDemand(period, customerId, pageNumber, PAGE_SIZE)
      : activeView === "prices"
        ? reportsApi.getPriceVariance(period, pageNumber, PAGE_SIZE)
        : reportsApi.getCurrentStock(undefined, pageNumber, PAGE_SIZE),
    enabled: activeView !== "demand" || Boolean(customerId),
    keepPreviousData: true,
    mode: operationalMode,
    userRole: user?.roleCode,
    scopeKey: `${user?.userId}|${reportScope}`,
  });

  const pageInfo = reportQuery.data;
  const demand = activeView === "demand" ? (reportQuery.data?.items as DemandReportItem[] ?? []) : [];
  const prices = activeView === "prices" ? (reportQuery.data?.items as PriceVarianceReportItem[] ?? []) : [];
  const stocks = activeView === "stock" ? (reportQuery.data?.items as CurrentStockReportItem[] ?? []) : [];
  const hasData = Boolean(reportQuery.data);
  const isLoading = (activeView === 'demand' && isCustomersLoading && !customerId) || (reportQuery.isInitialLoading && !hasData);
  const error = customerError || reportQuery.error;

  useEffect(() => {
    if (reportQuery.data) {
      serverStateCache.set('snapshot:reports', { activeView, period, customerId, pageNumber });
    }
  }, [reportQuery.data, activeView, period, customerId, pageNumber]);
  const reload = () => {
    if (customerError) {
      setCustomerError(null);
      setIsCustomersLoading(true);
      setCustomerRetry((retry) => retry + 1);
      return;
    }
    return reportQuery.refetch();
  };

    const demandColumns: ColumnDef<DemandReportItem>[] = [
    { id: 'ingredient', header: 'Nguyên liệu', width: '28%', cell: (r) => <span className="font-semibold">{r.ingredientName}</span> },
    { id: 'required', header: 'Tổng nhu cầu', width: '16%', align: 'right', cell: (r) => <Num value={r.totalRequiredQty} format="quantity" suffix={` ${r.unitName}`} /> },
    { id: 'stock', header: 'Tồn hiện tại', width: '16%', align: 'right', cell: (r) => <Num value={r.currentStockQty} format="quantity" suffix={` ${r.unitName}`} /> },
    { id: 'purchase', header: 'Đề xuất mua', width: '16%', align: 'right', cell: (r) => <Num value={r.suggestedPurchaseQty} format="quantity" suffix={` ${r.unitName}`} /> },
    { id: 'issued', header: 'Đã xuất Bếp', width: '14%', align: 'right', cell: (r) => <Num value={r.issuedQty} format="quantity" suffix={` ${r.unitName}`} /> },
    { id: 'status', header: 'Trạng thái', width: '14%', align: 'center', cell: (r) => <Badge variant="neutral" size="sm">{r.fulfillmentStatus}</Badge> },
  ];
  const priceColumns: ColumnDef<PriceVarianceReportItem>[] = [
    { id: 'code', header: 'Phiếu nhập', width: '18%', cell: (r) => <IdentifierText value={r.receiptCode} /> },
    { id: 'ingredient', header: 'Nguyên liệu', width: '26%', cell: (r) => <span className="font-semibold">{r.ingredientName}</span> },
    { id: 'supplier', header: 'Nhà cung cấp', width: '22%', cell: (r) => <span>{r.supplierName || '—'}</span> },
    { id: 'reference', header: 'Giá tham chiếu', width: '15%', align: 'right', cell: (r) => <Num value={r.referencePrice} format="currency" /> },
    { id: 'actual', header: 'Giá nhập', width: '15%', align: 'right', cell: (r) => <Num value={r.unitPrice} format="currency" /> },
    { id: 'variance', header: 'Biến động', width: '12%', align: 'center', cell: (r) => <Badge variant={r.isWarning ? 'danger' : 'neutral'} size="sm">{r.variancePercent}%</Badge> },
  ];
  const stockColumns: ColumnDef<CurrentStockReportItem>[] = [
    { id: 'warehouse', header: 'Kho', width: '26%', cell: (r) => <span>{r.warehouseName}</span> },
    { id: 'ingredient', header: 'Nguyên liệu', width: '34%', cell: (r) => <span className="font-semibold">{r.ingredientName}</span> },
    { id: 'quantity', header: 'Tồn hiện tại', width: '22%', align: 'right', cell: (r) => <Num value={r.currentQty} format="quantity" suffix={` ${r.unitName}`} /> },
    { id: 'updated', header: 'Cập nhật', width: '18%', cell: (r) => <span className="font-mono text-xs">{formatVietnameseDateTime(r.lastUpdated)}</span> },
  ];
  const rows = activeView === 'demand' ? demand : activeView === 'prices' ? prices : stocks;

  return <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
    <WorkspaceHeader
      title="Báo cáo vận hành"
      breadcrumb="Báo cáo · Thống kê vận hành"
      contextSelectors={<>
        {activeView !== 'stock' && <Input type="month" value={period} onChange={(e) => { setPageNumber(1); setPeriod(e.target.value); }} className="h-9 w-40 text-sm font-mono" aria-label="Kỳ báo cáo" />}
        {activeView === 'demand' && <Select aria-label="Chọn khách hàng báo cáo" options={customers.map((c) => ({ value: c.customerId, label: `${c.customerCode} - ${c.customerName}` }))} value={customerId} onChange={(e) => { setPageNumber(1); setCustomerId(e.target.value); }} disabled={!customers.length} className="h-9 w-60" />}
      </>}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="default" onClick={reload} className="h-9 text-sm font-medium">
            Làm mới
          </Button>
          <Button variant="outline" size="default" onClick={() => window.print()} className="h-9 text-sm font-medium">
            In báo cáo
          </Button>
        </div>
      }
    />
    <TelemetrySubbar leftControls={<span className="text-xs font-semibold">{activeView === 'demand' ? 'Nhu cầu nguyên liệu' : activeView === 'prices' ? 'Biến động giá nhập' : 'Tồn kho hiện tại'}</span>} telemetryPills={<span className="text-slate-500"><Num value={pageInfo?.totalCount} /> dòng số liệu</span>} />
    <StateBoundary
      isLoading={isLoading}
      isFetching={reportQuery.isFetching}
      isPreviousData={reportQuery.isPreviousData && !error}
      loadingGeometry={{ kind: "matrix", columns: 6, rows: 8 }}
      hasExistingData={hasData}
      error={error}
      onRetry={reload}
      isEmpty={!isLoading && !reportQuery.isFetching && !error && rows.length === 0}
      emptyScenario={period !== currentPeriod() ? "filter-empty" : "prerequisite-blocked"}
      onResetFilters={() => setPeriod(currentPeriod())}
      contextDomain="reports"
      emptyTitle="Chưa có dữ liệu báo cáo"
      emptyDescription="Chưa có dữ liệu báo cáo cho phạm vi đã chọn."
    >
      {activeView === 'demand' && <DataGrid data={demand} columns={demandColumns} keyExtractor={(r) => `${r.requestDate}-${r.ingredientId}-${r.unitId}`} />}
      {activeView === 'prices' && <DataGrid data={prices} columns={priceColumns} keyExtractor={(r) => r.receiptLineId} />}
      {activeView === 'stock' && <DataGrid data={stocks} columns={stockColumns} keyExtractor={(r) => `${r.warehouseId}-${r.ingredientId}-${r.unitId}`} />}
    </StateBoundary>
    <PaginationBar
      label="Phân trang báo cáo"
      page={pageInfo?.pageNumber ?? pageNumber}
      pageSize={PAGE_SIZE}
      totalCount={pageInfo?.totalCount}
      totalPages={pageInfo?.totalPages}
      hasPrev={pageInfo?.hasPrev ?? false}
      hasNext={pageInfo?.hasNext ?? false}
      pending={isLoading || reportQuery.isFetching || reportQuery.isPreviousData}
      onPageChange={setPageNumber}
    />
  </div>;
}
