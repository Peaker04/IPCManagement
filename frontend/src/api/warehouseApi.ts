import { apiClient } from './client';
import type { ReportPage } from './reportsApi';

interface WarehousePageQuery {
  warehouseId?: string;
  pageNumber: number;
}

function warehousePageParams({ warehouseId, pageNumber }: WarehousePageQuery) {
  const params = new URLSearchParams({ pageNumber: String(pageNumber) });
  if (warehouseId && warehouseId !== 'ALL') params.set('warehouseId', warehouseId);
  return params;
}

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
  status: string;
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

function mapReceipt(receipt: RawReceipt): InventoryReceiptItem {
  return {
    receiptId: receipt.receiptId,
    receiptCode: receipt.receiptCode,
    receiptDate: receipt.receiptDate,
    supplierName: receipt.supplierName || '—',
    warehouseName: receipt.warehouseName || '—',
    status: receipt.status.toUpperCase(),
    itemsCount: receipt.lines.length,
    lines: receipt.lines.map(line => ({
      lineId: line.receiptLineId,
      ingredientCode: line.ingredientId,
      ingredientName: line.ingredientName || '—',
      unit: line.unitName || '—',
      receivedQty: line.quantity,
      unitPrice: line.unitPrice,
    })),
  };
}

export const warehouseApi = {
  async getWarehouses(signal?: AbortSignal): Promise<WarehouseItem[]> {
    const resp = await apiClient<{ items?: WarehouseItem[] } | WarehouseItem[]>('/warehouses', { signal });
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((w) => ({
      warehouseId: w.warehouseId,
      warehouseCode: w.warehouseCode,
      warehouseName: w.warehouseName,
      location: w.location,
      isActive: w.isActive,
    }));
  },

  async getReceipts(signal?: AbortSignal, query: WarehousePageQuery = { pageNumber: 1 }): Promise<ReportPage<InventoryReceiptItem>> {
    const page = await apiClient<ReportPage<RawReceipt>>(`/inventory-receipts?${warehousePageParams(query)}`, { signal });
    return { ...page, items: page.items.map(mapReceipt) };
  },

  async getReceipt(receiptId: string, signal?: AbortSignal): Promise<InventoryReceiptItem> {
    return mapReceipt(await apiClient<RawReceipt>(`/inventory-receipts/${encodeURIComponent(receiptId)}`, { signal }));
  },

  async getIssues(signal?: AbortSignal, query: WarehousePageQuery = { pageNumber: 1 }): Promise<ReportPage<InventoryIssueItem>> {
    const page = await apiClient<ReportPage<RawIssue>>(`/inventory-issues?${warehousePageParams(query)}`, { signal });
    return { ...page, items: page.items.map((i) => ({
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
    })) };
  },
};
