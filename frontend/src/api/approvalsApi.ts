import { apiClient } from './client';

export interface ApprovalInboxItem {
  inboxItemId: string;
  targetType: string;
  targetId: string;
  targetCode: string;
  itemType: string;
  title: string;
  source: string;
  ownerRole: string;
  submittedBy: string;
  dueDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  totalQuantity?: number;
  totalValue?: number;
  submittedAt: string;
  slaDeadline: string;
  supplierName?: string;
  materials?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export interface RawApprovalResponse {
  items: ApprovalInboxItem[];
  limit: number;
  hasNext: boolean;
}

export const approvalsApi = {
  async getInbox(targetType?: string): Promise<ApprovalInboxItem[]> {
    const resp = await apiClient<RawApprovalResponse | ApprovalInboxItem[]>('/approvals/inbox');
    const items = Array.isArray(resp) ? resp : resp?.items || [];

    if (targetType && targetType !== 'ALL') {
      return items.filter((i) => i.targetType === targetType || i.itemType === targetType);
    }
    return items;
  },

  async decide(
    targetType: string,
    id: string,
    decision: 'APPROVE' | 'REJECT',
    reason: string
  ): Promise<{ success: boolean }> {
    if (!reason || !reason.trim()) {
      throw new Error('Lý do phê duyệt / từ chối là bắt buộc (BR-GLOBAL-03).');
    }
    return apiClient<{ success: boolean }>(`/approvals/${encodeURIComponent(targetType)}/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
  },
};
