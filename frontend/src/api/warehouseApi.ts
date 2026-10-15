import { apiClient } from './client';

export interface WarehouseItem {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  location?: string;
  isActive: boolean;
}

export interface InventoryReceiptLineItem {
  lineId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  receivedQty: number;
  unitPrice?: number;
}

export interface InventoryReceiptItem {
  receiptId: string;
  receiptCode: string;
  receiptDate: string;
  supplierName: string;
  warehouseName: string;
  purchaseOrderCode?: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED';
  itemsCount: number;
  lines: InventoryReceiptLineItem[];
}

export interface InventoryIssueLineItem {
  lineId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
}

export interface InventoryIssueItem {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName: string;
  warehouseName: string;
  status: 'DRAFT' | 'ISSUED' | 'CONFIRMED';
  itemsCount: number;
  lines: InventoryIssueLineItem[];
}

export interface RawReceipt {
  receiptId: string;
  receiptCode: string;
  receiptDate: string;
  supplierName?: string;
  warehouseName?: string;
  purchaseOrderId?: string;
  status: string;
  lines?: Array<{
    receiptLineId?: string;
    ingredientCode?: string;
    ingredientName?: string;
    unitName?: string;
    receivedQty?: number;
    unitPrice?: number;
  }>;
}

export interface RawIssue {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseName?: string;
  status?: string;
  lines?: Array<{
    issueLineId?: string;
    ingredientCode?: string;
    ingredientName?: string;
    unitName?: string;
    requestedQty?: number;
    issuedQty?: number;
  }>;
}

export const warehouseApi = {
  async getWarehouses(): Promise<WarehouseItem[]> {
    return apiClient<WarehouseItem[]>('/warehouses');
  },

  async getReceipts(): Promise<InventoryReceiptItem[]> {
    const resp = await apiClient<{ items: RawReceipt[] } | RawReceipt[]>('/inventory-receipts');
    const items = Array.isArray(resp) ? resp : resp?.items || [];

    return items.map((r) => ({
      receiptId: r.receiptId,
      receiptCode: r.receiptCode,
      receiptDate: r.receiptDate,
      supplierName: r.supplierName || 'Nhà cung cấp',
      warehouseName: r.warehouseName || 'Kho trung tâm',
      status: (r.status?.toUpperCase() as InventoryReceiptItem['status']) || 'POSTED',
      itemsCount: r.lines?.length || 0,
      lines: (r.lines || []).map((l, idx) => ({
        lineId: l.receiptLineId || `line-${idx}`,
        ingredientCode: l.ingredientCode || 'NL-001',
        ingredientName: l.ingredientName || 'Nguyên liệu',
        unit: l.unitName || 'Kilogram',
        receivedQty: l.receivedQty || 0,
        unitPrice: l.unitPrice || 0,
      })),
    }));
  },

  async getIssues(): Promise<InventoryIssueItem[]> {
    const resp = await apiClient<{ items: RawIssue[] } | RawIssue[]>('/inventory-issues');
    const items = Array.isArray(resp) ? resp : resp?.items || [];

    return items.map((i) => ({
      issueId: i.issueId,
      issueCode: i.issueCode,
      issueDate: i.issueDate,
      shiftName: i.shiftName || 'Ca 1 (Sáng)',
      warehouseName: i.warehouseName || 'Kho trung tâm',
      status: (i.status?.toUpperCase() as InventoryIssueItem['status']) || 'ISSUED',
      itemsCount: i.lines?.length || 0,
      lines: (i.lines || []).map((l, idx) => ({
        lineId: l.issueLineId || `line-${idx}`,
        ingredientCode: l.ingredientCode || 'NL-001',
        ingredientName: l.ingredientName || 'Nguyên liệu',
        unit: l.unitName || 'Kilogram',
        requestedQty: l.requestedQty || 0,
        issuedQty: l.issuedQty || 0,
      })),
    }));
  },

  async createIssue(data: {
    warehouseId: string;
    shiftName: string;
    lines: Array<{ ingredientId: string; qty: number }>;
  }): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/inventory-issues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createReceipt(data: {
    warehouseId: string;
    supplierId: string;
    lines: Array<{ ingredientId: string; qty: number; price: number }>;
  }): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/inventory-receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
