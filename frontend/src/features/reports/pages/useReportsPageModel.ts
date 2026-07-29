import { useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type ContextStripItem } from '@/components/common';
import { useGetAuditChangePageQuery, useGetCurrentStockPageQuery, useGetDataQualityPageQuery, useGetIngredientDemandPageQuery, useGetIssueVsReturnUsagePageQuery, useGetKitchenIssuesPageQuery, useGetPriceVariancePageQuery, useGetPriceVarianceBySupplierPageQuery, useGetPriceVarianceByPeriodPageQuery, useGetPriceVarianceByDishGroupPageQuery, useGetPurchasePlanPageQuery, useGetStockMovementPageQuery, type WorkflowReportQuery } from '@/api/workflowApi';
import { type StockMovement } from '@/types/workflow';
import { toNextReportCursor, type ReportCursor } from '@/api/workflowApi';
import { uiCopy } from '@/lib/uiCopy';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import { toQueryView, type QuerySnapshot } from '@/lib/queryView';
import { buildCsv, downloadCsv } from './reportCsv';

export type ReportView = 'price' | 'demand' | 'purchase' | 'stock' | 'movement' | 'kitchen' | 'usage' | 'audit' | 'data-quality';

const reportTabs = [
  { id: 'reports-price', label: 'Biến động giá' },
  { id: 'reports-demand', label: 'Nhu cầu nguyên liệu' },
  { id: 'reports-purchase', label: 'Kế hoạch thu mua' },
  { id: 'reports-stock', label: 'Tồn kho' },
  { id: 'reports-movement', label: 'Nhập/xuất kho' },
  { id: 'reports-kitchen', label: 'Xuất bếp' },
  { id: 'reports-usage', label: 'Sử dụng thực tế' },
  { id: 'reports-audit', label: uiCopy.reports.audit },
  { id: 'reports-data-quality', label: uiCopy.reports.dataQuality },
];

export const movementTypeLabel: Record<StockMovement['type'], string> = {
  receipt: 'Nhập kho',
  issue: 'Xuất kho',
  supplemental: 'Xuất bổ sung',
  return: 'Trả kho',
  adjustment: 'Điều chỉnh',
};

export type PriceSubView = 'lines' | 'supplier' | 'period' | 'dishGroup';

const priceSubViewTabs: Array<{ id: PriceSubView; label: string }> = [
  { id: 'lines', label: 'Theo dòng nhập' },
  { id: 'supplier', label: 'Theo nhà cung cấp' },
  { id: 'period', label: 'Theo thời gian' },
  { id: 'dishGroup', label: 'Theo nhóm món' },
];

const validReportViews: ReportView[] = ['price', 'demand', 'purchase', 'stock', 'movement', 'kitchen', 'usage', 'audit', 'data-quality'];
export const standardPageSizeOptions = [8, 20, 50] as const;
export const pricePageSizeOptions = [6, 20, 50] as const;

const readPositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readPageSize = (value: string | null, fallback: number, options: readonly number[]) => {
  const parsed = readPositiveInteger(value, fallback);
  return options.includes(parsed) ? parsed : fallback;
};

const toReportView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở báo cáo ${label} để tải dữ liệu.`, retry: () => query.refetch(),
  errorMessage: `Không tải được báo cáo ${label}.`, forbiddenMessage: `Bạn không có quyền xem báo cáo ${label}.`,
});

type ReportsPagePermissions = {
  canReadAuditChanges: boolean;
  canReadPurchaseReports: boolean;
  canReadWarehouseReports: boolean;
};

export const useReportsPageModel = ({
  canReadAuditChanges,
  canReadPurchaseReports,
  canReadWarehouseReports,
}: ReportsPagePermissions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isViewPending, startViewTransition] = useTransition();
  const initialView = searchParams.get('view');
  const initialPage = readPositiveInteger(searchParams.get('page'), 1);
  const [requestedView, setRequestedView] = useState<ReportView>(
    validReportViews.includes(initialView as ReportView) ? (initialView as ReportView) : 'price'
  );
  const initialPriceSubView = searchParams.get('subview');
  const [requestedPriceSubView, setRequestedPriceSubView] = useState<PriceSubView>(
    priceSubViewTabs.some((tab) => tab.id === initialPriceSubView) ? initialPriceSubView as PriceSubView : 'lines',
  );

  // Quyền báo cáo phải bám sát policy của WorkflowReportsController, nếu không user sẽ thấy tab
  // rồi nhận 403 im lặng. Ánh xạ policy backend -> permission do server phát cho từng role:
  //   price-variance/* và purchase-plan -> PurchaseAccess (Admin/Quản lý/Thu mua) = purchase.read
  //   receipt-price-variance -> PurchaseOrderReadAccess (thêm Thủ kho) = purchase.read hoặc warehouse.read
  //   audit-changes -> AdminAccess
  const canReadReceiptPriceVariance = canReadPurchaseReports || canReadWarehouseReports;

  const visibleReportViews = useMemo<ReportView[]>(() => validReportViews.filter((view) => {
    if (view === 'price') return canReadReceiptPriceVariance;
    if (view === 'purchase') return canReadPurchaseReports;
    if (view === 'audit') return canReadAuditChanges;
    return true;
  }), [canReadReceiptPriceVariance, canReadPurchaseReports, canReadAuditChanges]);
  const visibleReportTabs = useMemo(
    () => reportTabs.filter((tab) => visibleReportViews.includes(tab.id.replace('reports-', '') as ReportView)),
    [visibleReportViews],
  );
  const visiblePriceSubViewTabs = useMemo(
    () => priceSubViewTabs.filter((tab) => (tab.id === 'lines' ? canReadReceiptPriceVariance : canReadPurchaseReports)),
    [canReadReceiptPriceVariance, canReadPurchaseReports],
  );

  // Bookmark cũ hoặc URL gõ tay có thể trỏ tới tab đã bị siết quyền: ép về tab hợp lệ đầu tiên
  // thay vì render bảng trống hoặc gọi API chỉ để nhận 403.
  const activeView: ReportView = visibleReportViews.includes(requestedView)
    ? requestedView
    : visibleReportViews[0] ?? 'demand';
  const priceSubView: PriceSubView = visiblePriceSubViewTabs.some((tab) => tab.id === requestedPriceSubView)
    ? requestedPriceSubView
    : visiblePriceSubViewTabs[0]?.id ?? 'lines';

  const [purchasePlanGroupBy, setPurchasePlanGroupBy] = useState<'day' | 'week'>('day');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [movementCursors, setMovementCursors] = useState<ReportCursor[]>([]);
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const [pricePageSize, setPricePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 6, pricePageSizeOptions));
  const [pricePage, setPricePage] = useState(initialPage);
  const [priceAggregatePageSize, setPriceAggregatePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [supplierPage, setSupplierPage] = useState(initialPage);
  const [periodPage, setPeriodPage] = useState(initialPage);
  const [dishGroupPage, setDishGroupPage] = useState(initialPage);
  const reportPageSize = 20;
  const [stockPageSize, setStockPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [stockPage, setStockPage] = useState(initialPage);
  const [demandPageSize, setDemandPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [demandPage, setDemandPage] = useState(initialPage);
  const [purchasePageSize, setPurchasePageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [purchasePage, setPurchasePage] = useState(initialPage);
  const [operationalPageSize, setOperationalPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [kitchenPage, setKitchenPage] = useState(initialPage);
  const [usagePage, setUsagePage] = useState(initialPage);
  const [dataQualityPage, setDataQualityPage] = useState(initialPage);
  const [dataQualitySearch, setDataQualitySearch] = useState('');
  const [debouncedDataQualitySearch, setDebouncedDataQualitySearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedDataQualitySearch(dataQualitySearch.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [dataQualitySearch]);

  const updateSearchState = (updates: Record<string, string | undefined>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  };

  const setNumberedPage = (setter: Dispatch<SetStateAction<number>>, nextPage: number) => {
    setter(nextPage);
    updateSearchState({
      view: activeView,
      subview: activeView === 'price' ? priceSubView : undefined,
      page: String(nextPage),
    });
  };

  const setNumberedPageSize = (
    pageSetter: Dispatch<SetStateAction<number>>,
    pageSizeSetter: Dispatch<SetStateAction<number>>,
    nextPageSize: number,
  ) => {
    pageSizeSetter(nextPageSize);
    pageSetter(1);
    updateSearchState({
      view: activeView,
      subview: activeView === 'price' ? priceSubView : undefined,
      page: '1',
      pageSize: String(nextPageSize),
    });
  };

  const resetCursorPages = () => {
    setMovementCursors([]);
    setAuditCursors([]);
  };

  const resetReportPages = () => {
    setPricePage(1);
    setSupplierPage(1);
    setPeriodPage(1);
    setDishGroupPage(1);
    setStockPage(1);
    setDemandPage(1);
    setPurchasePage(1);
    setKitchenPage(1);
    setUsagePage(1);
    setDataQualityPage(1);
    resetCursorPages();
  };

  const resetReportPagesAndUrl = () => {
    resetReportPages();
    updateSearchState({ page: '1' });
  };

  const reportQuery = useMemo<WorkflowReportQuery>(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    shiftName: shiftName || undefined,
    limit: reportPageSize,
  }), [dateFrom, dateTo, shiftName]);

  const priceVarianceResult = useGetPriceVariancePageQuery({
    ...reportQuery,
    pageNumber: pricePage,
    pageSize: pricePageSize,
  }, { skip: activeView !== 'price' || priceSubView !== 'lines' });
  const priceVarianceBySupplierResult = useGetPriceVarianceBySupplierPageQuery({ ...reportQuery, pageNumber: supplierPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'supplier' });
  const priceVarianceByPeriodResult = useGetPriceVarianceByPeriodPageQuery({ ...reportQuery, pageNumber: periodPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'period' });
  const priceVarianceByDishGroupResult = useGetPriceVarianceByDishGroupPageQuery({ ...reportQuery, pageNumber: dishGroupPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'dishGroup' });
  const ingredientDemandResult = useGetIngredientDemandPageQuery({
    ...reportQuery,
    pageNumber: demandPage,
    pageSize: demandPageSize,
  }, { skip: activeView !== 'demand' });
  const purchasePlanResult = useGetPurchasePlanPageQuery({
    ...reportQuery,
    groupBy: purchasePlanGroupBy,
    pageNumber: purchasePage,
    pageSize: purchasePageSize,
  }, { skip: activeView !== 'purchase' });
  const currentStockResult = useGetCurrentStockPageQuery({
    ...reportQuery,
    pageNumber: stockPage,
    pageSize: stockPageSize,
  }, { skip: activeView !== 'stock' });
  const movementCursor = movementCursors.at(-1);
  const auditCursor = auditCursors.at(-1);
  const stockMovementResult = useGetStockMovementPageQuery({
    ...reportQuery,
    cursorDate: movementCursor?.cursorDate,
    cursorId: movementCursor?.cursorId,
    cursorOffset: movementCursor?.cursorOffset,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'movement' });
  const kitchenIssueResult = useGetKitchenIssuesPageQuery({ ...reportQuery, pageNumber: kitchenPage, pageSize: operationalPageSize }, { skip: activeView !== 'kitchen' });
  const usageResult = useGetIssueVsReturnUsagePageQuery({ ...reportQuery, pageNumber: usagePage, pageSize: operationalPageSize }, { skip: activeView !== 'usage' });
  const auditResult = useGetAuditChangePageQuery({
    ...reportQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    cursorOffset: auditCursor?.cursorOffset,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'audit' });
  const dataQualityResult = useGetDataQualityPageQuery({
    ...reportQuery,
    pageNumber: dataQualityPage,
    pageSize: operationalPageSize,
    searchKeyword: debouncedDataQualitySearch || undefined,
  }, { skip: activeView !== 'data-quality' });

  const priceVarianceView = toReportView(priceVarianceResult, 'biến động giá theo dòng nhập');
  const priceVarianceBySupplierView = toReportView(priceVarianceBySupplierResult, 'biến động giá theo nhà cung cấp');
  const priceVarianceByPeriodView = toReportView(priceVarianceByPeriodResult, 'biến động giá theo thời gian');
  const priceVarianceByDishGroupView = toReportView(priceVarianceByDishGroupResult, 'biến động giá theo nhóm món');
  const ingredientDemandView = toReportView(ingredientDemandResult, 'nhu cầu nguyên liệu');
  const purchasePlanView = toReportView(purchasePlanResult, 'kế hoạch thu mua');
  const currentStockView = toReportView(currentStockResult, 'tồn kho hiện tại');
  const stockMovementView = toReportView(stockMovementResult, 'nhập xuất kho');
  const kitchenIssueView = toReportView(kitchenIssueResult, 'xuất kho cho bếp');
  const usageView = toReportView(usageResult, 'sử dụng thực tế');
  const auditView = toReportView(auditResult, 'nhật ký thay đổi');
  const dataQualityView = toReportView(dataQualityResult, 'chất lượng dữ liệu');

  const priceVarianceBySupplierRows = priceVarianceBySupplierView.phase === 'ready' ? priceVarianceBySupplierView.data.items : [];
  const priceVarianceByPeriodRows = priceVarianceByPeriodView.phase === 'ready' ? priceVarianceByPeriodView.data.items : [];
  const priceVarianceByDishGroupRows = priceVarianceByDishGroupView.phase === 'ready' ? priceVarianceByDishGroupView.data.items : [];
  const priceVarianceRows = priceVarianceView.phase === 'ready' ? priceVarianceView.data.items : [];
  const ingredientDemandRows = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data.items : [];
  const purchasePlanRows = purchasePlanView.phase === 'ready' ? purchasePlanView.data.items : [];
  const purchasePlanSummary = {
    rowCount: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalCount : 0,
    totalShortageQty: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalShortageQty : 0,
    totalEstimatedAmount: purchasePlanView.phase === 'ready' ? purchasePlanView.data.totalEstimatedAmount : 0,
    shortageTone: purchasePlanView.phase === 'ready' && purchasePlanView.data.totalShortageQty > 0 ? 'danger' as const : 'success' as const,
  };
  const currentStockRows = currentStockView.phase === 'ready' ? currentStockView.data.items : [];
  const stockMovementRows = stockMovementView.phase === 'ready' ? stockMovementView.data.items : [];
  const kitchenIssueRows = kitchenIssueView.phase === 'ready' ? kitchenIssueView.data.items : [];
  const usageRows = usageView.phase === 'ready' ? usageView.data.items : [];
  const auditRows = auditView.phase === 'ready' ? auditView.data.items : [];
  const dataQualityReport = dataQualityView.phase === 'ready' ? dataQualityView.data : undefined;
  const dataQualityRows = dataQualityReport?.page.items ?? [];

  const warningItems = priceVarianceRows.filter((item) => item.warning);
  const selectedWarning = warningItems[0];
  const shortageCount = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data.shortageCount : 0;
  const activePriceView = priceSubView === 'supplier'
    ? priceVarianceBySupplierView
    : priceSubView === 'period'
      ? priceVarianceByPeriodView
      : priceSubView === 'dishGroup'
        ? priceVarianceByDishGroupView
        : priceVarianceView;
  const reportViews = {
    price: activePriceView,
    demand: ingredientDemandView,
    purchase: purchasePlanView,
    stock: currentStockView,
    movement: stockMovementView,
    kitchen: kitchenIssueView,
    usage: usageView,
    audit: auditView,
    'data-quality': dataQualityView,
  };
  const activeReportView = reportViews[activeView];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each entry's rows/columns are paired per report view; a shared row type would be unsound here.
  const exportConfig: Record<ReportView, { filename: string; rows: unknown[]; columns: Array<[string, (row: any) => unknown]> }> = {
    price: {
      filename: 'bien-dong-gia',
      rows: priceVarianceRows,
      columns: [
        ['Tên nguyên liệu', (row) => row.name],
        ['Nhà cung cấp', (row) => row.supplier],
        ['ĐVT', (row) => row.unit],
        ['Giá tham chiếu', (row) => row.pricePrev],
        ['Giá nhập', (row) => row.priceCurrent],
        ['Thay đổi (%)', (row) => row.change],
        ['Vượt ngưỡng', (row) => (row.warning ? 'Có' : 'Không')],
      ],
    },
    demand: {
      filename: 'nhu-cau-nguyen-lieu',
      rows: ingredientDemandRows,
      columns: [
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
        ['Đơn vị', (row) => row.unitName],
        ['Nhà cung cấp', (row) => row.supplierName],
        ['Cảnh báo', (row) => row.warnings.join('; ')],
      ],
    },
    stock: {
      filename: 'ton-kho-hien-tai',
      rows: currentStockRows,
      columns: [
        ['Kho', (row) => row.warehouse],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Số lượng hiện tại', (row) => row.currentQty],
        ['Đơn vị', (row) => row.unit],
        ['Cập nhật', (row) => new Date(row.lastUpdated).toLocaleString('vi-VN')],
      ],
    },
    movement: {
      filename: 'nhap-xuat-kho',
      rows: stockMovementRows,
      columns: [
        ['Chứng từ', (row) => row.documentNo],
        ['Loại', (row: StockMovement) => movementTypeLabel[row.type]],
        ['Nguyên liệu', (row) => row.material],
        ['Số lượng', (row) => row.quantity],
        ['Đơn vị', (row) => row.unit],
        ['Phụ trách', (row) => row.owner],
        ['Trạng thái', (row) => formatWorkflowStatus(row.status)],
      ],
    },
    kitchen: {
      filename: 'xuat-bep',
      rows: kitchenIssueRows,
      columns: [
        ['Phiếu xuất', (row) => row.issueCode],
        ['Ngày', (row) => new Date(row.issueDate).toLocaleDateString('vi-VN')],
        ['Ca', (row) => row.shiftName ?? 'Cả ngày'],
        ['Kho', (row) => row.warehouse],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Yêu cầu', (row) => row.requestedQty],
        ['Đã xuất', (row) => row.issuedQty],
        ['Đơn vị', (row) => row.unit],
      ],
    },
    usage: {
      filename: 'su-dung-thuc-te',
      rows: usageRows,
      columns: [
        ['Phiếu xuất', (row) => row.issueCode],
        ['Ngày', (row) => new Date(row.issueDate).toLocaleDateString('vi-VN')],
        ['Ca', (row) => row.shiftName ?? 'Cả ngày'],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Đã xuất', (row) => row.issuedQty],
        ['Hoàn kho', (row) => row.returnedQty],
        ['Đã dùng', (row) => row.usedQty],
        ['Đơn vị', (row) => row.unit],
      ],
    },
    audit: {
      filename: 'audit',
      rows: auditRows,
      columns: [
        ['Thời gian', (row) => new Date(row.timestamp).toLocaleString('vi-VN')],
        ['Người thực hiện', (row) => row.actor],
        ['Mảng nghiệp vụ', (row) => row.businessArea],
        ['Đối tượng', (row) => row.fieldAffected],
        ['Giá trị cũ', (row) => row.oldValue],
        ['Giá trị mới', (row) => row.newValue],
        ['Lý do', (row) => row.reason],
      ],
    },
    'data-quality': {
      filename: 'data-quality',
      rows: dataQualityRows,
      columns: [
        ['Mức độ', (row) => row.severity],
        ['Hạn xử lý (SLA)', (row) => row.slaLabel],
        ['Priority', (row) => row.priorityRank],
        ['Trạng thái xử lý', (row) => formatWorkflowStatus(row.remediationStatus)],
        [uiCopy.reports.owner, (row) => row.owner],
        ['Nhóm lỗi', (row) => row.category],
        ['Bảng/entity', (row) => row.entityName],
        ['Mã', (row) => row.entityCode],
        ['Đối tượng', (row) => row.entityLabel],
        ['Vấn đề', (row) => row.message],
        ['Cách xử lý', (row) => row.suggestedAction],
        ['Route', (row) => row.route],
      ],
    },
  };

  const handleExportActiveReport = () => {
    const config = exportConfig[activeView];
    if (config.rows.length === 0) {
      return;
    }
    const csv = buildCsv(config.rows, config.columns);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${config.filename}-${timestamp}.csv`);
  };

  const openNextMovementPage = () => {
    const nextCursor = stockMovementView.phase === 'ready' && stockMovementView.data.hasNext
      ? toNextReportCursor(stockMovementView.data)
      : null;
    if (nextCursor) setMovementCursors((current) => [...current, nextCursor]);
  };

  const openNextAuditPage = () => {
    const nextCursor = auditView.phase === 'ready' && auditView.data.hasNext
      ? toNextReportCursor(auditView.data)
      : null;
    if (nextCursor) setAuditCursors((current) => [...current, nextCursor]);
  };

  // Chỉ số cảnh báo giá và nhật ký thay đổi cũng phải ẩn theo quyền: hiển thị "0" cho role
  // không được đọc dữ liệu đó là đánh lừa người dùng, không phải trạng thái thật.
  const reportContextItems: ContextStripItem[] = [
    ...(canReadReceiptPriceVariance
      ? [{ label: 'Cảnh báo giá', value: priceVarianceView.phase === 'ready' ? warningItems.length.toString() : '—', tone: priceVarianceView.phase !== 'ready' ? 'neutral' as const : warningItems.length ? 'danger' as const : 'success' as const }]
      : []),
    { label: 'Thiếu nguyên liệu', value: ingredientDemandView.phase === 'ready' ? shortageCount.toString() : '—', tone: ingredientDemandView.phase !== 'ready' ? 'neutral' : shortageCount ? 'danger' : 'success' },
    { label: 'Dòng tồn kho', value: currentStockView.phase === 'ready' ? currentStockView.data.totalCount.toString() : '—', tone: 'neutral' },
    ...(canReadAuditChanges
      ? [{ label: uiCopy.reports.audit, value: auditView.phase === 'ready' ? auditRows.length.toString() : '—', tone: 'neutral' as const }]
      : []),
    { label: uiCopy.reports.dataQuality, value: dataQualityView.phase === 'ready' ? dataQualityView.data.totalIssues.toString() : '—', tone: dataQualityView.phase !== 'ready' ? 'neutral' : dataQualityRows.length ? 'warning' : 'success' },
  ];


  return {
    activePriceView,
    activeReportView,
    activeView,
    auditCursor,
    auditCursors,
    auditResult,
    auditRows,
    canReadAuditChanges,
    canReadPurchaseReports,
    canReadReceiptPriceVariance,
    canReadWarehouseReports,
    currentStockResult,
    currentStockRows,
    dataQualityPage,
    dataQualityReport,
    dataQualityResult,
    dataQualityRows,
    dataQualitySearch,
    dateFrom,
    dateTo,
    demandPage,
    demandPageSize,
    dishGroupPage,
    exportConfig,
    handleExportActiveReport,
    ingredientDemandResult,
    ingredientDemandRows,
    initialPage,
    initialPriceSubView,
    initialView,
    isViewPending,
    kitchenIssueResult,
    kitchenIssueRows,
    kitchenPage,
    movementCursor,
    movementCursors,
    openNextAuditPage,
    openNextMovementPage,
    operationalPageSize,
    periodPage,
    priceAggregatePageSize,
    pricePage,
    pricePageSize,
    priceSubView,
    priceVarianceByDishGroupResult,
    priceVarianceByDishGroupRows,
    priceVarianceByPeriodResult,
    priceVarianceByPeriodRows,
    priceVarianceBySupplierResult,
    priceVarianceBySupplierRows,
    priceVarianceResult,
    priceVarianceRows,
    purchasePage,
    purchasePageSize,
    purchasePlanGroupBy,
    purchasePlanResult,
    purchasePlanRows,
    purchasePlanSummary,
    reportContextItems,
    reportPageSize,
    reportQuery,
    reportViews,
    requestedPriceSubView,
    requestedView,
    resetCursorPages,
    resetReportPages,
    resetReportPagesAndUrl,
    searchParams,
    selectedWarning,
    setAuditCursors,
    setDataQualityPage,
    setDataQualitySearch,
    setDateFrom,
    setDateTo,
    setDemandPage,
    setDemandPageSize,
    setDishGroupPage,
    setKitchenPage,
    setMovementCursors,
    setNumberedPage,
    setNumberedPageSize,
    setOperationalPageSize,
    setPeriodPage,
    setPriceAggregatePageSize,
    setPricePage,
    setPricePageSize,
    setPurchasePage,
    setPurchasePageSize,
    setPurchasePlanGroupBy,
    setRequestedPriceSubView,
    setRequestedView,
    setSearchParams,
    setShiftName,
    setSortDirection,
    setStockPage,
    setStockPageSize,
    setSupplierPage,
    setUsagePage,
    shiftName,
    shortageCount,
    sortDirection,
    startViewTransition,
    stockMovementResult,
    stockMovementRows,
    stockPage,
    stockPageSize,
    supplierPage,
    updateSearchState,
    usagePage,
    usageResult,
    usageRows,
    visiblePriceSubViewTabs,
    visibleReportTabs,
    visibleReportViews,
    warningItems,
  };
};

export type ReportsPageModel = ReturnType<typeof useReportsPageModel>;
