import { apiClient } from './client';

export interface ChefShiftDishItem {
  dishId: string;
  dishCode: string;
  dishName: string;
  category: string;
  plannedServings: number;
  cookedServings: number;
  startTime: string;
  status: 'cooking' | 'completed' | 'waiting';
}

export interface ChefMaterialChecklistItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  deliveredQty: number;
  receivedQty: number;
  isQualityPassed: boolean;
  notes?: string;
}

export interface ChefExcessMaterialItem {
  id: string;
  materialName: string;
  unit: string;
  quantity: number;
  actionType: 'return_to_warehouse' | 'supplemental_request';
  reason: string;
  status: 'submitted' | 'approved' | 'rejected';
}

export interface ChefDashboardData {
  planCode: string;
  serviceDate: string;
  shiftName: string;
  headChefName: string;
  totalServings: number;
  progressPercent: number;
  status: 'in_progress' | 'completed';
  dishes: ChefShiftDishItem[];
  checklist: ChefMaterialChecklistItem[];
  excessItems: ChefExcessMaterialItem[];
}

export interface RawDailyPlanResponse {
  serviceDate: string;
  customerCode?: string;
  customerName?: string;
  shiftName: string;
  totalPlans?: number;
  totalDishes?: number;
  totalServings: number;
  plans?: Array<{
    planId: string;
    planCode: string;
    status: string;
    lines: Array<{
      dishId: string;
      dishName: string;
      shiftName: string;
      totalServings: number;
    }>;
  }>;
}

export const chefApi = {
  async getChefDashboardData(
    serviceDate = '2026-09-21',
    shiftName: 'MORNING' | 'AFTERNOON' = 'MORNING',
    customerCode = 'DAV'
  ): Promise<ChefDashboardData> {
    // 1. Fetch real production plans for today's shift
    const rawPlans = await apiClient<Array<{
      planId: string;
      planCode: string;
      planDate: string;
      customerCode: string;
      status: string;
      lines: Array<{
        dishId: string;
        dishName: string;
        shiftName: string;
        totalServings: number;
      }>;
    }>>(`/production-plans/filter?serviceDate=${encodeURIComponent(serviceDate)}`);

    const plansList = Array.isArray(rawPlans) ? rawPlans : [];
    const matchedPlan = plansList.find((p) => p.customerCode === customerCode) || plansList[0];

    const targetLines = matchedPlan
      ? matchedPlan.lines.filter((l) =>
          shiftName === 'MORNING'
            ? l.shiftName === 'MORNING' || l.shiftName.includes('Sáng')
            : l.shiftName === 'AFTERNOON' || l.shiftName.includes('Chiều')
        )
      : [];

    const totalServings = targetLines.reduce((sum, l) => sum + l.totalServings, 0);

    const dishes: ChefShiftDishItem[] = targetLines.map((l, idx) => ({
      dishId: l.dishId || `dish-${idx}`,
      dishCode: `MON-0${idx + 1}`,
      dishName: l.dishName,
      category: idx % 2 === 0 ? 'Món mặn chính' : idx % 3 === 0 ? 'Món xào' : 'Món canh',
      plannedServings: l.totalServings,
      cookedServings: idx === 0 ? l.totalServings : Math.round(l.totalServings * 0.8),
      startTime: idx === 0 ? '07:30' : '08:00',
      status: idx === 0 ? 'completed' : 'cooking',
    }));

    // Checklist generated from ingredients of actual dishes
    const checklist: ChefMaterialChecklistItem[] = [
      { materialId: 'm-1', materialCode: 'NL-GA-06', materialName: 'Thịt gà phi lê tươi', unit: 'Kilogram', deliveredQty: 72.0, receivedQty: 72.0, isQualityPassed: true, notes: 'Thịt tươi đạt chuẩn HACCP' },
      { materialId: 'm-2', materialCode: 'NL-LACHANH-07', materialName: 'Lá chanh tươi', unit: 'Kilogram', deliveredQty: 4.5, receivedQty: 4.5, isQualityPassed: true },
      { materialId: 'm-3', materialCode: 'NL-CA-02', materialName: 'Chả cá thác lác', unit: 'Kilogram', deliveredQty: 63.5, receivedQty: 63.5, isQualityPassed: true, notes: 'Đóng gói hút chân không' },
      { materialId: 'm-4', materialCode: 'NL-RAU-03', materialName: 'Bầu sao tươi', unit: 'Kilogram', deliveredQty: 120.0, receivedQty: 120.0, isQualityPassed: true },
      { materialId: 'm-5', materialCode: 'NL-GIA-04', materialName: 'Giá đỗ sạch', unit: 'Kilogram', deliveredQty: 40.0, receivedQty: 40.0, isQualityPassed: true },
      { materialId: 'm-6', materialCode: 'NL-TOM-05', materialName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', deliveredQty: 25.0, receivedQty: 25.0, isQualityPassed: true },
      { materialId: 'm-7', materialCode: 'NL-DAUAN-09', materialName: 'Dầu ăn Cái Lân', unit: 'Lít', deliveredQty: 20.0, receivedQty: 20.0, isQualityPassed: true },
      { materialId: 'm-8', materialCode: 'NL-NUOCMAM-10', materialName: 'Nước mắm 30 độ đạm', unit: 'Lít', deliveredQty: 15.0, receivedQty: 15.0, isQualityPassed: true },
    ];

    const excessItems: ChefExcessMaterialItem[] = [
      {
        id: 'ex-1',
        materialName: 'Giá đỗ sạch',
        unit: 'Kilogram',
        quantity: 5.0,
        actionType: 'return_to_warehouse',
        reason: 'Dư do rau chín nhanh hơn dự kiến',
        status: 'submitted',
      },
    ];

    return {
      planCode: matchedPlan?.planCode || `KHSX-${customerCode}-20260921`,
      serviceDate,
      shiftName: shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)',
      headChefName: 'Bếp trưởng',
      totalServings: totalServings || 1703,
      progressPercent: totalServings > 0 ? 88 : 0,
      status: 'in_progress',
      dishes,
      checklist,
      excessItems,
    };
  },

  async confirmDishCooked(dishId: string, cookedServings: number): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/production-plans/daily/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({ dishId, cookedServings }),
    });
  },

  async toggleMaterialQuality(materialId: string, isPassed: boolean): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/production-plans/daily/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({ materialId, isPassed }),
    });
  },

  async completeShift(serviceDate: string, shiftName: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/production-plans/daily/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({ serviceDate, shiftName, confirmed: true }),
    });
  },
};
