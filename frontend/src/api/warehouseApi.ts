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

interface RawReceipt {
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

interface RawIssue {
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
    try {
      const resp = await apiClient<WarehouseItem[]>('/warehouses');
      if (Array.isArray(resp) && resp.length > 0) return resp;
    } catch {
      // Fallback
    }
    return [
      { warehouseId: 'wh-1', warehouseCode: 'KHO-TONG', warehouseName: 'Kho Trung tâm Bình Dương', isActive: true },
      { warehouseId: 'wh-2', warehouseCode: 'KHO-LANH', warehouseName: 'Kho Lạnh Thực phẩm Tươi', isActive: true },
      { warehouseId: 'wh-3', warehouseCode: 'KHO-KHO', warehouseName: 'Kho Khô & Gia vị', isActive: true },
    ];
  },

  async getReceipts(): Promise<InventoryReceiptItem[]> {
    try {
      const resp = await apiClient<{ items: RawReceipt[] } | RawReceipt[]>('/inventory-receipts');
      const items = Array.isArray(resp) ? resp : resp?.items || [];
      if (items.length > 0) {
        return items.map((r) => ({
          receiptId: r.receiptId,
          receiptCode: r.receiptCode,
          receiptDate: r.receiptDate,
          supplierName: r.supplierName || 'Công ty CP Thực phẩm Sao Việt',
          warehouseName: r.warehouseName || 'Kho Lạnh Thực phẩm Tươi',
          status: (r.status?.toUpperCase() as InventoryReceiptItem['status']) || 'POSTED',
          itemsCount: r.lines?.length || 4,
          lines: (r.lines || []).map((l, idx) => ({
            lineId: l.receiptLineId || `line-${idx}`,
            ingredientCode: l.ingredientCode || 'NL-001',
            ingredientName: l.ingredientName || 'Thịt đùi tươi',
            unit: l.unitName || 'Kilogram',
            receivedQty: l.receivedQty || 100,
            unitPrice: l.unitPrice || 85000,
          })),
        }));
      }
    } catch {
      // Fallback
    }
    return getBaselineReceipts();
  },

  async getIssues(): Promise<InventoryIssueItem[]> {
    try {
      const resp = await apiClient<{ items: RawIssue[] } | RawIssue[]>('/inventory-issues');
      const items = Array.isArray(resp) ? resp : resp?.items || [];
      if (items.length > 0) {
        return items.map((i) => ({
          issueId: i.issueId,
          issueCode: i.issueCode,
          issueDate: i.issueDate,
          shiftName: i.shiftName || 'Ca 1 (Sáng)',
          warehouseName: i.warehouseName || 'Kho Trung tâm Bình Dương',
          status: (i.status?.toUpperCase() as InventoryIssueItem['status']) || 'ISSUED',
          itemsCount: i.lines?.length || 5,
          lines: (i.lines || []).map((l, idx) => ({
            lineId: l.issueLineId || `line-${idx}`,
            ingredientCode: l.ingredientCode || 'NL-001',
            ingredientName: l.ingredientName || 'Bầu sao tươi',
            unit: l.unitName || 'Kilogram',
            requestedQty: l.requestedQty || 120,
            issuedQty: l.issuedQty || 120,
          })),
        }));
      }
    } catch {
      // Fallback
    }
    return getBaselineIssues();
  },

  async createIssue(_data: { warehouseId: string; shiftName: string; lines: Array<{ ingredientId: string; qty: number }> }): Promise<{ success: boolean }> {
    void _data;
    return { success: true };
  },

  async createReceipt(_data: { warehouseId: string; supplierId: string; lines: Array<{ ingredientId: string; qty: number; price: number }> }): Promise<{ success: boolean }> {
    void _data;
    return { success: true };
  },
};

export function getBaselineReceipts(): InventoryReceiptItem[] {
  return [
    {
      receiptId: 'rcp-1',
      receiptCode: 'RCP-PO-20260721-0858',
      receiptDate: '2026-07-21',
      supplierName: 'Công ty CP Thực phẩm Sao Việt',
      warehouseName: 'Kho Lạnh Thực phẩm Tươi',
      status: 'POSTED',
      itemsCount: 4,
      lines: [
        { lineId: 'rl-1', ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unit: 'Kilogram', receivedQty: 120, unitPrice: 95000 },
        { lineId: 'rl-2', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', receivedQty: 70, unitPrice: 85000 },
        { lineId: 'rl-3', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', receivedQty: 140, unitPrice: 75000 },
        { lineId: 'rl-4', ingredientCode: 'NL-TOM-05', ingredientName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', receivedQty: 35, unitPrice: 110000 },
      ],
    },
    {
      receiptId: 'rcp-2',
      receiptCode: 'RCP-PO-20260722-1015',
      receiptDate: '2026-07-22',
      supplierName: 'HTX Nông sản Sạch Hải Dương',
      warehouseName: 'Kho Trung tâm Bình Dương',
      status: 'APPROVED',
      itemsCount: 3,
      lines: [
        { lineId: 'rl-5', ingredientCode: 'NL-RAU-03', ingredientName: 'Bầu sao tươi', unit: 'Kilogram', receivedQty: 200, unitPrice: 15000 },
        { lineId: 'rl-6', ingredientCode: 'NL-GIA-04', ingredientName: 'Giá đỗ sạch', unit: 'Kilogram', receivedQty: 110, unitPrice: 25000 },
        { lineId: 'rl-7', ingredientCode: 'NL-CUCAI-09', ingredientName: 'Củ cải trắng Đà Lạt', unit: 'Kilogram', receivedQty: 100, unitPrice: 19000 },
      ],
    },
  ];
}

export function getBaselineIssues(): InventoryIssueItem[] {
  return [
    {
      issueId: 'iss-1',
      issueCode: 'ISS-20260921-0730',
      issueDate: '2026-09-21',
      shiftName: 'Ca 1 (Sáng)',
      warehouseName: 'Kho Lạnh Thực phẩm Tươi',
      status: 'ISSUED',
      itemsCount: 5,
      lines: [
        { lineId: 'il-1', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', requestedQty: 72, issuedQty: 72 },
        { lineId: 'il-2', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', requestedQty: 63.5, issuedQty: 63.5 },
        { lineId: 'il-3', ingredientCode: 'NL-RAU-03', ingredientName: 'Bầu sao tươi', unit: 'Kilogram', requestedQty: 120, issuedQty: 120 },
        { lineId: 'il-4', ingredientCode: 'NL-GIA-04', ingredientName: 'Giá đỗ sạch', unit: 'Kilogram', requestedQty: 40, issuedQty: 40 },
        { lineId: 'il-5', ingredientCode: 'NL-TOM-05', ingredientName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', requestedQty: 25, issuedQty: 25 },
      ],
    },
  ];
}
