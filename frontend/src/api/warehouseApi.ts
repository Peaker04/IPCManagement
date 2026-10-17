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
  lines: Array<{
    receiptLineId: string;
    ingredientId: string;
    ingredientName?: string;
    unitId: string;
    unitName?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface RawIssue {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseName?: string;
  receivedAt?: string;
  lines: Array<{
    issueLineId: string;
    ingredientId: string;
    ingredientName?: string;
    unitId: string;
    unitName?: string;
    requestedQty: number;
    issuedQty: number;
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
      supplierName: r.supplierName || '—',
      warehouseName: r.warehouseName || '—',
      status: r.status.toUpperCase() as InventoryReceiptItem['status'],
      itemsCount: r.lines.length,
      lines: r.lines.map((line) => ({
        lineId: line.receiptLineId,
        ingredientCode: line.ingredientId,
        ingredientName: line.ingredientName || '—',
        unit: line.unitName || '—',
        receivedQty: line.quantity,
        unitPrice: line.unitPrice,
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
      shiftName: i.shiftName || '—',
      warehouseName: i.warehouseName || '—',
      status: i.receivedAt ? 'CONFIRMED' : 'ISSUED',
      itemsCount: i.lines.length,
      lines: i.lines.map((line) => ({
        lineId: line.issueLineId,
        ingredientCode: line.ingredientId,
        ingredientName: line.ingredientName || '—',
        unit: line.unitName || '—',
        requestedQty: line.requestedQty,
        issuedQty: line.issuedQty,
      })),
    }));
  },
};
