import { apiClient } from './client';
import type { ReportPage } from './reportsApi';

export interface PurchaseOrderLineItem {
  lineId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  orderedQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrderItem {
  id: string;
  code: string;
  purchaseRequestCode?: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  linesCount: number;
  lines: PurchaseOrderLineItem[];
}

export interface SupplierItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  contactPhone?: string;
  address?: string;
  isActive: boolean;
}

export interface RawPoLine {
  purchaseOrderLineId: string;
  purchaseRequestLineId: string;
  ingredientId: string;
  ingredientName: string;
  unitId: string;
  unitName: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
}

export interface RawPo {
  purchaseOrderId: string;
  purchaseOrderCode: string;
  purchaseRequestId: string;
  purchaseRequestCode: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  status: string;
  lines: RawPoLine[];
}

function mapOrder(po: RawPo): PurchaseOrderItem {
      const lines: PurchaseOrderLineItem[] = po.lines.map((line) => ({
        lineId: line.purchaseOrderLineId,
        ingredientCode: line.ingredientId,
        ingredientName: line.ingredientName,
        unit: line.unitName,
        orderedQuantity: line.orderedQty,
        unitPrice: line.unitPrice,
        lineTotal: line.orderedQty * line.unitPrice,
      }));

      return {
        id: po.purchaseOrderId,
        code: po.purchaseOrderCode,
        purchaseRequestCode: po.purchaseRequestCode,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        status: po.status.toUpperCase() as PurchaseOrderItem['status'],
        totalAmount: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        linesCount: lines.length,
        lines,
      };
}

export const purchasingApi = {
  async getPurchaseOrders(signal?: AbortSignal, query = { supplierId: 'ALL', status: 'ALL', pageNumber: 1 }): Promise<ReportPage<PurchaseOrderItem>> {
    const params = new URLSearchParams({ pageNumber: String(query.pageNumber), pageSize: '20' });
    if (query.supplierId !== 'ALL') params.set('supplierId', query.supplierId);
    if (query.status !== 'ALL') params.set('status', query.status);
    const { page } = await apiClient<{ page: ReportPage<RawPo> }>(`/purchase-orders/page?${params}`, { signal });
    return { ...page, items: page.items.map(mapOrder) };
  },

  async getSuppliers(signal?: AbortSignal): Promise<SupplierItem[]> {
    return apiClient<SupplierItem[]>('/suppliers', { signal });
  },

  async createPurchaseOrdersFromRequest(purchaseRequestId: string): Promise<PurchaseOrderItem[]> {
    const orders = await apiClient<RawPo[]>(
      `/purchase-orders/from-request/${encodeURIComponent(purchaseRequestId)}`,
      { method: 'POST' }
    );

    return orders.map(mapOrder);
  },

  async cancelPurchaseOrder(orderId: string): Promise<unknown> {
    return apiClient(`/purchase-orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
    });
  },
};
