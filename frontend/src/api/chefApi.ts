import { apiClient } from './client';

export interface ChefPlanLineItem {
  planLineId: string;
  planId: string;
  planCode: string;
  dishId: string;
  dishName: string;
  shiftName: string;
  plannedServings: number;
  serviceDate: string;
  planStatus: string;
  sentToKitchenAt?: string;
}

export interface ChefIssueLineItem {
  issueLineId: string;
  materialRequestLineId?: string;
  ingredientId: string;
  ingredientName: string;
  unitId: string;
  unitName: string;
  requestedQty: number;
  issuedQty: number;
}

export interface ChefIssueItem {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName: string;
  warehouseName: string;
  receivedAt?: string;
  receivedByName?: string;
  lines: ChefIssueLineItem[];
}

export interface PageInfo {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface ChefDashboardData {
  serviceDate: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  shiftName: string;
  totalPlans: number;
  sentPlans: number;
  totalDishes: number;
  totalServings: number;
  warnings: string[];
  plans: ChefPlanLineItem[];
  issues: ChefIssueItem[];
  issuePage: PageInfo;
}

interface RawProductionPlan {
  planId: string;
  planCode: string;
  planDate: string;
  status?: string;
  sentToKitchenAt?: string;
  lines: Array<{
    planLineId: string;
    dishId: string;
    dishName?: string;
    shiftName?: string;
    totalServings: number;
  }>;
}

interface RawDailyProductionPlan {
  serviceDate: string;
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  shiftName?: string;
  totalPlans: number;
  sentPlans: number;
  totalDishes: number;
  totalServings: number;
  warnings: string[];
  plans: RawProductionPlan[];
}

interface RawInventoryIssue {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseName?: string;
  receivedAt?: string;
  receivedByName?: string;
  lines: Array<{
    issueLineId: string;
    materialRequestLineId?: string;
    ingredientId: string;
    ingredientName?: string;
    unitId: string;
    unitName?: string;
    requestedQty: number;
    issuedQty: number;
  }>;
}

interface PagedIssues extends PageInfo {
  items: RawInventoryIssue[];
}

export const chefApi = {
  async getChefDashboardData(
    serviceDate: string,
    shiftName: 'MORNING' | 'AFTERNOON',
    customerId: string,
    issuePageNumber = 1,
    issuePageSize = 25
  ): Promise<ChefDashboardData> {
    const planQuery = new URLSearchParams({ serviceDate, shiftName, customerId });
    const issueQuery = new URLSearchParams({
      sourceFamily: 'DEFAULT',
      issueDate: serviceDate,
      shiftName,
      pageNumber: String(issuePageNumber),
      pageSize: String(issuePageSize),
    });

    const [dailyPlan, issuePage] = await Promise.all([
      apiClient<RawDailyProductionPlan>(`/production-plans/daily?${planQuery.toString()}`),
      apiClient<PagedIssues>(`/inventory-issues?${issueQuery.toString()}`),
    ]);

    if (dailyPlan.customerId && dailyPlan.customerId !== customerId) {
      throw new Error('KHSX trả về không thuộc khách hàng đã chọn.');
    }

    return {
      serviceDate: dailyPlan.serviceDate,
      customerId: dailyPlan.customerId || customerId,
      customerCode: dailyPlan.customerCode || '—',
      customerName: dailyPlan.customerName || '—',
      shiftName: dailyPlan.shiftName || shiftName,
      totalPlans: dailyPlan.totalPlans,
      sentPlans: dailyPlan.sentPlans,
      totalDishes: dailyPlan.totalDishes,
      totalServings: dailyPlan.totalServings,
      warnings: dailyPlan.warnings,
      plans: dailyPlan.plans.flatMap((plan) =>
        plan.lines.map((line) => ({
          planLineId: line.planLineId,
          planId: plan.planId,
          planCode: plan.planCode,
          dishId: line.dishId,
          dishName: line.dishName || '—',
          shiftName: line.shiftName || dailyPlan.shiftName || '—',
          plannedServings: line.totalServings,
          serviceDate: plan.planDate,
          planStatus: plan.status || '—',
          sentToKitchenAt: plan.sentToKitchenAt,
        }))
      ),
      issues: issuePage.items.map((issue) => ({
        issueId: issue.issueId,
        issueCode: issue.issueCode,
        issueDate: issue.issueDate,
        shiftName: issue.shiftName || '—',
        warehouseName: issue.warehouseName || '—',
        receivedAt: issue.receivedAt,
        receivedByName: issue.receivedByName,
        lines: issue.lines.map((line) => ({
          issueLineId: line.issueLineId,
          materialRequestLineId: line.materialRequestLineId,
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName || '—',
          unitId: line.unitId,
          unitName: line.unitName || '—',
          requestedQty: line.requestedQty,
          issuedQty: line.issuedQty,
        })),
      })),
      issuePage: {
        totalCount: issuePage.totalCount,
        pageNumber: issuePage.pageNumber,
        pageSize: issuePage.pageSize,
        totalPages: issuePage.totalPages,
        hasPrev: issuePage.hasPrev,
        hasNext: issuePage.hasNext,
      },
    };
  },

  async confirmIssueReceipt(issueId: string, hasDiscrepancy: boolean, discrepancyNote?: string): Promise<ChefIssueItem> {
    return apiClient<ChefIssueItem>(`/inventory-issues/${encodeURIComponent(issueId)}/confirm-receipt`, {
      method: 'POST',
      body: JSON.stringify({ hasDiscrepancy, discrepancyNote }),
    });
  },
};
