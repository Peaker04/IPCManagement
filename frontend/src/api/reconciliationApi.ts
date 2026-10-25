import { apiClient } from './client';
import {
  mrxApi,
  type ReconciliationLineItem,
  type ReconciliationBatchSummary,
  type MrxDisposition,
  mapBatchDtoToSummary,
} from './mrxApi';

export type ReconciliationDisposition = MrxDisposition;
export type { ReconciliationLineItem, ReconciliationBatchSummary };

export const reconciliationApi = {
  getReconciliationSummary: (batchId: string, serviceDate?: string): Promise<ReconciliationBatchSummary> =>
    mrxApi.getBatchSummary(batchId, serviceDate),

  completeReconciliation: async (batchId: string, expectedVersion: number): Promise<ReconciliationBatchSummary> => {
    const batch = await mrxApi.completeBatch(batchId, expectedVersion);
    return mapBatchDtoToSummary(batch);
  },
};
