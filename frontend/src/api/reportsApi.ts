import { apiClient } from './client';

export interface DemandReportItem {
  requestDate: string; customerCode?: string; customerName?: string;
  ingredientId: string; ingredientName: string; unitId: string; unitName: string;
  totalRequiredQty: number; currentStockQty: number; suggestedPurchaseQty: number;
  issuedQty: number; receivedByKitchenQty: number; fulfillmentStatus: string;
}
export interface PriceVarianceReportItem {
  receiptLineId: string; receiptCode: string; receiptDate: string; supplierName?: string;
  ingredientId: string; ingredientName: string; unitName: string; quantity: number;
  unitPrice: number; referencePrice: number; variancePercent: number; isWarning: boolean;
}
export interface CurrentStockReportItem {
  warehouseId: string; warehouseName: string; ingredientId: string; ingredientName: string;
  unitId: string; unitName: string; currentQty: number; lastUpdated: string;
}

export interface ReportPage<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

function pageParams(pageNumber: number, pageSize: number) {
  return new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
}

function addPeriod(params: URLSearchParams, period?: string) {
  if (!period) return;
  const [year, month] = period.split('-').map(Number);
  params.set('dateFrom', `${period}-01`);
  params.set('dateTo', new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10));
}

export const reportsApi = {
  async getDemand(period?: string, customerId?: string, pageNumber = 1, pageSize = 25): Promise<ReportPage<DemandReportItem>> {
    const params = pageParams(pageNumber, pageSize);
    addPeriod(params, period);
    if (customerId && customerId !== 'ALL') params.set('customerId', customerId);
    return apiClient<ReportPage<DemandReportItem>>(`/workflow-reports/ingredient-demand/aggregate/page?${params}`);
  },
  async getPriceVariance(period?: string, pageNumber = 1, pageSize = 25): Promise<ReportPage<PriceVarianceReportItem>> {
    const params = pageParams(pageNumber, pageSize);
    addPeriod(params, period);
    return apiClient<ReportPage<PriceVarianceReportItem>>(`/workflow-reports/receipt-price-variance/page?${params}`);
  },
  async getCurrentStock(warehouseId?: string, pageNumber = 1, pageSize = 25): Promise<ReportPage<CurrentStockReportItem>> {
    const params = pageParams(pageNumber, pageSize);
    if (warehouseId && warehouseId !== 'ALL') params.set('warehouseId', warehouseId);
    return apiClient<ReportPage<CurrentStockReportItem>>(`/workflow-reports/current-stock/page?${params}`);
  },
};
