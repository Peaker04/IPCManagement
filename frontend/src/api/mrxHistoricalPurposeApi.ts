import { apiClient } from './client';
import { notifyMrxWriteAcknowledged } from './mrxCacheInvalidation';
import type { components } from '../shared/api/contracts/schema';

export type MrxHistoricalPurposeCandidate = components['schemas']['MrxHistoricalPurposeCandidate'];
export type MrxHistoricalPurposeRequest = components['schemas']['MrxHistoricalPurposeProposalRequest'];
export type MrxHistoricalPurposeDetail = components['schemas']['MrxHistoricalPurposeDetail'];

const path = '/reconciliation/historical-purpose';
export const mrxHistoricalPurposeApi = {
  candidates: (batchId: string, date: string) => apiClient<readonly MrxHistoricalPurposeCandidate[]>(
    `${path}/batches/${encodeURIComponent(batchId)}?${new URLSearchParams({ date })}`),
  async propose(request: MrxHistoricalPurposeRequest) {
    const result = await apiClient<MrxHistoricalPurposeDetail>(path, { method: 'POST', body: JSON.stringify(request) });
    if (result.batchId !== request.batchId || result.issueLineId !== request.issueLineId || result.serviceDate !== request.serviceDate
      || result.proposalId !== request.commandId || !['PENDING', 'APPLIED'].includes(result.status))
      throw new Error('Phản hồi phân bổ không khớp với lệnh đã gửi.');
    notifyMrxWriteAcknowledged();
    return result;
  },
};
