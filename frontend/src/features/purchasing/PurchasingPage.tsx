import { useState, useEffect, useMemo, useRef } from 'react';
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
import { PaginationBar } from '../../components/workbench/PaginationBar';
import {
  purchasingApi,
  type PurchaseOrderItem,
  type PurchaseOrderLineItem,
  type SupplierItem,
} from '../../api/purchasingApi';
import { formatVietnameseDate } from '../../utils/dates';
import { serverStateCache } from '../../store/serverStateCache';
import { useUrlWorkbenchState } from '../../hooks/useUrlWorkbenchState';
import { useOperationalRecovery } from '../../hooks/useOperationalRecovery';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import type { ReportPage } from '../../api/reportsApi';

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
  const { filters, setFilter, resetFilters, page, setPage, selectedId, setSelectedId } = useUrlWorkbenchState();
  const selectedSupplierId = filters.supplierId || 'ALL';
  const statusFilter = filters.status || 'ALL';
  const orderFilters = useMemo(() => ({ supplierId: selectedSupplierId, status: statusFilter, pageNumber: page }),
    [selectedSupplierId, statusFilter, page]);
  const ordersQuery = useOperationalRecovery<ReportPage<PurchaseOrderItem>, typeof orderFilters>({
    queryKey: `purchase_order_page_${JSON.stringify(orderFilters)}`,
    fetcher: (query, signal) => purchasingApi.getPurchaseOrders(signal, query),
    initialFilters: orderFilters,
    activeFilters: orderFilters,
    defaultFilters: { supplierId: 'ALL', status: 'ALL', pageNumber: 1 },
  });
  const suppliersQuery = useWorkbenchQuery<SupplierItem[]>({
    scopeKey: 'purchasing_suppliers',
    cacheKey: 'purchasing_suppliers',
    snapshotKey: '',
    queryFn: (_, signal) => purchasingApi.getSuppliers(signal),
  });
  const suppliers = suppliersQuery.data ?? [];
  const { isLoading, isFetching, isPreviousData } = ordersQuery;
  const error = ordersQuery.error;
  const hasLoadedOnce = ordersQuery.data !== null;
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<Error | null>(null);
  const mounted = useRef(false);

  const handleCancelPo = async () => {
    if (!cancelTarget || isCancelling || isFetching || isPreviousData || error
      || selectedPo?.id !== cancelTarget.id) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await purchasingApi.cancelPurchaseOrder(cancelTarget.id);
      serverStateCache.deletePrefix('purchase_order_page_');
      if (!mounted.current) return;
      setCancelSuccess(`Đã hủy đơn mua hàng ${cancelTarget.code} thành công.`);
      setCancelTarget(null);
      await ordersQuery.refetch();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err : new Error('Không thể hủy đơn mua hàng.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const loadData = () => {
    if (suppliersQuery.stateProps.error) void suppliersQuery.refetch(true);
    void ordersQuery.refetch();
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const pageData = ordersQuery.data;
  const filteredOrders = pageData?.items ?? [];
  const selectedPo = filteredOrders.find(p => p.id === selectedId) || filteredOrders.find(p => p.linesCount > 0) || filteredOrders[0] || null;

  const totalAmount = filteredOrders.reduce((sum, po) => sum + po.totalAmount, 0);

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
    { id: 'ALL', label: 'Tất cả đơn PO' },
    { id: 'ORDERED', label: 'Đã đặt hàng' },
    { id: 'PARTIALLY_RECEIVED', label: 'Nhận một phần' },
    { id: 'RECEIVED', label: 'Đã nhận đủ' },
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
              onChange={(e) => setFilter('supplierId', e.target.value)}
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
              onClick={() => void loadData()}
              disabled={isFetching || isCancelling}
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
            onChange={(id) => setFilter('status', id)}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng PO:</span>
              <strong className="text-slate-900 font-mono font-bold"><Num value={pageData?.totalCount} /> đơn</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng giá trị trên trang:</span>
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
        isFetching={isFetching}
        isPreviousData={isPreviousData}
        hasExistingData={hasLoadedOnce}
        loadingGeometry={{ kind: 'split', splitRatio: '60/40', columns: 6, rows: 10 }}
        error={error}
        onRetry={() => void loadData()}
        isEmpty={hasLoadedOnce && !isPreviousData && page === 1 && filteredOrders.length === 0}
        emptyScenario={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? 'filter-empty' : 'true-empty'}
        onResetFilters={resetFilters}
        actionLabel={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? 'Xóa bộ lọc PO' : 'Làm mới đơn mua hàng'}
        onAction={selectedSupplierId !== 'ALL' || statusFilter !== 'ALL' ? resetFilters : () => void loadData()}
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
              onRowClick={(row) => setSelectedId(row.id)}
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
                      disabled={isFetching || isPreviousData || isCancelling || Boolean(error)}
                      onClick={() => setCancelTarget(selectedPo)}
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
      {pageData && (
        <PaginationBar label="Phân trang đơn mua hàng" page={pageData.pageNumber}
          pageSize={pageData.pageSize} totalCount={pageData.totalCount} totalPages={pageData.totalPages}
          hasPrev={pageData.hasPrev} hasNext={pageData.hasNext} pending={isFetching || isPreviousData || Boolean(error)}
          retainButtonFocus onPageChange={setPage} />
      )}

      {cancelSuccess && (
        <InlineBanner variant="success" onClose={() => setCancelSuccess(null)} className="shrink-0">
          {cancelSuccess}
        </InlineBanner>
      )}

      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => {
          if (!isCancelling) {
            setCancelTarget(null);
            setCancelError(null);
          }
        }}
        title={`Xác nhận hủy đơn mua hàng: ${cancelTarget?.code ?? ''}`}
        description={`Nhà cung cấp: ${cancelTarget?.supplierName ?? ''} · Tổng giá trị: ${cancelTarget ? cancelTarget.totalAmount.toLocaleString('vi-VN') : 0} ₫`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => {
                setCancelTarget(null);
                setCancelError(null);
              }}
            >
              Quay lại
            </Button>
            <Button variant="destructive" size="sm" disabled={isFetching || isPreviousData || Boolean(error) || selectedPo?.id !== cancelTarget?.id}
              loading={isCancelling} loadingText="Đang hủy…" onClick={() => void handleCancelPo()}>
              Xác nhận hủy đơn PO
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
