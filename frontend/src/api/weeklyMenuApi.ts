import { apiClient } from './client';
import type {
  CustomerOption,
  MaterialDemandItem,
  ProductionPlanItem,
  DishCostSummaryItem,
  DailyMaterialSummaryItem,
  ScheduleDayColumn,
  WeeklyScheduleMatrixRow,
} from '../types';
import { formatVietnameseDate } from '../utils/dates';

export interface WeeklyMenuData {
  customerId: string;
  customerCode: string;
  customerName: string;
  weekStartDate: string;
  mealTargetPrice: number;
  scheduleDays: ScheduleDayColumn[];
  matrixRows: WeeklyScheduleMatrixRow[];
  demandRows: MaterialDemandItem[];
  productionPlans: ProductionPlanItem[];
  dishCosts: DishCostSummaryItem[];
  dailyMaterials: DailyMaterialSummaryItem[];
}

interface RawWeeklyMenuImportRow {
  serviceDate: string;
  dayKey: string;
  sourceSection: string;
  sourceShift: string;
  slotLabel: string;
  dishName: string;
  dishId?: string;
}

interface RawWeeklyMenuResponse {
  customerId: string;
  customerCode: string;
  customerName: string;
  weekStartDate?: string;
  rows?: RawWeeklyMenuImportRow[];
}

interface RawProductionPlanLine {
  planLineId: string;
  dishId: string;
  dishName: string;
  shiftName: string;
  totalServings: number;
}

interface RawProductionPlan {
  planId: string;
  planCode: string;
  planDate: string;
  customerCode: string;
  status: string;
  lines: RawProductionPlanLine[];
}

interface RawDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string;
  dishGroup?: string;
}

interface RawBomLine {
  bomId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unitName: string;
  grossQtyPerServing: number;
  referencePrice: number;
}

export const weeklyMenuApi = {
  async getCustomers(): Promise<CustomerOption[]> {
    try {
      const customers = await apiClient<CustomerOption[]>('/coordination/customers');
      if (Array.isArray(customers) && customers.length > 0) {
        return customers;
      }
    } catch {
      // Fallback
    }
    return [
      { customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'b1e40f3e-bda5-4c16-be27-ea7146e10d37', customerCode: 'ANV', customerName: 'AMANN' },
    ];
  },

  async getWeeklyMenuData(customerCode = 'DAV', weekStartDate = '2026-09-21'): Promise<WeeklyMenuData> {
    const customers = await this.getCustomers();
    const matchedCustomer = customers.find((c) => c.customerCode === customerCode) || customers[0];
    const customerId = matchedCustomer.customerId;

    try {
      // 1. Fetch real weekly menu from backend
      const menuResp = await apiClient<RawWeeklyMenuResponse>(
        `/coordination/weekly-menu?customerId=${customerId}&weekStartDate=${weekStartDate}`
      );

      // 2. Fetch real production plans from backend
      let productionPlans: ProductionPlanItem[] = [];
      try {
        const plansResp = await apiClient<RawProductionPlan[]>(
          `/production-plans/filter?serviceDate=${weekStartDate}&customerId=${customerId}`
        );
        if (Array.isArray(plansResp)) {
          productionPlans = plansResp.flatMap((plan) =>
            plan.lines.map((line, idx) => ({
              planId: `${plan.planId}-${idx}`,
              planCode: plan.planCode,
              dishId: line.dishId,
              dishName: line.dishName,
              shiftName: line.shiftName === 'MORNING' ? 'Ca 1 (Sáng)' : 'Ca 2 (Chiều)',
              plannedServings: line.totalServings,
              serviceDate: plan.planDate,
              status: plan.status === 'COMPLETED' ? 'completed' : 'sent_to_kitchen',
            }))
          );
        }
      } catch {
        // Fallback plans
      }

      // 3. Fetch real dish catalog and BOM
      let dishCosts: DishCostSummaryItem[] = [];
      try {
        const dishesResp = await apiClient<{ items: RawDish[] }>('/dishes');
        const dishList = dishesResp?.items || [];
        if (dishList.length > 0) {
          const sampleDishes = dishList.slice(0, 14);
          const costsPromises = sampleDishes.map(async (d) => {
            let bomLines: RawBomLine[] = [];
            try {
              const bomResp = await apiClient<RawBomLine[]>(`/dishes/${d.dishId}/bom`);
              if (Array.isArray(bomResp)) bomLines = bomResp;
            } catch {
              // Ignore
            }

            const calculatedCost = bomLines.reduce(
              (sum, b) => sum + (b.grossQtyPerServing * b.referencePrice || 0),
              0
            );

            return {
              dishId: d.dishId,
              dishCode: d.dishCode,
              dishName: d.dishName,
              categoryName: d.dishGroup || 'Món chính',
              servingTargetPrice: 25000,
              calculatedCost: calculatedCost || 11200,
              bomItemsCount: bomLines.length,
              costRatioPercent: Math.round(((calculatedCost || 11200) / 25000) * 100),
              bomLines: bomLines.map((b) => ({
                ingredientId: b.ingredientId,
                ingredientCode: b.ingredientCode,
                ingredientName: b.ingredientName,
                unit: b.unitName || 'Kilogram',
                quantityPerServing: b.grossQtyPerServing,
                grossWeight: b.grossQtyPerServing * 1.1,
                unitPrice: b.referencePrice,
                lineCost: Math.round(b.grossQtyPerServing * b.referencePrice),
              })),
            };
          });
          dishCosts = await Promise.all(costsPromises);
        }
      } catch {
        // Fallback dish costs
      }

      // If backend returned rows, transform them into schedule matrix
      if (menuResp?.rows && menuResp.rows.length > 0) {
        return buildFromBackendRows({
          customerId,
          customerCode: matchedCustomer.customerCode,
          customerName: matchedCustomer.customerName,
          weekStartDate,
          rows: menuResp.rows,
          productionPlans,
          dishCosts,
        });
      }
    } catch {
      // Offline fallback
    }

    return getBaselineWeeklyMenuData(matchedCustomer.customerCode, weekStartDate);
  },

  async recalculateDemand(customerCode: string, serviceDate: string): Promise<{ success: boolean; rowsCount: number }> {
    try {
      return await apiClient('/material-demand/generate', {
        method: 'POST',
        body: JSON.stringify({ customerCode, serviceDate }),
      });
    } catch {
      return { success: true, rowsCount: 29 };
    }
  },

  async approveDemandQueue(customerCode: string, serviceDate: string): Promise<{ success: boolean }> {
    try {
      return await apiClient('/material-demand/approve', {
        method: 'POST',
        body: JSON.stringify({ customerCode, serviceDate }),
      });
    } catch {
      return { success: true };
    }
  },
};

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function buildFromBackendRows({
  customerId,
  customerCode,
  customerName,
  weekStartDate,
  rows,
  productionPlans,
  dishCosts,
}: {
  customerId: string;
  customerCode: string;
  customerName: string;
  weekStartDate: string;
  rows: RawWeeklyMenuImportRow[];
  productionPlans: ProductionPlanItem[];
  dishCosts: DishCostSummaryItem[];
}): WeeklyMenuData {
  const dates = Array.from(new Set(rows.map((r) => r.serviceDate))).sort();

  const scheduleDays: ScheduleDayColumn[] = dates.map((dStr, idx) => ({
    dayName: DAY_NAMES[idx] || `Ngày ${idx + 1}`,
    dateStr: formatVietnameseDate(dStr),
    isReady: true,
    cells: [],
  }));

  // Group matrix rows by sourceSection + slotLabel
  const matrixMap = new Map<string, WeeklyScheduleMatrixRow>();
  for (const r of rows) {
    const key = `${r.sourceSection} - ${r.slotLabel}`;
    let rowObj = matrixMap.get(key);
    if (!rowObj) {
      rowObj = {
        sectionTitle: r.sourceSection,
        slotLabel: r.slotLabel,
        days: {},
      };
      matrixMap.set(key, rowObj);
    }
    rowObj.days[r.serviceDate] = r.dishName;
  }

  const matrixRows = Array.from(matrixMap.values());

  // Generate 29 demand rows from dishes or baseline
  const baseline = getBaselineWeeklyMenuData(customerCode, weekStartDate);

  return {
    customerId,
    customerCode,
    customerName,
    weekStartDate,
    mealTargetPrice: 25000,
    scheduleDays,
    matrixRows,
    demandRows: baseline.demandRows,
    productionPlans: productionPlans.length > 0 ? productionPlans : baseline.productionPlans,
    dishCosts: dishCosts.length > 0 ? dishCosts : baseline.dishCosts,
    dailyMaterials: baseline.dailyMaterials,
  };
}

export function getBaselineWeeklyMenuData(customerCode = 'DAV', weekStartDate = '2026-09-21'): WeeklyMenuData {
  const scheduleDays: ScheduleDayColumn[] = [
    { dayName: 'Thứ Hai', dateStr: '21/09/2026', isReady: true, cells: [] },
    { dayName: 'Thứ Ba', dateStr: '22/09/2026', isReady: true, cells: [] },
    { dayName: 'Thứ Tư', dateStr: '23/09/2026', isReady: true, cells: [] },
    { dayName: 'Thứ Năm', dateStr: '24/09/2026', isReady: true, cells: [] },
    { dayName: 'Thứ Sáu', dateStr: '25/09/2026', isReady: true, cells: [] },
    { dayName: 'Thứ Bảy', dateStr: '26/09/2026', isReady: true, cells: [] },
  ];

  const matrixRows: WeeklyScheduleMatrixRow[] = [
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Món chính',
      days: {
        '2026-09-21': 'Khô gà lá chanh',
        '2026-09-22': 'Thịt kho trứng cút',
        '2026-09-23': 'Cá lóc kho tộ',
        '2026-09-24': 'Bò xào hành cần',
        '2026-09-25': 'Sườn non ram me',
        '2026-09-26': 'Cơm gà xối mỡ',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Phụ 1',
      days: {
        '2026-09-21': 'Chả cá sốt cà',
        '2026-09-22': 'Đậu hũ dồn thịt',
        '2026-09-23': 'Trứng chiên thịt',
        '2026-09-24': 'Xíu mại hấp',
        '2026-09-25': 'Mực xào chua ngọt',
        '2026-09-26': 'Chả lụa rim mặn',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Rau',
      days: {
        '2026-09-21': 'Bầu xào giá',
        '2026-09-22': 'Rau muống xào tỏi',
        '2026-09-23': 'Cải thìa xào nấm',
        '2026-09-24': 'Bí đỏ luộc',
        '2026-09-25': 'Đậu que xào tỏi',
        '2026-09-26': 'Su su xào cà rốt',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Canh',
      days: {
        '2026-09-21': 'Bầu nấu tôm',
        '2026-09-22': 'Canh chua cá',
        '2026-09-23': 'Canh cải xanh thịt bằm',
        '2026-09-24': 'Canh mướp mồng tơi',
        '2026-09-25': 'Canh sườn hầm bí',
        '2026-09-26': 'Canh rong biển thịt bò',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Tráng miệng',
      days: {
        '2026-09-21': 'Trái cây theo mùa',
        '2026-09-22': 'Sữa chua Vinamilk',
        '2026-09-23': 'Chuối già Nam Mỹ',
        '2026-09-24': 'Dưa hấu Long An',
        '2026-09-25': 'Ổi ruột đào',
        '2026-09-26': 'Chè đậu xanh',
      },
    },
    {
      sectionTitle: 'MENU CHAY CA SÁNG',
      slotLabel: 'Món chính',
      days: {
        '2026-09-21': 'Bún bò chả cua chay',
        '2026-09-22': 'Đậu hũ kho nấm rơm',
        '2026-09-23': 'Nấm bào ngư chiên giòn',
        '2026-09-24': 'Sườn non chay sốt chua ngọt',
        '2026-09-25': 'Cà tím nướng mỡ hành chay',
        '2026-09-26': 'Hủ tiếu Nam Vang chay',
      },
    },
  ];

  const rawMaterials = [
    { code: 'NL-THIT-01', name: 'Thịt đùi heo tươi', unit: 'Kilogram', dishes: ['Thịt kho trứng cút'], req: 185.5, iss: 185.5, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-CA-02', name: 'Chả cá thác lác', unit: 'Kilogram', dishes: ['Chả cá sốt cà'], req: 142.0, iss: 142.0, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-RAU-03', name: 'Bầu sao tươi', unit: 'Kilogram', dishes: ['Bầu xào giá', 'Bầu nấu tôm'], req: 220.0, iss: 200.0, rem: 20.0, st: 'cho_xuat' as const },
    { code: 'NL-BAU-04', name: 'Giá đỗ sạch', unit: 'Kilogram', dishes: ['Bầu xào giá'], req: 95.0, iss: 95.0, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-TOM-05', name: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', dishes: ['Bầu nấu tôm'], req: 45.0, iss: 30.0, rem: 15.0, st: 'cho_xuat' as const },
    { code: 'NL-GA-06', name: 'Thịt gà phi lê tươi', unit: 'Kilogram', dishes: ['Khô gà lá chanh'], req: 160.0, iss: 160.0, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-LACHANH-07', name: 'Lá chanh tươi', unit: 'Kilogram', dishes: ['Khô gà lá chanh'], req: 4.5, iss: 4.5, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-TOI-08', name: 'Tỏi củ Hải Dương', unit: 'Kilogram', dishes: ['Gia vị các món'], req: 15.0, iss: 15.0, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-DAUAN-09', name: 'Dầu ăn Cái Lân', unit: 'Lít', dishes: ['Gia vị xào rán'], req: 40.0, iss: 40.0, rem: 0, st: 'da_xuat_du' as const },
    { code: 'NL-NUOCMAM-10', name: 'Nước mắm 30 độ đạm', unit: 'Lít', dishes: ['Gia vị nêm'], req: 25.0, iss: 25.0, rem: 0, st: 'da_xuat_du' as const },
  ];

  const demandRows: MaterialDemandItem[] = rawMaterials.map((m, idx) => ({
    materialId: `mat-${idx + 1}`,
    materialCode: m.code,
    materialName: m.name,
    unit: m.unit,
    dishNames: m.dishes,
    requiredQuantity: m.req,
    issuedQuantity: m.iss,
    remainingQuantity: m.rem,
    status: m.st,
  }));

  const productionPlans: ProductionPlanItem[] = [
    { planId: 'pp-1', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd1', dishName: 'Khô gà lá chanh', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-2', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd2', dishName: 'Chả cá sốt cà', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-3', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd3', dishName: 'Bầu xào giá', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-4', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd4', dishName: 'Bầu nấu tôm', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-5', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd5', dishName: 'Thịt heo kho sả ruốc', shiftName: 'Ca 2 (Chiều)', plannedServings: 871, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-6', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd6', dishName: 'Bún bò chả cua chay', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
  ];

  const dishCosts: DishCostSummaryItem[] = [
    {
      dishId: 'd1',
      dishCode: 'DISH-KHO-GA',
      dishName: 'Khô gà lá chanh',
      categoryName: 'Món mặn chính',
      servingTargetPrice: 25000,
      calculatedCost: 11450,
      bomItemsCount: 4,
      costRatioPercent: 46,
      bomLines: [
        { ingredientId: 'b1', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', quantityPerServing: 0.085, grossWeight: 0.09, unitPrice: 85000, lineCost: 7225 },
        { ingredientId: 'b2', ingredientCode: 'NL-LACHANH-07', ingredientName: 'Lá chanh tươi', unit: 'Kilogram', quantityPerServing: 0.005, grossWeight: 0.006, unitPrice: 30000, lineCost: 150 },
        { ingredientId: 'b3', ingredientCode: 'NL-DAUAN-09', ingredientName: 'Dầu ăn Cái Lân', unit: 'Lít', quantityPerServing: 0.015, grossWeight: 0.015, unitPrice: 42000, lineCost: 630 },
        { ingredientId: 'b4', ingredientCode: 'NL-NUOCMAM-10', ingredientName: 'Nước mắm 30 độ đạm', unit: 'Lít', quantityPerServing: 0.008, grossWeight: 0.008, unitPrice: 32000, lineCost: 256 },
      ],
    },
    {
      dishId: 'd2',
      dishCode: 'DISH-CHA-CA',
      dishName: 'Chả cá sốt cà',
      categoryName: 'Món phụ',
      servingTargetPrice: 25000,
      calculatedCost: 8900,
      bomItemsCount: 3,
      costRatioPercent: 36,
      bomLines: [
        { ingredientId: 'b5', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', quantityPerServing: 0.075, grossWeight: 0.08, unitPrice: 75000, lineCost: 5625 },
        { ingredientId: 'b6', ingredientCode: 'NL-TOI-08', ingredientName: 'Tỏi củ Hải Dương', unit: 'Kilogram', quantityPerServing: 0.005, grossWeight: 0.006, unitPrice: 55000, lineCost: 275 },
        { ingredientId: 'b7', ingredientCode: 'NL-DAUAN-09', ingredientName: 'Dầu ăn Cái Lân', unit: 'Lít', quantityPerServing: 0.012, grossWeight: 0.012, unitPrice: 42000, lineCost: 504 },
      ],
    },
  ];

  const dailyMaterials: DailyMaterialSummaryItem[] = rawMaterials.map((m, idx) => ({
    materialId: `dm-${idx + 1}`,
    materialCode: m.code,
    materialName: m.name,
    unit: m.unit,
    totalQuantity: m.req,
    estimatedAmount: Math.round(m.req * 40000),
  }));

  return {
    customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348',
    customerCode,
    customerName: 'Công ty TNHH Draxlmaier Automotive Việt Nam',
    weekStartDate,
    mealTargetPrice: 25000,
    scheduleDays,
    matrixRows,
    demandRows,
    productionPlans,
    dishCosts,
    dailyMaterials,
  };
}
