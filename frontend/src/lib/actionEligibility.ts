import type { ApprovalRecord, WorkflowLane } from '@/types/workflow';

export const resolveWorkflowGateAction = (lanes: WorkflowLane[]): string => {
  if (lanes.length === 0) return 'Mở công đoạn';

  const waiting = lanes.reduce((total, lane) => total + lane.waiting, 0);
  const blocked = lanes.reduce((total, lane) => total + lane.blocked, 0);
  const done = lanes.reduce((total, lane) => total + lane.done, 0);

  if (waiting === 0 && blocked === 0) {
    return done > 0 ? 'Đã hoàn tất' : 'Theo dõi công đoạn';
  }

  const tonePriority = { danger: 3, warning: 2, neutral: 1, success: 0 } as const;
  const highestPriorityLane = lanes.reduce((current, lane) =>
    tonePriority[lane.tone] > tonePriority[current.tone] ? lane : current);

  return highestPriorityLane.nextAction || 'Mở công đoạn';
};

export const resolveApprovalAvailability = (
  records: ApprovalRecord[],
  options: { isFetching: boolean; isError: boolean; isDeciding: boolean },
) => {
  const firstActionableRecord = records.find((record) => record.targetType && record.targetId);
  const disabledReason = options.isFetching
    ? 'Đang kiểm tra hàng đợi phê duyệt.'
    : options.isError
      ? 'Không tải được hàng đợi. Hãy thử tải lại trước khi xử lý.'
      : options.isDeciding
        ? 'Hệ thống đang lưu quyết định hiện tại.'
        : !firstActionableRecord
          ? 'Không có chứng từ nào đang chờ phê duyệt.'
          : null;

  return {
    firstActionableRecord,
    disabledReason,
    statusLabel: options.isFetching
      ? 'Đang tải'
      : options.isError
        ? 'Không tải được'
        : records.length > 0
          ? 'Chờ duyệt'
          : 'Không có việc chờ',
    statusTone: options.isError ? 'danger' : records.length > 0 ? 'warning' : 'success',
  } as const;
};

export const resolveIssueCreationAvailability = (options: {
  canManageWarehouse: boolean;
  isFetching: boolean;
  candidateCount?: number;
  isError?: boolean;
}) => {
  const disabledReason = !options.canManageWarehouse
    ? 'Chỉ người có quyền thủ kho mới được tạo phiếu xuất.'
    : options.isFetching
      ? 'Đang kiểm tra nhu cầu đủ điều kiện xuất kho.'
      : options.isError
        ? 'Không tải được danh sách nhu cầu đủ điều kiện xuất kho. Hãy tải lại trước khi kết luận là không còn nhu cầu.'
        : (options.candidateCount ?? 0) === 0
          ? 'Không còn nhu cầu đủ điều kiện xuất kho. Chờ nhu cầu mới hoặc xem lại luân chuyển đã hoàn tất.'
          : null;

  return {
    canCreate: disabledReason === null,
    disabledReason,
  };
};

export const resolveDemandLinePresentation = (options: {
  status?: string;
  shortage: number;
}) => {
  const normalizedStatus = options.status?.trim().toUpperCase();
  if (normalizedStatus === 'EXPORTED') {
    return { status: 'Đã xuất kho', nextAction: 'Đã hoàn tất', tone: 'success' } as const;
  }
  if (normalizedStatus === 'CANCELLED') {
    return { status: 'Cần tạo lại demand', nextAction: 'Import menu đã thay đổi, tạo lại demand từ KHSX', tone: 'warning' } as const;
  }
  return options.shortage > 0
    ? { status: 'Thiếu nguyên liệu', nextAction: 'Đề xuất mua thêm', tone: 'danger' } as const
    : { status: 'Tồn kho đủ', nextAction: 'Tạo phiếu xuất kho', tone: 'success' } as const;
};
