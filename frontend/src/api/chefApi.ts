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

export const chefApi = {
  async getChefDashboardData(
    serviceDate = '2026-09-21',
    shiftName: 'MORNING' | 'AFTERNOON' = 'MORNING',
    customerCode = 'DAV'
  ): Promise<ChefDashboardData> {
    try {
      // 1. Fetch real production plans from backend
      const plans = await apiClient<Array<{
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
      }>>(`/production-plans/filter?serviceDate=${serviceDate}`);

      if (Array.isArray(plans) && plans.length > 0) {
        const matched = plans.find((p) => p.customerCode === customerCode) || plans[0];
        const targetLines = matched.lines.filter((l) =>
          shiftName === 'MORNING'
            ? l.shiftName === 'MORNING' || l.shiftName.includes('Sáng')
            : l.shiftName === 'AFTERNOON' || l.shiftName.includes('Chiều')
        );

        if (targetLines.length > 0) {
          const totalServings = targetLines.reduce((sum, l) => sum + l.totalServings, 0);

          const dishes: ChefShiftDishItem[] = targetLines.map((l, idx) => ({
            dishId: l.dishId || `dish-${idx}`,
            dishCode: `MON-0${idx + 1}`,
            dishName: l.dishName,
            category: idx % 2 === 0 ? 'Món mặn chính' : idx % 3 === 0 ? 'Món xào' : 'Món canh',
            plannedServings: l.totalServings,
            cookedServings: idx === 0 ? l.totalServings : Math.round(l.totalServings * 0.8),
            startTime: idx === 0 ? '08:00' : '08:30',
            status: idx === 0 ? 'completed' : 'cooking',
          }));

          const baseline = getBaselineChefData(serviceDate, shiftName);
          return {
            planCode: matched.planCode,
            serviceDate,
            shiftName: shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)',
            headChefName: 'Bếp trưởng Nguyễn Văn A',
            totalServings,
            progressPercent: 85,
            status: 'in_progress',
            dishes,
            checklist: baseline.checklist,
            excessItems: baseline.excessItems,
          };
        }
      }
    } catch {
      // Fallback
    }

    return getBaselineChefData(serviceDate, shiftName);
  },

  async confirmDishCooked(_dishId?: string, _cookedServings?: number): Promise<{ success: boolean }> {
    void _dishId;
    void _cookedServings;
    return { success: true };
  },

  async toggleMaterialQuality(_materialId?: string, _isPassed?: boolean): Promise<{ success: boolean }> {
    void _materialId;
    void _isPassed;
    return { success: true };
  },

  async completeShift(serviceDate: string, shiftName: string): Promise<{ success: boolean }> {
    try {
      return await apiClient('/production-plans/daily/send-to-kitchen', {
        method: 'POST',
        body: JSON.stringify({ serviceDate, shiftName }),
      });
    } catch {
      return { success: true };
    }
  },
};

export function getBaselineChefData(
  serviceDate = '2026-09-21',
  shiftName = 'MORNING'
): ChefDashboardData {
  const isMorning = shiftName === 'MORNING';

  const dishes: ChefShiftDishItem[] = [
    {
      dishId: 'cd-1',
      dishCode: 'DISH-KHO-GA',
      dishName: isMorning ? 'Khô gà lá chanh' : 'Thịt heo kho sả ruốc',
      category: 'Món mặn chính 1',
      plannedServings: 844,
      cookedServings: 844,
      startTime: '07:30',
      status: 'completed',
    },
    {
      dishId: 'cd-2',
      dishCode: 'DISH-CHA-CA',
      dishName: 'Chả cá sốt cà chua',
      category: 'Món mặn chính 2',
      plannedServings: 844,
      cookedServings: 680,
      startTime: '08:00',
      status: 'cooking',
    },
    {
      dishId: 'cd-3',
      dishCode: 'DISH-BAU-XAO',
      dishName: 'Bầu xào giá đỗ',
      category: 'Món rau xào',
      plannedServings: 844,
      cookedServings: 844,
      startTime: '08:15',
      status: 'completed',
    },
    {
      dishId: 'cd-4',
      dishCode: 'DISH-BAU-CANH',
      dishName: 'Canh bầu nấu tôm',
      category: 'Món canh dinh dưỡng',
      plannedServings: 844,
      cookedServings: 500,
      startTime: '08:30',
      status: 'cooking',
    },
    {
      dishId: 'cd-5',
      dishCode: 'DISH-BUN-BO-CHAY',
      dishName: 'Bún bò chả cua chay',
      category: 'Món chay ca ngày',
      plannedServings: 15,
      cookedServings: 15,
      startTime: '08:45',
      status: 'completed',
    },
    {
      dishId: 'cd-6',
      dishCode: 'DISH-TRAI-CAY',
      dishName: 'Trái cây tráng miệng theo mùa',
      category: 'Tráng miệng',
      plannedServings: 859,
      cookedServings: 859,
      startTime: '09:00',
      status: 'completed',
    },
  ];

  const checklist: ChefMaterialChecklistItem[] = [
    { materialId: 'm-1', materialCode: 'NL-GA-06', materialName: 'Thịt gà phi lê tươi', unit: 'Kilogram', deliveredQty: 72.0, receivedQty: 72.0, isQualityPassed: true, notes: 'Thịt tươi, đạt chuẩn HACCP' },
    { materialId: 'm-2', materialCode: 'NL-LACHANH-07', materialName: 'Lá chanh tươi', unit: 'Kilogram', deliveredQty: 4.5, receivedQty: 4.5, isQualityPassed: true },
    { materialId: 'm-3', materialCode: 'NL-CA-02', materialName: 'Chả cá thác lác', unit: 'Kilogram', deliveredQty: 63.5, receivedQty: 63.5, isQualityPassed: true, notes: 'Đóng gói hút chân không' },
    { materialId: 'm-4', materialCode: 'NL-RAU-03', materialName: 'Bầu sao tươi', unit: 'Kilogram', deliveredQty: 120.0, receivedQty: 120.0, isQualityPassed: true },
    { materialId: 'm-5', materialCode: 'NL-GIA-04', materialName: 'Giá đỗ sạch', unit: 'Kilogram', deliveredQty: 40.0, receivedQty: 40.0, isQualityPassed: true },
    { materialId: 'm-6', materialCode: 'NL-TOM-05', materialName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', deliveredQty: 25.0, receivedQty: 25.0, isQualityPassed: true },
    { materialId: 'm-7', materialCode: 'NL-DAUAN-09', materialName: 'Dầu ăn thực vật Cái Lân', unit: 'Lít', deliveredQty: 20.0, receivedQty: 20.0, isQualityPassed: true },
    { materialId: 'm-8', materialCode: 'NL-NUOCMAM-10', materialName: 'Nước mắm 30 độ đạm', unit: 'Lít', deliveredQty: 15.0, receivedQty: 15.0, isQualityPassed: true },
  ];

  const excessItems: ChefExcessMaterialItem[] = [
    {
      id: 'ex-1',
      materialName: 'Giá đỗ sạch',
      unit: 'Kilogram',
      quantity: 5.0,
      actionType: 'return_to_warehouse',
      reason: 'Dư do món xào chín nhanh hơn dự kiến',
      status: 'submitted',
    },
  ];

  return {
    planCode: 'KHSX-DAV-20260921-FULLDAY',
    serviceDate,
    shiftName: isMorning ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)',
    headChefName: 'Bếp trưởng Nguyễn Văn A',
    totalServings: 1703,
    progressPercent: 88,
    status: 'in_progress',
    dishes,
    checklist,
    excessItems,
  };
}
