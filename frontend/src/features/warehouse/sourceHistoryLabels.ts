export const HISTORY_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Đang chờ xử lý', RECONCILIATION_REQUIRED: 'Cần đối soát',
  REJECTED: 'Từ chối', EXECUTED: 'Đã thực hiện yêu cầu', APPLIED: 'Đã áp dụng vào nguồn',
};
export const HISTORY_APPROVAL_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', NOT_REQUIRED: 'Không cần duyệt',
};
export const HISTORY_ROUTE_LABELS: Record<string, string> = {
  REIMPORT: 'Nhập lại nguồn', DIRECT: 'Áp dụng trực tiếp', APPROVED: 'Qua phê duyệt',
  REQUEST: 'Yêu cầu chỉnh sửa',
};

export const historyStatusVariant = (status: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' => status === 'APPLIED' ? 'success'
  : status === 'REJECTED' ? 'danger' : status === 'EXECUTED' ? 'info'
    : status === 'PENDING_REVIEW' || status === 'RECONCILIATION_REQUIRED' ? 'warning' : 'neutral';
export const historyApprovalVariant = (status: string): 'success' | 'danger' | 'warning' | 'neutral' => status === 'APPROVED' ? 'success'
  : status === 'REJECTED' ? 'danger' : status === 'PENDING' ? 'warning' : 'neutral';
