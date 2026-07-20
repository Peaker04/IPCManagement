import { useState } from 'react';
import { useToast } from '@/components/common';
import {
  useCancelPurchaseOrderMutation,
  useCreatePurchaseOrdersFromRequestMutation,
  useGetCurrentStockQuery,
  useGetPurchaseOrdersPageQuery,
  useGetPurchaseRequestsPageQuery,
  useRecordPurchaseOrderReceiptMutation,
  type PurchaseOrderDto,
} from '@/features/workflow';
import { getPurchasingErrorMessage, mapPurchaseRequestLines } from '../purchasingModel';

export function usePurchaseOrders() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [approvedRequestPage, setApprovedRequestPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [receiveQtyByLine, setReceiveQtyByLine] = useState<Record<string, string>>({});
  const [receiveWarehouseByOrder, setReceiveWarehouseByOrder] = useState<Record<string, string>>({});
  const { data: response } = useGetPurchaseOrdersPageQuery({ pageNumber: page, pageSize: 6 });
  const { data: requestResponse } = useGetPurchaseRequestsPageQuery({ status: 'APPROVED', pageNumber: approvedRequestPage, pageSize: 8 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 20 });
  const [createFromRequest, { isLoading: isCreating }] = useCreatePurchaseOrdersFromRequestMutation();
  const [recordReceipt] = useRecordPurchaseOrderReceiptMutation();
  const [cancelOrder] = useCancelPurchaseOrderMutation();
  const orders = response?.page.items ?? [];
  const purchaseRequestLines = mapPurchaseRequestLines(requestResponse?.items ?? []);
  const warehouseOptions = Array.from(new Map(currentStockRows.map((row) => [row.warehouseId, row.warehouse])).entries())
    .map(([warehouseId, warehouse]) => ({ warehouseId, warehouse }));

  const supplierCountByRequest = new Map<string, Set<string>>();
  purchaseRequestLines.forEach((line) => {
    if (!line.purchaseRequestId || !line.supplierId) return;
    const suppliers = supplierCountByRequest.get(line.purchaseRequestId) ?? new Set<string>();
    suppliers.add(line.supplierId);
    supplierCountByRequest.set(line.purchaseRequestId, suppliers);
  });
  const orderCountByRequest = new Map(Object.entries(response?.orderCountByRequest ?? {}));
  const approvedRequests = Array.from(new Map(
    purchaseRequestLines
      .filter((line) => line.status === 'APPROVED' && line.purchaseRequestId)
      .filter((line) => (orderCountByRequest.get(line.purchaseRequestId!) ?? 0) < (supplierCountByRequest.get(line.purchaseRequestId!)?.size ?? 0))
      .map((line) => [line.purchaseRequestId!, line]),
  ).values());

  const create = async (purchaseRequestId: string) => {
    try {
      await createFromRequest(purchaseRequestId).unwrap();
    } catch (error) {
      toast({ title: 'Chưa thể tạo đơn mua hàng', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  const receive = async (order: PurchaseOrderDto) => {
    const warehouseId = receiveWarehouseByOrder[order.purchaseOrderId] || warehouseOptions[0]?.warehouseId || '';
    if (!warehouseId) {
      toast({ title: 'Thiếu kho nhập hàng', description: 'Vui lòng chọn kho trước khi ghi nhận nhận hàng.', variant: 'warning' });
      return;
    }
    const lines = order.lines
      .map((line) => ({ purchaseOrderLineId: line.purchaseOrderLineId, receivedQty: Number(receiveQtyByLine[line.purchaseOrderLineId] || 0) }))
      .filter((line) => line.receivedQty > 0);
    if (lines.length === 0) {
      toast({ title: 'Chưa có số lượng nhận', description: 'Vui lòng nhập số lượng cho ít nhất một dòng.', variant: 'warning' });
      return;
    }
    try {
      await recordReceipt({ purchaseOrderId: order.purchaseOrderId, data: { warehouseId, lines } }).unwrap();
      setReceiveQtyByLine({});
      setReceiveWarehouseByOrder((current) => ({ ...current, [order.purchaseOrderId]: warehouseId }));
      setExpandedOrderId(null);
    } catch (error) {
      toast({ title: 'Chưa thể ghi nhận nhận hàng', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTargetId) return;
    try {
      await cancelOrder(cancelTargetId).unwrap();
      setCancelTargetId(null);
      toast({ title: 'Đã hủy đơn mua hàng', variant: 'success' });
    } catch (error) {
      toast({ title: 'Chưa thể hủy đơn mua hàng', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  return {
    page, setPage, response, orders, approvedRequests, isCreating, create,
    approvedRequestPage, setApprovedRequestPage, approvedRequestResponse: requestResponse,
    expandedOrderId, setExpandedOrderId,
    cancelTargetId, setCancelTargetId, confirmCancel,
    warehouseOptions, receiveQtyByLine, setReceiveQtyByLine,
    receiveWarehouseByOrder, setReceiveWarehouseByOrder, receive,
  };
}
