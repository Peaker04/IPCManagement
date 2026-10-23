import { apiClient } from './client';

export interface ReconciliationDisposition {
  category: string;
  reason: string;
  version: number;
  disposedAt: string;
}

export interface ReconciliationLineItem {
  id: string;
  dailyLineId?: string;
  serviceDate?: string;
  ingredientId: string;
  materialCode: string;
  materialName: string;
  unitId: string;
  unit: string;
  requiredQuantity: number;
  issuedQuantity?: number;
  issuedRequiredDifference?: number;
  status: string;
  version: number;
  triggers: string[];
  disposition?: ReconciliationDisposition;
  notes: string[];
}

export interface ReconciliationBatchSummary {
  batchId: string;
  customerId?: string;
  customerCode: string;
  customerName: string;
  weekStartDate?: string;
  weekEndDate?: string;
  status: string;
  version: number;
  weeklyStatus?: string;
  lines: ReconciliationLineItem[];
}

export interface RawReconciliationLineDto {
  batchLineId: string;
  dailyLineId?: string;
  serviceDate?: string;
  ingredientId: string;
  ingredientCode?: string;
  ingredientName?: string;
  canonicalUnitId: string;
  canonicalUnitName?: string;
  requiredQuantity: number;
  issuedQuantity?: number;
  issuedRequiredDifference?: number;
  triggers: string[];
  status: string;
  version: number;
  disposition?: ReconciliationDisposition;
  issueNotes?: string[];
}

export interface RawReconciliationBatchDto {
  batchId: string;
  menuVersionId: string;
  quantityImportBatchId: string;
  status: string;
  version: number;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  lines: RawReconciliationLineDto[];
  dailyReview?: {
    weeklyStatus: string;
    lines: RawReconciliationLineDto[];
  };
}

function mapLine(line: RawReconciliationLineDto): ReconciliationLineItem {
  return {
    id: line.batchLineId,
    dailyLineId: line.dailyLineId,
    serviceDate: line.serviceDate,
    ingredientId: line.ingredientId,
    materialCode: line.ingredientCode || line.ingredientId,
    materialName: line.ingredientName || '—',
    unitId: line.canonicalUnitId,
    unit: line.canonicalUnitName || '—',
    requiredQuantity: line.requiredQuantity,
    issuedQuantity: line.issuedQuantity,
    issuedRequiredDifference: line.issuedRequiredDifference,
    status: line.status,
    version: line.version,
    triggers: line.triggers,
    disposition: line.disposition,
    notes: line.issueNotes || [],
  };
}

function mapBatch(batch: RawReconciliationBatchDto, serviceDate?: string): ReconciliationBatchSummary {
  const sourceLines = batch.dailyReview?.lines || batch.lines;
  const lines = serviceDate
    ? sourceLines.filter((line) => line.serviceDate === serviceDate)
    : sourceLines;

  return {
    batchId: batch.batchId,
    customerId: batch.customerId,
    customerCode: batch.customerCode || '—',
    customerName: batch.customerName || '—',
    weekStartDate: batch.weekStartDate,
    weekEndDate: batch.weekEndDate,
    status: batch.status,
    version: batch.version,
    weeklyStatus: batch.dailyReview?.weeklyStatus,
    lines: lines.map(mapLine),
  };
}

export const reconciliationApi = {
  async getReconciliationSummary(
    batchId: string,
    serviceDate?: string
  ): Promise<ReconciliationBatchSummary> {
    const batch = await apiClient<RawReconciliationBatchDto>(
      `/reconciliation/batches/${encodeURIComponent(batchId)}`
    );
    return mapBatch(batch, serviceDate);
  },

  async completeReconciliation(batchId: string, expectedVersion: number): Promise<ReconciliationBatchSummary> {
    const batch = await apiClient<RawReconciliationBatchDto>(
      `/reconciliation/batches/${encodeURIComponent(batchId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ expectedVersion }),
      }
    );
    return mapBatch(batch);
  },
};
