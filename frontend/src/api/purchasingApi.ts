import { apiClient } from './client';

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
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
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

export const purchasingApi = {
  async getPurchaseOrders(): Promise<PurchaseOrderItem[]> {
    const resp = await apiClient<RawPo[] | { items: RawPo[] }>('/purchase-orders');
    const items = Array.isArray(resp) ? resp : resp?.items || [];

    return items.map((po) => {
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
    });
  },

  async getSuppliers(): Promise<SupplierItem[]> {
    return apiClient<SupplierItem[]>('/suppliers');
  },

  async createPurchaseOrdersFromRequest(purchaseRequestId: string): Promise<PurchaseOrderItem[]> {
    const orders = await apiClient<RawPo[]>(
      `/purchase-orders/from-request/${encodeURIComponent(purchaseRequestId)}`,
      { method: 'POST' }
    );

    return orders.map((po) => {
      const lines = po.lines.map((line) => ({
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
    });
  },
};
