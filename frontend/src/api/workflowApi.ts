import { apiSlice } from '@/api/apiSlice';
import {
  workflowAuditSourceTags,
  workflowCacheTags,
  workflowOperationalKpiSourceTags,
} from '@/api/workflowCacheTags';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import type { components, paths } from '@/shared/api/contracts/schema';
import type { ApiResponse } from '@/types/api';
import {
  ownerToLaneId,
  routeByLaneId,
  toneFromStatus,
  workflowLaneDefinitions,
} from '@/lib/workflowConfig';
import type {
  ApprovalRecord,
  DemandLine,
  RoleInboxItem,
  StockMovement,
  StockMovementType,
  WorkflowDocument,
  WorkflowDocumentType,
  WorkflowLane,
  WorkflowTone,
} from '@/types/workflow';
import { resolveDemandLinePresentation } from '@/lib/actionEligibility';

type LowerCamelQuery<Query> = {
  [Key in keyof Query as Uncapitalize<Key & string>]: Query[Key];
};

type MutableContract<Value> = Value extends readonly (infer Item)[]
  ? MutableContract<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableContract<Value[Key]> }
    : Value;

type WorkflowReportQueryWire =
  & NonNullable<paths['/api/workflow-reports/workflow-documents']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/ingredient-demand']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/purchase-plan']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/stock-movements']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/receipt-price-variance']['get']['parameters']['query']>
  & NonNullable<paths['/api/workflow-reports/audit-changes']['get']['parameters']['query']>;

type WorkflowReportPageQueryWire = WorkflowReportQueryWire
  & NonNullable<paths['/api/workflow-reports/ingredient-demand/page']['get']['parameters']['query']>;

export type WorkflowReportQuery = LowerCamelQuery<WorkflowReportQueryWire>;

export type WorkflowReportPageQuery = LowerCamelQuery<WorkflowReportPageQueryWire>;

export type MaterialRequestCandidatePageQuery = LowerCamelQuery<NonNullable<
  paths['/api/workflow-reports/material-request-candidates/page']['get']['parameters']['query']
>>;

export type CurrentStockPageQuery = WorkflowReportPageQuery;
export type ReceiptPriceVariancePageQuery = WorkflowReportPageQuery;
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

type SupplierEvidencePath = NonNullable<
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
type WarehousePageQuery = LowerCamelQuery<NonNullable<
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
type SupplementalRequestPath = NonNullable<
  paths['/api/supplemental-material-requests/{id}']['get']['parameters']['path']
>;
type SupplementalRequestId = {
  [Key in keyof SupplementalRequestPath as Key extends 'id' ? 'requestId' : never]: SupplementalRequestPath[Key];
};
type FulfillSupplementalMaterialRequest = SupplementalRequestId
  & components['schemas']['FulfillSupplementalMaterialRequest'];
type RejectSupplementalMaterialRequest = SupplementalRequestId
  & components['schemas']['RejectSupplementalMaterialRequest'];
export type InventoryIssueCreatedResult = components['schemas']['InventoryIssueCreatedDto'];
export type CreateInventoryReturnLineRequest = components['schemas']['CreateInventoryReturnLineRequest'];
export type CreateInventoryReturnRequest = components['schemas']['CreateInventoryReturnRequest'];
export type InventoryReturnCreatedResult = components['schemas']['InventoryReturnCreatedDto'];

type ConfirmInventoryIssueReceiptData = components['schemas']['ConfirmInventoryIssueReceiptRequest'];
type ConfirmInventoryIssueReceiptPath = NonNullable<
  paths['/api/inventory-issues/{id}/confirm-receipt']['post']['parameters']['path']
>;
export type ConfirmInventoryIssueReceiptRequest = ConfirmInventoryIssueReceiptData & {
  [Key in keyof ConfirmInventoryIssueReceiptPath as Key extends 'id'
    ? 'issueId'
    : never]: ConfirmInventoryIssueReceiptPath[Key];
};

export type InventoryIssueResult = MutableContract<components['schemas']['InventoryIssueDto']>;

type WorkflowDocumentDto = components['schemas']['WorkflowDocumentDto'];
type IngredientDemandReportDto = components['schemas']['IngredientDemandReportDto'];
type IngredientDemandPageResponseDto = components['schemas']['IngredientDemandPageDto'];
export type MaterialRequestCandidate = components['schemas']['MaterialRequestCandidateDto'];
type IngredientDemandAggregateReportDto = components['schemas']['IngredientDemandAggregateDto'];
type IngredientDemandAggregatePageResponseDto = components['schemas']['IngredientDemandAggregatePageDto'];

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

type PurchasePlanReportDto = components['schemas']['PurchasePlanReportDto'];
type PurchasePlanPageResponseDto = components['schemas']['PurchasePlanPageDto'];

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

type ProductionPlanDto = components['schemas']['ProductionPlanDto'];
type DailyProductionPlanDto = components['schemas']['DailyProductionPlanDto'];
export type SendDailyProductionPlanRequest = components['schemas']['SendDailyProductionPlanRequest'];
type ApprovalInboxItemDto = components['schemas']['ApprovalInboxItemDto'];
export type ApprovalRuleDto = components['schemas']['ApprovalRule'];
export type ApprovalAssignmentDto = components['schemas']['ApprovalAssignment'];
export type ApprovalAssignmentRequestDto = components['schemas']['ApprovalAssignmentRequest'];
export type ApprovalRuleRequestDto = components['schemas']['ApprovalRuleRequest'];
type StockMovementViewDto = components['schemas']['StockMovementViewDto'];
type StockLedgerReconciliationDto = components['schemas']['StockLedgerReconciliationDto'];

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
type SupplierQuotationPageQuery = NonNullable<
  paths['/api/supplier-quotations/ingredient/{ingredientId}/page']['get']['parameters']['path']
> & LowerCamelQuery<NonNullable<
  paths['/api/supplier-quotations/ingredient/{ingredientId}/page']['get']['parameters']['query']
>>;
type SupplierQuotationIdPath = NonNullable<
  paths['/api/supplier-quotations/{id}']['put']['parameters']['path']
>;
type UpdateSupplierQuotationArgs = {
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
type ConfirmInventoryReturnReceiptPath = NonNullable<
  paths['/api/inventory-returns/{id}/confirm-receipt']['post']['parameters']['path']
>;
export type ConfirmInventoryReturnReceiptRequest = ConfirmInventoryReturnReceiptData & {
  [Key in keyof ConfirmInventoryReturnReceiptPath as Key extends 'id'
    ? 'returnId'
    : never]: ConfirmInventoryReturnReceiptPath[Key];
};
export type PurchaseOrderDto = MutableContract<components['schemas']['PurchaseOrderDto']>;
type PurchaseOrderQuery = LowerCamelQuery<NonNullable<
  paths['/api/purchase-orders']['get']['parameters']['query']
>>;
type PurchaseOrderPageQuery = LowerCamelQuery<NonNullable<
  paths['/api/purchase-orders/page']['get']['parameters']['query']
>>;
export type PurchaseReceiptEvidenceRequirements = MutableContract<components['schemas']['PurchaseReceiptEvidenceRequirementsDto']>;
export type WarehousePurchaseReceiptLineRequest = components['schemas']['WarehousePurchaseReceiptLineRequest'];
export type WarehousePurchaseReceiptRequest = components['schemas']['RecordWarehousePurchaseReceiptRequest'];
export type WarehousePurchaseReceiptResult = MutableContract<components['schemas']['WarehousePurchaseReceiptResultDto']>;

export type RecordWarehousePurchaseReceiptRequest = {
  week?: PurchaseWorkbenchQuery['week'];
  data: WarehousePurchaseReceiptRequest;
};

type ApprovalInboxPageDto = components['schemas']['ApprovalInboxPageDto'];

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
type RecordPurchaseOrderReceiptArgs = {
  purchaseOrderId: PurchaseOrderDto['purchaseOrderId'];
  data: RecordPurchaseOrderReceiptDto;
};

type ReceiptPriceVarianceReportDto = components['schemas']['ReceiptPriceVarianceReportDto'];
export type PriceVarianceBySupplierDto = components['schemas']['PriceVarianceBySupplierDto'];
export type PriceVarianceByPeriodDto = components['schemas']['PriceVarianceByPeriodDto'];
export type PriceVarianceDishGroupIngredientDto = components['schemas']['PriceVarianceDishGroupIngredientDto'];
export type PriceVarianceByDishGroupDto = components['schemas']['PriceVarianceByDishGroupDto'];
export type OperationalKpiSummaryDto = components['schemas']['OperationalKpiSummaryDto'];
type CurrentStockSummaryDto = components['schemas']['CurrentStockSummaryDto'];
type KitchenIssueReportDto = components['schemas']['KitchenIssueReportDto'];
type IssueVsReturnUsageReportDto = components['schemas']['IssueVsReturnUsageReportDto'];
type AuditChangeReportDto = components['schemas']['AuditChangeReportDto'];
type DataQualityIssueDto = components['schemas']['DataQualityIssueDto'];
type DataQualityReportDto = components['schemas']['DataQualityReportDto'];
type DataQualityPageDto = components['schemas']['DataQualityPageDto'];
type MaterialDemandResultDto = components['schemas']['MaterialDemandResultDto'];
type GenerateMaterialDemandWire = components['schemas']['GenerateMaterialDemandRequest'];
export type GenerateMaterialDemandRequest = Omit<GenerateMaterialDemandWire, 'scope'>
  & Partial<Pick<GenerateMaterialDemandWire, 'scope'>>;
export type MaterialDemandStalenessQuery = LowerCamelQuery<NonNullable<
  paths['/api/material-demand/staleness']['get']['parameters']['query']
>>;
export type MaterialDemandStaleness = MutableContract<components['schemas']['MaterialDemandStalenessDto']>;
type PurchaseRequestWorkflowResultDto = components['schemas']['PurchaseRequestWorkflowResultDto'];

export type ApprovalDecisionRequest = {
  [Key in keyof NonNullable<
    paths['/api/approvals/{targetType}/{id}']['post']['parameters']['path']
  > as Key extends 'id' ? 'targetId' : Key]: NonNullable<
    paths['/api/approvals/{targetType}/{id}']['post']['parameters']['path']
  >[Key];
} & components['schemas']['ApprovalRequest'] & { week?: PurchaseWorkbenchQuery['week'] };

type ApprovalHistoryQuery = NonNullable<
  paths['/api/approval-history/{documentType}/{documentId}']['get']['parameters']['path']
>;
type ApprovalRuleIdPath = NonNullable<
  paths['/api/approval-rules/{id}']['put']['parameters']['path']
>;
type UpdateApprovalRuleArgs = {
  id: ApprovalRuleIdPath['id'];
  body: ApprovalRuleRequestDto;
};

export interface PriceVarianceRow {
  id: string;
  name: string;
  unit: string;
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

type CursorPageDto<T> = Omit<
  components['schemas']['StockMovementViewDtoCursorPageDto'],
  'items'
> & { readonly items?: readonly T[] };

type PageNumberPageDto<T> = Omit<
  components['schemas']['DataQualityIssueDtoPagedResponseDto'],
  'items'
> & { readonly items: readonly T[] };

export type DataQualityIssueRemediationResult = components['schemas']['DataQualityIssueRemediationDto'];

const getData = <T>(response: ApiResponse<T>): T => response.data as T;
const emptyDailyProductionPlan = (): DailyProductionPlan => ({
  serviceDate: '',
  totalPlans: 0,
  sentPlans: 0,
  totalDishes: 0,
  totalServings: 0,
  totalRequiredQty: 0,
  suggestedPurchaseQty: 0,
  warnings: [],
  plans: [],
});

const mapProductionPlan = (plan: ProductionPlanDto): ProductionPlan => ({
  ...plan,
  customerId: plan.customerId ?? undefined,
  customerCode: plan.customerCode ?? undefined,
  customerName: plan.customerName ?? undefined,
  status: plan.status ?? undefined,
  sentToKitchenAt: plan.sentToKitchenAt ?? undefined,
  sentToKitchenByName: plan.sentToKitchenByName ?? undefined,
  lines: plan.lines.map((line) => ({ ...line })),
});

const normalizeDailyProductionPlan = (
  response: ApiResponse<DailyProductionPlanDto> | DailyProductionPlanDto | unknown,
): DailyProductionPlan => {
  const maybeData =
    response && typeof response === 'object' && 'data' in response
      ? (response as ApiResponse<DailyProductionPlanDto>).data
      : response;

  if (!maybeData || typeof maybeData !== 'object' || Array.isArray(maybeData)) {
    return emptyDailyProductionPlan();
  }

  const plan = maybeData as Partial<DailyProductionPlanDto>;
  return {
    ...emptyDailyProductionPlan(),
    ...plan,
    customerId: plan.customerId ?? undefined,
    customerCode: plan.customerCode ?? undefined,
    customerName: plan.customerName ?? undefined,
    shiftName: plan.shiftName ?? undefined,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    plans: Array.isArray(plan.plans) ? plan.plans.map(mapProductionPlan) : [],
  };
};

const queryWithLimit = (query?: WorkflowReportQuery) => ({
  limit: 100,
  ...query,
});

const normalizeDocumentType = (type: string): WorkflowDocumentType => {
  if (type.includes('Đề nghị')) return 'Đơn mua';
  if (type.includes('mua')) return 'Đơn mua';
  if (type.includes('nhập')) return 'Phiếu nhập';
  if (type.includes('xuất')) return 'Phiếu xuất';
  if (type.includes('hoàn')) return 'Phiếu trả';
  if (type.includes('Điều chỉnh')) return 'Điều chỉnh';
  if (type.includes('Yêu cầu')) return 'KHSX';
  return 'KHSX';
};

const mapDocument = (item: WorkflowDocumentDto): WorkflowDocument => {
  const laneId = ownerToLaneId(item.ownerLane);
  const type = normalizeDocumentType(item.documentType);
  const tone = toneFromStatus(item.status);

  return {
    id: item.documentCode || item.documentId,
    type,
    title: item.documentType,
    status: item.status,
    owner: item.ownerLane,
    summary: item.summary,
    route: item.route || routeByLaneId[laneId],
    tone,
    lines: [
      { label: 'Ngày', value: new Date(item.documentDate).toLocaleDateString('vi-VN') },
      ...(item.shiftName ? [{ label: 'Ca', value: item.shiftName }] : []),
    ],
  };
};

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

const mapDemandAggregateLine = (item: IngredientDemandAggregateReportDto): DemandLine => {
  const shortage = Math.max(item.suggestedPurchaseQty, 0);
  const serviceDate = item.requestDate?.split('T')[0];
  const isCancelled = item.hasCancelledLine;

  return {
    id: `aggregate-${serviceDate}-${item.ingredientId}-${item.unitId}`,
    ingredientId: item.ingredientId,
    serviceDate,
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.currentStockQty,
    reserved: 0,
    unit: item.unitName ?? '',
    source: `${item.lineCount} dòng nhu cầu trong ngày`,
    status: isCancelled ? 'Cần tạo lại demand' : shortage > 0 ? 'Thiếu nguyên liệu' : 'Tồn kho đủ',
    nextAction: isCancelled ? 'Tạo lại demand từ KHSX' : shortage > 0 ? 'Đề xuất mua thêm' : 'Tạo phiếu xuất kho',
    tone: isCancelled ? 'warning' : shortage > 0 ? 'danger' : 'success',
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

const normalizeWorkflowTone = (tone: string, status: string): WorkflowTone =>
  tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'neutral'
    ? tone
    : toneFromStatus(status);

const mapApprovalInboxItem = (item: ApprovalInboxItemDto): ApprovalRecord => ({
  id: item.inboxItemId || item.targetCode || item.targetId,
  targetType: item.targetType,
  targetId: item.targetId,
  targetCode: item.targetCode,
  type: item.itemType === 'price-alert' || item.itemType === 'price-exception' ? 'price-alert' : item.itemType === 'adjustment' ? 'adjustment' : item.itemType === 'issue' ? 'issue' : 'purchase',
  title: item.title,
  source: item.source || item.targetCode,
  owner: item.ownerRole,
  submittedBy: item.submittedBy,
  deadline: item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : 'Trong ca',
  status: item.status,
  reason: item.reason,
  nextAction: item.nextAction,
  tone: normalizeWorkflowTone(item.tone, item.status),
  slaDeadline: item.slaDeadline ?? undefined,
  slaHours: item.slaHours,
  route: item.route,
  weekStartDate: item.weekStartDate ?? undefined,
  serviceDate: item.serviceDate ?? undefined,
  scope: item.scope ?? undefined,
  lineCount: item.lineCount,
  totalQuantity: item.totalQuantity,
  totalValue: item.totalValue,
  submittedAt: item.submittedAt ?? undefined,
  referencePrice: item.referencePrice,
  proposedPrice: item.proposedPrice,
  variancePercent: item.variancePercent,
  evidenceType: item.evidenceType ?? undefined,
  evidenceId: item.evidenceId ?? undefined,
  evidenceDate: item.evidenceDate ?? undefined,
  proposalFingerprint: item.proposalFingerprint ?? undefined,
  proposalVersion: item.proposalVersion,
  supplierName: item.supplierName ?? undefined,
  sourceDocumentCode: item.sourceDocumentCode ?? undefined,
  materials: (item.materials ?? []).map((material) => ({ ...material })),
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
  id: `${item.receiptId}-${item.ingredientId}`,
  name: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
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
  id: `${item.issueId}-${item.ingredientId}`,
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

export const workflowApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWorkflowDocuments: builder.query<WorkflowDocument[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/workflow-documents',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<WorkflowDocumentDto[]>) => getData(response).map(mapDocument),
      providesTags: [workflowCacheTags.documents],
    }),
    getSuppliers: builder.query<SupplierDto[], void>({
      query: () => '/suppliers',
      transformResponse: (response: ApiResponse<SupplierDto[]>) => getData(response),
    }),
    getWarehouses: builder.query<PageNumberPage<WarehouseDto>, WarehousePageQuery | void>({
      query: (query) => ({
        url: '/warehouses',
        params: { pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 100 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<WarehouseDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false,
      },
    }),
    getWarehouseSelector: builder.query<WarehouseDto[], void>({
      query: () => '/warehouses/selector',
      transformResponse: (response: ApiResponse<WarehouseDto[]>) => getData(response),
    }),
    getPurchaseWorkbench: builder.query<PurchaseWorkbenchWeek, PurchaseWorkbenchQuery>({
      query: ({ week, date, stage, page = 1, pageSize = 8 }) => ({
        url: '/purchase-workflow/workbench',
        params: {
          week,
          ...(date ? { date } : {}),
          ...(stage ? { stage } : {}),
          page,
          pageSize,
        },
      }),
      transformResponse: (response: ApiResponse<PurchaseWorkbenchWeek>) => getData(response),
      providesTags: (_result, _error, { week }) => [
        workflowCacheTags.purchaseWorkbench,
        { type: 'WorkflowReports', id: `PurchaseWorkbench:${week}` },
      ],
    }),
    getSupplierEvidence: builder.query<SupplierEvidenceResult, SupplierEvidenceQuery>({
      query: ({ purchaseRequestId, purchaseRequestLineId }) =>
        `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier-evidence`,
      transformResponse: (response: ApiResponse<SupplierEvidenceResult>) => getData(response),
      providesTags: (_result, _error, { purchaseRequestId, purchaseRequestLineId }) => [
        workflowCacheTags.supplierEvidence,
        {
          type: 'WorkflowReports',
          id: `SupplierEvidence:${purchaseRequestId}:${purchaseRequestLineId}`,
        },
      ],
    }),
    confirmLineSupplier: builder.mutation<PurchaseLineSupplierDecision, ConfirmPurchaseLineSupplierRequest>({
      query: ({ purchaseRequestId, purchaseRequestLineId, data }) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier-decision`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<PurchaseLineSupplierDecision>) => getData(response),
      invalidatesTags: (_result, _error, { purchaseRequestId, purchaseRequestLineId, week }) => [
        workflowCacheTags.purchaseRequests,
        {
          type: 'WorkflowReports',
          id: `SupplierEvidence:${purchaseRequestId}:${purchaseRequestLineId}`,
        },
        { type: 'WorkflowReports', id: `PurchaseWorkbench:${week}` },
        workflowCacheTags.approvalInbox,
      ],
    }),
    recordWarehousePurchaseReceipt: builder.mutation<
      WarehousePurchaseReceiptResult,
      RecordWarehousePurchaseReceiptRequest
    >({
      query: ({ data }) => ({
        url: `/warehouse/purchase-orders/${data.purchaseOrderId}/receipts`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: (_result, _error, { data, week }) => [
        'PurchaseOrders',
        { type: 'PurchaseOrders', id: data.purchaseOrderId },
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
        ...(week
          ? [{ type: 'WorkflowReports' as const, id: `PurchaseWorkbench:${week}` }]
          : []),
      ],
    }),
    updatePurchaseRequestLineSupplier: builder.mutation<
      ApiResponse<void>,
      SupplierEvidenceQuery & { data: UpdatePurchaseRequestLineSupplierDto }
    >({
      query: ({ purchaseRequestId, purchaseRequestLineId, data }) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    getSupplierQuotationsByIngredient: builder.query<SupplierQuotationDto[], string>({
      query: (ingredientId) => `/supplier-quotations/ingredient/${ingredientId}`,
      transformResponse: (response: ApiResponse<SupplierQuotationDto[]>) => getData(response),
      providesTags: ['SupplierQuotations'],
    }),
    getSupplierQuotationsByIngredientPage: builder.query<PageNumberPage<SupplierQuotationDto>, SupplierQuotationPageQuery>({
      query: ({ ingredientId, pageNumber = 1, pageSize = 8 }) => ({
        url: `/supplier-quotations/ingredient/${ingredientId}/page`,
        params: { pageNumber, pageSize },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<SupplierQuotationDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['SupplierQuotations'],
    }),
    createSupplierQuotation: builder.mutation<SupplierQuotationDto, CreateSupplierQuotationDto>({
      query: (body) => ({
        url: '/supplier-quotations',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<SupplierQuotationDto>) => response.data!,
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    updateSupplierQuotation: builder.mutation<SupplierQuotationDto, UpdateSupplierQuotationArgs>({
      query: ({ quotationId, data }) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<SupplierQuotationDto>) => response.data!,
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    deactivateSupplierQuotation: builder.mutation<ApiResponse<void>, string>({
      query: (quotationId) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    getPurchaseOrders: builder.query<PurchaseOrderDto[], PurchaseOrderQuery | void>({
      query: (query) => ({
        url: '/purchase-orders',
        params: query?.status ? { status: query.status } : undefined,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto[]>) => getData(response),
      providesTags: ['PurchaseOrders'],
    }),
    getPurchaseOrdersPage: builder.query<PurchaseOrderPageResponse, PurchaseOrderPageQuery | void>({
      query: (query) => ({
        url: '/purchase-orders/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 6 },
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderPageResponse>) => response.data ?? {
        page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 6, totalPages: 0, hasPrev: false, hasNext: false },
        orderCountByRequest: {},
      },
      providesTags: ['PurchaseOrders'],
    }),
    createPurchaseOrdersFromRequest: builder.mutation<PurchaseOrderDto[], string>({
      query: (purchaseRequestId) => ({
        url: `/purchase-orders/from-request/${purchaseRequestId}`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto[]>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.documents,
      ],
    }),
    recordPurchaseOrderReceipt: builder.mutation<PurchaseOrderDto, RecordPurchaseOrderReceiptArgs>({
      query: ({ purchaseOrderId, data }) => ({
        url: `/purchase-orders/${purchaseOrderId}/receive`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto>) => response.data!,
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
      ],
    }),
    cancelPurchaseOrder: builder.mutation<PurchaseOrderDto, string>({
      query: (purchaseOrderId) => ({
        url: `/purchase-orders/${purchaseOrderId}/cancel`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto>) => response.data!,
      invalidatesTags: ['PurchaseOrders'],
    }),
    getIngredientDemand: builder.query<DemandLine[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IngredientDemandReportDto[]>) => getData(response).map(mapDemandLine),
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    generateMaterialDemand: builder.mutation<ApiResponse<MaterialDemandResultDto>, GenerateMaterialDemandRequest>({
      query: (body) => ({
        url: '/material-demand/generate',
        method: 'POST',
        body: {
          scope: 'FULLDAY',
          ...body,
        },
      }),
      invalidatesTags: [
        'MaterialDemandStaleness',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getMaterialDemandStaleness: builder.query<ApiResponse<MaterialDemandStaleness>, MaterialDemandStalenessQuery>({
      query: ({ serviceDate, customerId, scope }) => ({
        url: '/material-demand/staleness',
        params: { serviceDate, ...(customerId ? { customerId } : {}), ...(scope ? { scope } : {}) },
      }),
      providesTags: ['MaterialDemandStaleness'],
    }),
    createPurchaseRequestFromDemand: builder.mutation<ApiResponse<PurchaseRequestWorkflowResult>, GeneratePurchaseRequestFromDemandRequest>({
      query: (body) => ({
        url: '/purchase-workflow/from-demand',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.documents,
      ],
    }),
    submitPurchaseRequest: builder.mutation<ApiResponse<PurchaseRequestWorkflowResultDto>, string>({
      query: (purchaseRequestId) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.approvalInbox,
        workflowCacheTags.documents,
      ],
    }),
    createInventoryReceiptFromPurchase: builder.mutation<ApiResponse<InventoryReceiptCreatedResult>, CreateInventoryReceiptFromPurchaseRequest>({
      query: (body) => ({
        url: '/inventory-receipts/from-purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
      ],
    }),
    createInventoryIssue: builder.mutation<ApiResponse<InventoryIssueCreatedResult>, CreateInventoryIssueRequest>({
      query: (body) => ({
        url: '/inventory-issues',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.operationalKpis,
      ],
    }),
    createSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, CreateSupplementalMaterialRequest>({
      query: (body) => ({
        url: '/supplemental-material-requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getSupplementalMaterialRequests: builder.query<PageNumberPage<SupplementalMaterialRequestResult>, SupplementalMaterialRequestPageQuery | void>({
      query: (query) => ({
        url: '/supplemental-material-requests',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<SupplementalMaterialRequestResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.supplementalRequests],
    }),
    fulfillSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, FulfillSupplementalMaterialRequest>({
      query: ({ requestId, quantity }) => ({
        url: `/supplemental-material-requests/${requestId}/fulfill`,
        method: 'POST',
        body: { quantity },
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.documents,
      ],
    }),
    routeSupplementalMaterialRequestToPurchasing: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, string>({
      query: (requestId) => ({
        url: `/supplemental-material-requests/${requestId}/route-to-purchasing`,
        method: 'POST',
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.documents,
      ],
    }),
    rejectSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, RejectSupplementalMaterialRequest>({
      query: ({ requestId, reason }) => ({
        url: `/supplemental-material-requests/${requestId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.documents,
      ],
    }),
    createInventoryReturn: builder.mutation<ApiResponse<InventoryReturnCreatedResult>, CreateInventoryReturnRequest>({
      query: (body) => ({
        url: '/inventory-returns',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.inventoryReturns,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.issueUsage,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getInventoryReturns: builder.query<PageNumberPage<InventoryReturnResult>, InventoryReturnPageQuery | void>({
      query: (query) => ({
        url: '/inventory-returns',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<InventoryReturnResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.inventoryReturns],
    }),
    getInventoryReturnById: builder.query<InventoryReturnResult | undefined, string>({
      query: (returnId) => `/inventory-returns/${returnId}`,
      transformResponse: (response: ApiResponse<InventoryReturnResult>) => response.data,
      providesTags: [workflowCacheTags.inventoryReturns],
    }),
    confirmInventoryReturnReceipt: builder.mutation<ApiResponse<void>, ConfirmInventoryReturnReceiptRequest>({
      query: ({ returnId, ...body }) => ({
        url: `/inventory-returns/${returnId}/confirm-receipt`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.inventoryReturns,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.issueUsage,
        workflowCacheTags.documents,
      ],
    }),
    confirmInventoryIssueReceipt: builder.mutation<ApiResponse<InventoryIssueResult>, ConfirmInventoryIssueReceiptRequest>({
      query: ({ issueId, hasDiscrepancy = false, discrepancyNote }) => ({
        url: `/inventory-issues/${issueId}/confirm-receipt`,
        method: 'POST',
        body: {
          hasDiscrepancy,
          discrepancyNote,
        },
      }),
      invalidatesTags: [
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.documents,
      ],
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
    getPurchasePlanPage: builder.query<PageNumberPage<PurchasePlanRow> & { totalShortageQty: number; totalEstimatedAmount: number }, WorkflowReportPageQuery | void>({
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
    getIngredientDemandAggregatePage: builder.query<PageNumberPage<DemandLine> & { shortageCount: number }, WorkflowReportPageQuery | void>({
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
    getDailyProductionPlan: builder.query<DailyProductionPlan, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/production-plans/daily',
        params: query || undefined,
      }),
      transformResponse: normalizeDailyProductionPlan,
      providesTags: [workflowCacheTags.productionPlans],
    }),
    sendDailyProductionPlanToKitchen: builder.mutation<DailyProductionPlan, SendDailyProductionPlanRequest>({
      query: (body) => ({
        url: '/production-plans/daily/send-to-kitchen',
        method: 'POST',
        body,
      }),
      transformResponse: normalizeDailyProductionPlan,
      invalidatesTags: [
        workflowCacheTags.productionPlans,
        workflowCacheTags.documents,
        workflowCacheTags.kitchenIssues,
      ],
    }),
    getApprovalRecords: builder.query<ApprovalInboxPage, ApprovalInboxQuery | void>({
      query: (query) => ({
        url: '/approvals/inbox',
        params: {
          limit: query?.limit ?? 20,
          ...(query?.cursor ? { cursor: query.cursor } : {}),
        },
      }),
      transformResponse: (response: ApiResponse<ApprovalInboxPageDto>): ApprovalInboxPage => {
        const page = getData(response);
        return {
          items: (page.items ?? []).map(mapApprovalInboxItem),
          limit: page.limit,
          hasNext: page.hasNext,
          nextCursor: page.nextCursor,
        };
      },
      providesTags: (result) => [
        workflowCacheTags.approvalInbox,
        ...(result?.items ?? []).map((item) => ({
          type: 'WorkflowReports' as const,
          id: `ApprovalTarget:${item.targetType}:${item.targetId}`,
        })),
      ],
    }),
    executeApprovalDecision: builder.mutation<ApiResponse<unknown>, ApprovalDecisionRequest>({
      query: ({ targetType, targetId, status, reason }) => ({
        url: `/approvals/${targetType}/${targetId}`,
        method: 'POST',
        body: { status, reason },
      }),
      invalidatesTags: (_result, _error, { targetType, targetId, week }) => [
        workflowCacheTags.approvalInbox,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
        workflowCacheTags.purchaseRequests,
        { type: 'WorkflowReports', id: `ApprovalTarget:${targetType}:${targetId}` },
        ...(week
          ? [{ type: 'WorkflowReports' as const, id: `PurchaseWorkbench:${week}` }]
          : []),
      ],
    }),
    getStockMovements: builder.query<StockMovement[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockMovementViewDto[]>) => getData(response).map(mapStockMovement),
      providesTags: [workflowCacheTags.stockMovements],
    }),
    getStockMovementPage: builder.query<CursorPage<StockMovement>, WorkflowReportQuery | void>({
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
    getOperationalKpis: builder.query<OperationalKpiSummaryDto, void>({
      query: () => '/workflow-reports/operational-kpis',
      transformResponse: (response: ApiResponse<OperationalKpiSummaryDto>) => response.data!,
      providesTags: [
        'Coordination',
        'PurchaseOrders',
        workflowCacheTags.operationalKpis,
        ...workflowOperationalKpiSourceTags,
      ],
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
    getDataQualityPage: builder.query<DataQualityPageReport, WorkflowReportPageQuery | void>({
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
    getPurchaseRequests: builder.query<ApiResponse<PurchaseRequestResult[]>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests',
        params: query || undefined,
      }),
      providesTags: [workflowCacheTags.purchaseRequests],
    }),
    getPurchaseRequestsPage: builder.query<PageNumberPage<PurchaseRequestResult>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PurchaseRequestResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.purchaseRequests],
    }),
    getApprovalHistory: builder.query<ApiResponse<ApprovalHistoryItem[]>, ApprovalHistoryQuery>({
      query: ({ documentType, documentId }) => `/approval-history/${documentType}/${documentId}`,
      providesTags: [workflowCacheTags.approvalHistory],
    }),
    getApprovalRules: builder.query<ApiResponse<ApprovalRuleDto[]>, void>({
      query: () => '/approval-rules',
      providesTags: [workflowCacheTags.approvalRules],
    }),
    createApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, ApprovalRuleRequestDto>({
      query: (body) => ({
        url: '/approval-rules',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    updateApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, UpdateApprovalRuleArgs>({
      query: ({ id, body }) => ({
        url: `/approval-rules/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    deleteApprovalRule: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/approval-rules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWorkflowDocumentsQuery,
  useGetIngredientDemandQuery,
  useGetIngredientDemandPageQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetIngredientDemandAggregatePageQuery,
  useGenerateMaterialDemandMutation,
  useGetMaterialDemandStalenessQuery,
  useCreatePurchaseRequestFromDemandMutation,
  useSubmitPurchaseRequestMutation,
  useCreateInventoryReceiptFromPurchaseMutation,
  useCreateInventoryIssueMutation,
  useCreateSupplementalMaterialRequestMutation,
  useGetSupplementalMaterialRequestsQuery,
  useFulfillSupplementalMaterialRequestMutation,
  useRouteSupplementalMaterialRequestToPurchasingMutation,
  useRejectSupplementalMaterialRequestMutation,
  useCreateInventoryReturnMutation,
  useGetInventoryReturnsQuery,
  useGetInventoryReturnByIdQuery,
  useConfirmInventoryReturnReceiptMutation,
  useConfirmInventoryIssueReceiptMutation,
  useGetPurchasePlanQuery,
  useGetPurchasePlanPageQuery,
  useGetDailyProductionPlanQuery,
  useSendDailyProductionPlanToKitchenMutation,
  useGetApprovalRecordsQuery,
  useExecuteApprovalDecisionMutation,
  useGetStockMovementsQuery,
  useGetStockMovementPageQuery,
  useGetPriceVarianceQuery,
  useGetPriceVariancePageQuery,
  useGetPriceVarianceBySupplierQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVarianceByPeriodQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceByDishGroupQuery,
  useGetPriceVarianceByDishGroupPageQuery,
  useGetOperationalKpisQuery,
  useGetCurrentStockQuery,
  useGetCurrentStockPageQuery,
  useGetStockLedgerReconciliationQuery,
  useGetKitchenIssuesQuery,
  useGetKitchenIssuesPageQuery,
  useGetIssueVsReturnUsageQuery,
  useGetIssueVsReturnUsagePageQuery,
  useGetAuditChangesQuery,
  useGetAuditChangePageQuery,
  useGetSuppliersQuery,
  useGetWarehousesQuery,
  useGetWarehouseSelectorQuery,
  useGetPurchaseWorkbenchQuery,
  useGetSupplierEvidenceQuery,
  useConfirmLineSupplierMutation,
  useRecordWarehousePurchaseReceiptMutation,
  useUpdatePurchaseRequestLineSupplierMutation,
  useGetDataQualityQuery,
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
  useGetSupplierQuotationsByIngredientQuery,
  useGetSupplierQuotationsByIngredientPageQuery,
  useCreateSupplierQuotationMutation,
  useUpdateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrdersPageQuery,
  useCreatePurchaseOrdersFromRequestMutation,
  useRecordPurchaseOrderReceiptMutation,
  useCancelPurchaseOrderMutation,
  useGetPurchaseRequestsQuery,
  useGetPurchaseRequestsPageQuery,
  useGetApprovalHistoryQuery,
  useGetApprovalRulesQuery,
  useCreateApprovalRuleMutation,
  useUpdateApprovalRuleMutation,
  useDeleteApprovalRuleMutation,
} = workflowApi;

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
