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
import type { paths } from '../shared/api/contracts/schema';
import { formatVietnameseDate } from '../utils/dates';

type WeeklyMenuImportResult = paths['/api/coordination/weekly-menu/import/preview']['post']['responses']['200']['content']['application/json']['data'];

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

export interface WeeklyMenuSlotUpdateItem {
  serviceDate: string;
  shiftName: string;
  slotType: string;
  dishId: string;
}

export interface BulkUpdateWeeklyMenuPayload {
  customerId: string;
  slots: WeeklyMenuSlotUpdateItem[];
}

export interface UpsertQuickServingsPayload {
  customerId: string;
  serviceDate: string;
  shiftName: string;
  servings: number;
  complete?: boolean;
}

export interface WeeklyMenuImportHistoryItem {
  menuVersionId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  weekStartDate: string;
  versionNo: number;
  status: string;
  sourceFileName?: string;
  createdByName?: string;
  createdAt: string;
  successRowCount: number;
  errorRowCount: number;
  warningRowCount: number;
  canRollback: boolean;
  cannotRollbackReason?: string;
}

export const weeklyMenuApi = {
  async getCustomers(): Promise<CustomerOption[]> {
    return apiClient<CustomerOption[]>('/coordination/customers');
  },

  async getWeeklyMenu(customerId: string, weekStartDate: string): Promise<RawWeeklyMenuResponse> {
    const mode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ipc_v3_mode') : null) || 'DEFAULT';
    const endpoint = mode === 'MATERIAL_RECONCILIATION'
      ? `/reconciliation/weekly-menu?customerId=${encodeURIComponent(customerId)}&weekStartDate=${encodeURIComponent(weekStartDate)}`
      : `/coordination/weekly-menu?customerId=${encodeURIComponent(customerId)}&weekStartDate=${encodeURIComponent(weekStartDate)}`;
    return apiClient<RawWeeklyMenuResponse>(endpoint);
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
    const mode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ipc_v3_mode') : null) || 'DEFAULT';
    const isMrx = mode === 'MATERIAL_RECONCILIATION';

    const [menuResponse, rawPlans, demandPage] = await Promise.all([
      this.getWeeklyMenu(matchedCustomer.customerId, weekStartDate),
      isMrx
        ? Promise.resolve([])
        : this.getProductionPlans(weekStartDate, weekEndDate, matchedCustomer.customerId).catch(() => []),
      isMrx
        ? Promise.resolve({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 })
        : this.getAllDemand(weekStartDate, weekEndDate, matchedCustomer.customerId).catch(() => ({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 })),
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

  async previewWeeklyMenuImport(formData: FormData): Promise<WeeklyMenuImportResult> {
    return apiClient<WeeklyMenuImportResult>(
      '/coordination/weekly-menu/import/preview',
      { method: 'POST', body: formData }
    );
  },

  async commitWeeklyMenuImport(formData: FormData): Promise<WeeklyMenuImportResult> {
    return apiClient<WeeklyMenuImportResult>(
      '/coordination/weekly-menu/import/commit',
      { method: 'POST', body: formData }
    );
  },

  getWeeklyMenuTemplateUrl(customerId?: string, weekStartDate?: string): string {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (weekStartDate) params.set('weekStartDate', weekStartDate);
    return `/api/coordination/weekly-menu/template?${params.toString()}`;
  },

  async getMenuSchedules(customerId: string, weekStartDate: string): Promise<Array<{ menuScheduleId: string; serviceDate: string; shiftName: string; status: string; menuVersionStatus?: string }>> {
    return apiClient<Array<{ menuScheduleId: string; serviceDate: string; shiftName: string; status: string; menuVersionStatus?: string }>>(
      `/coordination/menu-schedules?customerId=${encodeURIComponent(customerId)}&weekStartDate=${encodeURIComponent(weekStartDate)}`
    );
  },

  async publishMenuSchedule(menuScheduleId: string, reason = 'Xuất bản thực đơn tuần'): Promise<unknown> {
    return apiClient(
      `/coordination/menu-schedules/${encodeURIComponent(menuScheduleId)}/version`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE', reason }),
      }
    );
  },

  async bulkUpdateWeeklyMenu(payload: BulkUpdateWeeklyMenuPayload): Promise<string[]> {
    return apiClient<string[]>('/coordination/weekly-menu/bulk-update', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async upsertQuickServings(payload: UpsertQuickServingsPayload): Promise<unknown> {
    return apiClient('/coordination/meal-quantity-plans/quick-servings', {
      method: 'POST',
      body: JSON.stringify({ complete: true, ...payload }),
    });
  },

  async getImportHistory(customerId?: string, pageNumber = 1, pageSize = 20): Promise<{ items: WeeklyMenuImportHistoryItem[]; totalCount: number }> {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    if (customerId) params.set('customerId', customerId);
    return apiClient<{ items: WeeklyMenuImportHistoryItem[]; totalCount: number }>(`/coordination/weekly-menu/import-history?${params.toString()}`);
  },

  async rollbackImport(menuVersionId: string): Promise<{ menuVersionId: string; menuSchedulesRemoved: number }> {
    return apiClient<{ menuVersionId: string; menuSchedulesRemoved: number }>(`/coordination/weekly-menu/import/${encodeURIComponent(menuVersionId)}/rollback`, {
      method: 'POST',
    });
  },
};
