import { useEffect, useRef } from 'react';
import { ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IdentifierText, InlineAlert, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import type { PurchaseOrderDto, PurchaseOrderLineDto } from '@/api/workflowApiTypes';
import { PurchaseOrderLineGroups } from '../PurchaseOrderLineGroups';

interface WarehousePurchaseOrdersPanelProps {
  canReceivePurchases: boolean;
  purchaseOrders: PurchaseOrderDto[];
  isFetchingPurchaseOrders: boolean;
  isPurchaseOrderDetailsOpen: boolean;
  selectedPurchaseOrderId: string | null;
  selectedPurchaseOrder?: PurchaseOrderDto;
  purchaseOrderDetailsHref: (purchaseOrderId: string | null) => string;
  onSelectReceiptLine: (line: PurchaseOrderLineDto) => void;
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenBatchReceipt: () => void;
}

export function WarehousePurchaseOrdersPanel({
  canReceivePurchases,
  purchaseOrders,
  isFetchingPurchaseOrders,
  isPurchaseOrderDetailsOpen,
  selectedPurchaseOrderId,
  selectedPurchaseOrder,
  purchaseOrderDetailsHref,
  onSelectReceiptLine,
  pageNumber,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onOpenBatchReceipt,
}: WarehousePurchaseOrdersPanelProps) {
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPurchaseOrder) return;
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedPurchaseOrder]);

  return (
<SectionPanel
  title="Đơn mua và tiến độ nhập kho"
  icon={<ReceiptText size={18} aria-hidden="true" />}
  description="Theo dõi tiến độ nhận và mở đúng đơn để ghi nhận từng dòng hoặc tạo phiếu nhập hàng loạt."
  className="min-w-0 overflow-hidden"
>
  {!canReceivePurchases && (
    <InlineAlert title="Chế độ chỉ đọc" variant="info" className="mb-3">
      Chỉ vai trò Warehouse được ghi nhận phiếu nhập. Bạn vẫn có thể theo dõi tiến độ đơn mua.
    </InlineAlert>
  )}
  <TableViewport
    ariaLabel="Đơn mua và tiến độ nhập kho"
    caption="Các đơn mua chờ kho ghi nhận số lượng thực nhận"
    className="ipc-table-viewport--page-flow"
  >
    <table className="ipc-data-table min-w-[900px] table-fixed w-full">
      <thead>
        <tr>
          <th scope="col" className="w-[30%]">Đơn mua / Nhà cung cấp</th>
          <th scope="col" className="w-[22%]">Đề xuất nguồn</th>
          <th scope="col" className="w-[18%]">Tiến độ nhập</th>
          <th scope="col" className="w-[16%]">Trạng thái</th>
          <th scope="col" className="w-[14%] text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {isFetchingPurchaseOrders && purchaseOrders.length === 0 ? (
          Array.from({ length: 8 }, (_, index) => (
            <tr key={`purchase-order-skeleton-${index}`} aria-hidden="true">
              <td colSpan={5}>
                <div className="h-5 animate-pulse rounded-sm bg-slate-200 motion-reduce:animate-none" />
              </td>
            </tr>
          ))
        ) : purchaseOrders.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
              Chưa có đơn mua trong phạm vi hiện tại.
            </td>
          </tr>
        ) : (
          purchaseOrders.map((order) => {
            const completedLines = order.lines.filter((line) => line.receivedQty >= line.orderedQty).length;
            const remainingLines = order.lines.length - completedLines;
            const isSelected = isPurchaseOrderDetailsOpen && selectedPurchaseOrderId === order.purchaseOrderId;
            return (
              <tr key={order.purchaseOrderId} className={isSelected ? 'bg-blue-50/60' : undefined}>
                <td className="min-w-0">
                  <IdentifierText value={order.purchaseOrderCode} className="font-semibold text-slate-900" />
                  <span className="mt-0.5 block truncate text-xs text-slate-600" title={order.supplierName}>{order.supplierName}</span>
                </td>
                <td className="min-w-0 text-slate-600">
                  <IdentifierText value={order.purchaseRequestCode} />
                </td>
                <td data-cell-role="numeric" className="whitespace-nowrap tabular-nums">
                  {remainingLines}/{order.lines.length} dòng còn phải nhận
                </td>
                <td className="ipc-badge-cell whitespace-nowrap">
                  <StatusBadge
                    status={order.status}
                    domain="purchase"
                    className="ipc-table-badge ipc-table-badge--status"
                  />
                </td>
                <td className="text-right">
                  <Link className="ipc-button ipc-button-ghost whitespace-nowrap" aria-label={`${isSelected ? 'Đóng chi tiết' : 'Xem chi tiết'} ${order.purchaseOrderCode}`} aria-expanded={isSelected} to={purchaseOrderDetailsHref(isSelected ? null : order.purchaseOrderId)}>
                    {isSelected ? 'Đóng chi tiết' : 'Xem chi tiết'}
                  </Link>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </TableViewport>
  <PaginationBar page={pageNumber} pageSize={pageSize} totalItems={totalItems} pageSizeOptions={[8, 20, 50]} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />

  {selectedPurchaseOrder && (
    <div
      ref={detailRef}
      role="region"
      aria-label={`Chi tiết ${selectedPurchaseOrder.purchaseOrderCode}`}
      tabIndex={-1}
      className="mt-4 rounded-sm border border-slate-300 bg-slate-50 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="warehouse-purchase-order-detail-title" className="flex min-w-0 items-center gap-1 text-sm font-semibold text-slate-950">
            <span className="shrink-0">Chi tiết</span>
            <IdentifierText value={selectedPurchaseOrder.purchaseOrderCode} />
          </h3>
          <p className="mt-1 text-xs text-slate-600">Số lượng và đơn giá thực nhận được xác nhận riêng cho từng dòng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">{selectedPurchaseOrder.orderDate}</span>
          {canReceivePurchases && selectedPurchaseOrder.lines.some((line) => line.receivedQty < line.orderedQty) && (
            <Button type="button" size="sm" onClick={onOpenBatchReceipt}>
              Nhận toàn bộ dòng còn lại
            </Button>
          )}
        </div>
      </div>
      <PurchaseOrderLineGroups lines={selectedPurchaseOrder.lines} canReceive={canReceivePurchases} onReceive={onSelectReceiptLine} />
    </div>
  )}
</SectionPanel>
  );
}
