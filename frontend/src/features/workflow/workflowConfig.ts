import { ROUTES } from '@/routes/routeConfig';
import type { WorkflowLane, WorkflowLaneId, WorkflowTone } from './types';

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
    label: 'KHSX',
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
    nextAction: 'Kiểm tra audit và BOM',
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

export const toneFromStatus = (status?: string): WorkflowTone => {
  const normalized = (status ?? '').toLowerCase();

  if (normalized.includes('thiếu') || normalized.includes('vượt') || normalized.includes('không đủ')) {
    return 'danger';
  }

  if (
    normalized.includes('chờ') ||
    normalized.includes('cần') ||
    normalized.includes('mới') ||
    normalized.includes('theo dõi')
  ) {
    return 'warning';
  }

  if (normalized.includes('đã') || normalized.includes('hoàn tất') || normalized.includes('đủ')) {
    return 'success';
  }

  return 'neutral';
};

const workflowStatusLabels: Record<string, string> = {
  APPROVED: 'Đã phê duyệt',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Hoàn tất',
  CONFIRMED: 'Đã xác nhận',
  CREATED: 'Mới tạo',
  DRAFT: 'Bản nháp',
  EXPORTED: 'Đã xuất kho',
  ERROR: 'Có lỗi',
  MANAGERAPPROVED: 'Quản lí đã duyệt',
  ORDERED: 'Đã đặt hàng',
  PARTIALRECEIVED: 'Đã nhận một phần',
  PENDING: 'Đang chờ xử lý',
  OPEN: 'Đang mở',
  RECEIVED: 'Đã nhận đủ',
  REJECTED: 'Bị từ chối',
  REOPENED: 'Đã mở lại',
  RESOLVED: 'Đã xử lý',
  SENTTOKITCHEN: 'Đã gửi bếp',
  SENTTOSUPPLIER: 'Đã gửi nhà cung cấp',
  SENTTOWAREHOUSE: 'Đã gửi kho',
  WARNING: 'Có cảnh báo',
};

export const formatWorkflowStatus = (status?: string) => {
  const value = status?.trim();
  if (!value) return 'Chưa cập nhật';

  return workflowStatusLabels[value.toUpperCase()] ?? value;
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
