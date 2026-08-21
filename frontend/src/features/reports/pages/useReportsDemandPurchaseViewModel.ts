import { useDeferredValue, useState } from 'react';
import {
  useGetIngredientDemandAggregatePageQuery,
  useGetPurchasePlanPageQuery,
  type WorkflowReportQuery,
} from '@/api/workflowApi';
import { uiCopy } from '@/lib/uiCopy';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import {
  readPageSize,
  standardPageSizeOptions,
  toReportView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';

type ReportsDemandPurchaseViewModelArgs = {
  activeView: ReportView;
  initialPage: number;
  reportQuery: WorkflowReportQuery;
  searchParams: URLSearchParams;
};

export function useReportsDemandPurchaseViewModel({ activeView, initialPage, reportQuery, searchParams }: ReportsDemandPurchaseViewModelArgs) {
  const [purchasePlanGroupBy, setPurchasePlanGroupBy] = useState<'day' | 'week'>('day');
  const [demandPageSize, setDemandPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [demandPage, setDemandPage] = useState(initialPage);
  const [demandSearch, setDemandSearch] = useState('');
  const deferredDemandSearch = useDeferredValue(demandSearch.trim());
  const [purchasePageSize, setPurchasePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [purchasePage, setPurchasePage] = useState(initialPage);
  const [purchaseSearch, setPurchaseSearchState] = useState('');
  const deferredPurchaseSearch = useDeferredValue(purchaseSearch.trim());
  const ingredientDemandResult = useGetIngredientDemandAggregatePageQuery({
    ...reportQuery,
    searchKeyword: deferredDemandSearch || undefined,
    pageNumber: demandPage,
    pageSize: demandPageSize,
  }, { skip: activeView !== 'demand' });
  const purchasePlanResult = useGetPurchasePlanPageQuery({
    ...reportQuery,
    groupBy: purchasePlanGroupBy,
    searchKeyword: deferredPurchaseSearch || undefined,
    pageNumber: purchasePage,
    pageSize: purchasePageSize,
  }, { skip: activeView !== 'purchase' });
  const ingredientDemandView = toReportView(ingredientDemandResult, 'nhu cầu nguyên liệu');
  const purchasePlanView = toReportView(purchasePlanResult, 'kế hoạch thu mua');
  const ingredientDemandRows = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data.items : [];
  const purchasePlanRows = purchasePlanView.phase === 'ready' ? purchasePlanView.data.items : [];
  const purchasePlanSummary = {
    rowCount: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalCount : 0,
    totalShortageQty: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalShortageQty : 0,
    totalEstimatedAmount: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalEstimatedAmount : 0,
    shortageTone: purchasePlanView.phase === 'ready' && purchasePlanView.data.totalShortageQty > 0 ? 'danger' as const : 'success' as const,
  };
  const shortageCount = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data.shortageCount : 0;
  const setPurchaseSearch = (value: string) => {
    setPurchaseSearchState(value);
    setPurchasePage(1);
  };
  const exportConfigs: Record<'demand' | 'purchase', ReportExportConfig> = {
    demand: {
      filename: 'nhu-cau-nguyen-lieu',
      rows: ingredientDemandRows,
      columns: [
        ['Ngày', (row) => row.serviceDate],
        ['Nguyên liệu', (row) => row.material],
        ['Nguồn', (row) => row.source],
        ['Cần', (row) => row.required],
        ['Tồn hiện có', (row) => row.available],
        ['Thiếu/mua', (row) => Math.max(row.required - row.available, 0)],
        ['Đơn vị', (row) => row.unit],
        ['Trạng thái', (row) => formatWorkflowStatus(row.status)],
      ],
    },
    purchase: {
      filename: 'ke-hoach-thu-mua',
      rows: purchasePlanRows,
      columns: [
        ['Kỳ', (row) => row.periodKey],
        ['Nguyên liệu', (row) => row.ingredientName],
        ['Cần', (row) => row.requiredQty],
        ['Tồn', (row) => row.currentStockQty],
        [uiCopy.reports.pending, (row) => row.pendingReceiptQty],
        ['Đề xuất mua', (row) => row.shortageQty],
        ['Đơn giá dự kiến', (row) => row.estimatedUnitPrice],
        ['Thành tiền dự kiến', (row) => row.estimatedAmount],
        ['Đơn vị', (row) => row.unitName],
        ['Nhà cung cấp', (row) => row.supplierName],
        ['Cảnh báo', (row) => row.warnings.join('; ')],
      ],
    },
  };

  return {
    demandPage,
    demandPageSize,
    demandSearch,
    exportConfigs,
    ingredientDemandResult,
    ingredientDemandRows,
    purchasePage,
    purchasePageSize,
    purchaseSearch,
    purchasePlanGroupBy,
    purchasePlanResult,
    purchasePlanRows,
    purchasePlanSummary,
    setDemandPage,
    setDemandPageSize,
    setDemandSearch,
    setPurchasePage,
    setPurchasePageSize,
    setPurchaseSearch,
    setPurchasePlanGroupBy,
    shortageCount,
    views: { demand: ingredientDemandView, purchase: purchasePlanView },
  };
}
