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

type ApprovalDecision = 'Approve' | 'Reject';

export const getApprovalDecisionCopy = (targetType: string | undefined, decision: ApprovalDecision) => {
  const isDemand = targetType === 'material-demand';
  const isPriceException = targetType === 'purchase-price-exception';
  const noun = isDemand ? 'nhu cầu nguyên liệu' : isPriceException ? 'ngoại lệ giá' : 'chứng từ';
  const safeLabel = isDemand ? 'Giữ nhu cầu' : isPriceException ? 'Giữ ngoại lệ giá' : 'Giữ chứng từ';

  if (decision === 'Reject') {
    return {
      title: `Từ chối ${noun}?`,
      description: isDemand
        ? 'Lý do là bắt buộc và sẽ được lưu trong lịch sử phê duyệt.'
        : isPriceException
          ? 'Thu mua phải thay đổi giá, nhà cung cấp hoặc gửi lại bằng chứng trước khi tiếp tục.'
          : 'Lý do là bắt buộc và sẽ được lưu trong lịch sử phê duyệt.',
      safeLabel,
      submitLabel: isDemand ? 'Từ chối nhu cầu' : isPriceException ? 'Từ chối ngoại lệ' : 'Từ chối chứng từ',
    };
  }

  return {
    title: `Duyệt ${noun}?`,
    description: 'Quyết định sẽ được lưu vào lịch sử phê duyệt và cập nhật trạng thái vận hành.',
    safeLabel,
    submitLabel: isDemand ? 'Duyệt nhu cầu' : isPriceException ? 'Duyệt ngoại lệ' : 'Duyệt chứng từ',
  };
};
