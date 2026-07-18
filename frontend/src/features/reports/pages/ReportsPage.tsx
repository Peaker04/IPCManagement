import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardList,
  Database,
  Download,
  Filter,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  CursorPaginationBar,
  ExceptionLane,
  FieldRow,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  TableViewport,
  SectionPanel,
  StatusBadge,
  StockMovementTable,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetAuditChangePageQuery,
  useGetCurrentStockPageQuery,
  useGetDataQualityPageQuery,
  useGetIngredientDemandPageQuery,
  useGetIssueVsReturnUsagePageQuery,
  useGetKitchenIssuesPageQuery,
  useGetPriceVariancePageQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceByDishGroupPageQuery,
  useGetPurchasePlanPageQuery,
  useGetStockMovementPageQuery,
  type StockMovement,
  type WorkflowReportQuery,
} from '@/features/workflow';
import { formatCurrency, formatPercent, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';
import { uiCopy } from '@/lib/uiCopy';
import { formatWorkflowStatus } from '@/features/workflow/workflowConfig';
import { normalizePurchasePlanGroupBy } from '../reportPlanning';

type ReportView = 'price' | 'demand' | 'purchase' | 'stock' | 'movement' | 'kitchen' | 'usage' | 'audit' | 'data-quality';

const reportTabs = [
  { id: 'reports-price', label: 'Biến động giá' },
  { id: 'reports-demand', label: 'Nhu cầu NVL' },
  { id: 'reports-purchase', label: 'Kế hoạch thu mua' },
  { id: 'reports-stock', label: 'Tồn kho' },
  { id: 'reports-movement', label: 'Nhập/xuất kho' },
  { id: 'reports-kitchen', label: 'Xuất bếp' },
  { id: 'reports-usage', label: 'Sử dụng thực tế' },
  { id: 'reports-audit', label: uiCopy.reports.audit },
  { id: 'reports-data-quality', label: uiCopy.reports.dataQuality },
];

const movementTypeLabel: Record<StockMovement['type'], string> = {
  receipt: 'Nhập kho',
  issue: 'Xuất kho',
  supplemental: 'Xuất bổ sung',
  return: 'Trả kho',
  adjustment: 'Điều chỉnh',
};

const escapeCsvValue = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const buildCsv = <T,>(rows: T[], columns: Array<[string, (row: T) => unknown]>) => {
  const headerLine = columns.map(([label]) => escapeCsvValue(label)).join(',');
  const rowLines = rows.map((row) => columns.map(([, getValue]) => escapeCsvValue(getValue(row))).join(','));
  return ['﻿' + headerLine, ...rowLines].join('\r\n');
};

const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center text-slate-500">
      Chưa có dữ liệu để hiển thị
    </td>
  </tr>
);

interface ReportCursor {
  cursorDate: string;
  cursorId?: string;
}

type PriceSubView = 'lines' | 'supplier' | 'period' | 'dishGroup';

const priceSubViewTabs: Array<{ id: PriceSubView; label: string }> = [
  { id: 'lines', label: 'Theo dòng nhập' },
  { id: 'supplier', label: 'Theo nhà cung cấp' },
  { id: 'period', label: 'Theo thời gian' },
  { id: 'dishGroup', label: 'Theo nhóm món' },
];

const validReportViews: ReportView[] = ['price', 'demand', 'purchase', 'stock', 'movement', 'kitchen', 'usage', 'audit', 'data-quality'];

const ReportsPage = () => {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [activeView, setActiveView] = useState<ReportView>(
    validReportViews.includes(initialView as ReportView) ? (initialView as ReportView) : 'price'
  );
  const [priceSubView, setPriceSubView] = useState<PriceSubView>('lines');
  const [purchasePlanGroupBy, setPurchasePlanGroupBy] = useState<'day' | 'week'>('day');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [movementCursors, setMovementCursors] = useState<ReportCursor[]>([]);
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const pricePageSize = 6;
  const [pricePage, setPricePage] = useState(1);
  const priceAggregatePageSize = 8;
  const [supplierPage, setSupplierPage] = useState(1);
  const [periodPage, setPeriodPage] = useState(1);
  const [dishGroupPage, setDishGroupPage] = useState(1);
  const reportPageSize = 20;
  const stockPageSize = 8;
  const [stockPage, setStockPage] = useState(1);
  const demandPageSize = 8;
  const [demandPage, setDemandPage] = useState(1);
  const purchasePageSize = 8;
  const [purchasePage, setPurchasePage] = useState(1);
  const operationalPageSize = 8;
  const [kitchenPage, setKitchenPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [dataQualityPage, setDataQualityPage] = useState(1);

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

  const reportQuery: WorkflowReportQuery = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    shiftName: shiftName || undefined,
    limit: 100,
  };

  const priceVarianceResult = useGetPriceVariancePageQuery({
    ...reportQuery,
    pageNumber: pricePage,
    pageSize: pricePageSize,
  }, { skip: activeView !== 'price' || priceSubView !== 'lines' });
  const priceVarianceBySupplierResult = useGetPriceVarianceBySupplierPageQuery({ ...reportQuery, pageNumber: supplierPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'supplier' });
  const priceVarianceByPeriodResult = useGetPriceVarianceByPeriodPageQuery({ ...reportQuery, pageNumber: periodPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'period' });
  const priceVarianceByDishGroupResult = useGetPriceVarianceByDishGroupPageQuery({ ...reportQuery, pageNumber: dishGroupPage, pageSize: priceAggregatePageSize }, { skip: activeView !== 'price' || priceSubView !== 'dishGroup' });
  const priceVarianceBySupplierRows = priceVarianceBySupplierResult.data?.items ?? [];
  const priceVarianceByPeriodRows = priceVarianceByPeriodResult.data?.items ?? [];
  const priceVarianceByDishGroupRows = priceVarianceByDishGroupResult.data?.items ?? [];
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
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'movement' });
  const kitchenIssueResult = useGetKitchenIssuesPageQuery({ ...reportQuery, pageNumber: kitchenPage, pageSize: operationalPageSize }, { skip: activeView !== 'kitchen' });
  const usageResult = useGetIssueVsReturnUsagePageQuery({ ...reportQuery, pageNumber: usagePage, pageSize: operationalPageSize }, { skip: activeView !== 'usage' });
  const auditResult = useGetAuditChangePageQuery({
    ...reportQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'audit' });
  const dataQualityResult = useGetDataQualityPageQuery({ ...reportQuery, pageNumber: dataQualityPage, pageSize: operationalPageSize }, { skip: activeView !== 'data-quality' });

  const priceVarianceRows = priceVarianceResult.data?.items ?? [];
  const ingredientDemandRows = ingredientDemandResult.data?.items ?? [];
  const purchasePlanRows = purchasePlanResult.data?.items ?? [];
  const purchasePlanSummary = {
    rowCount: purchasePlanResult.data?.totalCount ?? 0,
    totalShortageQty: purchasePlanResult.data?.totalShortageQty ?? 0,
    totalEstimatedAmount: purchasePlanResult.data?.totalEstimatedAmount ?? 0,
    shortageTone: (purchasePlanResult.data?.totalShortageQty ?? 0) > 0 ? 'danger' as const : 'success' as const,
  };
  const currentStockRows = currentStockResult.data?.items ?? [];
  const stockMovementRows = stockMovementResult.data?.items ?? [];
  const kitchenIssueRows = kitchenIssueResult.data?.items ?? [];
  const usageRows = usageResult.data?.items ?? [];
  const auditRows = auditResult.data?.items ?? [];
  const dataQualityReport = dataQualityResult.data;
  const dataQualityRows = dataQualityReport?.page.items ?? [];

  const warningItems = priceVarianceRows.filter((item) => item.warning);
  const selectedWarning = warningItems[0];
  const shortageCount = ingredientDemandResult.data?.shortageCount ?? 0;
  const reportStates: Record<ReportView, { isFetching: boolean; isError: boolean }> = {
    price: priceVarianceResult,
    demand: ingredientDemandResult,
    purchase: purchasePlanResult,
    stock: currentStockResult,
    movement: stockMovementResult,
    kitchen: kitchenIssueResult,
    usage: usageResult,
    audit: auditResult,
    'data-quality': dataQualityResult,
  };
  const activeReportState = reportStates[activeView];

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
        ['SLA', (row) => row.slaLabel],
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
    const page = stockMovementResult.data;
    if (page?.hasNext && page.nextCursorDate) {
      setMovementCursors((current) => [...current, {
        cursorDate: page.nextCursorDate!,
        cursorId: page.nextCursorId,
      }]);
    }
  };

  const openNextAuditPage = () => {
    const page = auditResult.data;
    if (page?.hasNext && page.nextCursorDate) {
      setAuditCursors((current) => [...current, {
        cursorDate: page.nextCursorDate!,
        cursorId: page.nextCursorId,
      }]);
    }
  };

  const warningQueue = warningItems.map((item) => ({
    title: item.name,
    description: `Tăng ${formatPercent(item.change)} tại ${item.supplier}. Giá hiện tại ${formatCurrency(item.priceCurrent)}/${formatUnit(item.unit)}.`,
    action: (
      <div className="ipc-report-warning-actions">
        <Link className="ipc-button ipc-button-warning ipc-button-bounded" to={ROUTES.PURCHASING}>
          Thu mua xử lí
        </Link>
        <Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.APPROVALS}>
          Gửi quản lí duyệt
        </Link>
      </div>
    ),
    tone: 'danger' as const,
  }));

  return (
    <OperationalFrame
      eyebrow="Dữ liệu vận hành"
      title="Phân tích và thống kê workflow"
      command={
        <CommandBar
          actions={
            <button
              type="button"
              className="ipc-button ipc-button-primary"
              onClick={handleExportActiveReport}
              disabled={exportConfig[activeView].rows.length === 0}
            >
              <Download size={16} />
              Xuất báo cáo
            </button>
          }
        >
          <div className="ipc-command-meta">
            <Filter size={16} />
            <span>Bộ lọc báo cáo</span>
          </div>
          <FieldRow label="Từ ngày" htmlFor="report-date-from">
            <input
              id="report-date-from"
              type="date"
              className="ipc-input"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                resetReportPages();
              }}
            />
          </FieldRow>
          <FieldRow label="Đến ngày" htmlFor="report-date-to">
            <input
              id="report-date-to"
              type="date"
              className="ipc-input"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                resetReportPages();
              }}
            />
          </FieldRow>
          <FieldRow label="Ca" htmlFor="report-shift">
            <select id="report-shift" className="ipc-select" value={shiftName} onChange={(event) => { setShiftName(event.target.value); resetReportPages(); }}>
              <option value="">Tất cả</option>
              <option value="MORNING">Ca sáng</option>
              <option value="AFTERNOON">Ca chiều</option>
            </select>
          </FieldRow>
          {(activeView === 'movement' || activeView === 'audit') && (
            <FieldRow label="Sắp xếp" htmlFor="report-sort-direction">
              <select
                id="report-sort-direction"
                className="ipc-select"
                value={sortDirection}
                onChange={(event) => {
                  setSortDirection(event.target.value as 'desc' | 'asc');
                  resetCursorPages();
                }}
              >
                <option value="desc">Mới nhất trước</option>
                <option value="asc">Cũ nhất trước</option>
              </select>
            </FieldRow>
          )}
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Cảnh báo giá', value: warningItems.length.toString(), tone: warningItems.length ? 'danger' : 'success' },
            { label: 'Thiếu nguyên liệu', value: shortageCount.toString(), tone: shortageCount ? 'danger' : 'success' },
            { label: 'Dòng tồn kho', value: currentStockRows.length.toString(), tone: 'neutral' },
            { label: uiCopy.reports.audit, value: auditRows.length.toString(), tone: 'neutral' },
            { label: uiCopy.reports.dataQuality, value: (dataQualityReport?.totalIssues ?? 0).toString(), tone: dataQualityRows.length ? 'warning' : 'success' },
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn loại báo cáo vận hành"
        tabs={reportTabs}
        activeTab={`reports-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('reports-', '') as ReportView)}
      />

      {activeReportState.isFetching && (
        <InlineAlert title="Đang tải dữ liệu báo cáo" variant="info">
          Hệ thống đang lấy dữ liệu báo cáo quy trình cho tab đang mở.
        </InlineAlert>
      )}

      {activeReportState.isError && (
        <InlineAlert title="Không tải được dữ liệu báo cáo" variant="danger">
          Vui lòng kiểm tra quyền truy cập hoặc dữ liệu mẫu trước khi đối chiếu.
        </InlineAlert>
      )}

      {activeView === 'price' && (
        <div id="reports-price-panel" role="tabpanel" aria-labelledby="reports-price-tab" className="flex flex-col gap-4">
          <ExceptionLane
            title="Hàng đợi cảnh báo giá"
            items={warningQueue}
            empty="Không có nguyên liệu vượt ngưỡng trong kỳ này."
          />

          <ViewSwitcher
            compact
            ariaLabel="Chọn cách phân tích biến động giá"
            tabs={priceSubViewTabs.map((tab) => ({ id: `price-sub-${tab.id}`, label: tab.label }))}
            activeTab={`price-sub-${priceSubView}`}
            onTabChange={(id) => setPriceSubView(id.replace('price-sub-', '') as PriceSubView)}
          />

          {priceSubView === 'supplier' && (
            <SectionPanel title="Biến động giá theo nhà cung cấp" icon={<ClipboardList size={18} color="#475569" />}>
              <TableViewport ariaLabel="Bảng biến động giá theo nhà cung cấp">
                <table className="ipc-data-table">
                  <thead>
                    <tr>
                      <th>Nguyên liệu</th>
                      <th>Nhà cung cấp</th>
                      <th>Số lần nhập</th>
                      <th>Giá TB</th>
                      <th>Giá thấp nhất</th>
                      <th>Giá cao nhất</th>
                      <th>Giá tham chiếu</th>
                      <th>% biến động</th>
                      <th>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceVarianceBySupplierRows.length === 0 ? (
                      <EmptyRow colSpan={9} />
                    ) : (
                      priceVarianceBySupplierRows.map((row) => (
                        <tr key={`${row.ingredientId}-${row.supplierId}`} className={row.isWarning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                          <td>{row.ingredientName}</td>
                          <td>{row.supplierName}</td>
                          <td className="ipc-numeric-cell">{row.receiptCount}</td>
                          <td className="ipc-numeric-cell">{formatCurrency(row.avgUnitPrice)}</td>
                          <td className="ipc-numeric-cell">{formatCurrency(row.minUnitPrice)}</td>
                          <td className="ipc-numeric-cell">{formatCurrency(row.maxUnitPrice)}</td>
                          <td className="ipc-numeric-cell">{formatCurrency(row.referencePrice)}</td>
                          <td className="ipc-numeric-cell">{formatPercent(row.variancePercent)}</td>
                          <td className="ipc-badge-cell">
                            {row.isWarning ? (
                              <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableViewport>
              <PaginationBar page={priceVarianceBySupplierResult.data?.pageNumber ?? supplierPage} pageSize={priceVarianceBySupplierResult.data?.pageSize ?? priceAggregatePageSize} totalItems={priceVarianceBySupplierResult.data?.totalCount ?? 0} onPageChange={setSupplierPage} />
            </SectionPanel>
          )}

          {priceSubView === 'period' && (
            <SectionPanel title="Biến động giá theo thời gian (theo tháng)" icon={<ClipboardList size={18} color="#475569" />}>
              <TableViewport ariaLabel="Bảng biến động giá theo thời gian">
                <table className="ipc-data-table">
                  <thead>
                    <tr>
                      <th>Nguyên liệu</th>
                      <th>Tháng</th>
                      <th>Giá TB</th>
                      <th>% so với tham chiếu</th>
                      <th>% so với tháng trước</th>
                      <th>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceVarianceByPeriodRows.length === 0 ? (
                      <EmptyRow colSpan={6} />
                    ) : (
                      priceVarianceByPeriodRows.map((row) => (
                        <tr key={`${row.ingredientId}-${row.periodLabel}`} className={row.isWarning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                          <td>{row.ingredientName}</td>
                          <td>{row.periodLabel}</td>
                          <td className="ipc-numeric-cell">{formatCurrency(row.avgUnitPrice)}</td>
                          <td className="ipc-numeric-cell">{formatPercent(row.variancePercentVsReference)}</td>
                          <td className="ipc-numeric-cell">
                            {row.variancePercentVsPreviousPeriod == null ? '—' : formatPercent(row.variancePercentVsPreviousPeriod)}
                          </td>
                          <td className="ipc-badge-cell">
                            {row.isWarning ? (
                              <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableViewport>
              <PaginationBar page={priceVarianceByPeriodResult.data?.pageNumber ?? periodPage} pageSize={priceVarianceByPeriodResult.data?.pageSize ?? priceAggregatePageSize} totalItems={priceVarianceByPeriodResult.data?.totalCount ?? 0} onPageChange={setPeriodPage} />
            </SectionPanel>
          )}

          {priceSubView === 'dishGroup' && (
            <SectionPanel title="Biến động giá theo nhóm món (có trọng số theo định lượng nguyên liệu)" icon={<ClipboardList size={18} color="#475569" />}>
              <TableViewport ariaLabel="Bảng biến động giá theo nhóm món">
                <table className="ipc-data-table">
                  <thead>
                    <tr>
                      <th>Nhóm món</th>
                      <th>Số nguyên liệu</th>
                      <th>Số NL vượt ngưỡng</th>
                      <th>% biến động (có trọng số)</th>
                      <th>Nguyên liệu ảnh hưởng nhiều nhất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceVarianceByDishGroupRows.length === 0 ? (
                      <EmptyRow colSpan={5} />
                    ) : (
                      priceVarianceByDishGroupRows.map((row) => (
                        <tr key={row.dishGroup} className={row.warningIngredientCount > 0 ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                          <td>{row.dishGroup}</td>
                          <td className="ipc-numeric-cell">{row.ingredientCount}</td>
                          <td className="ipc-numeric-cell">{row.warningIngredientCount}</td>
                          <td className="ipc-numeric-cell">{formatPercent(row.weightedAvgVariancePercent)}</td>
                          <td className="text-left">
                            {row.topIngredients.map((ing) => `${ing.ingredientName} (${formatPercent(ing.variancePercent)})`).join(', ')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableViewport>
              <PaginationBar page={priceVarianceByDishGroupResult.data?.pageNumber ?? dishGroupPage} pageSize={priceVarianceByDishGroupResult.data?.pageSize ?? priceAggregatePageSize} totalItems={priceVarianceByDishGroupResult.data?.totalCount ?? 0} onPageChange={setDishGroupPage} />
            </SectionPanel>
          )}

          {priceSubView === 'lines' && (
          <SectionPanel title="Bảng biến động giá nguyên liệu" icon={<ClipboardList size={18} color="#475569" />}>
            <TableViewport ariaLabel="Bảng biến động giá nguyên liệu" className="ipc-report-table-shell">
              <table className="ipc-data-table ipc-report-table">
                <thead>
                  <tr>
                    <th>Tên nguyên liệu</th>
                    <th>ĐV</th>
                    <th>Giá tham chiếu</th>
                    <th>Giá nhập</th>
                    <th>Thay đổi</th>
                    <th>Đánh giá</th>
                    <th>Xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {priceVarianceRows.length === 0 ? (
                    <EmptyRow colSpan={7} />
                  ) : (
                    priceVarianceRows.map((item, index) => (
                      <tr key={`${item.id}-${pricePage}-${index}`} className={item.warning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                        <td className={item.warning ? 'ipc-report-material-cell is-warning' : 'ipc-report-material-cell'}>
                          <span className="ipc-report-material">
                            {item.warning ? <AlertTriangle size={14} className="text-[var(--ipc-danger)]" /> : <TrendingUp size={14} color="#475569" />}
                            <span className="ipc-report-material-copy">
                              <span>{item.name}</span>
                              <span className="text-xs font-normal text-slate-400">{item.supplier}</span>
                            </span>
                          </span>
                        </td>
                        <td>{formatUnit(item.unit)}</td>
                        <td className="ipc-numeric-cell">{formatCurrency(item.pricePrev)}</td>
                        <td className="ipc-numeric-cell font-bold">{formatCurrency(item.priceCurrent)}</td>
                        <td className={item.warning ? 'ipc-numeric-cell font-bold text-[var(--ipc-danger)]' : item.change > 0 ? 'ipc-numeric-cell font-bold text-[var(--ipc-warning)]' : 'ipc-numeric-cell text-slate-600'}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            {item.change > 0 && <span className="inline-block text-[10px] text-inherit">▲</span>}
                            {item.change > 0 ? `+${formatPercent(item.change)}` : '0%'}
                          </span>
                        </td>
                        <td className="ipc-badge-cell">
                          {item.warning ? (
                            <StatusBadge variant="danger" className="ipc-table-badge ipc-table-badge--status">Vượt ngưỡng</StatusBadge>
                          ) : item.change > 0 ? (
                            <StatusBadge variant="warning" className="ipc-table-badge ipc-table-badge--status">Theo dõi</StatusBadge>
                          ) : (
                            <StatusBadge variant="success" className="ipc-table-badge ipc-table-badge--status">Ổn định</StatusBadge>
                          )}
                        </td>
                        <td className="ipc-report-action-cell">
                          {item.warning ? 'Thu mua xử lí, duyệt nếu vẫn vượt ngưỡng' : 'Theo dõi kỳ kế'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={priceVarianceResult.data?.pageNumber ?? pricePage}
              pageSize={priceVarianceResult.data?.pageSize ?? pricePageSize}
              totalItems={priceVarianceResult.data?.totalCount ?? 0}
              onPageChange={setPricePage}
            />
          </SectionPanel>
          )}

          {priceSubView === 'lines' && selectedWarning && (
            <div className="ipc-split-detail-strip ipc-report-warning-detail">
              <div className="ipc-split-detail-label mb-3">Tác động vận hành — {selectedWarning.name}</div>
              <div className="flex flex-wrap items-start gap-4">
                <div className="ipc-report-warning-card min-w-[240px] flex-1 rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-3 text-sm text-[var(--ipc-danger)]">
                  <div className="font-bold text-[14px]">Vượt ngưỡng {formatPercent(selectedWarning.change)}</div>
                  <div className="mt-1 leading-5">
                    Giá tăng từ {formatCurrency(selectedWarning.pricePrev)} lên {formatCurrency(selectedWarning.priceCurrent)}/{formatUnit(selectedWarning.unit)}.
                  </div>
                </div>
                <div className="ipc-report-warning-card rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 min-w-[240px] flex-1">
                  <div className="font-bold text-slate-900 text-[14px]">Hành động đề xuất</div>
                  <p className="mt-1 leading-5 text-slate-500">
                    Thu mua kiểm tra nhà cung cấp thay thế, sau đó gửi quản lí duyệt nếu giá vẫn vượt ngưỡng.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="ipc-button ipc-button-warning ipc-button-bounded shadow-sm" to={ROUTES.PURCHASING}>Mở thu mua</Link>
                    <Link className="ipc-button ipc-button-ghost ipc-button-bounded shadow-sm" to={ROUTES.APPROVALS}>Mở duyệt vận hành</Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="Nhu cầu nguyên liệu theo ngày, ca, khách hàng và món" icon={<Utensils size={18} />}>
          <TableViewport ariaLabel="Bảng nhu cầu nguyên liệu">
            <table className="ipc-data-table ipc-status-action-table">
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Nguồn</th>
                  <th>Cần</th>
                  <th>Tồn hiện có</th>
                  <th>Thiếu/mua</th>
                  <th>Trạng thái</th>
                  <th>Handoff</th>
                </tr>
              </thead>
              <tbody>
                {ingredientDemandRows.length === 0 ? <EmptyRow colSpan={7} /> : ingredientDemandRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{row.material}</td>
                    <td>{row.source}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.required, row.unit)}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.available, row.unit)}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(Math.max(row.required - row.available, 0), row.unit)}</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={row.tone}>{formatWorkflowStatus(row.status)}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={row.tone === 'danger' ? ROUTES.PURCHASING : ROUTES.WAREHOUSE}>{row.nextAction}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={ingredientDemandResult.data?.pageNumber ?? demandPage}
            pageSize={ingredientDemandResult.data?.pageSize ?? demandPageSize}
            totalItems={ingredientDemandResult.data?.totalCount ?? 0}
            onPageChange={setDemandPage}
          />
        </SectionPanel>
      )}

      {activeView === 'purchase' && (
        <SectionPanel
          title="Kế hoạch thu mua dự kiến"
          icon={<ShoppingCart size={18} />}
          badge={(
            <div className="flex flex-wrap gap-2">
              {(['day', 'week'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`ipc-button ${purchasePlanGroupBy === mode ? 'ipc-button-primary' : 'ipc-button-ghost'}`}
                    onClick={() => setPurchasePlanGroupBy(normalizePurchasePlanGroupBy(mode))}
                  >
                  {mode === 'day' ? 'Theo ngày' : 'Theo tuần'}
                </button>
              ))}
            </div>
          )}
        >
          <ContextStrip
            items={[
              { label: 'Dòng kế hoạch', value: String(purchasePlanSummary.rowCount), tone: purchasePlanSummary.rowCount ? 'info' : 'neutral' },
              { label: 'Thiếu sau pending', value: formatQuantityWithUnit(purchasePlanSummary.totalShortageQty, ''), tone: purchasePlanSummary.shortageTone },
              { label: 'Tổng dự kiến', value: formatCurrency(purchasePlanSummary.totalEstimatedAmount), tone: 'neutral' },
            ]}
          />
          <TableViewport ariaLabel="Bảng kế hoạch thu mua dự kiến">
            <table className="ipc-data-table ipc-status-action-table">
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th>Nguyên liệu</th>
                  <th>Cần</th>
                  <th>Tồn</th>
                  <th>{uiCopy.reports.pending}</th>
                  <th>Đề xuất mua</th>
                    <th>Nhà cung cấp</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {purchasePlanRows.length === 0 ? <EmptyRow colSpan={8} /> : purchasePlanRows.map((row) => (
                  <tr key={`${row.periodKey}-${row.ingredientId}-${row.unitId}`}>
                    <td>{row.periodKey}</td>
                    <td>{row.ingredientName ?? row.ingredientId}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.requiredQty, row.unitName ?? '')}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentStockQty, row.unitName ?? '')}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.pendingReceiptQty, row.unitName ?? '')}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.shortageQty, row.unitName ?? '')}</td>
                    <td>{row.supplierName ?? 'Chưa có báo giá'}</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={row.warnings.length ? 'warning' : 'success'}>
                        {row.warnings[0] ?? 'Sẵn sàng'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={purchasePlanResult.data?.pageNumber ?? purchasePage}
            pageSize={purchasePlanResult.data?.pageSize ?? purchasePageSize}
            totalItems={purchasePlanResult.data?.totalCount ?? 0}
            onPageChange={setPurchasePage}
          />

        </SectionPanel>
      )}

      {activeView === 'stock' && (
        <SectionPanel title="Tồn kho hiện tại và xu hướng luân chuyển" icon={<Warehouse size={18} />}>
          <TableViewport ariaLabel="Bảng tồn kho hiện tại">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Kho</th>
                  <th>Nguyên liệu</th>
                  <th>Số lượng hiện tại</th>
                  <th>Cập nhật</th>
                  <th>Handoff</th>
                </tr>
              </thead>
              <tbody>
                {currentStockRows.length === 0 ? <EmptyRow colSpan={5} /> : currentStockRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{row.warehouse}</td>
                    <td>{row.ingredient}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                    <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={currentStockResult.data?.pageNumber ?? stockPage}
            pageSize={currentStockResult.data?.pageSize ?? stockPageSize}
            totalItems={currentStockResult.data?.totalCount ?? 0}
            onPageChange={setStockPage}
          />
        </SectionPanel>
      )}

      {activeView === 'movement' && (
        <SectionPanel title="Lịch sử nhập, xuất, trả và điều chỉnh kho" icon={<ArrowLeftRight size={18} />}>
          <StockMovementTable movements={stockMovementRows} pageSize={reportPageSize} />
          <CursorPaginationBar
            page={movementCursors.length + 1}
            hasNext={stockMovementResult.data?.hasNext ?? false}
            onPrevious={() => setMovementCursors((current) => current.slice(0, -1))}
            onNext={openNextMovementPage}
          />
        </SectionPanel>
      )}

      {activeView === 'kitchen' && (
        <SectionPanel title="Xuất kho cho bếp theo ca" icon={<PackageCheck size={18} />}>
          <TableViewport ariaLabel="Bảng xuất kho cho bếp">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Phiếu xuất</th>
                  <th>Ngày</th>
                  <th>Ca</th>
                  <th>Kho</th>
                  <th>Nguyên liệu</th>
                  <th>Yêu cầu</th>
                  <th>Đã xuất</th>
                </tr>
              </thead>
              <tbody>
                {kitchenIssueRows.length === 0 ? <EmptyRow colSpan={7} /> : kitchenIssueRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td className="font-mono">{row.issueCode}</td>
                    <td>{new Date(row.issueDate).toLocaleDateString('vi-VN')}</td>
                    <td>{row.shiftName ?? 'Cả ngày'}</td>
                    <td>{row.warehouse}</td>
                    <td>{row.ingredient}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.requestedQty, row.unit)}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.issuedQty, row.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar page={kitchenIssueResult.data?.pageNumber ?? kitchenPage} pageSize={kitchenIssueResult.data?.pageSize ?? operationalPageSize} totalItems={kitchenIssueResult.data?.totalCount ?? 0} onPageChange={setKitchenPage} />
        </SectionPanel>
      )}

      {activeView === 'usage' && (
        <SectionPanel title="Sử dụng thực tế của bếp: đã xuất - hoàn kho" icon={<RotateCcw size={18} />}>
          <TableViewport ariaLabel="Bảng sử dụng thực tế sau hoàn kho">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Phiếu xuất</th>
                  <th>Ngày</th>
                  <th>Ca</th>
                  <th>Nguyên liệu</th>
                  <th>Đã xuất</th>
                  <th>Hoàn kho</th>
                  <th>Đã dùng</th>
                </tr>
              </thead>
              <tbody>
                {usageRows.length === 0 ? <EmptyRow colSpan={7} /> : usageRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td className="font-mono">{row.issueCode}</td>
                    <td>{new Date(row.issueDate).toLocaleDateString('vi-VN')}</td>
                    <td>{row.shiftName ?? 'Cả ngày'}</td>
                    <td>{row.ingredient}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.issuedQty, row.unit)}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.returnedQty, row.unit)}</td>
                    <td className="ipc-numeric-cell font-bold">{formatQuantityWithUnit(row.usedQty, row.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar page={usageResult.data?.pageNumber ?? usagePage} pageSize={usageResult.data?.pageSize ?? operationalPageSize} totalItems={usageResult.data?.totalCount ?? 0} onPageChange={setUsagePage} />
        </SectionPanel>
      )}

      {activeView === 'audit' && (
        <SectionPanel title={`${uiCopy.reports.audit} định lượng, tồn kho, số suất và chứng từ`} icon={<Database size={18} />}>
          <TableViewport ariaLabel="Bảng audit thay đổi hệ thống">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Mảng nghiệp vụ</th>
                  <th>Đối tượng</th>
                  <th>Giá trị cũ</th>
                  <th>Giá trị mới</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 ? <EmptyRow colSpan={7} /> : auditRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{new Date(row.timestamp).toLocaleString('vi-VN')}</td>
                    <td>{row.actor}</td>
                    <td>{row.businessArea}</td>
                    <td>{row.fieldAffected}</td>
                    <td>{row.oldValue}</td>
                    <td>{row.newValue}</td>
                    <td className="text-left">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <CursorPaginationBar
            page={auditCursors.length + 1}
            hasNext={auditResult.data?.hasNext ?? false}
            onPrevious={() => setAuditCursors((current) => current.slice(0, -1))}
            onNext={openNextAuditPage}
          />
        </SectionPanel>
      )}

      {activeView === 'data-quality' && (
        <SectionPanel title={uiCopy.reports.preProductionQuality} icon={<AlertTriangle size={18} />}>
          <ContextStrip
            items={[
              { label: 'Tổng issue', value: (dataQualityReport?.totalIssues ?? 0).toString(), tone: dataQualityRows.length ? 'warning' : 'success' },
              { label: uiCopy.reports.error, value: (dataQualityReport?.errorCount ?? 0).toString(), tone: dataQualityReport?.errorCount ? 'danger' : 'success' },
              { label: uiCopy.reports.warning, value: (dataQualityReport?.warningCount ?? 0).toString(), tone: dataQualityReport?.warningCount ? 'warning' : 'success' },
              { label: 'SLA gấp', value: (dataQualityReport?.urgentIssueCount ?? 0).toString(), tone: dataQualityReport?.urgentIssueCount ? 'danger' : 'success' },
              { label: uiCopy.reports.resolvedWithIssues, value: (dataQualityReport?.resolvedIssueCount ?? 0).toString(), tone: dataQualityReport?.resolvedIssueCount ? 'warning' : 'success' },
              { label: 'Thiếu định lượng', value: (dataQualityReport?.missingBomCount ?? 0).toString(), tone: dataQualityReport?.missingBomCount ? 'warning' : 'success' },
              { label: 'Thiếu quy đổi', value: (dataQualityReport?.missingConversionCount ?? 0).toString(), tone: dataQualityReport?.missingConversionCount ? 'warning' : 'success' },
            ]}
          />
          <TableViewport ariaLabel="Bảng data quality trước production">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Mức độ</th>
                  <th>SLA</th>
                  <th>Trạng thái xử lý</th>
                  <th>{uiCopy.reports.owner}</th>
                  <th>Nhóm lỗi</th>
                  <th>Đối tượng</th>
                  <th>Vấn đề</th>
                  <th>Cách xử lý</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dataQualityRows.length === 0 ? <EmptyRow colSpan={9} /> : dataQualityRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <StatusBadge variant={row.severity === 'error' ? 'danger' : 'warning'} className="ipc-table-badge ipc-table-badge--status">
                        {row.severity === 'error' ? uiCopy.reports.error : uiCopy.reports.warning}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800">{row.slaLabel}</div>
                      <div className="text-xs text-slate-500">Priority {row.priorityRank}</div>
                    </td>
                    <td>
                      <StatusBadge variant={row.remediationStatus === 'resolved' ? 'warning' : row.remediationStatus === 'reopened' ? 'danger' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                        {formatWorkflowStatus(row.remediationStatus)}
                      </StatusBadge>
                    </td>
                    <td>{row.owner}</td>
                    <td>{row.category}</td>
                    <td>
                      <div className="font-medium text-slate-800">{row.entityLabel}</div>
                      <div className="text-xs text-slate-500">{row.entityName} / {row.entityCode}</div>
                    </td>
                    <td className="text-left">{row.message}</td>
                    <td className="text-left">{row.suggestedAction}</td>
                    <td>
                      {row.route ? (
                        <Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={row.route}>
                          Xử lý
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar page={dataQualityResult.data?.page.pageNumber ?? dataQualityPage} pageSize={dataQualityResult.data?.page.pageSize ?? operationalPageSize} totalItems={dataQualityResult.data?.page.totalCount ?? 0} onPageChange={setDataQualityPage} />
        </SectionPanel>
      )}
    </OperationalFrame>
  );
};

export default ReportsPage;
