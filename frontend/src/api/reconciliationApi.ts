import { apiClient } from './client';
import {
  mrxApi,
  type MrxBatch,
  type ReconciliationLineItem,
  type ReconciliationBatchSummary,
  type MrxDisposition,
  mapBatchDtoToSummary,
} from './mrxApi';

export type ReconciliationDisposition = MrxDisposition;
export type { ReconciliationLineItem, ReconciliationBatchSummary };

export const reconciliationApi = {
  getReconciliationSummary: async (batchId: string, serviceDate?: string): Promise<ReconciliationBatchSummary> => {
    const batch = await apiClient<MrxBatch>(`/reconciliation/batches/${encodeURIComponent(batchId)}`);
    return mapBatchDtoToSummary(batch, serviceDate);
  },

  completeReconciliation: async (batchId: string, expectedVersion: number): Promise<ReconciliationBatchSummary> => {
    const batch = await mrxApi.completeBatch(batchId, expectedVersion);
    return mapBatchDtoToSummary(batch);
  },
};
