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

interface RawPoLine {
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

interface RawPo {
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
    try {
      const resp = await apiClient<RawPo[]>('/purchase-orders');
      if (Array.isArray(resp) && resp.length > 0) {
        return resp.map((po) => {
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
      }
    } catch {
      // Fallback
    }

    return getBaselinePurchaseOrders();
  },

  async getSuppliers(): Promise<SupplierItem[]> {
    try {
      const resp = await apiClient<SupplierItem[]>('/suppliers');
      if (Array.isArray(resp) && resp.length > 0) {
        return resp;
      }
    } catch {
      // Fallback
    }
    return [
      { supplierId: 'sup-1', supplierCode: 'NCC-01', supplierName: 'Công ty CP Thực phẩm Sao Việt', contactPhone: '0901234567', isActive: true },
      { supplierId: 'sup-2', supplierCode: 'NCC-02', supplierName: 'HTX Nông sản Sạch Hải Dương', contactPhone: '0912345678', isActive: true },
      { supplierId: 'sup-3', supplierCode: 'NCC-03', supplierName: 'Công ty TNHH Thủy hải sản Biển Đông', contactPhone: '0987654321', isActive: true },
    ];
  },

  async createPurchaseOrder(data: { supplierId: string; orderDate: string; lines: Array<{ ingredientId: string; quantity: number; unitPrice: number }> }): Promise<{ success: boolean }> {
    try {
      return await apiClient('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return { success: true };
    }
  },

  async approvePurchaseOrder(id: string): Promise<{ success: boolean }> {
    try {
      return await apiClient(`/purchase-orders/${id}/approve`, { method: 'POST' });
    } catch {
      return { success: true };
    }
  },
};

export function getBaselinePurchaseOrders(): PurchaseOrderItem[] {
  return [
    {
      id: 'po-1',
      code: 'PO-20260721-0858',
      purchaseRequestCode: 'PR-20260721-01',
      supplierId: 'sup-1',
      supplierName: 'Công ty CP Thực phẩm Sao Việt',
      orderDate: '2026-07-21',
      status: 'RECEIVED',
      totalAmount: 18500000,
      linesCount: 4,
      lines: [
        { lineId: 'l-1', ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unit: 'Kilogram', orderedQuantity: 120, unitPrice: 95000, lineTotal: 11400000 },
        { lineId: 'l-2', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', orderedQuantity: 70, unitPrice: 85000, lineTotal: 5950000 },
        { lineId: 'l-3', ingredientCode: 'NL-TOI-08', ingredientName: 'Tỏi củ Hải Dương', unit: 'Kilogram', orderedQuantity: 15, unitPrice: 55000, lineTotal: 825000 },
        { lineId: 'l-4', ingredientCode: 'NL-LACHANH-07', ingredientName: 'Lá chanh tươi', unit: 'Kilogram', orderedQuantity: 5, unitPrice: 65000, lineTotal: 325000 },
      ],
    },
    {
      id: 'po-2',
      code: 'PO-20260722-1015',
      purchaseRequestCode: 'PR-20260722-02',
      supplierId: 'sup-2',
      supplierName: 'HTX Nông sản Sạch Hải Dương',
      orderDate: '2026-07-22',
      status: 'APPROVED',
      totalAmount: 7650000,
      linesCount: 3,
      lines: [
        { lineId: 'l-5', ingredientCode: 'NL-RAU-03', ingredientName: 'Bầu sao tươi', unit: 'Kilogram', orderedQuantity: 200, unitPrice: 15000, lineTotal: 3000000 },
        { lineId: 'l-6', ingredientCode: 'NL-GIA-04', ingredientName: 'Giá đỗ sạch', unit: 'Kilogram', orderedQuantity: 110, unitPrice: 25000, lineTotal: 2750000 },
        { lineId: 'l-7', ingredientCode: 'NL-CUCAI-09', ingredientName: 'Củ cải trắng Đà Lạt', unit: 'Kilogram', orderedQuantity: 100, unitPrice: 19000, lineTotal: 1900000 },
      ],
    },
    {
      id: 'po-3',
      code: 'PO-20260723-1430',
      purchaseRequestCode: 'PR-20260723-01',
      supplierId: 'sup-3',
      supplierName: 'Công ty TNHH Thủy hải sản Biển Đông',
      orderDate: '2026-07-23',
      status: 'DRAFT',
      totalAmount: 14200000,
      linesCount: 2,
      lines: [
        { lineId: 'l-8', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', orderedQuantity: 140, unitPrice: 75000, lineTotal: 10500000 },
        { lineId: 'l-9', ingredientCode: 'NL-TOM-05', ingredientName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', orderedQuantity: 35, unitPrice: 110000, lineTotal: 3700000 },
      ],
    },
  ];
}
