import { ROUTES } from '@/lib/routeConfig';
import type { StatusPresentation } from '@/lib/statusPresentation';
import type { WorkflowLane, WorkflowLaneId, WorkflowTone } from '@/types/workflow';

type WorkflowStatusPresentation = Omit<StatusPresentation, 'tone'> & { tone: WorkflowTone };

const laneBase: Array<Pick<WorkflowLane, 'id' | 'label' | 'owner' | 'stage' | 'route' | 'nextAction'>> = [
  {
    id: 'coordination',
    label: 'Điều phối',
    owner: 'Điều phối ca',
    stage: 'Chốt đơn',
    route: ROUTES.MEAL_ORDERS,
    nextAction: 'Gửi tính định lượng',
  },
  {
    id: 'planning',
    label: 'Kế hoạch sản xuất',
    owner: 'Kế hoạch định lượng',
    stage: 'Kiểm tồn kho',
    route: ROUTES.WEEKLY_MENU,
    nextAction: 'Đề xuất mua thêm',
  },
  {
    id: 'management',
    label: 'Quản lí',
    owner: 'Quản lí vận hành',
    stage: 'Duyệt mua / duyệt xuất',
    route: ROUTES.APPROVALS,
    nextAction: 'Duyệt danh sách mua thêm',
  },
  {
    id: 'purchasing',
    label: 'Thu mua',
    owner: 'Nhân sự thu mua',
    stage: 'Thu mua',
    route: ROUTES.PURCHASING,
    nextAction: 'Chọn nhà cung cấp',
  },
  {
    id: 'warehouse',
    label: 'Thủ kho',
    owner: 'Kho nguyên liệu',
    stage: 'Xuất kho',
    route: ROUTES.WAREHOUSE,
    nextAction: 'Tạo phiếu xuất kho',
  },
  {
    id: 'kitchen',
    label: 'Bếp trưởng',
    owner: 'Bếp trưởng ca',
    stage: 'Bếp nhận',
    route: ROUTES.CHEF_DASHBOARD,
    nextAction: 'Xác nhận nhận nguyên liệu',
  },
  {
    id: 'admin',
    label: 'Admin',
    owner: 'Quản trị dữ liệu',
    stage: 'Điều chỉnh / thông báo',
    route: ROUTES.ADMIN_DATA,
    nextAction: 'Kiểm tra nhật ký và định lượng',
  },
];

export const workflowLaneDefinitions: WorkflowLane[] = laneBase.map((lane) => ({
  ...lane,
  status: 'Chờ dữ liệu backend',
  waiting: 0,
  blocked: 0,
  done: 0,
  tone: 'neutral',
}));

export const laneIdByOwner: Record<string, WorkflowLaneId> = {
  'Điều phối': 'coordination',
  'Điều phối ca': 'coordination',
  KHSX: 'planning',
  'Kế hoạch định lượng': 'planning',
  'Quản lí': 'management',
  'Quản lí vận hành': 'management',
  'Mua hàng': 'purchasing',
  'Thu mua': 'purchasing',
  'Thủ kho': 'warehouse',
  'Bếp trưởng': 'kitchen',
  Admin: 'admin',
  'Admin dữ liệu': 'admin',
  'Quản trị dữ liệu': 'admin',
};

export const routeByLaneId: Record<WorkflowLaneId, string> = Object.fromEntries(
  workflowLaneDefinitions.map((lane) => [lane.id, lane.route]),
) as Record<WorkflowLaneId, string>;

const normalizeStatusCode = (status: string) => status.toUpperCase().replace(/[\s_-]/g, '');

const workflowStatusPresentations: Readonly<Record<string, WorkflowStatusPresentation>> = {
  APPROVED: { label: 'Đã phê duyệt', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  CREATED: { label: 'Mới tạo', tone: 'neutral' },
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  EXPORTED: { label: 'Đã xuất kho', tone: 'success' },
  ERROR: { label: 'Có lỗi', tone: 'danger' },
  MANAGERAPPROVED: { label: 'Quản lí đã duyệt', tone: 'success' },
  ORDERED: { label: 'Đã đặt hàng', tone: 'success' },
  PARTIALRECEIVED: { label: 'Đã nhận một phần', tone: 'warning' },
  PARTIALLYRECEIVED: { label: 'Đã nhận một phần', tone: 'warning' },
  PARTIALLYFULFILLED: { label: 'Đã cấp một phần', tone: 'warning' },
  PENDING: { label: 'Đang chờ xử lý', tone: 'warning' },
  PENDINGRECEIPT: { label: 'Chờ kho tiếp nhận', tone: 'warning' },
  PENDINGWAREHOUSEREVIEW: { label: 'Chờ kho xử lý', tone: 'warning' },
  NEEDSPURCHASE: { label: 'Chờ thu mua', tone: 'warning' },
  ISSUED: { label: 'Chờ bếp ký nhận', tone: 'warning' },
  FULFILLED: { label: 'Đã cấp đủ', tone: 'success' },
  RECORDED: { label: 'Đã ghi nhận', tone: 'success' },
  OPEN: { label: 'Đang mở', tone: 'warning' },
  RECEIVED: { label: 'Đã nhận đủ', tone: 'success' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  REOPENED: { label: 'Đã mở lại', tone: 'warning' },
  RESOLVED: { label: 'Đã xử lý', tone: 'success' },
  ROLLEDBACK: { label: 'Đã hoàn tác', tone: 'warning' },
  PUBLISHED: { label: 'Đã phát hành', tone: 'success' },
  SENTTOKITCHEN: { label: 'Đã gửi bếp', tone: 'success' },
  SENTTOSUPPLIER: { label: 'Đã gửi nhà cung cấp', tone: 'success' },
  SENTTOWAREHOUSE: { label: 'Đã gửi kho', tone: 'success' },
  SUBMITTED: { label: 'Chờ phê duyệt', tone: 'warning' },
  WARNING: { label: 'Có cảnh báo', tone: 'warning' },
};

const serviceRunStatusPresentations: Readonly<Record<string, WorkflowStatusPresentation>> = {
  BLOCKED: { label: 'Đang bị chặn', tone: 'danger' },
  MATERIALSINPROGRESS: { label: 'Đang hoàn tất vật tư', tone: 'warning' },
  READYTOPRODUCE: { label: 'Sẵn sàng phục vụ', tone: 'warning' },
  INSERVICE: { label: 'Đang phục vụ', tone: 'warning' },
  RECONCILIATIONREQUIRED: { label: 'Cần đối soát', tone: 'danger' },
  READYTOCLOSE: { label: 'Sẵn sàng đóng ca', tone: 'success' },
  CLOSED: { label: 'Đã đóng ca', tone: 'success' },
};

const toneFromFallbackText = (status: string): WorkflowTone => {
  const normalized = status.toLocaleLowerCase('vi-VN');
  if (['thiếu', 'vượt', 'không đủ', 'lỗi', 'tắc', 'từ chối', 'hủy'].some((token) => normalized.includes(token))) return 'danger';
  if (['chờ', 'cần', 'mới', 'theo dõi', 'dự thảo', 'một phần', 'mở lại'].some((token) => normalized.includes(token))) return 'warning';
  if (['đã', 'hoàn tất', 'đủ', 'ổn định', 'hợp lệ', 'hoạt động'].some((token) => normalized.includes(token))) return 'success';
  return 'neutral';
};

export const getWorkflowStatusPresentation = (status?: string): WorkflowStatusPresentation => {
  const value = status?.trim();
  if (!value) return { label: 'Chưa cập nhật', tone: 'neutral' };
  return workflowStatusPresentations[normalizeStatusCode(value)] ?? { label: value, tone: toneFromFallbackText(value) };
};

export const getServiceRunStatusPresentation = (status?: string): WorkflowStatusPresentation => {
  const value = status?.trim();
  if (!value) return { label: 'Chưa cập nhật trạng thái ca phục vụ', tone: 'neutral' };
  return serviceRunStatusPresentations[normalizeStatusCode(value)]
    ?? { label: 'Trạng thái ca phục vụ chưa được hỗ trợ', tone: 'neutral' };
};

export const toneFromStatus = (status?: string): WorkflowTone => getWorkflowStatusPresentation(status).tone;

export const formatWorkflowStatus = (status?: string) => {
  return getWorkflowStatusPresentation(status).label;
};

export const ownerToLaneId = (owner?: string): WorkflowLaneId => {
  if (!owner) return 'admin';
  return laneIdByOwner[owner] ?? 'admin';
};

export function getWorkflowContextForPath(pathname: string) {
  const lane = workflowLaneDefinitions.find((item) => item.route === pathname) ?? workflowLaneDefinitions[0];

  return {
    lane,
    inbox: [],
    documents: [],
    blockedItems: [],
  };
}
