import { apiSlice } from '@/api/apiSlice';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import type { ApiResponse } from '@/types/api';
import {
  ownerToLaneId,
  routeByLaneId,
  toneFromStatus,
  workflowLaneDefinitions,
} from './workflowConfig';
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
} from './types';

export interface WorkflowReportQuery {
  serviceDate?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  warehouseId?: string;
  ingredientId?: string;
  supplierId?: string;
  shiftName?: string;
  cursorDate?: string;
  cursorId?: string;
  limit?: number;
  sortDirection?: 'asc' | 'desc';
  actor?: string;
  businessArea?: string;
  movementType?: string;
  entityName?: string;
  fieldName?: string;
  groupBy?: 'day' | 'week';
  priceTier?: number;
  warningOnly?: boolean;
}

export interface WorkflowReportPageQuery extends WorkflowReportQuery {
  pageNumber?: number;
  pageSize?: number;
}

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
}

export interface ApprovalInboxQuery {
  limit?: number;
  cursor?: string;
}

export interface ApprovalInboxPage {
  items: ApprovalRecord[];
  limit: number;
  hasNext: boolean;
  nextCursor?: string | null;
}

export interface PurchaseRequestQuery {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface PurchaseRequestResult {
  purchaseRequestId: string;
  purchaseRequestCode: string;
  materialRequestId: string;
  purchaseForDate: string;
  shiftName?: string;
  status: string;
  lines: Array<{
    purchaseRequestLineId: string;
    materialRequestLineId: string;
    ingredientId: string;
    ingredientName: string;
    supplierId: string;
    supplierName: string;
    unitId: string;
    unitName: string;
    requiredQty: number;
    currentStockQty: number;
    purchaseQty: number;
    estimatedUnitPrice: number;
    expectedDeliveryDate?: string;
    note?: string;
  }>;
}

export interface ApprovalHistoryItem {
  historyId: string;
  targetType: string;
  targetId: string;
  decision: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  actionBy: string;
  actionByName: string;
  actionAt: string;
}

export interface CreateInventoryReceiptFromPurchaseLineRequest {
  purchaseRequestLineId: string;
  unitId: string;
  receivedQty: number;
  unitPrice?: number;
  lotNumber?: string;
  manufactureDate?: string;
  expiredDate?: string;
}

export interface CreateInventoryReceiptFromPurchaseRequest {
  purchaseRequestId: string;
  receiptDate: string;
  supplierId: string;
  warehouseId: string;
  lines: CreateInventoryReceiptFromPurchaseLineRequest[];
}

export interface InventoryReceiptCreatedResult {
  receiptId: string;
  receiptCode: string;
}

export interface CreateInventoryIssueLineRequest {
  ingredientId: string;
  requestedQty: number;
  issuedQty: number;
  unitId: string;
}

export interface CreateInventoryIssueRequest {
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  materialRequestId: string;
  receivedBy?: string;
  lines: CreateInventoryIssueLineRequest[];
}

export interface InventoryIssueCreatedResult {
  issueId: string;
  issueCode: string;
}

export interface CreateInventoryReturnLineRequest {
  ingredientId: string;
  quantity: number;
  unitId: string;
}

export interface CreateInventoryReturnRequest {
  returnDate: string;
  shiftName?: string;
  returnType?: 'RETURN' | 'WASTE';
  warehouseId: string;
  issueId: string;
  reason: string;
  lines: CreateInventoryReturnLineRequest[];
}

export interface InventoryReturnCreatedResult {
  returnId: string;
  returnCode: string;
}

export interface ConfirmInventoryIssueReceiptRequest {
  issueId: string;
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
}

export interface InventoryIssueResult {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  warehouseName?: string;
  materialRequestId: string;
  issuedBy: string;
  issuedByName?: string;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  createdAt: string;
}

interface WorkflowDocumentDto {
  documentId: string;
  documentCode: string;
  documentType: string;
  documentDate: string;
  shiftName?: string;
  status: string;
  ownerLane: string;
  route: string;
  summary: string;
}

interface IngredientDemandReportDto {
  materialRequestId: string;
  materialRequestCode: string;
  requestDate: string;
  status: string;
  shiftName?: string;
  customerName?: string;
  dishName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  bomId?: string | null;
  priceTierAmount?: number;
  bomScope?: string;
  totalServings: number;
  bomRatePercent?: number;
  appliedPortionRuleId?: string | null;
  appliedPortionRuleSource?: string;
  appliedPortionRatePercent?: number;
  yieldLossPercent?: number | null;
  totalRequiredQty: number;
  currentStockQty: number;
  suggestedPurchaseQty: number;
}

interface IngredientDemandPageResponseDto {
  items: IngredientDemandReportDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  shortageCount: number;
}

interface IngredientDemandAggregateReportDto {
  requestDate: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  totalRequiredQty: number;
  currentStockQty: number;
  suggestedPurchaseQty: number;
  lineCount: number;
  hasCancelledLine: boolean;
}

interface IngredientDemandAggregatePageResponseDto {
  items: IngredientDemandAggregateReportDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  shortageCount: number;
}

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

interface PurchasePlanPageResponseDto {
  items: PurchasePlanRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalShortageQty: number;
  totalEstimatedAmount: number;
}

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

export interface SendDailyProductionPlanRequest {
  serviceDate: string;
  customerId?: string;
  shiftName?: string;
  reason?: string;
}

interface ApprovalInboxItemDto {
  inboxItemId: string;
  targetType: string;
  targetId: string;
  targetCode: string;
  itemType: string;
  title: string;
  source: string;
  ownerRole: string;
  submittedBy: string;
  dueDate?: string | null;
  status: string;
  reason: string;
  nextAction: string;
  tone: WorkflowTone;
  route: string;
  slaDeadline?: string | null;
  slaHours?: number | null;
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export interface ApprovalRuleDto {
  ruleId?: string;
  ruleName: string;
  documentType: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  slaHours?: number | null;
  isActive: boolean;
  createdAt?: string;
  approvalassignments?: ApprovalAssignmentDto[];
}

export interface ApprovalAssignmentDto {
  assignmentId?: string;
  ruleId?: string;
  sequence: number;
  approverRole: string;
  approverUserId?: string | null;
  isRequired: boolean;
  approverUser?: {
    userId: string;
    fullName: string;
    username: string;
  } | null;
}

export interface ApprovalAssignmentRequestDto {
  sequence: number;
  approverRole: string;
  approverUserId?: string | null;
  isRequired: boolean;
}

export interface ApprovalRuleRequestDto {
  ruleName: string;
  documentType: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  slaHours?: number | null;
  isActive: boolean;
  assignments: ApprovalAssignmentRequestDto[];
}

interface StockMovementViewDto {
  movementId: string;
  movementDate: string;
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  movementType: string;
  quantityIn: number;
  quantityOut: number;
  beforeQty?: number;
  afterQty?: number;
  refTable?: string;
  refId?: string;
  reason?: string;
  note?: string;
}

interface StockLedgerReconciliationDto {
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  currentQty: number;
  ledgerQty: number;
  differenceQty: number;
  isMatched: boolean;
  lastMovementAt?: string;
}

export interface SupplierDto {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
}

export interface UpdatePurchaseRequestLineSupplierDto {
  supplierId: string;
  estimatedUnitPrice: number;
  expectedDeliveryDate?: string | null;
  note?: string | null;
}

export interface SupplierQuotationDto {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  ingredientId: string;
  ingredientName: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
  isActive: boolean;
  isBestPrice: boolean;
}

export interface CreateSupplierQuotationDto {
  supplierId: string;
  ingredientId: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
}

export interface UpdateSupplierQuotationDto {
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
  isActive: boolean;
}

export interface PurchaseOrderLineDto {
  purchaseOrderLineId: string;
  purchaseRequestLineId: string;
  ingredientId: string;
  ingredientName: string;
  unitId: string;
  unitName: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
}

export interface PurchaseOrderDto {
  purchaseOrderId: string;
  purchaseOrderCode: string;
  purchaseRequestId: string;
  purchaseRequestCode: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  status: string;
  lines: PurchaseOrderLineDto[];
}

interface ApprovalInboxPageDto {
  items: ApprovalInboxItemDto[];
  limit: number;
  hasNext: boolean;
  nextCursor?: string | null;
}

export interface PurchaseOrderPageResponse {
  page: PageNumberPage<PurchaseOrderDto>;
  orderCountByRequest: Record<string, number>;
}

export interface RecordPurchaseOrderReceiptLineDto {
  purchaseOrderLineId: string;
  receivedQty: number;
}

export interface RecordPurchaseOrderReceiptDto {
  warehouseId: string;
  lines: RecordPurchaseOrderReceiptLineDto[];
}

interface ReceiptPriceVarianceReportDto {
  receiptId: string;
  receiptCode: string;
  receiptDate: string;
  supplierId: string;
  supplierName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  referencePrice: number;
  variancePercent: number;
  isWarning: boolean;
}

export interface PriceVarianceBySupplierDto {
  ingredientId: string;
  ingredientName?: string;
  supplierId: string;
  supplierName?: string;
  receiptCount: number;
  avgUnitPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  referencePrice: number;
  variancePercent: number;
  isWarning: boolean;
}

export interface PriceVarianceByPeriodDto {
  ingredientId: string;
  ingredientName?: string;
  periodLabel: string;
  periodStart: string;
  avgUnitPrice: number;
  referencePrice: number;
  variancePercentVsReference: number;
  variancePercentVsPreviousPeriod?: number | null;
  isWarning: boolean;
}

export interface PriceVarianceDishGroupIngredientDto {
  ingredientName: string;
  variancePercent: number;
  weight: number;
}

export interface PriceVarianceByDishGroupDto {
  dishGroup: string;
  ingredientCount: number;
  warningIngredientCount: number;
  weightedAvgVariancePercent: number;
  topIngredients: PriceVarianceDishGroupIngredientDto[];
}

export interface OperationalKpiSummaryDto {
  shortageCount: number;
  lowStockCount: number;
  overduePurchaseRequestCount: number;
  lateReceiptCount: number;
  pendingKitchenConfirmationCount: number;
  failedWorkflowCount: number;
  criticalDataQualityCount: number;
  overdueApprovalCount: number;
  totalKitchenIssuedQty: number;
  totalKitchenUsedQty: number;
  totalKitchenReturnedQty: number;
  generatedAt: string;
}

interface CurrentStockSummaryDto {
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  currentQty: number;
  lastUpdated: string;
}

interface KitchenIssueReportDto {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  requestedQty: number;
  issuedQty: number;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  isReceivedByKitchen: boolean;
  receiptStatus: string;
}

interface IssueVsReturnUsageReportDto {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  issuedQty: number;
  returnedQty: number;
  wastedQty: number;
  usedQty: number;
  varianceQty: number;
}

interface AuditChangeReportDto {
  auditId: string;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
  businessArea: string;
  entityName: string;
  entityId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}

interface DataQualityIssueDto {
  issueId: string;
  category: string;
  severity: 'error' | 'warning' | string;
  owner?: string;
  priorityRank?: number;
  slaHours?: number;
  slaDueAt?: string;
  slaLabel?: string;
  entityName: string;
  entityId?: string;
  entityCode: string;
  entityLabel: string;
  message: string;
  suggestedAction: string;
  route: string;
  remediationStatus?: 'open' | 'resolved' | 'reopened' | string;
  remediationAt?: string;
  remediationByName?: string;
  remediationNote?: string;
}

interface DataQualityReportDto {
  generatedAt: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  resolvedIssueCount?: number;
  reopenedIssueCount?: number;
  urgentIssueCount?: number;
  missingBomCount: number;
  invalidUnitCount: number;
  missingConversionCount: number;
  negativeStockCount: number;
  orphanDocumentCount: number;
  issues: DataQualityIssueDto[];
}

interface PageNumberPageDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface DataQualityPageDto extends DataQualityReportDto {
  page: PageNumberPageDto<DataQualityIssueDto>;
}

interface MissingBomDishDto {
  dishId: string;
  dishCode: string;
  dishName: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  menuId: string;
  menuName: string;
  shiftName: string;
  totalServings: number;
  message: string;
}

interface MissingUnitConversionIssueDto {
  issueId: string;
  ingredientId: string;
  ingredientName: string;
  sourceUnitId: string;
  sourceUnitName: string;
  targetUnitId: string;
  targetUnitName: string;
  message: string;
}

interface MaterialDemandResultDto {
  materialRequestId: string;
  requestCode: string;
  serviceDate: string;
  scope: string;
  status: string;
  productionPlanLineCount: number;
  lines: Array<{
    materialRequestLineId: string;
    ingredientId: string;
    ingredientName: string;
    unitId: string;
    unitName: string;
    dishId: string;
    dishName: string;
    shiftName: string;
    totalServings: number;
    grossQtyPerServing: number;
    bomRatePercent: number;
    appliedPortionRuleId?: string | null;
    appliedPortionRuleSource?: string;
    appliedPortionRatePercent?: number;
    yieldLossPercent?: number | null;
    totalRequiredQty: number;
    currentStockQty: number;
    suggestedPurchaseQty: number;
  }>;
  missingBomDishes: MissingBomDishDto[];
  missingConversionIssues: MissingUnitConversionIssueDto[];
}

export interface GenerateMaterialDemandRequest {
  serviceDate: string;
  customerId?: string;
  shiftName?: string;
  scope?: 'FULLDAY' | 'MORNING' | 'AFTERNOON';
}

export interface MaterialDemandStalenessQuery {
  serviceDate: string;
  customerId?: string;
  scope?: 'FULLDAY' | 'MORNING' | 'AFTERNOON';
}

export interface MaterialDemandStaleness {
  hasExistingPlan: boolean;
  isStale: boolean;
  lastGeneratedAt?: string | null;
  reasons: string[];
}

interface PurchaseRequestWorkflowResultDto {
  purchaseRequestId: string;
  purchaseRequestCode: string;
  materialRequestId: string;
  purchaseForDate: string;
  shiftName?: string;
  status: string;
  lines: Array<{
    purchaseRequestLineId: string;
    materialRequestLineId: string;
    ingredientId: string;
    ingredientName: string;
    supplierId: string;
    supplierName: string;
    unitId: string;
    unitName: string;
    requiredQty: number;
    currentStockQty: number;
    purchaseQty: number;
    estimatedUnitPrice: number;
  }>;
}

export interface ApprovalDecisionRequest {
  targetType: string;
  targetId: string;
  status: 'Approve' | 'Reject';
  reason?: string | null;
}

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
  ingredient: string;
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

export interface DataQualityIssueRemediationRequest {
  issueId: string;
  action: 'resolve' | 'reopen';
  note?: string;
}

interface CursorPageDto<T> {
  items?: T[];
  limit: number;
  hasNext: boolean;
  nextCursorDate?: string;
  nextCursorId?: string;
}

export interface DataQualityIssueRemediationResult {
  issueId: string;
  remediationStatus: 'resolved' | 'reopened';
  remediationAt: string;
  note?: string;
}

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

const normalizeDailyProductionPlan = (response: ApiResponse<DailyProductionPlan> | DailyProductionPlan | unknown): DailyProductionPlan => {
  const maybeData =
    response && typeof response === 'object' && 'data' in response
      ? (response as ApiResponse<DailyProductionPlan>).data
      : response;

  if (!maybeData || typeof maybeData !== 'object' || Array.isArray(maybeData)) {
    return emptyDailyProductionPlan();
  }

  const plan = maybeData as Partial<DailyProductionPlan>;
  return {
    ...emptyDailyProductionPlan(),
    ...plan,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    plans: Array.isArray(plan.plans) ? plan.plans : [],
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
  const isCancelled = item.status?.toUpperCase() === 'CANCELLED';
  const tone: WorkflowTone = isCancelled ? 'warning' : shortage > 0 ? 'danger' : 'success';

  return {
    id: `${item.materialRequestId}-${item.ingredientId}`,
    materialRequestId: item.materialRequestId,
    ingredientId: item.ingredientId,
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
    status: isCancelled ? 'Cần tạo lại demand' : shortage > 0 ? 'Thiếu nguyên liệu' : 'Tồn kho đủ',
    nextAction: isCancelled ? 'Import menu đã thay đổi, tạo lại demand từ KHSX' : shortage > 0 ? 'Đề xuất mua thêm' : 'Tạo phiếu xuất kho',
    tone,
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

const mapApprovalInboxItem = (item: ApprovalInboxItemDto): ApprovalRecord => ({
  id: item.inboxItemId || item.targetCode || item.targetId,
  targetType: item.targetType,
  targetId: item.targetId,
  type: item.itemType === 'price-alert' ? 'price-alert' : item.itemType === 'adjustment' ? 'adjustment' : item.itemType === 'issue' ? 'issue' : 'purchase',
  title: item.title,
  source: item.source || item.targetCode,
  owner: item.ownerRole,
  submittedBy: item.submittedBy,
  deadline: item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : 'Trong ca',
  status: item.status,
  reason: item.reason,
  nextAction: item.nextAction,
  tone: item.tone ?? toneFromStatus(item.status),
  slaDeadline: item.slaDeadline,
  slaHours: item.slaHours,
  materials: item.materials ?? [],
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
  ingredient: item.ingredientName ?? item.ingredientId,
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
  lastMovementAt: item.lastMovementAt,
});

const mapKitchenIssue = (item: KitchenIssueReportDto): KitchenIssueRow => ({
  id: `${item.issueId}-${item.ingredientId}`,
  issueId: item.issueId,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName,
  warehouseId: item.warehouseId,
  warehouse: item.warehouseName ?? item.warehouseId,
  ingredientId: item.ingredientId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unitId: item.unitId,
  unit: item.unitName ?? '',
  requestedQty: item.requestedQty,
  issuedQty: item.issuedQty,
  receivedBy: item.receivedBy,
  receivedByName: item.receivedByName,
  receivedAt: item.receivedAt,
  isReceivedByKitchen: item.isReceivedByKitchen,
  receiptStatus: item.receiptStatus,
});

const mapUsageReport = (item: IssueVsReturnUsageReportDto): UsageReportRow => ({
  id: `${item.issueId}-${item.ingredientId}`,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName,
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
  nextCursorDate: page.nextCursorDate,
  nextCursorId: page.nextCursorId,
});

const mapPageNumberPage = <TDto, TRow>(
  page: PageNumberPage<TDto>,
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
  slaDueAt: issue.slaDueAt,
  slaLabel: issue.slaLabel ?? (issue.severity === 'error' ? 'P2 / 8h' : 'P4 / 48h'),
  entityName: issue.entityName,
  entityId: issue.entityId,
  entityCode: issue.entityCode,
  entityLabel: issue.entityLabel,
  message: issue.message,
  suggestedAction: issue.suggestedAction,
  route: issue.route,
  remediationStatus: issue.remediationStatus === 'resolved' ? 'resolved' : issue.remediationStatus === 'reopened' ? 'reopened' : 'open',
  remediationAt: issue.remediationAt,
  remediationByName: issue.remediationByName,
  remediationNote: issue.remediationNote,
});

const mapDataQualityReport = (item: DataQualityReportDto): DataQualityReport => ({
  generatedAt: item.generatedAt,
  totalIssues: item.totalIssues,
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
      providesTags: ['WorkflowReports'],
    }),
    getSuppliers: builder.query<SupplierDto[], void>({
      query: () => '/suppliers',
      transformResponse: (response: ApiResponse<SupplierDto[]>) => getData(response),
    }),
    updatePurchaseRequestLineSupplier: builder.mutation<
      ApiResponse<void>,
      { purchaseRequestId: string; purchaseRequestLineId: string; data: UpdatePurchaseRequestLineSupplierDto }
    >({
      query: ({ purchaseRequestId, purchaseRequestLineId, data }) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    getSupplierQuotationsByIngredient: builder.query<SupplierQuotationDto[], string>({
      query: (ingredientId) => `/supplier-quotations/ingredient/${ingredientId}`,
      transformResponse: (response: ApiResponse<SupplierQuotationDto[]>) => getData(response),
      providesTags: ['SupplierQuotations'],
    }),
    getSupplierQuotationsByIngredientPage: builder.query<PageNumberPage<SupplierQuotationDto>, { ingredientId: string; pageNumber?: number; pageSize?: number }>({
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
      invalidatesTags: ['SupplierQuotations'],
    }),
    updateSupplierQuotation: builder.mutation<SupplierQuotationDto, { quotationId: string; data: UpdateSupplierQuotationDto }>({
      query: ({ quotationId, data }) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<SupplierQuotationDto>) => response.data!,
      invalidatesTags: ['SupplierQuotations'],
    }),
    deactivateSupplierQuotation: builder.mutation<ApiResponse<void>, string>({
      query: (quotationId) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SupplierQuotations'],
    }),
    getPurchaseOrders: builder.query<PurchaseOrderDto[], { status?: string } | void>({
      query: (query) => ({
        url: '/purchase-orders',
        params: query?.status ? { status: query.status } : undefined,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto[]>) => getData(response),
      providesTags: ['PurchaseOrders'],
    }),
    getPurchaseOrdersPage: builder.query<PurchaseOrderPageResponse, { status?: string; pageNumber?: number; pageSize?: number } | void>({
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
      invalidatesTags: ['PurchaseOrders', 'WorkflowReports'],
    }),
    recordPurchaseOrderReceipt: builder.mutation<PurchaseOrderDto, { purchaseOrderId: string; data: RecordPurchaseOrderReceiptDto }>({
      query: ({ purchaseOrderId, data }) => ({
        url: `/purchase-orders/${purchaseOrderId}/receive`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto>) => response.data!,
      invalidatesTags: ['PurchaseOrders', 'WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
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
      invalidatesTags: ['WorkflowReports', 'MaterialDemandStaleness'],
    }),
    getMaterialDemandStaleness: builder.query<ApiResponse<MaterialDemandStaleness>, MaterialDemandStalenessQuery>({
      query: ({ serviceDate, customerId, scope }) => ({
        url: '/material-demand/staleness',
        params: { serviceDate, ...(customerId ? { customerId } : {}), ...(scope ? { scope } : {}) },
      }),
      providesTags: ['MaterialDemandStaleness'],
    }),
    submitPurchaseRequest: builder.mutation<ApiResponse<PurchaseRequestWorkflowResultDto>, string>({
      query: (purchaseRequestId) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    createInventoryReceiptFromPurchase: builder.mutation<ApiResponse<InventoryReceiptCreatedResult>, CreateInventoryReceiptFromPurchaseRequest>({
      query: (body) => ({
        url: '/inventory-receipts/from-purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    createInventoryIssue: builder.mutation<ApiResponse<InventoryIssueCreatedResult>, CreateInventoryIssueRequest>({
      query: (body) => ({
        url: '/inventory-issues',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    createInventoryReturn: builder.mutation<ApiResponse<InventoryReturnCreatedResult>, CreateInventoryReturnRequest>({
      query: (body) => ({
        url: '/inventory-returns',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
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
      invalidatesTags: ['WorkflowReports'],
    }),
    getPurchasePlan: builder.query<PurchasePlanRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-plan',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PurchasePlanRow[]>) => response.data ?? [],
      providesTags: ['WorkflowReports'],
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
          items: page?.items ?? [],
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
      providesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
    }),
    getDailyProductionPlan: builder.query<DailyProductionPlan, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/production-plans/daily',
        params: query || undefined,
      }),
      transformResponse: normalizeDailyProductionPlan,
      providesTags: ['WorkflowReports'],
    }),
    sendDailyProductionPlanToKitchen: builder.mutation<DailyProductionPlan, SendDailyProductionPlanRequest>({
      query: (body) => ({
        url: '/production-plans/daily/send-to-kitchen',
        method: 'POST',
        body,
      }),
      transformResponse: normalizeDailyProductionPlan,
      invalidatesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
    }),
    executeApprovalDecision: builder.mutation<ApiResponse<unknown>, ApprovalDecisionRequest>({
      query: ({ targetType, targetId, status, reason }) => ({
        url: `/approvals/${targetType}/${targetId}`,
        method: 'POST',
        body: { status: status === 'Approve' ? 0 : 1, reason },
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    getStockMovements: builder.query<StockMovement[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockMovementViewDto[]>) => getData(response).map(mapStockMovement),
      providesTags: ['WorkflowReports'],
    }),
    getStockMovementPage: builder.query<CursorPage<StockMovement>, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<StockMovementViewDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false }, mapStockMovement),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVariance: builder.query<PriceVarianceRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<ReceiptPriceVarianceReportDto[]>) => getData(response).map(mapPriceVariance),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceBySupplier: builder.query<PriceVarianceBySupplierDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceBySupplierDto[]>) => getData(response),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceBySupplierPage: builder.query<PageNumberPage<PriceVarianceBySupplierDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceBySupplierDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceByPeriod: builder.query<PriceVarianceByPeriodDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByPeriodDto[]>) => getData(response),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceByPeriodPage: builder.query<PageNumberPage<PriceVarianceByPeriodDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByPeriodDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceByDishGroup: builder.query<PriceVarianceByDishGroupDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByDishGroupDto[]>) => getData(response),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVarianceByDishGroupPage: builder.query<PageNumberPage<PriceVarianceByDishGroupDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByDishGroupDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['WorkflowReports'],
    }),
    getOperationalKpis: builder.query<OperationalKpiSummaryDto, void>({
      query: () => '/workflow-reports/operational-kpis',
      transformResponse: (response: ApiResponse<OperationalKpiSummaryDto>) => response.data!,
      providesTags: ['WorkflowReports'],
    }),
    getCurrentStock: builder.query<CurrentStockRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<CurrentStockSummaryDto[]>) => getData(response).map(mapCurrentStock),
      providesTags: ['WorkflowReports'],
    }),
    getStockLedgerReconciliation: builder.query<StockLedgerReconciliationRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-ledger-reconciliation',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockLedgerReconciliationDto[]>) => getData(response).map(mapStockLedgerReconciliation),
      providesTags: ['WorkflowReports'],
    }),
    getKitchenIssues: builder.query<KitchenIssueRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<KitchenIssueReportDto[]>) => getData(response).map(mapKitchenIssue),
      providesTags: ['WorkflowReports'],
    }),
    getKitchenIssuesPage: builder.query<PageNumberPage<KitchenIssueRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<KitchenIssueReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapKitchenIssue),
      providesTags: ['WorkflowReports'],
    }),
    getIssueVsReturnUsage: builder.query<UsageReportRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IssueVsReturnUsageReportDto[]>) => getData(response).map(mapUsageReport),
      providesTags: ['WorkflowReports'],
    }),
    getIssueVsReturnUsagePage: builder.query<PageNumberPage<UsageReportRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<IssueVsReturnUsageReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapUsageReport),
      providesTags: ['WorkflowReports'],
    }),
    getAuditChanges: builder.query<AuditLogRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<AuditChangeReportDto[]>) => getData(response).map(mapAuditChange),
      providesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
    }),
    getAuditChangePage: builder.query<CursorPage<AuditLogRow>, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<AuditChangeReportDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false }, mapAuditChange),
      providesTags: ['WorkflowReports'],
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
      providesTags: ['WorkflowReports'],
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
          return { ...mapDataQualityReport({ generatedAt: '', totalIssues: 0, errorCount: 0, warningCount: 0, missingBomCount: 0, invalidUnitCount: 0, missingConversionCount: 0, negativeStockCount: 0, orphanDocumentCount: 0, issues: [] }), page: emptyPage };
        }
        return {
          ...mapDataQualityReport(report),
          page: mapPageNumberPage(report.page ?? emptyPage, mapDataQualityIssue),
        };
      },
      providesTags: ['WorkflowReports'],
    }),
    updateDataQualityIssueRemediation: builder.mutation<ApiResponse<DataQualityIssueRemediationResult>, DataQualityIssueRemediationRequest>({
      query: (body) => ({
        url: '/workflow-reports/data-quality/issues/remediation',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    getPurchaseRequests: builder.query<ApiResponse<PurchaseRequestResult[]>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests',
        params: query || undefined,
      }),
      providesTags: ['WorkflowReports'],
    }),
    getPurchaseRequestsPage: builder.query<PageNumberPage<PurchaseRequestResult>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PurchaseRequestResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['WorkflowReports'],
    }),
    getApprovalHistory: builder.query<ApiResponse<ApprovalHistoryItem[]>, { documentType: string; documentId: string }>({
      query: ({ documentType, documentId }) => `/approval-history/${documentType}/${documentId}`,
      providesTags: ['WorkflowReports'],
    }),
    getApprovalRules: builder.query<ApiResponse<ApprovalRuleDto[]>, void>({
      query: () => '/approval-rules',
      providesTags: ['WorkflowReports'],
    }),
    createApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, ApprovalRuleRequestDto>({
      query: (body) => ({
        url: '/approval-rules',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    updateApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, { id: string; body: ApprovalRuleRequestDto }>({
      query: ({ id, body }) => ({
        url: `/approval-rules/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    deleteApprovalRule: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/approval-rules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWorkflowDocumentsQuery,
  useGetIngredientDemandQuery,
  useGetIngredientDemandPageQuery,
  useGetIngredientDemandAggregatePageQuery,
  useGenerateMaterialDemandMutation,
  useGetMaterialDemandStalenessQuery,
  useSubmitPurchaseRequestMutation,
  useCreateInventoryReceiptFromPurchaseMutation,
  useCreateInventoryIssueMutation,
  useCreateInventoryReturnMutation,
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

export function useWorkflowOverview() {
  const documentsResult = useGetWorkflowDocumentsQuery({ limit: 100 });
  const demandResult = useGetIngredientDemandQuery({ limit: 100 });
  const priceResult = useGetPriceVarianceQuery({ limit: 100 });
  const movementsResult = useGetStockMovementsQuery({ limit: 100 });

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
