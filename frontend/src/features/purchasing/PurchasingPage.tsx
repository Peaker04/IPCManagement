import { useState, useEffect, useMemo } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { SplitView } from '../../components/workbench/SplitView';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Tabs } from '../../components/ui/tabs';
import {
  purchasingApi,
  type PurchaseOrderItem,
  type PurchaseOrderLineItem,
  type SupplierItem,
} from '../../api/purchasingApi';
import { formatVietnameseDate } from '../../utils/dates';

const PO_STATUS_CONFIG: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Dự thảo', variant: 'neutral' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', variant: 'warning' },
  APPROVED: { label: 'Đã duyệt', variant: 'info' },
  SENT: { label: 'Đã gửi NCC', variant: 'info' },
  ORDERED: { label: 'Đã đặt hàng', variant: 'warning' },
  PARTIALLY_RECEIVED: { label: 'Nhận một phần', variant: 'warning' },
  RECEIVED: { label: 'Đã nhận đủ', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'danger' },
};

export function PurchasingPage() {
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pos, sups] = await Promise.all([
        purchasingApi.getPurchaseOrders(),
        purchasingApi.getSuppliers(),
      ]);
      setOrders(pos);
      setSuppliers(sups);
      if (pos.length > 0 && !selectedPoId) {
        setSelectedPoId(pos[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải danh sách đơn mua hàng PO.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [pos, sups] = await Promise.all([
          purchasingApi.getPurchaseOrders(),
          purchasingApi.getSuppliers(),
        ]);
        if (!ignore) {
          setOrders(pos);
          setSuppliers(sups);
          if (pos.length > 0) setSelectedPoId(pos[0].id);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err : new Error('Không thể tải danh sách đơn mua hàng PO.'));
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      if (selectedSupplierId !== 'ALL' && po.supplierId !== selectedSupplierId) return false;
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      return true;
    });
  }, [orders, selectedSupplierId, statusFilter]);

  const selectedPo = orders.find((p) => p.id === selectedPoId) || filteredOrders[0] || null;

  const totalAmount = useMemo(() => {
    return filteredOrders.reduce((sum, po) => sum + po.totalAmount, 0);
  }, [filteredOrders]);

  const supplierOptions = [
    {
      value: 'ALL',
      label: suppliers.length > 0
        ? `Tất cả nhà cung cấp (${suppliers.length} đối tác)`
        : 'Tất cả nhà cung cấp',
    },
    ...suppliers.map((s) => ({ value: s.supplierId, label: `${s.supplierCode} - ${s.supplierName}` })),
  ];

  const STATUS_TABS = [
    { id: 'ALL', label: 'Tất cả đơn PO', count: orders.length },
    { id: 'ORDERED', label: 'Đã đặt hàng', count: orders.filter((o) => o.status === 'ORDERED').length },
    { id: 'PARTIALLY_RECEIVED', label: 'Nhận một phần', count: orders.filter((o) => o.status === 'PARTIALLY_RECEIVED').length },
    { id: 'RECEIVED', label: 'Đã nhận đủ', count: orders.filter((o) => o.status === 'RECEIVED').length },
  ];

  const columns: ColumnDef<PurchaseOrderItem>[] = [
    {
      id: 'code',
      header: 'Mã đơn PO',
      width: '16%',
      minWidth: '95px',
      cell: (row) => <IdentifierText value={row.code} />,
    },
    {
      id: 'supplier',
      header: 'Nhà cung cấp',
      width: '24%',
      minWidth: '120px',
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-sm truncate block">
          {row.supplierName}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Ngày đặt',
      width: '13%',
      minWidth: '75px',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.orderDate)}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Mặt hàng',
      width: '12%',
      minWidth: '65px',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs whitespace-nowrap">{row.linesCount} dòng</span>,
    },
    {
      id: 'amount',
      header: 'Tổng tiền',
      width: '18%',
      minWidth: '95px',
      align: 'right',
      cell: (row) => (
        <Num value={row.totalAmount} format="currency" className="font-bold text-slate-900 text-sm" />
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '17%',
      minWidth: '95px',
      align: 'center',
      cell: (row) => {
        const config = PO_STATUS_CONFIG[row.status] || { label: row.status, variant: 'neutral' };
        return (
          <Badge variant={config.variant} size="sm" className="whitespace-nowrap">
            {config.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Thu mua & Đề xuất PO"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc nhà cung cấp"
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-9 w-72 font-medium text-sm"
            />
            <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-mono flex items-center">
              PO đang xử lý
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
            <span className="text-xs text-slate-500 max-w-72">
              PO chỉ được tạo từ đề xuất mua hàng đã duyệt.
            </span>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={STATUS_TABS}
            activeId={statusFilter}
            onChange={(id) => setStatusFilter(id)}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng PO:</span>
              <strong className="text-slate-900 font-mono font-bold">{filteredOrders.length} đơn</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng giá trị:</span>
              <strong className="text-emerald-700 font-mono font-bold">
                {totalAmount.toLocaleString('vi-VN')} ₫
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Đối tác:</span>
              <strong className="text-slate-900 font-semibold">{suppliers.length} NCC</strong>
            </span>
          </>
        }
      />

      {/* Zone 3: SplitView (Master 7 cols PO list | Detail 5 cols PO lines) */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={filteredOrders.length === 0}
        emptyTitle="Không tìm thấy đơn mua hàng"
        emptyDescription="Không có đơn PO nào khớp với điều kiện tìm kiếm hoặc trạng thái đã chọn. PO mới phải được tạo từ một đề xuất mua hàng đã duyệt."
      >
        <SplitView
          masterWidthClass="w-7/12 xl:w-8/12"
          master={
            <DataGrid<PurchaseOrderItem>
              data={filteredOrders}
              columns={columns}
              keyExtractor={(row) => row.id}
              selectedKey={selectedPo?.id}
              onRowClick={(row) => setSelectedPoId(row.id)}
              minWidth="min-w-[550px]"
            />
          }
          detail={
            selectedPo ? (
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="h-10 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Chi tiết PO: {selectedPo.code}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {selectedPo.lines.length} mặt hàng
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    NCC: {selectedPo.supplierName}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  {selectedPo.lines.length === 0 ? (
                    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                      Đơn PO này chưa có dòng nguyên liệu chi tiết.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse table-fixed">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <tr>
                          <th className="h-10 px-4 w-[40%]">Nguyên liệu</th>
                          <th className="h-10 px-3 w-[16%] text-center">ĐVT</th>
                          <th className="h-10 px-3 w-[20%] text-right">Số lượng</th>
                          <th className="h-10 px-4 w-[24%] text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {selectedPo.lines.map((line: PurchaseOrderLineItem) => (
                          <tr key={line.lineId} className="h-10 hover:bg-slate-50">
                            <td className="px-4 py-2 truncate">
                              <span className="font-medium text-slate-900 text-sm">{line.ingredientName}</span>
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 font-mono text-xs">
                              {line.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-sm">
                              <Num value={line.orderedQuantity} format="quantity" />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Num value={line.lineTotal} format="currency" className="font-semibold text-slate-900" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="h-11 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 font-medium text-sm">
                  <span className="text-slate-600">Tổng cộng đơn PO:</span>
                  <strong className="text-emerald-700 font-mono font-bold text-base">
                    {selectedPo.totalAmount.toLocaleString('vi-VN')} ₫
                  </strong>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
                Chọn một đơn PO bên trái để xem phân rã chi tiết
              </div>
            )
          }
        />
      </StateBoundary>
    </div>
  );
}
