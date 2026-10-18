import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import { reportsApi, type ReportPage, type DemandReportItem, type PriceVarianceReportItem, type CurrentStockReportItem } from '../../api/reportsApi';
import { formatVietnameseDateTime } from '../../utils/dates';
import type { CustomerOption } from '../../types';

function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

const PAGE_SIZE = 25;

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const activeView = view === 'prices' || view === 'stock' ? view : 'demand';
  const [period, setPeriod] = useState(currentPeriod);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [demand, setDemand] = useState<DemandReportItem[]>([]);
  const [prices, setPrices] = useState<PriceVarianceReportItem[]>([]);
  const [stocks, setStocks] = useState<CurrentStockReportItem[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInfo, setPageInfo] = useState<Pick<ReportPage<unknown>, 'totalCount' | 'pageNumber' | 'totalPages' | 'hasPrev' | 'hasNext'>>({ totalCount: 0, pageNumber: 1, totalPages: 0, hasPrev: false, hasNext: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((items) => {
      if (ignore) return;
      setCustomers(items);
      setCustomerId(items[0]?.customerId || '');
      if (items.length === 0 && activeView === 'demand') setIsLoading(false);
    }).catch((cause: unknown) => {
      if (!ignore && activeView === 'demand') {
        setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
        setIsLoading(false);
      }
    });
    return () => { ignore = true; };
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'demand' && !customerId) return;
    const sequence = ++requestSequence.current;
    const request = activeView === 'demand'
      ? reportsApi.getDemand(period, customerId, pageNumber, PAGE_SIZE)
      : activeView === 'prices'
        ? reportsApi.getPriceVariance(period, pageNumber, PAGE_SIZE)
        : reportsApi.getCurrentStock(undefined, pageNumber, PAGE_SIZE);
    request.then((page) => {
      if (sequence !== requestSequence.current) return;
      setPageInfo(page);
      if (activeView === 'demand') setDemand(page.items as DemandReportItem[]);
      else if (activeView === 'prices') setPrices(page.items as PriceVarianceReportItem[]);
      else setStocks(page.items as CurrentStockReportItem[]);
    }).catch((cause: unknown) => {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause : new Error('Không thể tải báo cáo.'));
    }).finally(() => {
      if (sequence === requestSequence.current) setIsLoading(false);
    });
  }, [activeView, period, customerId, pageNumber]);

  const reload = () => {
    setIsLoading(true);
    setError(null);
    const sequence = ++requestSequence.current;
    const request = activeView === 'demand'
      ? reportsApi.getDemand(period, customerId, pageNumber, PAGE_SIZE)
      : activeView === 'prices'
        ? reportsApi.getPriceVariance(period, pageNumber, PAGE_SIZE)
        : reportsApi.getCurrentStock(undefined, pageNumber, PAGE_SIZE);
    request.then((page) => {
      if (sequence !== requestSequence.current) return;
      setPageInfo(page);
      if (activeView === 'demand') setDemand(page.items as DemandReportItem[]);
      else if (activeView === 'prices') setPrices(page.items as PriceVarianceReportItem[]);
      else setStocks(page.items as CurrentStockReportItem[]);
    }).catch((cause: unknown) => {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause : new Error('Không thể tải báo cáo.'));
    }).finally(() => {
      if (sequence === requestSequence.current) setIsLoading(false);
    });
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
      contextSelectors={<>
        {activeView !== 'stock' && <input type="month" value={period} onChange={(e) => { setIsLoading(true); setError(null); setPageNumber(1); setPeriod(e.target.value); }} className="h-9 rounded border border-slate-300 px-3 text-sm" aria-label="Kỳ báo cáo" />}
        {activeView === 'demand' && <Select aria-label="Chọn khách hàng báo cáo" options={customers.map((c) => ({ value: c.customerId, label: `${c.customerCode} - ${c.customerName}` }))} value={customerId} onChange={(e) => { setIsLoading(true); setError(null); setPageNumber(1); setCustomerId(e.target.value); }} disabled={!customers.length} className="h-9 w-60" />}
      </>}
      actions={<Button variant="outline" size="default" onClick={reload} className="h-9 text-sm font-medium">Làm mới</Button>}
    />
    <TelemetrySubbar leftControls={<span className="text-xs font-semibold">{activeView === 'demand' ? 'Nhu cầu nguyên liệu' : activeView === 'prices' ? 'Biến động giá nhập' : 'Tồn kho hiện tại'}</span>} telemetryPills={<span className="text-slate-500">{pageInfo.totalCount} dòng số liệu</span>} />
    <StateBoundary isLoading={isLoading} isFetching={isLoading} hasExistingData={rows.length > 0} error={error} onRetry={reload} isEmpty={!isLoading && !error && rows.length === 0} emptyScenario="prerequisite-blocked" emptyTitle="Chưa có dữ liệu báo cáo" emptyDescription="Chưa có dữ liệu báo cáo cho phạm vi đã chọn.">
      {activeView === 'demand' && <DataGrid data={demand} columns={demandColumns} keyExtractor={(r) => `${r.requestDate}-${r.ingredientId}-${r.unitId}`} />}
      {activeView === 'prices' && <DataGrid data={prices} columns={priceColumns} keyExtractor={(r) => r.receiptLineId} />}
      {activeView === 'stock' && <DataGrid data={stocks} columns={stockColumns} keyExtractor={(r) => `${r.warehouseId}-${r.ingredientId}-${r.unitId}`} />}
    </StateBoundary>
    {pageInfo.totalPages > 1 && (
      <nav aria-label="Phân trang báo cáo" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
        <span className="text-xs text-slate-500">Trang {pageInfo.pageNumber}/{pageInfo.totalPages}</span>
        <Button variant="outline" size="xs" disabled={!pageInfo.hasPrev || isLoading} onClick={() => { setIsLoading(true); setError(null); setPageNumber((page) => page - 1); }}>Trang trước</Button>
        <Button variant="outline" size="xs" disabled={!pageInfo.hasNext || isLoading} onClick={() => { setIsLoading(true); setError(null); setPageNumber((page) => page + 1); }}>Trang sau</Button>
      </nav>
    )}
  </div>;
}
