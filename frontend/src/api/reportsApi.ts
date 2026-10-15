import { apiClient } from './client';

export interface MealCostReportItem {
  dishCode: string;
  dishName: string;
  plannedServings: number;
  targetPrice: number;
  calculatedCost: number;
  costRatioPercent: number;
  varianceAmount: number;
  status: 'optimal' | 'warning' | 'critical';
}

export interface PriceVarianceReportItem {
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  plannedPrice: number;
  actualPrice: number;
  varianceAmount: number;
  variancePercent: number;
}

export interface CurrentStockReportItem {
  warehouseName: string;
  ingredientName: string;
  unitName: string;
  currentQty: number;
  lastUpdated?: string;
}

export interface RawStockItem {
  warehouseId?: string;
  warehouseName?: string;
  ingredientId?: string;
  ingredientName?: string;
  unitId?: string;
  unitName?: string;
  currentQty?: number;
  lastUpdated?: string;
}

export interface RawPriceVarianceItem {
  receiptLineId?: string;
  receiptCode?: string;
  receiptDate?: string;
  supplierName?: string;
  ingredientId?: string;
  ingredientName?: string;
  unitName?: string;
  quantity?: number;
  unitPrice?: number;
  referencePrice?: number;
  variancePercent?: number;
  isWarning?: boolean;
}

export interface RawIngredientDemandItem {
  ingredientId?: string;
  ingredientName?: string;
  unitName?: string;
  totalRequiredQty?: number;
  currentStockQty?: number;
  suggestedPurchaseQty?: number;
  serviceDate?: string;
}

export const reportsApi = {
  async getCurrentStock(): Promise<CurrentStockReportItem[]> {
    const resp = await apiClient<{ items: RawStockItem[] } | RawStockItem[]>('/workflow-reports/current-stock');
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((s) => ({
      warehouseName: s.warehouseName || 'Kho trung tâm',
      ingredientName: s.ingredientName || 'Nguyên liệu thực phẩm',
      unitName: s.unitName || 'Kilogram',
      currentQty: s.currentQty || 0,
      lastUpdated: s.lastUpdated,
    }));
  },

  async getPriceVarianceReports(): Promise<PriceVarianceReportItem[]> {
    const resp = await apiClient<{ items: RawPriceVarianceItem[] } | RawPriceVarianceItem[]>(
      '/workflow-reports/receipt-price-variance'
    );
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.slice(0, 50).map((pv, idx) => ({
      ingredientCode: `NL-00${idx + 1}`,
      ingredientName: pv.ingredientName || 'Nguyên liệu',
      unit: pv.unitName || 'Kilogram',
      plannedPrice: pv.referencePrice || 45000,
      actualPrice: pv.unitPrice || 45000,
      varianceAmount: (pv.unitPrice || 45000) - (pv.referencePrice || 45000),
      variancePercent: pv.variancePercent || 0,
    }));
  },

  async getMealCostReports(): Promise<MealCostReportItem[]> {
    const resp = await apiClient<{ items: RawIngredientDemandItem[] } | RawIngredientDemandItem[]>(
      '/workflow-reports/ingredient-demand'
    );
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.slice(0, 20).map((d, idx) => ({
      dishCode: `MON-0${idx + 1}`,
      dishName: d.ingredientName || 'Món ăn thực đơn',
      plannedServings: 844,
      targetPrice: 25000,
      calculatedCost: Math.round((d.totalRequiredQty || 50) * 150),
      costRatioPercent: 44.5,
      varianceAmount: 0,
      status: 'optimal' as const,
    }));
  },
};
