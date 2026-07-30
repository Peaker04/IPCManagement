import { apiSlice } from '@/api/apiSlice';
import type {
  WorkflowReportQuery, WorkflowReportPageQuery, IngredientDemandAggregatePageQuery, PurchasePlanPageQuery,
  DataQualityPageQuery,
  MaterialRequestCandidatePageQuery,
  CurrentStockPageQuery, StockMovementPageQuery,
  ReceiptPriceVariancePageQuery,
  PriceVarianceAggregatePageQuery,
  PageNumberPage,
  CursorPage,
  IngredientDemandReportDto,
  IngredientDemandPageResponseDto,
  MaterialRequestCandidate,
  IngredientDemandAggregatePageResponseDto,
  PurchasePlanRow,
  PurchasePlanReportDto,
  PurchasePlanPageResponseDto,
  StockMovementViewDto,
  StockLedgerReconciliationDto,
  ReceiptPriceVarianceReportDto,
  PriceVarianceBySupplierDto,
  PriceVarianceByPeriodDto,
  PriceVarianceByDishGroupDto,
  CurrentStockSummaryDto,
  KitchenIssueReportDto,
  IssueVsReturnUsageReportDto,
  AuditChangeReportDto,
  DataQualityIssueDto,
  DataQualityReportDto,
  DataQualityPageDto,
  PriceVarianceRow,
  AuditLogRow,
  CurrentStockRow,
  StockLedgerReconciliationRow,
  KitchenIssueRow,
  UsageReportRow,
  DataQualityIssueRow,
  DataQualityReport,
  DataQualityPageReport,
  DataQualityIssueRemediationRequest,
  CursorPageDto,
  PageNumberPageDto,
  DataQualityIssueRemediationResult,
} from '@/api/workflowApiTypes';
import type {
  DemandLine,
  RoleInboxItem,
  StockMovement,
  StockMovementType,
  WorkflowDocument,
  WorkflowLane,
  WorkflowTone,
} from '@/types/workflow';
import type { ApiResponse } from '@/types/api';
import { workflowAuditSourceTags, workflowCacheTags } from '@/api/workflowCacheTags';
import { resolveDemandLinePresentation } from '@/lib/actionEligibility';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import {
  ownerToLaneId,
  routeByLaneId,
  workflowLaneDefinitions,
} from '@/lib/workflowConfig';
import { useGetWorkflowDocumentsQuery } from '@/api/workflowDocumentsApi';
import { mapDemandAggregateLine } from './reportMappers';

const getData = <T>(response: ApiResponse<T>): T => response.data as T;
const queryWithLimit = (query?: WorkflowReportQuery) => ({
  limit: 100,
  ...query,
});

const mapDemandLine = (item: IngredientDemandReportDto): DemandLine => {
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

const mapPurchasePlanRow = (item: PurchasePlanReportDto): PurchasePlanRow => ({
  ...item,
  groupBy: item.groupBy === 'week' ? 'week' : 'day',
  ingredientName: item.ingredientName ?? undefined,
  unitName: item.unitName ?? undefined,
  supplierId: item.supplierId ?? undefined,
  supplierName: item.supplierName ?? undefined,
  expectedDeliveryDate: item.expectedDeliveryDate ?? undefined,
  warnings: [...item.warnings],
});

const mapStockMovement = (item: StockMovementViewDto): StockMovement => {
  const movementType = item.movementType.toUpperCase();
  const type: StockMovementType =
    movementType === 'RECEIPT'
      ? 'receipt'
      : movementType === 'ISSUE'
        ? 'issue'
        : movementType === 'RETURN'
          ? 'return'
          : 'adjustment';
  const quantity = type === 'issue' ? item.quantityOut : item.quantityIn;
  const tone = type === 'adjustment' || type === 'return' ? 'success' : 'warning';

  return {
    id: item.movementId,
    type,
    documentNo: item.refTable ? `${item.refTable}${item.refId ? `-${item.refId.slice(0, 8)}` : ''}` : item.movementId.slice(0, 8),
    material: item.ingredientName ?? item.ingredientId,
    quantity,
    beforeQty: item.beforeQty,
    afterQty: item.afterQty,
    unit: item.unitName ?? '',
    owner: item.warehouseName ?? 'Kho',
    status: type === 'receipt' ? 'Đã nhập kho' : type === 'issue' ? 'Đã xuất kho' : type === 'return' ? 'Đã hoàn kho' : 'Đã điều chỉnh tồn',
    nextAction: type === 'issue' ? 'Bếp xác nhận nhận nguyên liệu' : 'Cập nhật tồn kho',
    tone,
  };
};

const mapPriceVariance = (item: ReceiptPriceVarianceReportDto): PriceVarianceRow => ({
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

const mapCurrentStock = (item: CurrentStockSummaryDto): CurrentStockRow => ({
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

const mapStockLedgerReconciliation = (item: StockLedgerReconciliationDto): StockLedgerReconciliationRow => ({
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

const mapKitchenIssue = (item: KitchenIssueReportDto): KitchenIssueRow => ({
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

const mapUsageReport = (item: IssueVsReturnUsageReportDto): UsageReportRow => ({
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

const mapAuditChange = (item: AuditChangeReportDto): AuditLogRow => ({
  id: item.auditId,
  timestamp: item.changedAt,
  actor: item.changedByName || item.changedBy,
  businessArea: item.businessArea,
  fieldAffected: [item.entityName, item.fieldName].filter(Boolean).join(' / '),
  oldValue: item.oldValue ?? '',
  newValue: item.newValue ?? '',
  reason: item.reason ?? item.businessArea,
});

const mapCursorPage = <TDto, TRow>(
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

const mapPageNumberPage = <TDto, TRow>(
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

const mapDataQualityIssue = (issue: DataQualityIssueDto): DataQualityIssueRow => ({
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

const mapDataQualityReport = (item: DataQualityReportDto): DataQualityReport => ({
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

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getIngredientDemand: builder.query<DemandLine[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IngredientDemandReportDto[]>) => getData(response).map(mapDemandLine),
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getPurchasePlan: builder.query<PurchasePlanRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-plan',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PurchasePlanReportDto[]>) =>
        (response.data ?? []).map(mapPurchasePlanRow),
      providesTags: [
        'PurchaseOrders',
        'SupplierQuotations',
        workflowCacheTags.purchasePlan,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.purchaseRequests,
      ],
    }),
    getPurchasePlanPage: builder.query<PageNumberPage<PurchasePlanRow> & { totalShortageQty: number; totalEstimatedAmount: number }, PurchasePlanPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-plan/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PurchasePlanPageResponseDto>) => {
        const page = response.data;
        return {
          items: (page?.items ?? []).map(mapPurchasePlanRow),
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 8,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          totalShortageQty: page?.totalShortageQty ?? 0,
          totalEstimatedAmount: page?.totalEstimatedAmount ?? 0,
        };
      },
      providesTags: [
        'PurchaseOrders',
        'SupplierQuotations',
        workflowCacheTags.purchasePlan,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.purchaseRequests,
      ],
    }),
    getIngredientDemandPage: builder.query<PageNumberPage<DemandLine> & { shortageCount: number }, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<IngredientDemandPageResponseDto>) => {
        const page = response.data;
        return {
          items: page?.items?.map(mapDemandLine) ?? [],
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 8,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          shortageCount: page?.shortageCount ?? 0,
        };
      },
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getMaterialRequestCandidatePage: builder.query<PageNumberPage<MaterialRequestCandidate>, MaterialRequestCandidatePageQuery>({
      query: (query) => ({
        url: '/workflow-reports/material-request-candidates/page',
        params: {
          ...query,
          pageNumber: query.pageNumber ?? 1,
          pageSize: query.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<MaterialRequestCandidate>>) => response.data ?? {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      },
      providesTags: [workflowCacheTags.materialRequestCandidates],
    }),
    getIngredientDemandAggregatePage: builder.query<PageNumberPage<DemandLine> & { shortageCount: number }, IngredientDemandAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand/aggregate/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 20,
        },
      }),
      transformResponse: (response: ApiResponse<IngredientDemandAggregatePageResponseDto>) => {
        const page = response.data;
        return {
          items: page?.items?.map(mapDemandAggregateLine) ?? [],
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 20,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          shortageCount: page?.shortageCount ?? 0,
        };
      },
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getStockMovements: builder.query<StockMovement[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockMovementViewDto[]>) => getData(response).map(mapStockMovement),
      providesTags: [workflowCacheTags.stockMovements],
    }),
    getStockMovementPage: builder.query<CursorPage<StockMovement>, StockMovementPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<StockMovementViewDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false, nextCursorOffset: 0 }, mapStockMovement),
      providesTags: [workflowCacheTags.stockMovements],
    }),
    getPriceVariance: builder.query<PriceVarianceRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<ReceiptPriceVarianceReportDto[]>) => getData(response).map(mapPriceVariance),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceBySupplier: builder.query<PriceVarianceBySupplierDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceBySupplierDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceBySupplierPage: builder.query<PageNumberPage<PriceVarianceBySupplierDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceBySupplierDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByPeriod: builder.query<PriceVarianceByPeriodDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByPeriodDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByPeriodPage: builder.query<PageNumberPage<PriceVarianceByPeriodDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByPeriodDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByDishGroup: builder.query<PriceVarianceByDishGroupDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByDishGroupDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByDishGroupPage: builder.query<PageNumberPage<PriceVarianceByDishGroupDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByDishGroupDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getCurrentStock: builder.query<CurrentStockRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<CurrentStockSummaryDto[]>) => getData(response).map(mapCurrentStock),
      providesTags: [workflowCacheTags.currentStock],
    }),
    getStockLedgerReconciliation: builder.query<StockLedgerReconciliationRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-ledger-reconciliation',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockLedgerReconciliationDto[]>) => getData(response).map(mapStockLedgerReconciliation),
      providesTags: [
        workflowCacheTags.stockLedger,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
      ],
    }),
    getKitchenIssues: builder.query<KitchenIssueRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<KitchenIssueReportDto[]>) => getData(response).map(mapKitchenIssue),
      providesTags: [workflowCacheTags.kitchenIssues],
    }),
    getKitchenIssuesPage: builder.query<PageNumberPage<KitchenIssueRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<KitchenIssueReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapKitchenIssue),
      providesTags: [workflowCacheTags.kitchenIssues],
    }),
    getIssueVsReturnUsage: builder.query<UsageReportRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IssueVsReturnUsageReportDto[]>) => getData(response).map(mapUsageReport),
      providesTags: [
        workflowCacheTags.issueUsage,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.inventoryReturns,
      ],
    }),
    getIssueVsReturnUsagePage: builder.query<PageNumberPage<UsageReportRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<IssueVsReturnUsageReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapUsageReport),
      providesTags: [
        workflowCacheTags.issueUsage,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.inventoryReturns,
      ],
    }),
    getAuditChanges: builder.query<AuditLogRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<AuditChangeReportDto[]>) => getData(response).map(mapAuditChange),
      providesTags: [workflowCacheTags.auditChanges, ...workflowAuditSourceTags],
    }),
    getPriceVariancePage: builder.query<PageNumberPage<PriceVarianceRow>, ReceiptPriceVariancePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 6,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<ReceiptPriceVarianceReportDto>>) =>
        mapPageNumberPage(response.data ?? {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 6,
          totalPages: 0,
          hasPrev: false,
          hasNext: false,
        }, mapPriceVariance),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getCurrentStockPage: builder.query<PageNumberPage<CurrentStockRow>, CurrentStockPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<CurrentStockSummaryDto>>) =>
        mapPageNumberPage(response.data ?? {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 8,
          totalPages: 0,
          hasPrev: false,
          hasNext: false,
        }, mapCurrentStock),
      providesTags: [workflowCacheTags.currentStock],
    }),
    getAuditChangePage: builder.query<CursorPage<AuditLogRow>, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<AuditChangeReportDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false, nextCursorOffset: 0 }, mapAuditChange),
      providesTags: [workflowCacheTags.auditChanges, ...workflowAuditSourceTags],
    }),
    getDataQuality: builder.query<DataQualityReport, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/data-quality',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<DataQualityReportDto>) =>
        response.data ? mapDataQualityReport(response.data) : {
          generatedAt: '',
          totalIssues: 0,
          isTruncated: false,
          errorCount: 0,
          warningCount: 0,
          resolvedIssueCount: 0,
          reopenedIssueCount: 0,
          urgentIssueCount: 0,
          missingBomCount: 0,
          invalidUnitCount: 0,
          missingConversionCount: 0,
          negativeStockCount: 0,
          orphanDocumentCount: 0,
          issues: [],
        },
      providesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.stockLedger,
      ],
    }),
    getDataQualityPage: builder.query<DataQualityPageReport, DataQualityPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/data-quality/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<DataQualityPageDto>) => {
        const report = response.data;
        const emptyPage: PageNumberPage<DataQualityIssueRow> = {
          items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
        };
        if (!report) {
          return {
            ...mapDataQualityReport({
              generatedAt: '',
              totalIssues: 0,
              isTruncated: false,
              errorCount: 0,
              warningCount: 0,
              resolvedIssueCount: 0,
              reopenedIssueCount: 0,
              urgentIssueCount: 0,
              missingBomCount: 0,
              invalidUnitCount: 0,
              missingConversionCount: 0,
              negativeStockCount: 0,
              orphanDocumentCount: 0,
              issues: [],
            }),
            page: emptyPage,
          };
        }
        return {
          ...mapDataQualityReport(report),
          page: mapPageNumberPage(report.page ?? emptyPage, mapDataQualityIssue),
        };
      },
      providesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.stockLedger,
      ],
    }),
    updateDataQualityIssueRemediation: builder.mutation<ApiResponse<DataQualityIssueRemediationResult>, DataQualityIssueRemediationRequest>({
      query: (body) => ({
        url: '/workflow-reports/data-quality/issues/remediation',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.operationalKpis,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetIngredientDemandQuery,
  useGetPurchasePlanQuery,
  useGetPurchasePlanPageQuery,
  useGetIngredientDemandPageQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetIngredientDemandAggregatePageQuery,
  useGetStockMovementsQuery,
  useGetStockMovementPageQuery,
  useGetPriceVarianceQuery,
  useGetPriceVarianceBySupplierQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVarianceByPeriodQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceByDishGroupQuery,
  useGetPriceVarianceByDishGroupPageQuery,
  useGetCurrentStockQuery,
  useGetStockLedgerReconciliationQuery,
  useGetKitchenIssuesQuery,
  useGetKitchenIssuesPageQuery,
  useGetIssueVsReturnUsageQuery,
  useGetIssueVsReturnUsagePageQuery,
  useGetAuditChangesQuery,
  useGetPriceVariancePageQuery,
  useGetCurrentStockPageQuery,
  useGetAuditChangePageQuery,
  useGetDataQualityQuery,
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
} = reportsApi;

const buildRoleInbox = (
  documents: WorkflowDocument[],
  demandLines: DemandLine[],
  priceRows: PriceVarianceRow[],
): RoleInboxItem[] => {
  const documentItems: RoleInboxItem[] = documents
    .filter((document) => document.tone === 'warning' || document.tone === 'danger')
    .map((document) => {
      const laneId = ownerToLaneId(document.owner);
      return {
        id: `doc-${document.id}`,
        laneId,
        owner: document.owner,
        title: document.title,
        description: document.summary,
        due: document.lines.find((line) => line.label === 'Ca')?.value ?? 'Trong ca',
        nextAction: document.status,
        tone: document.tone,
        route: document.route || routeByLaneId[laneId],
      };
    });

  const demandItems: RoleInboxItem[] = demandLines
    .filter((line) => line.tone === 'danger')
    .map((line, index) => ({
      id: `demand-${line.id}-${index}`,
      laneId: 'planning',
      owner: 'KHSX',
      title: `Thiếu ${line.material}`,
      description: `Cần ${formatQuantityWithUnit(line.required, line.unit)}, hiện có ${formatQuantityWithUnit(line.available, line.unit)}.`,
      due: 'Sau kiểm tồn',
      nextAction: line.nextAction,
      tone: 'danger',
      route: routeByLaneId.planning,
    }));

  const priceItems: RoleInboxItem[] = priceRows
    .filter((row) => row.warning)
    .map((row) => ({
      id: `price-${row.id}`,
      laneId: 'purchasing',
      owner: 'Thu mua',
      title: `${row.name} vượt ngưỡng giá`,
      description: `Tăng ${formatPercent(row.change)} tại ${row.supplier}.`,
      due: 'Trước khi đặt hàng',
      nextAction: 'Gửi cảnh báo biến động giá',
      tone: 'danger',
      route: routeByLaneId.purchasing,
    }));

  return [...documentItems, ...demandItems, ...priceItems];
};

const buildWorkflowLanes = (
  documents: WorkflowDocument[],
  inbox: RoleInboxItem[],
  movements: StockMovement[],
): WorkflowLane[] =>
  workflowLaneDefinitions.map((lane) => {
    const laneInbox = inbox.filter((item) => item.laneId === lane.id);
    const laneDocuments = documents.filter((document) => ownerToLaneId(document.owner) === lane.id);
    const blocked = laneInbox.filter((item) => item.tone === 'danger').length;
    const waiting = laneInbox.length + laneDocuments.filter((document) => document.tone === 'warning').length;
    const done = laneDocuments.filter((document) => document.tone === 'success').length
      + (lane.id === 'warehouse' ? movements.filter((movement) => movement.tone === 'success').length : 0);
    const tone: WorkflowTone = blocked > 0 ? 'danger' : waiting > 0 ? 'warning' : done > 0 ? 'success' : 'neutral';

    return {
      ...lane,
      waiting,
      blocked,
      done,
      tone,
      status: blocked > 0 ? 'Có ngoại lệ' : waiting > 0 ? 'Đang chờ xử lí' : done > 0 ? 'Đã ghi nhận' : 'Chưa có dữ liệu',
    };
  });

export function useWorkflowOverview(options: { skip?: boolean } = {}) {
  const queryOptions = { skip: options.skip ?? false };
  const documentsResult = useGetWorkflowDocumentsQuery({ limit: 100 }, queryOptions);
  const demandResult = useGetIngredientDemandQuery({ limit: 100 }, queryOptions);
  const priceResult = useGetPriceVarianceQuery({ limit: 100 }, queryOptions);
  const movementsResult = useGetStockMovementsQuery({ limit: 100 }, queryOptions);

  const documents = documentsResult.data ?? [];
  const demandLines = demandResult.data ?? [];
  const priceRows = priceResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const roleInboxItems = buildRoleInbox(documents, demandLines, priceRows);
  const workflowLanes = buildWorkflowLanes(documents, roleInboxItems, movements);

  return {
    workflowLanes,
    roleInboxItems,
    blockedItems: roleInboxItems.filter((item) => item.tone === 'danger'),
    documents,
    demandLines,
    movements,
    isLoading: documentsResult.isLoading || demandResult.isLoading || priceResult.isLoading || movementsResult.isLoading,
    isError: documentsResult.isError || demandResult.isError || priceResult.isError || movementsResult.isError,
  };
}
