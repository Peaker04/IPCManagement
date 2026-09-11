import { ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { IdentifierText, InlineAlert, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
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
  onOpenBatchReceipt,
}: WarehousePurchaseOrdersPanelProps) {
  return (
<SectionPanel
  title="Đơn mua chờ nhập kho"
  icon={<ReceiptText size={18} aria-hidden="true" />}
  description="Chọn đúng đơn và dòng thực nhận để đối chiếu số lượng thực tế từ nhà cung cấp."
  className="min-w-0 overflow-hidden"
>
  {!canReceivePurchases && (
    <InlineAlert title="Chế độ chỉ đọc" variant="info" className="mb-3">
      Chỉ vai trò Warehouse được ghi nhận phiếu nhập. Bạn vẫn có thể theo dõi tiến độ đơn mua.
    </InlineAlert>
  )}
  <TableViewport
    ariaLabel="Danh sách đơn mua và tiến độ nhập kho"
    caption="Danh sách đơn mua và tiến độ nhập kho"
    className="ipc-table-viewport--page-flow"
  >
    <table className="ipc-data-table min-w-[1060px] !table-auto">
      <thead>
        <tr>
          <th className="min-w-[280px]">Đơn mua</th>
          <th className="min-w-[160px]">Nhà cung cấp</th>
          <th className="min-w-[220px]">Đề xuất mua</th>
          <th className="min-w-[140px]">Trạng thái</th>
          <th className="min-w-[130px]">Tiến độ dòng</th>
          <th className="min-w-[130px] text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {isFetchingPurchaseOrders && purchaseOrders.length === 0 ? (
          Array.from({ length: 8 }, (_, index) => (
            <tr key={`purchase-order-skeleton-${index}`} aria-hidden="true">
              <td colSpan={6}>
                <div className="h-5 animate-pulse rounded-sm bg-slate-200 motion-reduce:animate-none" />
              </td>
            </tr>
          ))
        ) : purchaseOrders.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
              Chưa có đơn mua để theo dõi nhập kho.
            </td>
          </tr>
        ) : (
          purchaseOrders.map((order) => {
            const completedLines = order.lines.filter((line) => line.receivedQty >= line.orderedQty).length;
            const isSelected = isPurchaseOrderDetailsOpen && selectedPurchaseOrderId === order.purchaseOrderId;
            return (
              <tr key={order.purchaseOrderId} className={isSelected ? 'bg-blue-50/60' : undefined}>
                <td className="min-w-0 font-semibold text-slate-900">
                  <IdentifierText value={order.purchaseOrderCode} />
                </td>
                <td>{order.supplierName}</td>
                <td className="min-w-0 text-slate-600">
                  <IdentifierText value={order.purchaseRequestCode} />
                </td>
                <td className="ipc-badge-cell whitespace-nowrap">
                  <StatusBadge variant={order.status === 'COMPLETED' ? 'success' : order.status === 'ORDERED' ? 'info' : order.status === 'PARTIALLY_RECEIVED' ? 'warning' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                    {formatWorkflowStatus(order.status)}
                  </StatusBadge>
                </td>
                <td className="whitespace-nowrap">
                  {completedLines}/{order.lines.length} dòng đã đủ
                </td>
                <td className="text-right">
                  <Link className="ipc-button ipc-button-ghost" aria-expanded={isSelected} to={purchaseOrderDetailsHref(isSelected ? null : order.purchaseOrderId)}>
                    {isSelected ? 'Đóng chi tiết' : 'Xem dòng nhận'}
                  </Link>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </TableViewport>
  <PaginationBar page={pageNumber} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} />

  {selectedPurchaseOrder && (
    <div className="mt-4 rounded-sm border border-slate-300 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex min-w-0 items-center gap-1 text-sm font-semibold text-slate-950">
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
      <TableViewport ariaLabel={`Chi tiết đơn mua ${selectedPurchaseOrder.purchaseOrderCode}`} caption="Các dòng và yêu cầu bằng chứng nhập kho do máy chủ cung cấp." className="max-h-[320px]">
        <PurchaseOrderLineGroups lines={selectedPurchaseOrder.lines} canReceive={canReceivePurchases} onReceive={onSelectReceiptLine} />
      </TableViewport>
    </div>
  )}
</SectionPanel>
  );
}
