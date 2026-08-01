import { useDeferredValue, useEffect, useState } from 'react';
import {
  useGetPriceVarianceByDishGroupPageQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVariancePageQuery,
  type WorkflowReportQuery,
} from '@/api/workflowApi';
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
  const selectedWarning = warningItems[0];
  const activePriceView = priceSubView === 'supplier'
    ? priceVarianceBySupplierView
    : priceSubView === 'period'
      ? priceVarianceByPeriodView
      : priceSubView === 'dishGroup'
        ? priceVarianceByDishGroupView
        : priceVarianceView;
  const exportConfig: ReportExportConfig = {
    filename: 'bien-dong-gia',
    rows: priceVarianceRows,
    columns: [
      ['Tên nguyên liệu', (row) => row.name],
      ['Nhà cung cấp', (row) => row.supplier],
      ['Mã phiếu nhập', (row) => row.receiptCode],
      ['Ngày nhập', (row) => row.receiptDate],
      ['Số lượng', (row) => row.quantity],
      ['ĐVT', (row) => row.unit],
      ['Giá tham chiếu', (row) => row.pricePrev],
      ['Giá nhập', (row) => row.priceCurrent],
      ['Thay đổi (%)', (row) => row.change],
      ['Vượt ngưỡng', (row) => (row.warning ? 'Có' : 'Không')],
    ],
  };

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
