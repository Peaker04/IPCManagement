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
  dishName?: string;
  shiftName?: string;
  totalServings: number;
  priceTierAmount?: number;
}

export interface RawProductionPlan {
  planId: string;
  planCode: string;
  planDate: string;
  customerId?: string;
  customerCode?: string;
  status?: string;
  sentToKitchenAt?: string;
  lines: RawProductionPlanLine[];
}

interface RawDemandAggregateItem {
  requestDate: string;
  customerId: string;
  customerCode?: string;
  customerName?: string;
  priceTierAmount: number;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  totalRequiredQty: number;
  issuedQty: number;
  receivedByKitchenQty: number;
  remainingToIssueQty: number;
  fulfillmentStatus: string;
}

interface RawDemandAggregatePage {
  items: RawDemandAggregateItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  remainingToIssueCount: number;
  pendingKitchenReceiptCount: number;
}

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function mapDemandStatus(item: RawDemandAggregateItem): MaterialDemandItem['status'] {
  if (item.fulfillmentStatus === 'FULFILLED') return 'fulfilled';
  if (item.fulfillmentStatus === 'IN_PROGRESS') return 'in_progress';
  return 'missing';
}

export const weeklyMenuApi = {
  async getCustomers(): Promise<CustomerOption[]> {
    return apiClient<CustomerOption[]>('/coordination/customers');
  },

  async getWeeklyMenu(customerId: string, weekStartDate: string): Promise<RawWeeklyMenuResponse> {
    return apiClient<RawWeeklyMenuResponse>(
      `/coordination/weekly-menu?customerId=${encodeURIComponent(customerId)}&weekStartDate=${encodeURIComponent(weekStartDate)}`
    );
  },

  async getProductionPlans(dateFrom: string, dateTo: string, customerId: string): Promise<RawProductionPlan[]> {
    const query = new URLSearchParams({ dateFrom, dateTo, customerId });
    return apiClient<RawProductionPlan[]>(`/production-plans/filter?${query.toString()}`);
  },

  async getDemandPage(dateFrom: string, dateTo: string, customerId: string, pageNumber = 1, pageSize = 100): Promise<RawDemandAggregatePage> {
    const query = new URLSearchParams({
      dateFrom,
      dateTo,
      customerId,
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    });
    return apiClient<RawDemandAggregatePage>(
      `/workflow-reports/ingredient-demand/aggregate/page?${query.toString()}`
    );
  },

  async getAllDemand(dateFrom: string, dateTo: string, customerId: string, pageSize = 100): Promise<RawDemandAggregatePage> {
    const firstPage = await this.getDemandPage(dateFrom, dateTo, customerId, 1, pageSize);
    const items = [...firstPage.items];
    let pageNumber = 2;
    while (items.length < firstPage.totalCount) {
      const page = await this.getDemandPage(dateFrom, dateTo, customerId, pageNumber, pageSize);
      if (page.items.length === 0) break;
      items.push(...page.items);
      pageNumber += 1;
    }
    return { ...firstPage, items };
  },

  async recalculateDemand(customerId: string, serviceDate: string) {
    return apiClient('/material-demand/generate', {
      method: 'POST',
      body: JSON.stringify({ customerId, serviceDate, scope: 'FULLDAY' }),
    });
  },

  async approveDemandQueue(demandId: string, reason?: string) {
    return apiClient(`/material-demand/${encodeURIComponent(demandId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getWeeklyMenuData(customerCode: string, weekStartDate: string): Promise<WeeklyMenuData> {
    const customers = await this.getCustomers();
    const matchedCustomer = customers.find((customer) => customer.customerCode === customerCode);
    if (!matchedCustomer) {
      throw new Error(`Không tìm thấy khách hàng với mã ${customerCode}.`);
    }

    const weekEndDate = addDays(weekStartDate, 6);
    const [menuResponse, rawPlans, demandPage] = await Promise.all([
      this.getWeeklyMenu(matchedCustomer.customerId, weekStartDate),
      this.getProductionPlans(weekStartDate, weekEndDate, matchedCustomer.customerId),
      this.getAllDemand(weekStartDate, weekEndDate, matchedCustomer.customerId),
    ]);

    const rows = menuResponse?.rows || [];
    const dates = Array.from(new Set(rows.map((row) => row.serviceDate))).sort();
    const scheduleDays: ScheduleDayColumn[] = dates.map((date, index) => ({
      dayName: DAY_NAMES[index] || `Ngày ${index + 1}`,
      dateStr: formatVietnameseDate(date),
      cells: [],
    }));

    const matrixMap = new Map<string, WeeklyScheduleMatrixRow>();
    for (const row of rows) {
      const key = `${row.sourceSection} - ${row.slotLabel}`;
      const matrixRow = matrixMap.get(key) || {
        sectionTitle: row.sourceSection,
        slotLabel: row.slotLabel,
        days: {},
      };
      matrixRow.days[row.serviceDate] = row.dishName;
      matrixMap.set(key, matrixRow);
    }

    const productionPlans = rawPlans.flatMap((plan) =>
      plan.lines.map((line): ProductionPlanItem => ({
        planId: line.planLineId,
        planCode: plan.planCode,
        dishId: line.dishId,
        dishName: line.dishName || '—',
        shiftName: line.shiftName || '—',
        plannedServings: line.totalServings,
        serviceDate: plan.planDate,
        status: plan.status === 'COMPLETED'
          ? 'completed'
          : plan.sentToKitchenAt
            ? 'sent_to_kitchen'
            : 'draft',
      }))
    );

    const demandRows = demandPage.items.map((item): MaterialDemandItem => ({
      materialId: `${item.requestDate}:${item.customerId}:${item.ingredientId}:${item.unitId}`,
      materialCode: item.ingredientId,
      materialName: item.ingredientName || '—',
      unit: item.unitName || '—',
      dishNames: [],
      requiredQuantity: item.totalRequiredQty,
      issuedQuantity: item.issuedQty,
      remainingQuantity: item.remainingToIssueQty,
      status: mapDemandStatus(item),
    }));

    const priceTiers = new Set(
      rawPlans.flatMap((plan) => plan.lines.map((line) => line.priceTierAmount).filter((value): value is number => value != null))
    );

    return {
      customerId: matchedCustomer.customerId,
      customerCode: matchedCustomer.customerCode,
      customerName: matchedCustomer.customerName,
      weekStartDate,
      mealTargetPrice: priceTiers.size === 1 ? Array.from(priceTiers)[0] : 0,
      scheduleDays,
      matrixRows: Array.from(matrixMap.values()),
      demandRows,
      productionPlans,
      dishCosts: [],
      dailyMaterials: [],
    };
  },
};
