import type { components } from '@/shared/api/contracts/schema';
import type { PageNumberPage } from './workflowApiTypes';

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
  sourceCustomerName?: string;
  sourceShiftName?: string;
  sourcePriceTierAmount?: number;
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
  categoryCode: string;
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
  actionLabel: string;
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
