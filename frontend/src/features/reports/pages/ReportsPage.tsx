import {
  AlertTriangle,
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
import { Link } from 'react-router-dom';
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
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetAuditChangesQuery,
  useGetCurrentStockQuery,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  type WorkflowReportQuery,
} from '@/features/workflow';
import { formatCurrency, formatPercent, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';

type ReportView = 'price' | 'demand' | 'purchase' | 'stock' | 'kitchen' | 'usage' | 'audit';

const reportTabs = [
  { id: 'reports-price', label: 'Biến động giá' },
  { id: 'reports-demand', label: 'Nhu cầu NVL' },
  { id: 'reports-purchase', label: 'Nhu cầu mua' },
  { id: 'reports-stock', label: 'Tồn kho' },
  { id: 'reports-kitchen', label: 'Xuất bếp' },
  { id: 'reports-usage', label: 'Sử dụng thực tế' },
  { id: 'reports-audit', label: 'Audit' },
];

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center text-slate-500">
      Chưa có dữ liệu để hiển thị
    </td>
  </tr>
);

const ReportsPage = () => {
  const [activeView, setActiveView] = useState<ReportView>('price');
  const [pricePage, setPricePage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shiftName, setShiftName] = useState('');
  const pricePageSize = 6;

  const reportQuery: WorkflowReportQuery = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    shiftName: shiftName || undefined,
    limit: 100,
  };

  const priceVarianceResult = useGetPriceVarianceQuery(reportQuery);
  const ingredientDemandResult = useGetIngredientDemandQuery(reportQuery);
  const purchaseDemandResult = useGetPurchaseDemandQuery(reportQuery);
  const currentStockResult = useGetCurrentStockQuery({ limit: 100 });
  const kitchenIssueResult = useGetKitchenIssuesQuery(reportQuery);
  const usageResult = useGetIssueVsReturnUsageQuery(reportQuery);
  const auditResult = useGetAuditChangesQuery(reportQuery);

  const priceVarianceRows = priceVarianceResult.data ?? [];
  const ingredientDemandRows = ingredientDemandResult.data ?? [];
  const purchaseDemandRows = purchaseDemandResult.data ?? [];
  const currentStockRows = currentStockResult.data ?? [];
  const kitchenIssueRows = kitchenIssueResult.data ?? [];
  const usageRows = usageResult.data ?? [];
  const auditRows = auditResult.data ?? [];

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
    kitchen: kitchenIssueResult,
    usage: usageResult,
    audit: auditResult,
  };
  const activeReportState = reportStates[activeView];

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
            <button type="button" className="ipc-button ipc-button-primary">
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
            <input id="report-date-from" type="date" className="ipc-input" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </FieldRow>
          <FieldRow label="Đến ngày" htmlFor="report-date-to">
            <input id="report-date-to" type="date" className="ipc-input" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </FieldRow>
          <FieldRow label="Ca" htmlFor="report-shift">
            <select id="report-shift" className="ipc-select" value={shiftName} onChange={(event) => setShiftName(event.target.value)}>
              <option value="">Tất cả</option>
              <option value="MORNING">Ca sáng</option>
              <option value="AFTERNOON">Ca chiều</option>
            </select>
          </FieldRow>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Cảnh báo giá', value: warningItems.length.toString(), tone: warningItems.length ? 'danger' : 'success' },
            { label: 'Thiếu nguyên liệu', value: shortageItems.length.toString(), tone: shortageItems.length ? 'danger' : 'success' },
            { label: 'Dòng tồn kho', value: currentStockRows.length.toString(), tone: 'neutral' },
            { label: 'Audit', value: auditRows.length.toString(), tone: 'neutral' },
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
                    pagedPriceVarianceRows.map((item) => (
                      <tr key={item.id} className={item.warning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
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

          {selectedWarning && (
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
            <table className="ipc-data-table">
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
                {ingredientDemandRows.length === 0 ? <EmptyRow colSpan={7} /> : ingredientDemandRows.map((row) => (
                  <tr key={row.id}>
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
            <table className="ipc-data-table">
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
                {purchaseDemandRows.length === 0 ? <EmptyRow colSpan={7} /> : purchaseDemandRows.map((row) => (
                  <tr key={row.id}>
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
                {currentStockRows.length === 0 ? <EmptyRow colSpan={5} /> : currentStockRows.map((row) => (
                  <tr key={row.id}>
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
                {kitchenIssueRows.length === 0 ? <EmptyRow colSpan={7} /> : kitchenIssueRows.map((row) => (
                  <tr key={row.id}>
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
                {usageRows.length === 0 ? <EmptyRow colSpan={7} /> : usageRows.map((row) => (
                  <tr key={row.id}>
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
                  <th>Đối tượng</th>
                  <th>Giá trị cũ</th>
                  <th>Giá trị mới</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 ? <EmptyRow colSpan={6} /> : auditRows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.timestamp).toLocaleString('vi-VN')}</td>
                    <td>{row.actor}</td>
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
    </OperationalFrame>
  );
};

export default ReportsPage;
