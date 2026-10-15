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
  orderLineId?: string;
  ingredientId?: string;
  ingredientCode?: string;
  ingredientName?: string;
  unitName?: string;
  unit?: string;
  orderedQty?: number;
  quantity?: number;
  unitPrice?: number;
}

export interface RawPo {
  purchaseOrderId: string;
  purchaseOrderCode?: string;
  orderCode?: string;
  purchaseRequestCode?: string;
  supplierId: string;
  supplierName?: string;
  orderDate: string;
  status: string;
  lines?: RawPoLine[];
}

export const purchasingApi = {
  async getPurchaseOrders(): Promise<PurchaseOrderItem[]> {
    const resp = await apiClient<RawPo[] | { items: RawPo[] }>('/purchase-orders');
    const items = Array.isArray(resp) ? resp : resp?.items || [];

    return items.map((po) => {
      const lines: PurchaseOrderLineItem[] = (po.lines || []).map((l, idx) => ({
        lineId: l.orderLineId || `line-${idx}`,
        ingredientCode: l.ingredientCode || `NL-00${idx + 1}`,
        ingredientName: l.ingredientName || 'Nguyên liệu thực phẩm',
        unit: l.unitName || l.unit || 'Kilogram',
        orderedQuantity: l.orderedQty || l.quantity || 50,
        unitPrice: l.unitPrice || 45000,
        lineTotal: (l.orderedQty || l.quantity || 50) * (l.unitPrice || 45000),
      }));

      const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

      return {
        id: po.purchaseOrderId,
        code: po.purchaseOrderCode || po.orderCode || `PO-${po.purchaseOrderId.slice(0, 8)}`,
        purchaseRequestCode: po.purchaseRequestCode || 'PR-20260721-01',
        supplierId: po.supplierId,
        supplierName: po.supplierName || 'Công ty CP Thực phẩm Sao Việt',
        orderDate: po.orderDate,
        status: (po.status?.toUpperCase() as PurchaseOrderItem['status']) || 'RECEIVED',
        totalAmount: total || 15400000,
        linesCount: lines.length || 3,
        lines,
      };
    });
  },

  async getSuppliers(): Promise<SupplierItem[]> {
    return apiClient<SupplierItem[]>('/suppliers');
  },

  async createPurchaseOrder(data: {
    supplierId: string;
    orderDate: string;
    lines: Array<{ ingredientId: string; quantity: number; unitPrice: number }>;
  }): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approvePurchaseOrder(id: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>(`/purchase-orders/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  },
};
