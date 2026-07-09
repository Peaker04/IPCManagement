import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
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
  DataTableShell,
  ExceptionLane,
  FieldRow,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  SectionPanel,
  StatusBadge,
  StockMovementTable,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetAuditChangePageQuery,
  useGetCurrentStockQuery,
  useGetDataQualityQuery,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetPriceVarianceQuery,
  useGetPriceVarianceBySupplierQuery,
  useGetPriceVarianceByPeriodQuery,
  useGetPriceVarianceByDishGroupQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementPageQuery,
  type StockMovement,
  type WorkflowReportQuery,
} from '@/features/workflow';
import { formatCurrency, formatPercent, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';

type ReportView = 'price' | 'demand' | 'purchase' | 'stock' | 'movement' | 'kitchen' | 'usage' | 'audit' | 'data-quality';

const reportTabs = [
  { id: 'reports-price', label: 'Biến động giá' },
  { id: 'reports-demand', label: 'Nhu cầu NVL' },
  { id: 'reports-purchase', label: 'Nhu cầu mua' },
  { id: 'reports-stock', label: 'Tồn kho' },
  { id: 'reports-movement', label: 'Nhập/xuất kho' },
  { id: 'reports-kitchen', label: 'Xuất bếp' },
  { id: 'reports-usage', label: 'Sử dụng thực tế' },
  { id: 'reports-audit', label: 'Audit' },
  { id: 'reports-data-quality', label: 'Data quality' },
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

const CursorPagination = ({
  page,
  hasNext,
  onPrevious,
  onNext,
}: {
  page: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) => (
  <nav className="ipc-pagination-bar" aria-label="Phân trang báo cáo">
    <div className="ipc-pagination-range">Trang {page}, tải theo cursor</div>
    <div className="ipc-pagination-actions">
      <button
        type="button"
        className="ipc-pagination-button"
        disabled={page <= 1}
        onClick={onPrevious}
        aria-label="Trang trước"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="ipc-pagination-page" aria-live="polite">Trang {page}</span>
      <button
        type="button"
        className="ipc-pagination-button"
        disabled={!hasNext}
        onClick={onNext}
        aria-label="Trang sau"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  </nav>
);

type PriceSubView = 'lines' | 'supplier' | 'period' | 'dishGroup';

const priceSubViewTabs: Array<{ id: PriceSubView; label: string }> = [
  { id: 'lines', label: 'Theo dòng nhập' },
  { id: 'supplier', label: 'Theo NCC' },
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
  const [pricePage, setPricePage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [movementCursors, setMovementCursors] = useState<ReportCursor[]>([]);
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const pricePageSize = 6;
  const reportPageSize = 20;

  const resetCursorPages = () => {
    setMovementCursors([]);
    setAuditCursors([]);
  };

  const reportQuery: WorkflowReportQuery = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    shiftName: shiftName || undefined,
    limit: 100,
  };

  const priceVarianceResult = useGetPriceVarianceQuery(reportQuery);
  const priceVarianceBySupplierResult = useGetPriceVarianceBySupplierQuery(reportQuery, { skip: activeView !== 'price' || priceSubView !== 'supplier' });
  const priceVarianceByPeriodResult = useGetPriceVarianceByPeriodQuery(reportQuery, { skip: activeView !== 'price' || priceSubView !== 'period' });
  const priceVarianceByDishGroupResult = useGetPriceVarianceByDishGroupQuery(reportQuery, { skip: activeView !== 'price' || priceSubView !== 'dishGroup' });
  const priceVarianceBySupplierRows = priceVarianceBySupplierResult.data ?? [];
  const priceVarianceByPeriodRows = priceVarianceByPeriodResult.data ?? [];
  const priceVarianceByDishGroupRows = priceVarianceByDishGroupResult.data ?? [];
  const ingredientDemandResult = useGetIngredientDemandQuery(reportQuery);
  const purchaseDemandResult = useGetPurchaseDemandQuery(reportQuery);
  const currentStockResult = useGetCurrentStockQuery({ limit: 100 });
  const movementCursor = movementCursors.at(-1);
  const auditCursor = auditCursors.at(-1);
  const stockMovementResult = useGetStockMovementPageQuery({
    ...reportQuery,
    cursorDate: movementCursor?.cursorDate,
    cursorId: movementCursor?.cursorId,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'movement' });
  const kitchenIssueResult = useGetKitchenIssuesQuery(reportQuery);
  const usageResult = useGetIssueVsReturnUsageQuery(reportQuery);
  const auditResult = useGetAuditChangePageQuery({
    ...reportQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'audit' });
  const dataQualityResult = useGetDataQualityQuery(reportQuery);

  const priceVarianceRows = priceVarianceResult.data ?? [];
  const ingredientDemandRows = ingredientDemandResult.data ?? [];
  const purchaseDemandRows = purchaseDemandResult.data ?? [];
  const currentStockRows = currentStockResult.data ?? [];
  const stockMovementRows = stockMovementResult.data?.items ?? [];
  const kitchenIssueRows = kitchenIssueResult.data ?? [];
  const usageRows = usageResult.data ?? [];
  const auditRows = auditResult.data?.items ?? [];
  const dataQualityReport = dataQualityResult.data;
  const dataQualityRows = dataQualityReport?.issues ?? [];

  const warningItems = priceVarianceRows.filter((item) => item.warning);
  const selectedWarning = warningItems[0];
  const shortageItems = ingredientDemandRows.filter((item) => item.tone === 'danger');
  const totalPricePages = Math.max(1, Math.ceil(priceVarianceRows.length / pricePageSize));
  const safePricePage = Math.min(pricePage, totalPricePages);
  const pagedPriceVarianceRows = priceVarianceRows.slice((safePricePage - 1) * pricePageSize, safePricePage * pricePageSize);
  const reportStates: Record<ReportView, { isFetching: boolean; isError: boolean }> = {
    price: priceVarianceResult,
    demand: ingredientDemandResult,
    purchase: purchaseDemandResult,
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
        ['Trạng thái', (row) => row.status],
      ],
    },
    purchase: {
      filename: 'nhu-cau-mua',
      rows: purchaseDemandRows,
      columns: [
        ['Nguyên liệu', (row) => row.material],
        ['Nhà cung cấp', (row) => row.source],
        ['Cần', (row) => row.required],
        ['Mua', (row) => row.reserved],
        ['Đơn vị', (row) => row.unit],
        ['Trạng thái', (row) => row.status],
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
        ['Trạng thái', (row) => row.status],
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
        ['Trạng thái xử lý', (row) => row.remediationStatus],
        ['Owner', (row) => row.owner],
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
                resetCursorPages();
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
                resetCursorPages();
              }}
            />
          </FieldRow>
          <FieldRow label="Ca" htmlFor="report-shift">
            <select id="report-shift" className="ipc-select" value={shiftName} onChange={(event) => setShiftName(event.target.value)}>
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
            { label: 'Thiếu nguyên liệu', value: shortageItems.length.toString(), tone: shortageItems.length ? 'danger' : 'success' },
            { label: 'Dòng tồn kho', value: currentStockRows.length.toString(), tone: 'neutral' },
            { label: 'Audit', value: auditRows.length.toString(), tone: 'neutral' },
            { label: 'Data quality', value: (dataQualityReport?.totalIssues ?? 0).toString(), tone: dataQualityRows.length ? 'warning' : 'success' },
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
          Hệ thống đang lấy dữ liệu từ API workflow report cho tab đang mở.
        </InlineAlert>
      )}

      {activeReportState.isError && (
        <InlineAlert title="Không tải được dữ liệu báo cáo" variant="danger">
          Vui lòng kiểm tra API backend, quyền truy cập hoặc dữ liệu import mẫu trước khi đối chiếu.
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
              <DataTableShell ariaLabel="Bảng biến động giá theo nhà cung cấp">
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
              </DataTableShell>
            </SectionPanel>
          )}

          {priceSubView === 'period' && (
            <SectionPanel title="Biến động giá theo thời gian (theo tháng)" icon={<ClipboardList size={18} color="#475569" />}>
              <DataTableShell ariaLabel="Bảng biến động giá theo thời gian">
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
              </DataTableShell>
            </SectionPanel>
          )}

          {priceSubView === 'dishGroup' && (
            <SectionPanel title="Biến động giá theo nhóm món (có trọng số theo định lượng BOM)" icon={<ClipboardList size={18} color="#475569" />}>
              <DataTableShell ariaLabel="Bảng biến động giá theo nhóm món">
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
              </DataTableShell>
            </SectionPanel>
          )}

          {priceSubView === 'lines' && (
          <SectionPanel title="Bảng biến động giá nguyên liệu" icon={<ClipboardList size={18} color="#475569" />}>
            <DataTableShell ariaLabel="Bảng biến động giá nguyên liệu" className="ipc-report-table-shell">
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
                  {pagedPriceVarianceRows.length === 0 ? (
                    <EmptyRow colSpan={7} />
                  ) : (
                    pagedPriceVarianceRows.map((item, index) => (
                      <tr key={`${item.id}-${safePricePage}-${index}`} className={item.warning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
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
            </DataTableShell>
            <PaginationBar page={safePricePage} pageSize={pricePageSize} totalItems={priceVarianceRows.length} onPageChange={setPricePage} />
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
          <DataTableShell ariaLabel="Bảng nhu cầu nguyên liệu">
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
                    <td className="ipc-badge-cell"><StatusBadge variant={row.tone}>{row.status}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={row.tone === 'danger' ? ROUTES.PURCHASING : ROUTES.WAREHOUSE}>{row.nextAction}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'purchase' && (
        <SectionPanel title="Nhu cầu mua theo nhà cung cấp, ngày và ca" icon={<ShoppingCart size={18} />}>
          <DataTableShell ariaLabel="Bảng nhu cầu mua">
            <table className="ipc-data-table ipc-status-action-table">
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Nhà cung cấp</th>
                  <th>Cần</th>
                  <th>Mua</th>
                  <th>Đơn giá dự kiến</th>
                  <th>Trạng thái</th>
                  <th>Handoff</th>
                </tr>
              </thead>
              <tbody>
                {purchaseDemandRows.length === 0 ? <EmptyRow colSpan={7} /> : purchaseDemandRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{row.material}</td>
                    <td>{row.source}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.required, row.unit)}</td>
                    <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.reserved, row.unit)}</td>
                    <td className="ipc-numeric-cell">{row.reserved > 0 ? 'Theo phiếu mua' : 'Không phát sinh'}</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={row.tone}>{row.status}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>{row.nextAction}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'stock' && (
        <SectionPanel title="Tồn kho hiện tại và xu hướng luân chuyển" icon={<Warehouse size={18} />}>
          <DataTableShell ariaLabel="Bảng tồn kho hiện tại">
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
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'movement' && (
        <SectionPanel title="Lịch sử nhập, xuất, trả và điều chỉnh kho" icon={<ArrowLeftRight size={18} />}>
          <StockMovementTable movements={stockMovementRows} pageSize={reportPageSize} />
          <CursorPagination
            page={movementCursors.length + 1}
            hasNext={stockMovementResult.data?.hasNext ?? false}
            onPrevious={() => setMovementCursors((current) => current.slice(0, -1))}
            onNext={openNextMovementPage}
          />
        </SectionPanel>
      )}

      {activeView === 'kitchen' && (
        <SectionPanel title="Xuất kho cho bếp theo ca" icon={<PackageCheck size={18} />}>
          <DataTableShell ariaLabel="Bảng xuất kho cho bếp">
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
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'usage' && (
        <SectionPanel title="Sử dụng thực tế của bếp: đã xuất - hoàn kho" icon={<RotateCcw size={18} />}>
          <DataTableShell ariaLabel="Bảng sử dụng thực tế sau hoàn kho">
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
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'audit' && (
        <SectionPanel title="Audit thay đổi BOM, tồn kho, số suất và chứng từ" icon={<Database size={18} />}>
          <DataTableShell ariaLabel="Bảng audit thay đổi hệ thống">
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
          </DataTableShell>
        </SectionPanel>
      )}

      {activeView === 'data-quality' && (
        <SectionPanel title="Data quality trước production" icon={<AlertTriangle size={18} />}>
          <ContextStrip
            items={[
              { label: 'Tổng issue', value: (dataQualityReport?.totalIssues ?? 0).toString(), tone: dataQualityRows.length ? 'warning' : 'success' },
              { label: 'Error', value: (dataQualityReport?.errorCount ?? 0).toString(), tone: dataQualityReport?.errorCount ? 'danger' : 'success' },
              { label: 'Warning', value: (dataQualityReport?.warningCount ?? 0).toString(), tone: dataQualityReport?.warningCount ? 'warning' : 'success' },
              { label: 'SLA gấp', value: (dataQualityReport?.urgentIssueCount ?? 0).toString(), tone: dataQualityReport?.urgentIssueCount ? 'danger' : 'success' },
              { label: 'Resolved còn lỗi', value: (dataQualityReport?.resolvedIssueCount ?? 0).toString(), tone: dataQualityReport?.resolvedIssueCount ? 'warning' : 'success' },
              { label: 'Thiếu BOM', value: (dataQualityReport?.missingBomCount ?? 0).toString(), tone: dataQualityReport?.missingBomCount ? 'warning' : 'success' },
              { label: 'Thiếu quy đổi', value: (dataQualityReport?.missingConversionCount ?? 0).toString(), tone: dataQualityReport?.missingConversionCount ? 'warning' : 'success' },
            ]}
          />
          <DataTableShell ariaLabel="Bảng data quality trước production">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th>Mức độ</th>
                  <th>SLA</th>
                  <th>Trạng thái xử lý</th>
                  <th>Owner</th>
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
                        {row.severity === 'error' ? 'Error' : 'Warning'}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800">{row.slaLabel}</div>
                      <div className="text-xs text-slate-500">Priority {row.priorityRank}</div>
                    </td>
                    <td>
                      <StatusBadge variant={row.remediationStatus === 'resolved' ? 'warning' : row.remediationStatus === 'reopened' ? 'danger' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                        {row.remediationStatus === 'resolved' ? 'Resolved còn lỗi' : row.remediationStatus === 'reopened' ? 'Reopened' : 'Open'}
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
          </DataTableShell>
          <CursorPagination
            page={auditCursors.length + 1}
            hasNext={auditResult.data?.hasNext ?? false}
            onPrevious={() => setAuditCursors((current) => current.slice(0, -1))}
            onNext={openNextAuditPage}
          />
        </SectionPanel>
      )}
    </OperationalFrame>
  );
};

export default ReportsPage;
