import { useState, useEffect } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import {
  reportsApi,
  type MealCostReportItem,
  type PriceVarianceReportItem,
  type CurrentStockReportItem,
} from '../../api/reportsApi';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'meal-cost' | 'price-variance' | 'stock'>('meal-cost');
  const [period, setPeriod] = useState('2026-09');
  const [customer, setCustomer] = useState('DAV');
  const [mealCosts, setMealCosts] = useState<MealCostReportItem[]>([]);
  const [priceVariances, setPriceVariances] = useState<PriceVarianceReportItem[]>([]);
  const [stocks, setStocks] = useState<CurrentStockReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mc, pv, st] = await Promise.all([
        reportsApi.getMealCostReports(),
        reportsApi.getPriceVarianceReports(),
        reportsApi.getCurrentStock(),
      ]);
      setMealCosts(mc);
      setPriceVariances(pv);
      setStocks(st);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu báo cáo vận hành.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [mc, pv, st] = await Promise.all([
          reportsApi.getMealCostReports(),
          reportsApi.getPriceVarianceReports(),
          reportsApi.getCurrentStock(),
        ]);
        if (!ignore) {
          setMealCosts(mc);
          setPriceVariances(pv);
          setStocks(st);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu báo cáo vận hành.');
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, [period, customer]);

  const TAB_ITEMS = [
    { id: 'meal-cost', label: 'Báo cáo chi phí suất ăn', count: mealCosts.length },
    { id: 'price-variance', label: 'Biến động giá mua', count: priceVariances.length },
    { id: 'stock', label: 'Tồn kho hiện tại', count: stocks.length },
  ];

  // Tab 1: Meal Cost Columns
  const mealCostColumns: ColumnDef<MealCostReportItem>[] = [
    {
      id: 'code',
      header: 'Mã món',
      width: '16%',
      cell: (row) => <IdentifierText value={row.dishCode} />,
    },
    {
      id: 'name',
      header: 'Tên món ăn phục vụ',
      width: '28%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm truncate block">{row.dishName}</span>,
    },
    {
      id: 'servings',
      header: 'Số suất nấu',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.plannedServings} format="quantity" suffix=" suất" />,
    },
    {
      id: 'target',
      header: 'Định mức bán',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.targetPrice} format="currency" />,
    },
    {
      id: 'cost',
      header: 'Giá vốn thực tế',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.calculatedCost} format="currency" className="font-bold text-slate-900 text-sm" />,
    },
    {
      id: 'ratio',
      header: 'Tỷ lệ chi phí',
      width: '14%',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.costRatioPercent <= 45 ? 'success' : 'warning'} size="sm">
          {row.costRatioPercent}%
        </Badge>
      ),
    },
  ];

  // Tab 2: Price Variance Columns
  const priceVarianceColumns: ColumnDef<PriceVarianceReportItem>[] = [
    {
      id: 'code',
      header: 'Mã nguyên liệu',
      width: '18%',
      cell: (row) => <IdentifierText value={row.ingredientCode} />,
    },
    {
      id: 'name',
      header: 'Tên nguyên liệu thực phẩm',
      width: '32%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>,
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.unit}</span>,
    },
    {
      id: 'planned',
      header: 'Giá kế hoạch',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.plannedPrice} format="currency" />,
    },
    {
      id: 'actual',
      header: 'Giá mua thực tế',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.actualPrice} format="currency" className="font-bold text-slate-900" />,
    },
    {
      id: 'variance',
      header: 'Biến động (%)',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.variancePercent === 0 ? 'neutral' : row.variancePercent > 0 ? 'danger' : 'success'}
          size="sm"
        >
          {row.variancePercent > 0 ? `+${row.variancePercent}%` : `${row.variancePercent}%`}
        </Badge>
      ),
    },
  ];

  // Tab 3: Current Stock Columns
  const stockColumns: ColumnDef<CurrentStockReportItem>[] = [
    {
      id: 'warehouse',
      header: 'Kho lưu trữ',
      width: '30%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.warehouseName}</span>,
    },
    {
      id: 'ingredient',
      header: 'Tên nguyên liệu thực phẩm',
      width: '36%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>,
    },
    {
      id: 'qty',
      header: 'Số lượng tồn kho',
      width: '20%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.currentQty}
          format="quantity"
          suffix={` ${row.unitName}`}
          className="font-bold text-slate-900 text-sm"
        />
      ),
    },
    {
      id: 'status',
      header: 'Mức khả dụng',
      width: '14%',
      align: 'center',
      cell: () => (
        <Badge variant="success" size="sm">
          Đủ sản xuất
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Báo cáo chi phí & Hao hụt"
        contextSelectors={
          <>
            <Select
              options={[
                { value: '2026-09', label: 'Kỳ tháng 09/2026 (Hiện tại)' },
                { value: '2026-08', label: 'Kỳ tháng 08/2026' },
                { value: '2026-07', label: 'Kỳ tháng 07/2026' },
              ]}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 w-60 font-medium text-sm"
            />
            <Select
              options={[
                { value: 'DAV', label: 'Draxlmaier Automotive' },
                { value: 'ANV', label: 'AMANN Sewing Thread' },
              ]}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="h-9 w-60 font-medium text-sm"
            />
            <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Dữ liệu chốt sổ
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={loadData}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              onClick={() => alert('Xuất báo cáo tài chính suất ăn thành công!')}
              className="h-9 text-sm font-medium"
            >
              Xuất báo cáo Excel
            </Button>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'meal-cost' | 'price-variance' | 'stock')}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng chi phí:</span>
              <strong className="text-emerald-700 font-mono font-bold">37.445.061 ₫</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Hao hụt TB:</span>
              <strong className="text-slate-900 font-bold">1.2%</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="success" size="sm">
              Định mức: Đạt chuẩn
            </Badge>
          </>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={false}
      >
        {activeTab === 'meal-cost' && (
          <DataGrid<MealCostReportItem>
            data={mealCosts}
            columns={mealCostColumns}
            keyExtractor={(row) => row.dishCode}
          />
        )}

        {activeTab === 'price-variance' && (
          <DataGrid<PriceVarianceReportItem>
            data={priceVariances}
            columns={priceVarianceColumns}
            keyExtractor={(row) => row.ingredientCode}
          />
        )}

        {activeTab === 'stock' && (
          <DataGrid<CurrentStockReportItem>
            data={stocks}
            columns={stockColumns}
            keyExtractor={(row, idx) => `${row.warehouseName}-${row.ingredientName}-${idx}`}
          />
        )}
      </StateBoundary>
    </div>
  );
}
