import type { components, paths } from '@/shared/api/contracts/schema';
import type { ApprovalRecord } from '@/types/workflow';

export type LowerCamelQuery<Query> = {
  [Key in keyof Query as Uncapitalize<Key & string>]: Query[Key];
};

export type MutableContract<Value> = Value extends readonly (infer Item)[]
  ? MutableContract<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableContract<Value[Key]> }
    : Value;

export type WorkflowReportQueryWire =
  & NonNullable<paths['/api/workflow-reports/workflow-documents']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/ingredient-demand']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/purchase-plan']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/stock-movements']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/receipt-price-variance']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/audit-changes']['get']['parameters']['query']>;

export type WorkflowReportPageQueryWire = WorkflowReportQueryWire
  & NonNullable<paths['/api/workflow-reports/ingredient-demand/page']['get']['parameters']['query']>;

export type WorkflowReportQuery = LowerCamelQuery<WorkflowReportQueryWire>;
export type SupplyLineReconciliationDto = MutableContract<components['schemas']['SupplyLineReconciliationDto']>;
export interface LegacyLineageDispositionDto {
  dispositionId: string;
  legacyLineType: 'ISSUE_LINE' | 'RETURN_LINE' | string;
  legacyLineId: string;
  targetMaterialRequestLineId?: string | null;
  targetIssueLineId?: string | null;
  status: 'PENDING_MANAGER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | string;
  reason: string;
  reviewReason?: string | null;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  appliedBy?: string | null;
  appliedAt?: string | null;
  version: number;
}
export interface LegacyLineageCandidateDto {
  legacyLineType: string;
  legacyLineId: string;
  targetLineId: string;
  documentCode: string;
  ingredientId: string;
  unitId: string;
}
export type CreateLegacyLineageDispositionRequest = components['schemas']['CreateLegacyLineageDispositionRequest'];
export type ReviewLegacyLineageDispositionRequest = components['schemas']['ReviewLegacyLineageDispositionRequest'];
export type ApplyLegacyLineageDispositionRequest = components['schemas']['ApplyLegacyLineageDispositionRequest'];

export type WorkflowReportPageQuery = LowerCamelQuery<WorkflowReportPageQueryWire>;
export type IngredientDemandAggregatePageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/ingredient-demand/aggregate/page']['get']['parameters']['query']
>>;
export type PurchasePlanPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/purchase-plan/page']['get']['parameters']['query']
>>;
export type DataQualityPageQuery = WorkflowReportPageQuery & { searchKeyword?: string };

export type MaterialRequestCandidatePageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/material-request-candidates/page']['get']['parameters']['query']
>>;

export type CurrentStockPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/current-stock/page']['get']['parameters']['query']
>>;
export type StockMovementPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/stock-movements/page']['get']['parameters']['query']
>>;
export type ReceiptPriceVariancePageQuery = WorkflowReportPageQuery & { searchKeyword?: string };
export type PriceVarianceAggregatePageQuery = WorkflowReportPageQuery;

export interface PageNumberPage<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface CursorPage<T> {
  items: T[];
  limit: number;
  hasNext: boolean;
  nextCursorDate?: string;
  nextCursorId?: string;
  /** Số dòng đã trả ở cùng `nextCursorDate`; phải gửi lại nguyên vẹn nếu không trang sau sẽ nhảy dòng. */
  nextCursorOffset?: number;
}

/**
 * Con trỏ phân trang là một bộ ba: mốc thời gian, id dòng cuối và số dòng đã tiêu thụ tại mốc đó.
 * Cột thời gian ở backend là `datetime` theo giây nên một mốc chứa nhiều dòng hơn một trang —
 * bỏ `cursorOffset` là mất dòng ở ranh giới trang.
 */
export interface ReportCursor {
  cursorDate: string;
  cursorId?: string;
  cursorOffset?: number;
}

/** Đẩy con trỏ của trang kế tiếp vào ngăn xếp điều hướng; trả về `null` khi không còn trang sau. */
export const toNextReportCursor = (page?: {
  nextCursorDate?: string;
  nextCursorId?: string;
  nextCursorOffset?: number;
}): ReportCursor | null => (page?.nextCursorDate
  ? { cursorDate: page.nextCursorDate, cursorId: page.nextCursorId, cursorOffset: page.nextCursorOffset }
  : null);

export type ApprovalInboxQuery = LowerCamelQuery<NonNullable<
  paths['/api/approvals/inbox']['get']['parameters']['query']
>>;

export interface ApprovalInboxPage {
  items: ApprovalRecord[];
  limit: number;
  hasNext: boolean;
  nextCursor?: string | null;
}

export type PurchaseRequestQuery = LowerCamelQuery<
  NonNullable<paths['/api/purchase-requests']['get']['parameters']['query']>
  & NonNullable<paths['/api/purchase-requests/page']['get']['parameters']['query']>
>;

export type PurchaseRequestResult = MutableContract<components['schemas']['PurchaseRequestWorkflowResultDto']>;
export type PurchaseWorkbenchQuery = LowerCamelQuery<NonNullable<
  paths['/api/purchase-workflow/workbench']['get']['parameters']['query']
>>;
export type PurchaseWorkflowStageCounts = MutableContract<components['schemas']['PurchaseWorkflowStageCountsDto']>;
export type SupplierEvidenceType = components['schemas']['SupplierEvidenceType'];
export type SupplierEvidenceCandidate = MutableContract<components['schemas']['SupplierEvidenceCandidateDto']>;
export type SupplierEvidenceResult = MutableContract<components['schemas']['SupplierEvidenceResultDto']>;
export type PurchaseLineSupplierDecision = MutableContract<components['schemas']['PurchaseLineSupplierDecisionDto']>;
export type PurchaseRequestWorkflowLine = MutableContract<components['schemas']['PurchaseRequestWorkflowLineDto']>;
export type ApprovedDemandSummary = MutableContract<components['schemas']['ApprovedDemandSummaryDto']>;
export type PurchaseWorkbenchServiceDate = MutableContract<components['schemas']['PurchaseWorkbenchServiceDateDto']>;
export type PurchaseWorkbenchWeek = MutableContract<components['schemas']['PurchaseWorkbenchWeekDto']>;

export type SupplierEvidencePath = NonNullable<
  paths['/api/purchase-workflow/requests/{id}/lines/{lineId}/supplier-evidence']['get']['parameters']['path']
>;
export type SupplierEvidenceQuery = {
  [Key in keyof SupplierEvidencePath as Key extends 'id'
    ? 'purchaseRequestId'
    : Key extends 'lineId'
      ? 'purchaseRequestLineId'
      : never]: SupplierEvidencePath[Key];
};

export type ConfirmPurchaseLineSupplierData = components['schemas']['ConfirmPurchaseLineSupplierRequest'];

export type ConfirmPurchaseLineSupplierRequest = SupplierEvidenceQuery & {
  week: PurchaseWorkbenchQuery['week'];
  data: ConfirmPurchaseLineSupplierData;
};

export type ApprovalHistoryItem = components['schemas']['ApprovalHistoryItemDto'];
export type CreateInventoryReceiptFromPurchaseLineRequest = components['schemas']['CreateInventoryReceiptFromPurchaseLineRequest'];
export type CreateInventoryReceiptFromPurchaseRequest = components['schemas']['CreateInventoryReceiptFromPurchaseRequest'];
export type WarehouseDto = MutableContract<components['schemas']['WarehouseDto']>;
export type WarehousePageQuery = LowerCamelQuery<NonNullable<
  paths['/api/Warehouses']['get']['parameters']['query']
>>;
export type GeneratePurchaseRequestFromDemandRequest = components['schemas']['GeneratePurchaseRequestFromDemandRequest'];
export type PurchaseRequestWorkflowResult = MutableContract<components['schemas']['PurchaseRequestWorkflowResultDto']>;
export type InventoryReceiptCreatedResult = components['schemas']['InventoryReceiptCreatedDto'];
export type CreateInventoryIssueLineRequest = components['schemas']['CreateInventoryIssueLineRequest'];
export type CreateInventoryIssueRequest = components['schemas']['CreateInventoryIssueRequest'];
export type CreateSupplementalMaterialRequest = components['schemas']['CreateSupplementalMaterialRequest'];
export type SupplementalMaterialRequestResult = MutableContract<components['schemas']['SupplementalMaterialRequestDto']>;
export type SupplementalMaterialRequestPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/supplemental-material-requests']['get']['parameters']['query']
>>;
export type SupplementalRequestPath = NonNullable<
  paths['/api/supplemental-material-requests/{id}']['get']['parameters']['path']
>;
export type SupplementalRequestId = {
  [Key in keyof SupplementalRequestPath as Key extends 'id' ? 'requestId' : never]: SupplementalRequestPath[Key];
};
export type FulfillSupplementalMaterialRequest = SupplementalRequestId
  & components['schemas']['FulfillSupplementalMaterialRequest'];
export type RejectSupplementalMaterialRequest = SupplementalRequestId
  & components['schemas']['RejectSupplementalMaterialRequest'];
export type InventoryIssueCreatedResult = components['schemas']['InventoryIssueCreatedDto'];
export type CreateInventoryReturnLineRequest = components['schemas']['CreateInventoryReturnLineRequest'];
export type CreateInventoryReturnRequest = components['schemas']['CreateInventoryReturnRequest'];
export type InventoryReturnCreatedResult = components['schemas']['InventoryReturnCreatedDto'];

export type ConfirmInventoryIssueReceiptData = components['schemas']['ConfirmInventoryIssueReceiptRequest'];
export type ConfirmInventoryIssueReceiptPath = NonNullable<
  paths['/api/inventory-issues/{id}/confirm-receipt']['post']['parameters']['path']
>;
export type ConfirmInventoryIssueReceiptRequest = ConfirmInventoryIssueReceiptData & {
  [Key in keyof ConfirmInventoryIssueReceiptPath as Key extends 'id'
    ? 'issueId'
    : never]: ConfirmInventoryIssueReceiptPath[Key];
};

export type InventoryIssueResult = MutableContract<components['schemas']['InventoryIssueDto']>;

export type WorkflowDocumentDto = components['schemas']['WorkflowDocumentDto'];
export type IngredientDemandReportDto = components['schemas']['IngredientDemandReportDto'];
export type IngredientDemandPageResponseDto = components['schemas']['IngredientDemandPageDto'];
export type MaterialRequestCandidate = components['schemas']['MaterialRequestCandidateDto'];
export type IngredientDemandAggregateReportDto = components['schemas']['IngredientDemandAggregateDto'];
export type IngredientDemandAggregatePageResponseDto = components['schemas']['IngredientDemandAggregatePageDto'];

export interface PurchasePlanRow {
  periodKey: string;
  groupBy: 'day' | 'week';
  periodStart: string;
  periodEnd: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  requiredQty: number;
  currentStockQty: number;
  pendingReceiptQty: number;
  shortageQty: number;
  suggestedPurchaseQty: number;
  estimatedUnitPrice: number;
  estimatedAmount: number;
  supplierId?: string | null;
  supplierName?: string | null;
  expectedDeliveryDate?: string | null;
  warnings: string[];
}

export type PurchasePlanReportDto = components['schemas']['PurchasePlanReportDto'];
export type PurchasePlanPageResponseDto = components['schemas']['PurchasePlanPageDto'];

export interface ProductionPlanLine {
  planLineId: string;
  dishId: string;
  dishName?: string | null;
  shiftName?: string | null;
  totalServings: number;
  priceTierAmount?: number | null;
  bomScope?: string | null;
  totalRequiredQty: number;
  suggestedPurchaseQty: number;
  hasKitchenIssue: boolean;
  isReceivedByKitchen: boolean;
}

export interface ProductionPlan {
  planId: string;
  planCode: string;
  planDate: string;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  status?: string | null;
  sentToKitchenAt?: string | null;
  sentToKitchenByName?: string | null;
  lines: ProductionPlanLine[];
}

export interface DailyProductionPlan {
  serviceDate: string;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  shiftName?: string | null;
  totalPlans: number;
  sentPlans: number;
  totalDishes: number;
  totalServings: number;
  totalRequiredQty: number;
  suggestedPurchaseQty: number;
  warnings: string[];
  plans: ProductionPlan[];
}

export type ProductionPlanDto = components['schemas']['ProductionPlanDto'];
export type DailyProductionPlanDto = components['schemas']['DailyProductionPlanDto'];
export type SendDailyProductionPlanRequest = components['schemas']['SendDailyProductionPlanRequest'];
  export type ServiceRunLifecycleProjectionDto = components['schemas']['ServiceRunLifecycleProjectionDto'];
  export type ServiceRunOperationalRowDto = components['schemas']['ServiceRunOperationalRowDto'];
  export type ServiceRunPageResponseDto = components['schemas']['ServiceRunOperationalRowDtoPagedResponseDto'];
  export type ServiceRunPageQuery = { pageNumber?: number; pageSize?: number; serviceDate?: string; shiftName?: string; status?: string };
  export type ServiceRunByPlanQuery = { planId: string; shiftName: string };
export type OpenServiceRunRequest = components['schemas']['OpenServiceRunRequest'];
export type RecordActualServingsRequest = components['schemas']['RecordActualServingsRequest'];
  export type ReasonRequest = components['schemas']['ReasonRequest'];
  export type CreateServiceRunAdjustmentRequest = components['schemas']['CreateServiceRunAdjustmentRequest'];
  export type ServiceRunAdjustmentDto = components['schemas']['ServiceRunAdjustmentDto'];
export type ApprovalInboxItemDto = components['schemas']['ApprovalInboxItemDto'];
export type ApprovalRuleDto = components['schemas']['ApprovalRule'];
export type ApprovalAssignmentDto = components['schemas']['ApprovalAssignment'];
export type ApprovalAssignmentRequestDto = components['schemas']['ApprovalAssignmentRequest'];
export type ApprovalRuleRequestDto = components['schemas']['ApprovalRuleRequest'];
export type StockMovementViewDto = components['schemas']['StockMovementViewDto'];
export type StockLedgerReconciliationDto = components['schemas']['StockLedgerReconciliationDto'];

export type SupplierDto = MutableContract<components['schemas']['SupplierDto']>;

/** Legacy adapter for an exported hook whose backend route is no longer part of OpenAPI. */
export type UpdatePurchaseRequestLineSupplierDto =
  & Pick<ConfirmPurchaseLineSupplierData, 'supplierId' | 'note'>
  & {
    [Key in 'proposedUnitPrice' as 'estimatedUnitPrice']: ConfirmPurchaseLineSupplierData[Key];
  }
  & {
    [Key in 'proposedDeliveryDate' as 'expectedDeliveryDate']?: ConfirmPurchaseLineSupplierData[Key] | null;
  };

export type SupplierQuotationDto = MutableContract<components['schemas']['SupplierQuotationDto']>;
export type CreateSupplierQuotationDto = components['schemas']['CreateSupplierQuotationRequest'];
export type UpdateSupplierQuotationDto = components['schemas']['UpdateSupplierQuotationRequest'];
export type SupplierQuotationPageQuery = NonNullable<
  paths['/api/supplier-quotations/ingredient/{ingredientId}/page']['get']['parameters']['path']
> & LowerCamelQuery<NonNullable<
  paths['/api/supplier-quotations/ingredient/{ingredientId}/page']['get']['parameters']['query']
>>;
export type SupplierQuotationIdPath = NonNullable<
  paths['/api/supplier-quotations/{id}']['put']['parameters']['path']
>;
export type UpdateSupplierQuotationArgs = {
  quotationId: SupplierQuotationIdPath['id'];
  data: UpdateSupplierQuotationDto;
};
export type PurchaseOrderLineDto = MutableContract<components['schemas']['PurchaseOrderLineDto']>;
export type InventoryReturnLineResult = MutableContract<components['schemas']['InventoryReturnLineDto']>;
export type InventoryReturnResult = MutableContract<components['schemas']['InventoryReturnDto']>;
export type InventoryReturnPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/inventory-returns']['get']['parameters']['query']
>>;
export type ConfirmInventoryReturnReceiptData = components['schemas']['ConfirmInventoryReturnReceiptRequest'];
export type ConfirmInventoryReturnReceiptPath = NonNullable<
  paths['/api/inventory-returns/{id}/confirm-receipt']['post']['parameters']['path']
>;
export type ConfirmInventoryReturnReceiptRequest = ConfirmInventoryReturnReceiptData & {
  [Key in keyof ConfirmInventoryReturnReceiptPath as Key extends 'id'
    ? 'returnId'
    : never]: ConfirmInventoryReturnReceiptPath[Key];
};
export type PurchaseOrderDto = MutableContract<components['schemas']['PurchaseOrderDto']>;
export type PurchaseOrderQuery = LowerCamelQuery<NonNullable<
  paths['/api/purchase-orders']['get']['parameters']['query']
>>;
export type PurchaseOrderPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/purchase-orders/page']['get']['parameters']['query']
>>;
export type PurchaseReceiptEvidenceRequirements = MutableContract<components['schemas']['PurchaseReceiptEvidenceRequirementsDto']>;
export type WarehousePurchaseReceiptLineRequest = components['schemas']['WarehousePurchaseReceiptLineRequest'];
export type WarehousePurchaseReceiptRequest = components['schemas']['RecordWarehousePurchaseReceiptRequest'];
export type WarehousePurchaseReceiptResult = MutableContract<components['schemas']['WarehousePurchaseReceiptResultDto']>;
export type InventoryReceipt = MutableContract<components['schemas']['InventoryReceiptDto']>;
export type ReceiptQualityDecisionRequest = MutableContract<components['schemas']['ReceiptQualityDecisionRequest']>;
export type ReceiptPostRequest = MutableContract<components['schemas']['ReceiptPostRequest']>;
export type ReceiptReworkRequest = MutableContract<components['schemas']['ReceiptReworkRequest']>;
export type CreateReceiptCorrectionRequest = MutableContract<components['schemas']['CreateReceiptCorrectionRequest']>;
export type ReceiptCorrectionResult = MutableContract<components['schemas']['ReceiptCorrectionResultDto']>;
export type ReceiptQualityActionArgs = {
  purchaseOrderId: string;
  receiptId: string;
  data: ReceiptQualityDecisionRequest;
};
export type ReceiptPostActionArgs = {
  purchaseOrderId: string;
  receiptId: string;
  data: ReceiptPostRequest;
};
export type ReceiptReworkActionArgs = {
  purchaseOrderId: string;
  receiptId: string;
  data: ReceiptReworkRequest;
};
export type ReceiptCorrectionActionArgs = {
  purchaseOrderId: string;
  receiptId: string;
  data: CreateReceiptCorrectionRequest;
};

export type RecordWarehousePurchaseReceiptRequest = {
  week?: PurchaseWorkbenchQuery['week'];
  data: WarehousePurchaseReceiptRequest;
};

export type ApprovalInboxPageDto = components['schemas']['ApprovalInboxPageDto'];

export type PurchaseOrderPageResponse = MutableContract<components['schemas']['PurchaseOrderPageDto']>;

/** Legacy adapter retained for the exported `/receive` hook; that route is absent from OpenAPI. */
export type RecordPurchaseOrderReceiptLineDto = Pick<
  WarehousePurchaseReceiptLineRequest,
  'purchaseOrderLineId'
> & {
  [Key in 'actualQuantity' as 'receivedQty']: WarehousePurchaseReceiptLineRequest[Key];
};

export type RecordPurchaseOrderReceiptDto = Pick<WarehousePurchaseReceiptRequest, 'warehouseId'> & {
  lines: RecordPurchaseOrderReceiptLineDto[];
};
export type RecordPurchaseOrderReceiptArgs = {
  purchaseOrderId: PurchaseOrderDto['purchaseOrderId'];
  data: RecordPurchaseOrderReceiptDto;
};

export type ReceiptPriceVarianceReportDto = components['schemas']['ReceiptPriceVarianceReportDto'];
export type PriceVarianceBySupplierDto = components['schemas']['PriceVarianceBySupplierDto'];
export type PriceVarianceByPeriodDto = components['schemas']['PriceVarianceByPeriodDto'];
export type PriceVarianceDishGroupIngredientDto = components['schemas']['PriceVarianceDishGroupIngredientDto'];
export type PriceVarianceByDishGroupDto = components['schemas']['PriceVarianceByDishGroupDto'];
export type OperationalKpiSummaryDto = components['schemas']['OperationalKpiSummaryDto'];
export type CurrentStockSummaryDto = components['schemas']['CurrentStockSummaryDto'];
export type KitchenIssueReportDto = components['schemas']['KitchenIssueReportDto'];
export type IssueVsReturnUsageReportDto = components['schemas']['IssueVsReturnUsageReportDto'];
export type AuditChangeReportDto = components['schemas']['AuditChangeReportDto'];
export type DataQualityIssueDto = components['schemas']['DataQualityIssueDto'];
export type DataQualityReportDto = components['schemas']['DataQualityReportDto'];
export type DataQualityPageDto = components['schemas']['DataQualityPageDto'];
export type MaterialDemandResultDto = components['schemas']['MaterialDemandResultDto'];
export type GenerateMaterialDemandWire = components['schemas']['GenerateMaterialDemandRequest'];
export type GenerateMaterialDemandRequest = Omit<GenerateMaterialDemandWire, 'scope'>
  & Partial<Pick<GenerateMaterialDemandWire, 'scope'>>;
export type MaterialDemandStalenessQuery = LowerCamelQuery<NonNullable<
  paths['/api/material-demand/staleness']['get']['parameters']['query']
>>;
export type MaterialDemandStaleness = MutableContract<components['schemas']['MaterialDemandStalenessDto']>;
export type PurchaseRequestWorkflowResultDto = components['schemas']['PurchaseRequestWorkflowResultDto'];

export type ApprovalDecisionRequest = {
  [Key in keyof NonNullable<
    paths['/api/approvals/{targetType}/{id}']['post']['parameters']['path']
  > as Key extends 'id' ? 'targetId' : Key]: NonNullable<
    paths['/api/approvals/{targetType}/{id}']['post']['parameters']['path']
  >[Key];
} & components['schemas']['ApprovalRequest'] & { week?: PurchaseWorkbenchQuery['week'] };

export type ApprovalHistoryQuery = NonNullable<
  paths['/api/approval-history/{documentType}/{documentId}']['get']['parameters']['path']
>;
export type ApprovalRuleIdPath = NonNullable<
  paths['/api/approval-rules/{id}']['put']['parameters']['path']
>;
export type UpdateApprovalRuleArgs = {
  id: ApprovalRuleIdPath['id'];
  body: ApprovalRuleRequestDto;
};

export interface PriceVarianceRow {
  id: string;
  name: string;
  unit: string;
  receiptCode: string;
  receiptDate: string;
  quantity: number;
  pricePrev: number;
  priceCurrent: number;
  supplier: string;
  change: number;
  warning: boolean;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  businessArea: string;
  fieldAffected: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface CurrentStockRow {
  id: string;
  warehouseId: string;
  warehouse: string;
  ingredientId: string;
  ingredient: string;
  unitId: string;
  unit: string;
  currentQty: number;
  lastUpdated: string;
}

export interface StockLedgerReconciliationRow {
  id: string;
  warehouse: string;
  ingredient: string;
  unit: string;
  currentQty: number;
  ledgerQty: number;
  differenceQty: number;
  isMatched: boolean;
  lastMovementAt?: string;
}

export interface KitchenIssueRow {
  id: string;
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  warehouse: string;
  materialRequestId: string;
  ingredientId: string;
  ingredient: string;
  unitId: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  isReceivedByKitchen: boolean;
  receiptStatus: string;
}

export interface UsageReportRow {
  id: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  ingredient: string;
  unit: string;
  issuedQty: number;
  returnedQty: number;
  wastedQty: number;
  usedQty: number;
  varianceQty: number;
}

export interface DataQualityIssueRow {
  id: string;
  category: string;
  severity: 'error' | 'warning';
  owner: string;
  priorityRank: number;
  slaHours: number;
  slaDueAt?: string;
  slaLabel: string;
  entityName: string;
  entityId?: string;
  entityCode: string;
  entityLabel: string;
  message: string;
  suggestedAction: string;
  route: string;
  remediationStatus: 'open' | 'resolved' | 'reopened';
  remediationAt?: string;
  remediationByName?: string;
  remediationNote?: string;
}

export interface DataQualityReport {
  generatedAt: string;
  totalIssues: number;
  isTruncated: boolean;
  errorCount: number;
  warningCount: number;
  resolvedIssueCount: number;
  reopenedIssueCount: number;
  urgentIssueCount: number;
  missingBomCount: number;
  invalidUnitCount: number;
  missingConversionCount: number;
  negativeStockCount: number;
  orphanDocumentCount: number;
  issues: DataQualityIssueRow[];
}

export interface DataQualityPageReport extends DataQualityReport {
  page: PageNumberPage<DataQualityIssueRow>;
}

export type DataQualityIssueRemediationRequest = components['schemas']['DataQualityIssueRemediationRequest'];

export type CursorPageDto<T> = Omit<
  components['schemas']['StockMovementViewDtoCursorPageDto'],
  'items'
> & { readonly items?: readonly T[] };

export type PageNumberPageDto<T> = Omit<
  components['schemas']['DataQualityIssueDtoPagedResponseDto'],
  'items'
> & { readonly items: readonly T[] };

export type DataQualityIssueRemediationResult = components['schemas']['DataQualityIssueRemediationDto'];
