import { AlertTriangle, ClipboardList, Download, Filter, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CommandBar, DataTableShell, ExceptionLane, OperationalFrame, PaginationBar, SectionPanel, StatusBadge } from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';

const ReportsPage = () => {
  const [pricePage, setPricePage] = useState(1);
  const pricePageSize = 6;
  const materialsPriceData = [
    { name: 'Sườn heo', unit: 'kg', pricePrev: 115000, priceCurrent: 134000, supplier: 'Nhà cung cấp A', change: 16.5, warning: true },
    { name: 'Thịt gà', unit: 'kg', pricePrev: 83000, priceCurrent: 85000, supplier: 'Nhà cung cấp A', change: 2.4, warning: false },
    { name: 'Cá lóc phi lê', unit: 'kg', pricePrev: 110000, priceCurrent: 110000, supplier: 'Nhà cung cấp A', change: 0, warning: false },
    { name: 'Gạo tẻ', unit: 'kg', pricePrev: 17000, priceCurrent: 18000, supplier: 'Nhà cung cấp A', change: 5.8, warning: false },
    { name: 'Rau cải xanh', unit: 'kg', pricePrev: 12500, priceCurrent: 15000, supplier: 'Nhà cung cấp A', change: 20.0, warning: true },
    { name: 'Tôm tươi', unit: 'kg', pricePrev: 180000, priceCurrent: 180000, supplier: 'Nhà cung cấp B', change: 0, warning: false },
    { name: 'Thịt ba chỉ', unit: 'kg', pricePrev: 120000, priceCurrent: 125000, supplier: 'Nhà cung cấp A', change: 4.1, warning: false },
  ];

  const warningItems = materialsPriceData.filter((item) => item.warning);
  const selectedWarning = warningItems[0];
  const totalPricePages = Math.max(1, Math.ceil(materialsPriceData.length / pricePageSize));
  const safePricePage = Math.min(pricePage, totalPricePages);
  const pagedMaterialsPriceData = materialsPriceData.slice((safePricePage - 1) * pricePageSize, safePricePage * pricePageSize);

  const warningQueue = warningItems.map((item) => ({
    title: item.name,
    description: `Tăng ${item.change.toFixed(1)}% tại ${item.supplier}. Giá hiện tại ${item.priceCurrent.toLocaleString()} đ/${item.unit}.`,
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
      eyebrow="Dữ liệu giá mẫu"
      title="Phân tích biến động giá"
      command={
        <CommandBar
          actions={
            <button type="button" className="ipc-button ipc-button-primary">
              <Download size={16} />
              Xuất báo cáo biến động
            </button>
          }
        >
          <div className="ipc-command-meta">
            <Filter size={16} />
            <span>Kỳ phân tích: tuần hiện tại</span>
          </div>
          <StatusBadge variant="danger">Ngưỡng cảnh báo: trên 15%</StatusBadge>
          <StatusBadge variant="neutral">Nhà cung cấp: tất cả</StatusBadge>
        </CommandBar>
      }
    >
      <div className="flex flex-col gap-4">
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
                  <th>Giá tuần trước</th>
                  <th>Giá tuần này</th>
                  <th>Thay đổi</th>
                  <th>Đánh giá</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {pagedMaterialsPriceData.map((item) => (
                  <tr key={item.name} className={item.warning ? 'ipc-report-row is-warning' : 'ipc-report-row'}>
                    <td className={item.warning ? 'ipc-report-material-cell is-warning' : 'ipc-report-material-cell'}>
                      <span className="ipc-report-material">
                        {item.warning ? <AlertTriangle size={14} className="text-[var(--ipc-danger)]" /> : <TrendingUp size={14} color="#475569" />}
                        <span className="ipc-report-material-copy">
                          <span>{item.name}</span>
                          <span className="text-xs font-normal text-slate-400">{item.supplier}</span>
                        </span>
                      </span>
                    </td>
                    <td>{item.unit}</td>
                    <td className="ipc-numeric-cell">{item.pricePrev.toLocaleString()} đ</td>
                    <td className="ipc-numeric-cell font-bold">{item.priceCurrent.toLocaleString()} đ</td>
                    <td className={item.warning ? 'ipc-numeric-cell font-bold text-[var(--ipc-danger)]' : item.change > 0 ? 'ipc-numeric-cell font-bold text-[var(--ipc-warning)]' : 'ipc-numeric-cell text-slate-600'}>
                      <span className="inline-flex items-center gap-1 justify-end w-full">
                        {item.change > 0 && <span className="inline-block text-[10px] text-inherit">▲</span>}
                        {item.change > 0 ? `+${item.change.toFixed(1)}%` : '0%'}
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
                ))}
              </tbody>
            </table>
          </DataTableShell>
          <PaginationBar page={safePricePage} pageSize={pricePageSize} totalItems={materialsPriceData.length} onPageChange={setPricePage} />
        </SectionPanel>

        {selectedWarning && (
          <div className="ipc-split-detail-strip ipc-report-warning-detail">
            <div className="ipc-split-detail-label mb-3">Tác động vận hành — {selectedWarning.name}</div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="ipc-report-warning-card min-w-[240px] flex-1 rounded-md border border-[var(--ipc-danger)] bg-[var(--ipc-danger-soft)] p-3 text-sm text-[var(--ipc-danger)]">
                <div className="font-bold text-[14px]">Vượt ngưỡng {selectedWarning.change.toFixed(1)}%</div>
                <div className="mt-1 leading-5">
                  Giá tăng từ {selectedWarning.pricePrev.toLocaleString()} đ lên {selectedWarning.priceCurrent.toLocaleString()} đ/{selectedWarning.unit}.
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
    </OperationalFrame>
  );
};


export default ReportsPage;
