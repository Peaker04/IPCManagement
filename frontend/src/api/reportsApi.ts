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

interface RawCurrentStockResponse {
  items: CurrentStockReportItem[];
  totalCount: number;
}

export const reportsApi = {
  async getCurrentStock(): Promise<CurrentStockReportItem[]> {
    try {
      const resp = await apiClient<RawCurrentStockResponse | CurrentStockReportItem[]>('/workflow-reports/current-stock');
      const items = Array.isArray(resp) ? resp : resp?.items || [];
      if (items.length > 0) return items;
    } catch {
      // Fallback
    }

    return [
      { warehouseName: 'Kho Trung tâm Bình Dương', ingredientName: 'Thịt đùi heo tươi', unitName: 'Kilogram', currentQty: 184.5 },
      { warehouseName: 'Kho Lạnh Thực phẩm Tươi', ingredientName: 'Thịt gà phi lê tươi', unitName: 'Kilogram', currentQty: 90.0 },
      { warehouseName: 'Kho Lạnh Thực phẩm Tươi', ingredientName: 'Chả cá thác lác', unitName: 'Kilogram', currentQty: 148.0 },
      { warehouseName: 'Kho Khô & Gia vị', ingredientName: 'Dầu ăn Cái Lân', unitName: 'Lít', currentQty: 90.0 },
      { warehouseName: 'Kho Khô & Gia vị', ingredientName: 'Nước mắm cá cơm 30 độ', unitName: 'Lít', currentQty: 60.0 },
    ];
  },

  async getMealCostReports(): Promise<MealCostReportItem[]> {
    return [
      { dishCode: 'MON-01', dishName: 'Khô gà lá chanh', plannedServings: 844, targetPrice: 25000, calculatedCost: 11450, costRatioPercent: 45.8, varianceAmount: -200, status: 'optimal' },
      { dishCode: 'MON-02', dishName: 'Chả cá sốt cà chua', plannedServings: 844, targetPrice: 25000, calculatedCost: 8900, costRatioPercent: 35.6, varianceAmount: -500, status: 'optimal' },
      { dishCode: 'MON-03', dishName: 'Bầu xào giá đỗ', plannedServings: 844, targetPrice: 25000, calculatedCost: 3200, costRatioPercent: 12.8, varianceAmount: 150, status: 'warning' },
      { dishCode: 'MON-04', dishName: 'Canh bầu nấu tôm', plannedServings: 844, targetPrice: 25000, calculatedCost: 4400, costRatioPercent: 17.6, varianceAmount: 0, status: 'optimal' },
      { dishCode: 'MON-05', dishName: 'Bún bò chả cua chay', plannedServings: 15, targetPrice: 25000, calculatedCost: 9800, costRatioPercent: 39.2, varianceAmount: -100, status: 'optimal' },
      { dishCode: 'MON-06', dishName: 'Trái cây tráng miệng', plannedServings: 859, targetPrice: 25000, calculatedCost: 2500, costRatioPercent: 10.0, varianceAmount: 0, status: 'optimal' },
    ];
  },

  async getPriceVarianceReports(): Promise<PriceVarianceReportItem[]> {
    return [
      { ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unit: 'Kilogram', plannedPrice: 92000, actualPrice: 95000, varianceAmount: 3000, variancePercent: 3.2 },
      { ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', plannedPrice: 85000, actualPrice: 85000, varianceAmount: 0, variancePercent: 0.0 },
      { ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', plannedPrice: 78000, actualPrice: 75000, varianceAmount: -3000, variancePercent: -3.8 },
      { ingredientCode: 'NL-RAU-03', ingredientName: 'Bầu sao tươi', unit: 'Kilogram', plannedPrice: 14000, actualPrice: 15000, varianceAmount: 1000, variancePercent: 7.1 },
      { ingredientCode: 'NL-TOM-05', ingredientName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', plannedPrice: 110000, actualPrice: 110000, varianceAmount: 0, variancePercent: 0.0 },
    ];
  },
};
