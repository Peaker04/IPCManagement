import type {
  AuditChangeReportDto,
  AuditLogRow,
  CurrentStockRow,
  CurrentStockSummaryDto,
  CursorPageDto,
  DataQualityIssueDto,
  DataQualityIssueRow,
  DataQualityReport,
  DataQualityReportDto,
  IngredientDemandReportDto,
  KitchenIssueReportDto,
  KitchenIssueRow,
  PageNumberPageDto,
  PriceVarianceRow,
  PurchasePlanReportDto,
  PurchasePlanRow,
  ReceiptPriceVarianceReportDto,
  StockLedgerReconciliationDto,
  StockLedgerReconciliationRow,
  UsageReportRow,
  WorkflowReportQuery,
  IssueVsReturnUsageReportDto,
} from '@/api/workflowApiTypes';
import type { ApiResponse } from '@/types/api';
import type { CursorPage, PageNumberPage } from '@/api/workflowApiTypes';
import type { DemandLine } from '@/types/workflow';
import { resolveDemandLinePresentation } from '@/lib/actionEligibility';

export const getReportData = <T>(response: ApiResponse<T>): T => response.data as T;

export const reportQueryWithLimit = (query?: WorkflowReportQuery) => ({
  limit: 100,
  ...query,
});

export const mapDemandLine = (item: IngredientDemandReportDto): DemandLine => {
  const shortage = Math.max(item.suggestedPurchaseQty, 0);
  const presentation = resolveDemandLinePresentation({ status: item.status, shortage });

  return {
    // Khóa theo dòng chứng từ: một yêu cầu có thể có nhiều dòng cùng nguyên liệu (đo được
    // 108 nhóm / 244 dòng trên dữ liệu hiện tại), ghép requestId+ingredientId là trùng khóa.
    id: item.requestLineId || `${item.materialRequestId}-${item.ingredientId}`,
    materialRequestId: item.materialRequestId,
    materialRequestStatus: item.status,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
    bomId: item.bomId,
    priceTierAmount: item.priceTierAmount,
    bomScope: item.bomScope,
    sourceDocumentCode: item.materialRequestCode,
    serviceDate: item.requestDate?.split('T')[0],
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.currentStockQty,
    reserved: 0,
    unit: item.unitName ?? '',
    source: item.dishName || item.customerName || item.materialRequestCode,
    appliedPortionRuleId: item.appliedPortionRuleId,
    appliedPortionRuleSource: item.appliedPortionRuleSource,
    appliedPortionRatePercent: item.appliedPortionRatePercent,
    bomRatePercent: item.bomRatePercent,
    yieldLossPercent: item.yieldLossPercent,
    ...presentation,
  };
};

export const mapPurchasePlanRow = (item: PurchasePlanReportDto): PurchasePlanRow => ({
  ...item,
  groupBy: item.groupBy === 'week' ? 'week' : 'day',
  ingredientName: item.ingredientName ?? undefined,
  unitName: item.unitName ?? undefined,
  supplierId: item.supplierId ?? undefined,
  supplierName: item.supplierName ?? undefined,
  expectedDeliveryDate: item.expectedDeliveryDate ?? undefined,
  warnings: [...item.warnings],
});

export const mapPriceVariance = (item: ReceiptPriceVarianceReportDto): PriceVarianceRow => ({
  id: `${item.receiptId}-${item.ingredientId}-${item.unitId}`,
  name: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  receiptCode: item.receiptCode,
  receiptDate: item.receiptDate,
  quantity: item.quantity,
  pricePrev: item.referencePrice,
  priceCurrent: item.unitPrice,
  supplier: item.supplierName ?? item.supplierId,
  change: item.variancePercent,
  warning: item.isWarning,
});

export const mapCurrentStock = (item: CurrentStockSummaryDto): CurrentStockRow => ({
  id: `${item.warehouseId}-${item.ingredientId}`,
  warehouseId: item.warehouseId,
  warehouse: item.warehouseName ?? item.warehouseId,
  ingredientId: item.ingredientId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unitId: item.unitId,
  unit: item.unitName ?? '',
  currentQty: item.currentQty,
  lastUpdated: item.lastUpdated,
});

export const mapStockLedgerReconciliation = (item: StockLedgerReconciliationDto): StockLedgerReconciliationRow => ({
  id: `${item.warehouseId}-${item.ingredientId}`,
  warehouse: item.warehouseName ?? item.warehouseId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? item.unitId,
  currentQty: item.currentQty,
  ledgerQty: item.ledgerQty,
  differenceQty: item.differenceQty,
  isMatched: item.isMatched,
  lastMovementAt: item.lastMovementAt ?? undefined,
});

export const mapKitchenIssue = (item: KitchenIssueReportDto): KitchenIssueRow => ({
  id: item.issueLineId,
  issueId: item.issueId,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName ?? undefined,
  warehouseId: item.warehouseId,
  warehouse: item.warehouseName ?? item.warehouseId,
  materialRequestId: item.materialRequestId,
  ingredientId: item.ingredientId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unitId: item.unitId,
  unit: item.unitName ?? '',
  requestedQty: item.requestedQty,
  issuedQty: item.issuedQty,
  receivedBy: item.receivedBy ?? undefined,
  receivedByName: item.receivedByName ?? undefined,
  receivedAt: item.receivedAt ?? undefined,
  isReceivedByKitchen: item.isReceivedByKitchen,
  receiptStatus: item.receiptStatus,
});

export const mapUsageReport = (item: IssueVsReturnUsageReportDto): UsageReportRow => ({
  id: `${item.issueId}-${item.ingredientId}-${item.unitId}`,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName ?? undefined,
  ingredient: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  issuedQty: item.issuedQty,
  returnedQty: item.returnedQty,
  wastedQty: item.wastedQty,
  usedQty: item.usedQty,
  varianceQty: item.varianceQty,
});

export const mapAuditChange = (item: AuditChangeReportDto): AuditLogRow => ({
  id: item.auditId,
  timestamp: item.changedAt,
  actor: item.changedByName || item.changedBy,
  businessArea: item.businessArea,
  fieldAffected: [item.entityName, item.fieldName].filter(Boolean).join(' / '),
  oldValue: item.oldValue ?? '',
  newValue: item.newValue ?? '',
  reason: item.reason ?? item.businessArea,
});

export const mapCursorPage = <TDto, TRow>(
  page: CursorPageDto<TDto>,
  mapRow: (item: TDto) => TRow,
): CursorPage<TRow> => ({
  items: (page.items ?? []).map(mapRow),
  limit: page.limit,
  hasNext: page.hasNext,
  nextCursorDate: page.nextCursorDate ?? undefined,
  nextCursorId: page.nextCursorId ?? undefined,
  nextCursorOffset: page.nextCursorOffset,
});

export const mapPageNumberPage = <TDto, TRow>(
  page: PageNumberPageDto<TDto>,
  mapRow: (item: TDto) => TRow,
): PageNumberPage<TRow> => ({
  items: (page.items ?? []).map(mapRow),
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages,
  hasPrev: page.hasPrev,
  hasNext: page.hasNext,
});

export const mapDataQualityIssue = (issue: DataQualityIssueDto): DataQualityIssueRow => ({
  id: issue.issueId,
  category: issue.category,
  severity: issue.severity === 'error' ? 'error' : 'warning',
  owner: issue.owner || 'Quản lý vận hành',
  priorityRank: issue.priorityRank ?? (issue.severity === 'error' ? 2 : 4),
  slaHours: issue.slaHours ?? (issue.severity === 'error' ? 8 : 48),
  slaDueAt: issue.slaDueAt ?? undefined,
  slaLabel: issue.slaLabel ?? (issue.severity === 'error' ? 'P2 / 8h' : 'P4 / 48h'),
  entityName: issue.entityName,
  entityId: issue.entityId ?? undefined,
  entityCode: issue.entityCode,
  entityLabel: issue.entityLabel,
  message: issue.message,
  suggestedAction: issue.suggestedAction,
  route: issue.route,
  remediationStatus: issue.remediationStatus === 'resolved' ? 'resolved' : issue.remediationStatus === 'reopened' ? 'reopened' : 'open',
  remediationAt: issue.remediationAt ?? undefined,
  remediationByName: issue.remediationByName ?? undefined,
  remediationNote: issue.remediationNote ?? undefined,
});

export const mapDataQualityReport = (item: DataQualityReportDto): DataQualityReport => ({
  generatedAt: item.generatedAt,
  totalIssues: item.totalIssues,
  isTruncated: item.isTruncated ?? false,
  errorCount: item.errorCount,
  warningCount: item.warningCount,
  resolvedIssueCount: item.resolvedIssueCount ?? 0,
  reopenedIssueCount: item.reopenedIssueCount ?? 0,
  urgentIssueCount: item.urgentIssueCount ?? 0,
  missingBomCount: item.missingBomCount,
  invalidUnitCount: item.invalidUnitCount,
  missingConversionCount: item.missingConversionCount,
  negativeStockCount: item.negativeStockCount,
  orphanDocumentCount: item.orphanDocumentCount,
  issues: (item.issues ?? []).map(mapDataQualityIssue),
});
