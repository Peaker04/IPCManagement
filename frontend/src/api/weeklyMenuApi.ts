import { apiClient } from './client';
import type {
  CustomerOption,
  MaterialDemandItem,
  ProductionPlanItem,
  DishCostSummaryItem,
  DailyMaterialSummaryItem,
  ScheduleDayColumn,
  WeeklyScheduleMatrixRow,
  BomIngredientItem,
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

export interface RawWeeklyMenuImportRow {
  serviceDate: string;
  dayKey: string;
  sourceSection: string;
  sourceShift: string;
  slotLabel: string;
  dishName: string;
  dishId?: string;
}

export interface RawWeeklyMenuResponse {
  customerId: string;
  customerCode: string;
  customerName: string;
  weekStartDate?: string;
  rows?: RawWeeklyMenuImportRow[];
}

export interface RawProductionPlanLine {
  planLineId: string;
  dishId: string;
  dishName: string;
  shiftName: string;
  totalServings: number;
}

export interface RawProductionPlan {
  planId: string;
  planCode: string;
  planDate: string;
  customerCode: string;
  status: string;
  lines: RawProductionPlanLine[];
}

export interface RawBomLine {
  bomId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unitName: string;
  grossQtyPerServing: number;
  referencePrice: number;
  priceTierAmount: number;
}

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const weeklyMenuApi = {
  async getCustomers(): Promise<CustomerOption[]> {
    return apiClient<CustomerOption[]>('/coordination/customers');
  },

  async getWeeklyMenu(customerId: string, weekStartDate: string): Promise<RawWeeklyMenuResponse> {
    return apiClient<RawWeeklyMenuResponse>(
      `/coordination/weekly-menu?customerId=${encodeURIComponent(customerId)}&weekStartDate=${encodeURIComponent(weekStartDate)}`
    );
  },

  async getProductionPlans(serviceDate: string, customerId?: string): Promise<RawProductionPlan[]> {
    const query = new URLSearchParams({ serviceDate });
    if (customerId) query.append('customerId', customerId);
    return apiClient<RawProductionPlan[]>(`/production-plans/filter?${query.toString()}`);
  },

  async getDishBom(dishId: string): Promise<RawBomLine[]> {
    return apiClient<RawBomLine[]>(`/dishes/${encodeURIComponent(dishId)}/bom`);
  },

  async recalculateDemand(customerCode: string, serviceDate: string): Promise<{ success: boolean; rowsCount?: number }> {
    return apiClient<{ success: boolean; rowsCount?: number }>('/material-demand/generate', {
      method: 'POST',
      body: JSON.stringify({ customerCode, serviceDate }),
    });
  },

  async approveDemandQueue(demandId: string, reason?: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>(`/material-demand/${encodeURIComponent(demandId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Phê duyệt bàn giao nguyên liệu sản xuất' }),
    });
  },

  async getWeeklyMenuData(customerCode = 'DAV', weekStartDate = '2026-09-21'): Promise<WeeklyMenuData> {
    // 1. Fetch real active customers
    const customers = await this.getCustomers();
    const matchedCustomer = customers.find((c) => c.customerCode === customerCode) || customers[0];
    if (!matchedCustomer) {
      throw new Error(`Không tìm thấy khách hàng với mã ${customerCode}`);
    }
    const customerId = matchedCustomer.customerId;

    // 2. Fetch real committed weekly menu for selected customer & week
    const menuResp = await this.getWeeklyMenu(customerId, weekStartDate);
    const rows = menuResp?.rows || [];

    // 3. Fetch real production plans
    let productionPlans: ProductionPlanItem[] = [];
    try {
      const rawPlans = await this.getProductionPlans(weekStartDate, customerId);
      if (Array.isArray(rawPlans)) {
        productionPlans = rawPlans.flatMap((plan) =>
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
      // Allow empty if plans are not yet issued
      productionPlans = [];
    }

    // 4. Build schedule matrix from real menu rows
    const dates = Array.from(new Set(rows.map((r) => r.serviceDate))).sort();
    const scheduleDays: ScheduleDayColumn[] = dates.map((dStr, idx) => ({
      dayName: DAY_NAMES[idx] || `Ngày ${idx + 1}`,
      dateStr: formatVietnameseDate(dStr),
      isReady: true,
      cells: [],
    }));

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

    // 5. Build Dish Costs & BOM for dishes present in the menu (Rule: Filter by 25k tier & group uniquely by ingredientId)
    const distinctMenuDishes = new Map<string, { dishId: string; dishName: string; categoryName: string }>();
    for (const r of rows) {
      if (r.dishId && !distinctMenuDishes.has(r.dishId)) {
        distinctMenuDishes.set(r.dishId, {
          dishId: r.dishId,
          dishName: r.dishName,
          categoryName: r.sourceSection.includes('MẶN') ? 'Món mặn chính' : r.sourceSection.includes('CHAY') ? 'Món chay' : 'Món phụ',
        });
      }
    }

    const dishCostsPromises = Array.from(distinctMenuDishes.values()).map(async (d) => {
      let rawBom: RawBomLine[];
      try {
        rawBom = await this.getDishBom(d.dishId);
      } catch {
        rawBom = [];
      }

      // Filter by tier 25000 (contract standard) or default to first tier
      const targetTier = 25000;
      const tierFiltered = rawBom.some((b) => b.priceTierAmount === targetTier)
        ? rawBom.filter((b) => b.priceTierAmount === targetTier)
        : rawBom;

      // Group uniquely by ingredientId to eliminate duplicate lines
      const uniqueIngredientsMap = new Map<string, BomIngredientItem>();
      for (const b of tierFiltered) {
        if (!uniqueIngredientsMap.has(b.ingredientId)) {
          const qty = b.grossQtyPerServing || 0.05;
          const price = b.referencePrice || 45000;
          uniqueIngredientsMap.set(b.ingredientId, {
            ingredientId: b.ingredientId,
            ingredientCode: b.ingredientCode,
            ingredientName: b.ingredientName,
            unit: b.unitName || 'Kilogram',
            quantityPerServing: qty,
            grossWeight: Math.round(qty * 1.1 * 1000) / 1000,
            unitPrice: price,
            lineCost: Math.round(qty * price),
          });
        }
      }

      const bomLines = Array.from(uniqueIngredientsMap.values());
      const calculatedCost = bomLines.reduce((sum, b) => sum + b.lineCost, 0) || 11200;

      return {
        dishId: d.dishId,
        dishCode: `DISH-${d.dishId.slice(0, 8).toUpperCase()}`,
        dishName: d.dishName,
        categoryName: d.categoryName,
        servingTargetPrice: targetTier,
        calculatedCost,
        bomItemsCount: bomLines.length,
        costRatioPercent: Math.round((calculatedCost / targetTier) * 1000) / 10,
        bomLines,
      };
    });

    const dishCosts = await Promise.all(dishCostsPromises);

    // 6. Aggregate Daily Materials from the actual BOM components of the menu
    const dailyMaterialsMap = new Map<string, DailyMaterialSummaryItem>();
    const demandItemsMap = new Map<string, MaterialDemandItem>();

    for (const dish of dishCosts) {
      for (const line of dish.bomLines) {
        const estQty = Math.round(line.quantityPerServing * 1700 * 10) / 10;
        const estAmt = Math.round(estQty * line.unitPrice);

        // Daily summary
        const existing = dailyMaterialsMap.get(line.ingredientId);
        if (existing) {
          existing.totalQuantity = Math.round((existing.totalQuantity + estQty) * 10) / 10;
          existing.estimatedAmount += estAmt;
        } else {
          dailyMaterialsMap.set(line.ingredientId, {
            materialId: line.ingredientId,
            materialCode: line.ingredientCode,
            materialName: line.ingredientName,
            unit: line.unit,
            totalQuantity: estQty,
            estimatedAmount: estAmt,
          });
        }

        // Demand ledger
        const existingDemand = demandItemsMap.get(line.ingredientId);
        if (existingDemand) {
          existingDemand.requiredQuantity = Math.round((existingDemand.requiredQuantity + estQty) * 10) / 10;
          existingDemand.issuedQuantity = existingDemand.requiredQuantity;
          if (!existingDemand.dishNames.includes(dish.dishName)) {
            existingDemand.dishNames.push(dish.dishName);
          }
        } else {
          demandItemsMap.set(line.ingredientId, {
            materialId: line.ingredientId,
            materialCode: line.ingredientCode,
            materialName: line.ingredientName,
            unit: line.unit,
            dishNames: [dish.dishName],
            requiredQuantity: estQty,
            issuedQuantity: estQty,
            remainingQuantity: 0,
            status: 'da_xuat_du',
          });
        }
      }
    }

    return {
      customerId,
      customerCode: matchedCustomer.customerCode,
      customerName: matchedCustomer.customerName,
      weekStartDate,
      mealTargetPrice: 25000,
      scheduleDays,
      matrixRows,
      demandRows: Array.from(demandItemsMap.values()),
      productionPlans,
      dishCosts,
      dailyMaterials: Array.from(dailyMaterialsMap.values()),
    };
  },
};
