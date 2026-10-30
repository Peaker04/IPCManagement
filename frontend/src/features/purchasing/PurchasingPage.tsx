import { useState, useEffect, useMemo } from 'react';
import { Truck, ShoppingCart } from 'lucide-react';
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
import { Modal } from '../../components/ui/modal';
import { InlineBanner } from '../../components/ui/inline-banner';
import {
  purchasingApi,
  type PurchaseOrderItem,
  type PurchaseOrderLineItem,
  type SupplierItem,
} from '../../api/purchasingApi';
import { formatVietnameseDate } from '../../utils/dates';
import { serverStateCache } from '../../store/serverStateCache';

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

interface PurchasingSnapshot {
  pos: PurchaseOrderItem[];
  sups: SupplierItem[];
  selectedSupplierId: string;
  statusFilter: string;
  selectedPoId: string | null;
}

export function PurchasingPage() {
  const snapshot = serverStateCache.get<PurchasingSnapshot>('snapshot:purchasing')?.data;
  const cachedPurchasing = snapshot ? { pos: snapshot.pos, sups: snapshot.sups } : serverStateCache.get<{ pos: PurchaseOrderItem[]; sups: SupplierItem[] }>('purchasing_data')?.data;
  const [orders, setOrders] = useState<PurchaseOrderItem[]>(() => cachedPurchasing?.pos ?? []);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() => cachedPurchasing?.sups ?? []);
  const [selectedSupplierId, setSelectedSupplierId] = useState(() => snapshot?.selectedSupplierId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>(() => snapshot?.statusFilter || 'ALL');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(() => snapshot?.selectedPoId ?? (cachedPurchasing?.pos?.[0]?.id ?? null));
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<Error | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(cachedPurchasing));
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedPurchasing);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const handleCancelPo = async () => {
    if (!selectedPo) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await purchasingApi.cancelPurchaseOrder(selectedPo.id);
      setCancelSuccess(`Đã hủy đơn mua hàng ${selectedPo.code} thành công.`);
      setIsCancelModalOpen(false);
      setCancelError(null);
      serverStateCache.delete('purchasing_data');
      await loadData();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err : new Error('Không thể hủy đơn mua hàng.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const loadData = async () => {
    const cached = serverStateCache.get<{ pos: PurchaseOrderItem[]; sups: SupplierItem[] }>('purchasing_data')?.data;
    if (cached) {
      setOrders(cached.pos);
      setSuppliers(cached.sups);
      setIsLoading(false);
      setIsFetching(true);
    } else if (!hasLoadedOnce) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    setError(null);
    try {
      const [pos, sups] = await Promise.all([
        purchasingApi.getPurchaseOrders(),
        purchasingApi.getSuppliers(),
      ]);
      setOrders(pos);
      setSuppliers(sups);
      setHasLoadedOnce(true);
      serverStateCache.set('purchasing_data', { pos, sups });
      serverStateCache.set('snapshot:purchasing', { pos, sups, selectedSupplierId, statusFilter, selectedPoId: selectedPoId || pos[0]?.id || null });
      if (pos.length > 0 && !selectedPoId) {
        setSelectedPoId(pos[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải danh sách đơn mua hàng PO.'));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      if (selectedSupplierId !== 'ALL' && po.supplierId !== selectedSupplierId) return false;
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      return true;
    });
  }, [orders, selectedSupplierId, statusFilter]);

  const selectedPo = orders.find((p) => p.id === selectedPoId) || filteredOrders.find((p) => p.linesCount > 0) || filteredOrders[0] || null;

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
        breadcrumb="Thu mua · Đơn hàng PO"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc nhà cung cấp"
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-9 w-72 font-medium text-sm"
            />
            <Badge variant="neutral" size="default" className="h-9 px-3 text-sm font-medium flex items-center whitespace-nowrap shrink-0">
              PO đang xử lý
            </Badge>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">
              PO chỉ được tạo từ đề xuất mua hàng đã duyệt.
            </span>
            <Button
              variant="outline"
              size="default"
              onClick={loadData}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
          </div>
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
        isLoading={isLoading && !hasLoadedOnce}
        isFetching={isFetching || (isLoading && hasLoadedOnce)}
        hasExistingData={hasLoadedOnce || Boolean(cachedPurchasing)}
        error={error}
        onRetry={loadData}
        isEmpty={!isLoading && !isFetching && filteredOrders.length === 0}
        emptyScenario={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? 'filter-empty' : 'true-empty'}
        onResetFilters={() => {
          setSelectedSupplierId('ALL');
          setStatusFilter('ALL');
        }}
        actionLabel={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? 'Xóa bộ lọc PO' : 'Làm mới đơn mua hàng'}
        onAction={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? () => {
          setSelectedSupplierId('ALL');
          setStatusFilter('ALL');
        } : loadData}
        contextDomain="purchasing"
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
                    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center">
                      <div
                        aria-hidden="true"
                        className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2 text-slate-400"
                      >
                        <ShoppingCart size={20} strokeWidth={1.75} />
                      </div>
                      <p className="text-xs text-slate-500">Đơn PO này chưa có dòng nguyên liệu chi tiết.</p>
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
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Tổng cộng:</span>
                    <strong className="text-emerald-700 font-mono font-bold text-base">
                      {selectedPo.totalAmount.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                  {selectedPo.status !== 'CANCELLED' && selectedPo.status !== 'RECEIVED' && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    >
                      Hủy đơn PO
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400"
                >
                  <Truck size={20} strokeWidth={1.75} />
                </div>
                <p className="text-xs text-slate-500">Chọn một đơn PO bên trái để xem phân rã chi tiết</p>
              </div>
            )
          }
        />
      </StateBoundary>

      {cancelSuccess && (
        <InlineBanner variant="success" onClose={() => setCancelSuccess(null)} className="shrink-0">
          {cancelSuccess}
        </InlineBanner>
      )}

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (!isCancelling) {
            setIsCancelModalOpen(false);
            setCancelError(null);
          }
        }}
        title={`Xác nhận hủy đơn mua hàng: ${selectedPo?.code ?? ''}`}
        description={`Nhà cung cấp: ${selectedPo?.supplierName ?? ''} · Tổng giá trị: ${selectedPo ? selectedPo.totalAmount.toLocaleString('vi-VN') : 0} ₫`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => {
                setIsCancelModalOpen(false);
                setCancelError(null);
              }}
            >
              Quay lại
            </Button>
            <Button variant="destructive" size="sm" disabled={isCancelling} onClick={() => void handleCancelPo()}>
              {isCancelling ? 'Đang hủy…' : 'Xác nhận hủy đơn PO'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {cancelError && (
            <InlineBanner variant="error" onClose={() => setCancelError(null)}>
              {cancelError.message}
            </InlineBanner>
          )}
          <p className="text-sm text-slate-700">
            Bạn có chắc chắn muốn hủy đơn mua hàng này? Đơn mua hàng đã hủy sẽ không thể tạo phiếu nhập kho được nữa.
          </p>
        </div>
      </Modal>
    </div>
  );
}
