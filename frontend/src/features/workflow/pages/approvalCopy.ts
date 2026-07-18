import { formatWorkflowStatus } from '../workflowConfig';

const approvalDecisionLabels: Record<string, string> = {
  APPROVE: 'Đã duyệt',
  APPROVED: 'Đã duyệt',
  REJECT: 'Từ chối',
  REJECTED: 'Từ chối',
  SUBMIT: 'Đã gửi duyệt',
};

export const formatApprovalDecision = (decision?: string) => {
  const value = decision?.trim();
  if (!value) return 'Chưa cập nhật';

  return approvalDecisionLabels[value.toUpperCase()] ?? formatWorkflowStatus(value);
};
