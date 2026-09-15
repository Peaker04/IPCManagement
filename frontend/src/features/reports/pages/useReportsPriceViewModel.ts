import { useDeferredValue, useEffect, useState } from 'react';
import {
  useGetPriceVarianceByDishGroupPageQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVariancePageQuery,
} from '@/features/reports/reportsApi';
import type {
  PriceVarianceByDishGroupDto,
  PriceVarianceByPeriodDto,
  PriceVarianceBySupplierDto,
  PriceVarianceRow,
  WorkflowReportQuery,
} from '@/api/workflowApiTypes';
import {
  pricePageSizeOptions,
  readPageSize,
  standardPageSizeOptions,
  toReportView,
  type PriceSubView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';

type ReportsPriceViewModelArgs = {
  activeView: ReportView;
  initialPage: number;
  priceSubView: PriceSubView;
  reportQuery: WorkflowReportQuery;
  searchParams: URLSearchParams;
};

export function useReportsPriceViewModel({ activeView, initialPage, priceSubView, reportQuery, searchParams }: ReportsPriceViewModelArgs) {
  const [pricePageSize, setPricePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 6, pricePageSizeOptions));
  const [pricePage, setPricePage] = useState(initialPage);
  const [priceSearch, setPriceSearchState] = useState('');
  const [debouncedPriceSearch, setDebouncedPriceSearch] = useState('');
  const [selectedWarningId, setSelectedWarningId] = useState<string | null>(null);
  const deferredPriceSearch = useDeferredValue(debouncedPriceSearch);
  const [priceAggregatePageSize, setPriceAggregatePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [supplierPage, setSupplierPage] = useState(initialPage);
  const [periodPage, setPeriodPage] = useState(initialPage);
  const [dishGroupPage, setDishGroupPage] = useState(initialPage);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedPriceSearch(priceSearch.trim());
      setPricePage(1);
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [priceSearch]);

  const setPriceSearch = (value: string) => {
    setPriceSearchState(value);
  };

  const priceVarianceResult = useGetPriceVariancePageQuery({
    ...reportQuery,
    pageNumber: pricePage,
    pageSize: pricePageSize,
    searchKeyword: deferredPriceSearch || undefined,
  }, { skip: activeView !== 'price' || priceSubView !== 'lines' });
  const priceVarianceBySupplierResult = useGetPriceVarianceBySupplierPageQuery({ ...reportQuery, pageNumber: supplierPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'supplier' });
  const priceVarianceByPeriodResult = useGetPriceVarianceByPeriodPageQuery({ ...reportQuery, pageNumber: periodPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'period' });
  const priceVarianceByDishGroupResult = useGetPriceVarianceByDishGroupPageQuery({ ...reportQuery, pageNumber: dishGroupPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'dishGroup' });
  const priceVarianceView = toReportView(priceVarianceResult, 'biến động giá theo dòng nhập');
  const priceVarianceBySupplierView = toReportView(priceVarianceBySupplierResult, 'biến động giá theo nhà cung cấp');
  const priceVarianceByPeriodView = toReportView(priceVarianceByPeriodResult, 'biến động giá theo thời gian');
  const priceVarianceByDishGroupView = toReportView(priceVarianceByDishGroupResult, 'biến động giá theo nhóm món');
  const priceVarianceBySupplierRows = priceVarianceBySupplierView.phase === 'ready' ? priceVarianceBySupplierView.data.items : [];
  const priceVarianceByPeriodRows = priceVarianceByPeriodView.phase === 'ready' ? priceVarianceByPeriodView.data.items : [];
  const priceVarianceByDishGroupRows = priceVarianceByDishGroupView.phase === 'ready' ? priceVarianceByDishGroupView.data.items : [];
  const priceVarianceRows = priceVarianceView.phase === 'ready' ? priceVarianceView.data.items : [];
  const warningItems = priceVarianceRows.filter((item) => item.warning);
  const selectedWarning = warningItems.find((item) => item.id === selectedWarningId);
  const activePriceView = priceSubView === 'supplier'
    ? priceVarianceBySupplierView
    : priceSubView === 'period'
      ? priceVarianceByPeriodView
      : priceSubView === 'dishGroup'
        ? priceVarianceByDishGroupView
        : priceVarianceView;

  const linesConfig: ReportExportConfig = {
    filename: 'bien-dong-gia',
    rows: priceVarianceRows,
    columns: [
      ['Tên nguyên liệu', (row: PriceVarianceRow) => row.name],
      ['Nhà cung cấp', (row: PriceVarianceRow) => row.supplier],
      ['Mã phiếu nhập', (row: PriceVarianceRow) => row.receiptCode],
      ['Ngày nhập', (row: PriceVarianceRow) => row.receiptDate],
      ['Số lượng', (row: PriceVarianceRow) => row.quantity],
      ['ĐVT', (row: PriceVarianceRow) => row.unit],
      ['Giá tham chiếu', (row: PriceVarianceRow) => row.pricePrev],
      ['Giá nhập', (row: PriceVarianceRow) => row.priceCurrent],
      ['Thay đổi (%)', (row: PriceVarianceRow) => row.change],
      ['Vượt ngưỡng', (row: PriceVarianceRow) => (row.warning ? 'Có' : 'Không')],
    ],
  };

  const supplierConfig: ReportExportConfig = {
    filename: 'bien-dong-gia-theo-ncc',
    rows: priceVarianceBySupplierRows,
    columns: [
      ['Nguyên liệu', (row: PriceVarianceBySupplierDto) => row.ingredientName ?? ''],
      ['Nhà cung cấp', (row: PriceVarianceBySupplierDto) => row.supplierName ?? ''],
      ['ĐVT', (row: PriceVarianceBySupplierDto) => row.unitName ?? ''],
      ['Số lần nhập', (row: PriceVarianceBySupplierDto) => row.receiptCount],
      ['Giá TB', (row: PriceVarianceBySupplierDto) => row.avgUnitPrice],
      ['Giá thấp nhất', (row: PriceVarianceBySupplierDto) => row.minUnitPrice],
      ['Giá cao nhất', (row: PriceVarianceBySupplierDto) => row.maxUnitPrice],
      ['Giá tham chiếu', (row: PriceVarianceBySupplierDto) => row.referencePrice],
      ['Biến động (%)', (row: PriceVarianceBySupplierDto) => row.variancePercent],
      ['Vượt ngưỡng', (row: PriceVarianceBySupplierDto) => (row.isWarning ? 'Có' : 'Không')],
    ],
  };

  const periodConfig: ReportExportConfig = {
    filename: 'bien-dong-gia-theo-thoi-gian',
    rows: priceVarianceByPeriodRows,
    columns: [
      ['Nguyên liệu', (row: PriceVarianceByPeriodDto) => row.ingredientName ?? ''],
      ['ĐVT', (row: PriceVarianceByPeriodDto) => row.unitName ?? ''],
      ['Tháng', (row: PriceVarianceByPeriodDto) => row.periodLabel],
      ['Giá TB', (row: PriceVarianceByPeriodDto) => row.avgUnitPrice],
      ['% so với tham chiếu', (row: PriceVarianceByPeriodDto) => row.variancePercentVsReference],
      ['% so với tháng trước', (row: PriceVarianceByPeriodDto) => row.variancePercentVsPreviousPeriod ?? '—'],
      ['Vượt ngưỡng', (row: PriceVarianceByPeriodDto) => (row.isWarning ? 'Có' : 'Không')],
    ],
  };

  const dishGroupConfig: ReportExportConfig = {
    filename: 'bien-dong-gia-theo-nhom-mon',
    rows: priceVarianceByDishGroupRows,
    columns: [
      ['Nhóm món', (row: PriceVarianceByDishGroupDto) => row.dishGroup],
      ['Số nguyên liệu', (row: PriceVarianceByDishGroupDto) => row.ingredientCount],
      ['Số NL vượt ngưỡng', (row: PriceVarianceByDishGroupDto) => row.warningIngredientCount],
      ['% biến động (có trọng số)', (row: PriceVarianceByDishGroupDto) => row.weightedAvgVariancePercent],
      ['Nguyên liệu ảnh hưởng nhiều nhất', (row: PriceVarianceByDishGroupDto) => (row.topIngredients ?? []).map((i) => `${i.ingredientName} (${i.variancePercent}%)`).join('; ')],
    ],
  };

  const exportConfig: ReportExportConfig =
    priceSubView === 'supplier'
      ? supplierConfig
      : priceSubView === 'period'
        ? periodConfig
        : priceSubView === 'dishGroup'
          ? dishGroupConfig
          : linesConfig;

  return {
    activePriceView,
    dishGroupPage,
    exportConfig,
    periodPage,
    priceAggregatePageSize,
    pricePage,
    pricePageSize,
    priceSearch,
    priceVarianceByDishGroupResult,
    priceVarianceByDishGroupRows,
    priceVarianceByPeriodResult,
    priceVarianceByPeriodRows,
    priceVarianceBySupplierResult,
    priceVarianceBySupplierRows,
    priceVarianceResult,
    priceVarianceRows,
    selectedWarning,
    selectWarning: setSelectedWarningId,
    setDishGroupPage,
    setPeriodPage,
    setPriceAggregatePageSize,
    setPricePage,
    setPricePageSize,
    setPriceSearch,
    setSupplierPage,
    supplierPage,
    view: priceVarianceView,
    warningItems,
  };
}
