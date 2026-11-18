import { apiClient } from './client';
import { notifyMrxWriteAcknowledged } from './mrxCacheInvalidation';
import type { components } from '../shared/api/contracts/schema';

export type ApprovalInboxItem = components['schemas']['ApprovalInboxItemDto'];
export type ApprovalHistoryItem = components['schemas']['ApprovalHistoryItemDto'];
export type OperationalApprovalPage = components['schemas']['OperationalApprovalPage'];
export type OperationalApprovalAction = 'APPROVE' | 'REJECT' | 'REVIEW_APPROVE' | 'REVIEW_REJECT' | 'APPLY';
export type OperationalApprovalDetail = components['schemas']['OperationalApprovalDetail'];
export type OperationalApprovalCommandContext = Pick<OperationalApprovalDetail, 'mode' | 'modeVersion' | 'fingerprint'>
  & { item: Pick<ApprovalInboxItem, 'targetType' | 'targetId'> };

export interface OperationalApprovalFilters { type: string; cursor: string; search: string; state: 'PENDING' | 'PROCESSED'; customerCode?: string; date?: string }

export const approvalsApi = {
  getOperationalInbox(filters: OperationalApprovalFilters): Promise<OperationalApprovalPage> {
    const query = new URLSearchParams({ Limit: '20' });
    if (filters.type !== 'ALL') query.set('TargetType', filters.type);
    if (filters.cursor) query.set('Cursor', filters.cursor);
    if (filters.search) query.set('SearchKeyword', filters.search);
    if (filters.customerCode) query.set('CustomerCode', filters.customerCode);
    if (filters.date) query.set('Date', filters.date);
    if (filters.state === 'PROCESSED') query.set('State', filters.state);
    return apiClient<OperationalApprovalPage>(`/operational-approvals/inbox?${query}`);
  },
  getDetail(type: string, id: string, state: string = 'PENDING'): Promise<OperationalApprovalDetail> {
    const query = state === 'PROCESSED' ? '?state=PROCESSED' : '';
    return apiClient<OperationalApprovalDetail>(`/operational-approvals/${encodeURIComponent(type)}/${encodeURIComponent(id)}${query}`);
  },
  async decideOperational(detail: OperationalApprovalCommandContext, decision: OperationalApprovalAction, reason: string, commandId: string) {
    const result = await apiClient<components['schemas']['ApprovalResultDto']>(
      `/operational-approvals/${encodeURIComponent(detail.item.targetType)}/${encodeURIComponent(detail.item.targetId)}/decision`,
      { method: 'POST', body: JSON.stringify({ commandId, expectedModeVersion: detail.modeVersion,
        expectedFingerprint: detail.fingerprint, decision: decision === 'REJECT' || decision === 'REVIEW_REJECT' ? 'Reject' : 'Approve',
        ...(!['APPROVE', 'REJECT'].includes(decision) ? { action: decision } : {}), reason }) });
    if (detail.mode === 'MATERIAL_RECONCILIATION') notifyMrxWriteAcknowledged();
    return result;
  },
  async getHistory(documentType: string, documentId: string): Promise<ApprovalHistoryItem[]> {
    return apiClient<ApprovalHistoryItem[]>(
      `/operational-approvals/${encodeURIComponent(documentType)}/${encodeURIComponent(documentId)}/history`
    );
  },
};
