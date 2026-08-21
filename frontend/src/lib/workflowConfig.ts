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
  status: 'Chưa đồng bộ dữ liệu',
  waiting: 0,
  blocked: 0,
  done: 0,
  tone: 'neutral',
}));

export const workflowLaneStatusByPath = Object.fromEntries(
  workflowLaneDefinitions.map((lane) => [lane.route, lane.status]),
) as Record<string, string>;

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
  APPROVED: { label: 'Đã duyệt', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  COMPLETED: { label: 'Hoàn tất', tone: 'neutral' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'neutral' },
  CREATED: { label: 'Bản nháp', tone: 'neutral' },
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  EXPORTED: { label: 'Đã xuất kho', tone: 'neutral' },
  ERROR: { label: 'Bị chặn', tone: 'danger' },
  MANAGERAPPROVED: { label: 'Đã duyệt', tone: 'neutral' },
  ORDERED: { label: 'Đã đặt hàng', tone: 'neutral' },
  PARTIALRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  PARTIALLYRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  PARTIALLYFULFILLED: { label: 'Nhận một phần', tone: 'warning' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  PENDINGAPPROVAL: { label: 'Chờ duyệt', tone: 'warning' },
  PENDINGRECEIPT: { label: 'Chờ vật tư', tone: 'warning' },
  PENDINGWAREHOUSEREVIEW: { label: 'Chờ duyệt', tone: 'warning' },
  NEEDSPURCHASE: { label: 'Chờ vật tư', tone: 'warning' },
  ISSUED: { label: 'Chờ vật tư', tone: 'warning' },
  FULFILLED: { label: 'Hoàn tất', tone: 'neutral' },
  RECORDED: { label: 'Hoàn tất', tone: 'neutral' },
  OPEN: { label: 'Đang mở', tone: 'warning' },
  RECEIVED: { label: 'Hoàn tất', tone: 'neutral' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  REOPENED: { label: 'Đang mở', tone: 'warning' },
  RESOLVED: { label: 'Hoàn tất', tone: 'neutral' },
  ROLLEDBACK: { label: 'Đang mở', tone: 'warning' },
  PUBLISHED: { label: 'Đã xuất kho', tone: 'neutral' },
  SENTTOKITCHEN: { label: 'Đã xuất kho', tone: 'neutral' },
  SENTTOSUPPLIER: { label: 'Đã đặt hàng', tone: 'neutral' },
  SENTTOWAREHOUSE: { label: 'Đã xuất kho', tone: 'neutral' },
  SUBMITTED: { label: 'Chờ duyệt', tone: 'warning' },
  WARNING: { label: 'Bị chặn', tone: 'danger' },
};

const serviceRunStatusPresentations: Readonly<Record<string, WorkflowStatusPresentation>> = {
  PLANNED: { label: 'Bản nháp', tone: 'neutral' },
  BLOCKED: { label: 'Bị chặn', tone: 'danger' },
  MATERIALSINPROGRESS: { label: 'Chờ vật tư', tone: 'warning' },
  READYTOPRODUCE: { label: 'Sẵn sàng', tone: 'neutral' },
  INSERVICE: { label: 'Đang mở', tone: 'warning' },
  RECONCILIATIONREQUIRED: { label: 'Bị chặn', tone: 'danger' },
  READYTOCLOSE: { label: 'Sẵn sàng', tone: 'neutral' },
  CLOSED: { label: 'Hoàn tất', tone: 'neutral' },
};

const serviceRunBlockerPresentations: Readonly<Record<string, string>> = {
  PLANNOTSIGNEDOFF: 'Kế hoạch chưa được xác nhận',
  DEMANDNOTGENERATED: 'Chưa có nhu cầu nguyên liệu',
  BOMINCOMPLETE: 'Món ăn chưa đủ định lượng',
  OPENSUPPLY: 'Còn chứng từ cấp phát chưa hoàn tất',
  UNRECEIVEDISSUE: 'Bếp chưa xác nhận nhận nguyên liệu',
  OPENSUPPLEMENTAL: 'Còn yêu cầu bổ sung chưa hoàn tất',
  ACTUALSERVINGSNOTRECORDED: 'Chưa ghi nhận số suất thực tế',
  SERVICECONFIRMATIONREQUIRED: 'Cần xác nhận hoàn tất phục vụ',
  UNRESOLVEDVARIANCE: 'Chênh lệch vật tư chưa được quyết toán',
  UNRESOLVEDSERVINGVARIANCE: 'Chênh lệch số suất chưa được quyết định',
  CONFIRMATIONOUTCOMECONFLICT: 'Kết quả xác nhận phục vụ cần đối soát',
};

const serviceRunVarianceTrackPresentations: Readonly<Record<string, string>> = {
  PLANNING: 'Kế hoạch',
  MATERIALSUPPLY: 'Vật tư và cấp phát',
  SERVICEEXECUTION: 'Thực hiện phục vụ',
  RECONCILIATION: 'Đối soát',
};

const toneFromFallbackText = (status: string): WorkflowTone => {
  const normalized = status.toLocaleLowerCase('vi-VN');
  if (['thiếu', 'vượt', 'không đủ', 'lỗi', 'tắc', 'từ chối', 'hủy'].some((token) => normalized.includes(token))) return 'danger';
  if (['chờ', 'cần', 'mới', 'theo dõi', 'dự thảo', 'một phần', 'mở lại'].some((token) => normalized.includes(token))) return 'warning';
  if (['đã', 'hoàn tất', 'đủ', 'ổn định', 'hợp lệ', 'hoạt động'].some((token) => normalized.includes(token))) return 'neutral';
  return 'neutral';
};

export const getWorkflowStatusPresentation = (status?: string): WorkflowStatusPresentation => {
  const value = status?.trim();
  if (!value) return { label: 'Chưa cập nhật', tone: 'neutral' };
  return workflowStatusPresentations[normalizeStatusCode(value)]
    ?? { label: 'Chưa cập nhật', tone: toneFromFallbackText(value) };
};

export const getServiceRunStatusPresentation = (status?: string): WorkflowStatusPresentation => {
  const value = status?.trim();
  if (!value) return { label: 'Chưa cập nhật', tone: 'neutral' };
  return serviceRunStatusPresentations[normalizeStatusCode(value)]
    ?? { label: 'Chưa cập nhật', tone: 'neutral' };
};

export const formatServiceRunBlocker = (blocker?: string) => {
  const value = blocker?.trim();
  if (!value) return 'Chưa có điều kiện chặn';
  return serviceRunBlockerPresentations[normalizeStatusCode(value)] ?? 'Có điều kiện cần xử lý';
};

export const formatServiceRunVarianceTrack = (track?: string) => {
  const value = track?.trim();
  if (!value) return 'Chưa chọn phạm vi';
  return serviceRunVarianceTrackPresentations[normalizeStatusCode(value)] ?? 'Phạm vi ngoại lệ';
};

export const formatServiceRunConfirmationOutcome = (outcome?: string) => {
  const value = outcome?.trim();
  if (!value) return 'Chưa xác nhận';
  return ({ PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', WAIVED: 'Đã miễn xác nhận' } as const)[normalizeStatusCode(value) as 'PENDING' | 'CONFIRMED' | 'WAIVED'] ?? 'Chưa xác nhận';
};

const reconciliationDispositionPresentations: Readonly<Record<string, string>> = {
  MATCHED: 'Đã khớp',
  SUPPLEMENTALOPEN: 'Đang chờ cấp bổ sung',
  KITCHENACKPENDING: 'Chờ Bếp xác nhận',
  DEMANDREMAINING: 'Còn thiếu nguyên liệu',
  OVERISSUEDRECONCILIATIONREQUIRED: 'Cần đối soát phần cấp dư',
  LEGACYDISPOSITIONPARTIAL: 'Cần quyết định thêm',
  LEGACYDISPOSITIONPENDINGMANAGERREVIEW: 'Chờ Quản lý quyết định',
  LEGACYDISPOSITIONAPPROVEDAWAITINGAPPLY: 'Đã duyệt · chờ áp dụng',
  LEGACYDISPOSITIONREJECTED: 'Cần quyết định lại',
  LEGACYLINEAGERECONCILIATIONREQUIRED: 'Cần quyết định',
};

export const formatReconciliationDisposition = (disposition?: string) => {
  const value = disposition?.trim();
  if (!value) return 'Chưa có kết quả đối soát';
  return reconciliationDispositionPresentations[normalizeStatusCode(value)] ?? 'Cần kiểm tra đối soát';
};

export const formatLegacyLineType = (lineType?: string) => {
  const normalized = normalizeStatusCode(lineType ?? '');
  return ({ ISSUELINE: 'Dòng xuất kho', RETURNLINE: 'Dòng trả kho' } as const)[normalized as 'ISSUELINE' | 'RETURNLINE']
    ?? 'Dòng chứng từ lịch sử';
};

export const formatLegacyDispositionStatus = (status?: string) => {
  const normalized = normalizeStatusCode(status ?? '');
  return ({
    UNDISPOSITIONED: 'Cần lập đề xuất',
    PENDINGMANAGERREVIEW: 'Chờ Quản lý duyệt',
    APPROVED: 'Đã duyệt · chờ áp dụng',
    REJECTED: 'Đã từ chối',
    APPLIED: 'Đã liên kết nguồn',
  } as const)[normalized as 'UNDISPOSITIONED' | 'PENDINGMANAGERREVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED']
    ?? 'Cần kiểm tra trạng thái';
};

export const toneFromStatus = (status?: string): WorkflowTone => getWorkflowStatusPresentation(status).tone;

export const formatWorkflowStatus = (status?: string) => {
  return getWorkflowStatusPresentation(status).label;
};

export const formatShiftName = (shift?: string) => {
  const normalized = normalizeStatusCode(shift ?? '');
  return ({ MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều' } as const)[normalized as 'MORNING' | 'AFTERNOON']
    ?? (shift?.trim() || 'Chưa xác định ca');
};

export const formatMenuVersionStatus = (status?: string) => {
  const normalized = normalizeStatusCode(status ?? '');
  return ({
    DRAFT: 'Bản nháp',
    ACTIVE: 'Đang áp dụng',
    SUPERSEDED: 'Đã thay thế',
    LOCKED: 'Đã khóa',
  } as const)[normalized as 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'LOCKED']
    ?? formatWorkflowStatus(status);
};

const dataQualityCategoryLabels: Readonly<Record<string, string>> = {
  missing_bom: 'Thiếu định lượng món',
  legacy_missing_bom: 'Định lượng cũ chưa đầy đủ',
  invalid_unit: 'Đơn vị chưa hợp lệ',
  missing_conversion: 'Thiếu quy đổi đơn vị',
  legacy_bom_tier: 'Định lượng cũ chưa đúng mức giá',
  legacy_missing_conversion: 'Dữ liệu cũ thiếu quy đổi',
  inactive_bom_ingredient: 'Định lượng dùng nguyên liệu ngừng hoạt động',
  negative_stock: 'Tồn kho âm',
  inventory_ledger_mismatch: 'Tồn kho lệch sổ',
  stock_shortage: 'Nguyên liệu chưa đủ để cấp',
  missing_contract: 'Thiếu cấu hình hợp đồng',
  missing_supplier: 'Chưa chọn nhà cung cấp',
  stale_demand: 'Nhu cầu cần tính lại',
  stale_purchase_request: 'Đề xuất mua cần cập nhật',
  kitchen_receipt_discrepancy: 'Bếp nhận lệch số lượng',
  orphan_document: 'Chứng từ mất liên kết',
  unit_normalization_review: 'Cần xác nhận chuẩn hóa đơn vị',
};

const dataQualityOwnerLabels: Readonly<Record<string, string>> = {
  admin: 'Quản trị dữ liệu',
  management: 'Quản lý vận hành',
  manager: 'Quản lý vận hành',
  purchasing: 'Bộ phận Thu mua',
  warehouse: 'Bộ phận Kho',
  kitchen: 'Bộ phận Bếp',
  coordination: 'Bộ phận Điều phối',
};

const dataQualityEntityLabels: Readonly<Record<string, string>> = {
  customercontract: 'Hợp đồng khách hàng',
  dish: 'Món ăn',
  bom: 'Định lượng món',
  ingredient: 'Nguyên liệu',
  inventory: 'Tồn kho',
  stockmovement: 'Bút toán kho',
  materialrequest: 'Phiếu yêu cầu nguyên liệu',
  purchaserequest: 'Đề xuất mua',
  purchaseorder: 'Đơn mua hàng',
  inventoryissue: 'Phiếu xuất kho',
  inventoryreceipt: 'Phiếu nhập kho',
};

export const formatDataQualityCategory = (category?: string) =>
  dataQualityCategoryLabels[category?.trim().toLocaleLowerCase('en-US') ?? ''] ?? 'Vấn đề dữ liệu cần kiểm tra';

export const formatDataQualityOwner = (owner?: string) =>
  dataQualityOwnerLabels[owner?.trim().toLocaleLowerCase('en-US') ?? ''] ?? (owner?.trim() || 'Bộ phận vận hành');

export const formatDataQualityEntity = (entity?: string) =>
  dataQualityEntityLabels[normalizeStatusCode(entity ?? '').toLocaleLowerCase('en-US')] ?? 'Đối tượng nghiệp vụ';

export const formatDataQualityRemediationStatus = (status?: string) => ({
  open: 'Chưa xử lý',
  resolved: 'Đã xử lý',
  reopened: 'Đã mở lại',
} as const)[status?.trim().toLocaleLowerCase('en-US') as 'open' | 'resolved' | 'reopened'] ?? 'Chưa xử lý';

export const formatPriorityLabel = (priority?: number) => priority ? `Ưu tiên P${priority}` : 'Chưa xếp ưu tiên';

export const getDataQualityActionLabel = (category?: string) => ({
  missing_bom: 'Mở định lượng món',
  legacy_missing_bom: 'Mở định lượng món',
  missing_contract: 'Mở hợp đồng',
  missing_supplier: 'Mở chọn nhà cung cấp',
  stock_shortage: 'Mở kế hoạch mua',
  stale_demand: 'Mở nhu cầu nguyên liệu',
  stale_purchase_request: 'Mở đề xuất mua',
  kitchen_receipt_discrepancy: 'Mở checklist Bếp nhận',
  negative_stock: 'Mở tồn kho',
  inventory_ledger_mismatch: 'Mở đối chiếu tồn kho',
  orphan_document: 'Mở nhật ký chứng từ',
  invalid_unit: 'Mở danh mục đơn vị',
  missing_conversion: 'Mở quy đổi đơn vị',
  legacy_missing_conversion: 'Mở quy đổi đơn vị',
  unit_normalization_review: 'Mở chuẩn hóa đơn vị',
} as const)[category?.trim().toLocaleLowerCase('en-US') as keyof typeof dataQualityCategoryLabels] ?? 'Mở nơi xử lý';

/** Replaces storage implementation vocabulary in server-authored guidance. */
export const formatDataQualityCopy = (value?: string) => (value?.trim() || 'Chưa có mô tả')
  .replace(/current\s*stock/gi, 'tồn kho hiện tại')
  .replace(/stock\s*movements?/gi, 'bút toán kho')
  .replace(/\bledger\b/gi, 'sổ kho')
  .replace(/\bportion\s*rule\b/gi, 'quy tắc khẩu phần')
  .replace(/\bpublish(?:ed)?\b/gi, 'công bố')
  .replace(/\bcontracts?\b/gi, 'hợp đồng')
  .replace(/\bkilograms?\b/gi, 'kg')
  .replace(/\bpieces?\b/gi, 'cái');

/** Keeps coupled receipt lifecycle enums out of user-facing UI. */
export const formatReceiptLifecycleStatus = (status?: string, qualityStatus?: string) => {
  const normalizedStatus = normalizeStatusCode(status ?? '');
  const normalizedQuality = normalizeStatusCode(qualityStatus ?? '');

  if (normalizedStatus === 'DRAFT' && normalizedQuality === 'PENDINGINSPECTION') return 'Chờ kiểm tra chất lượng';
  if (normalizedStatus === 'PENDINGAPPROVAL' && normalizedQuality === 'ACCEPTED') return 'Chờ Quản lý duyệt';
  if (normalizedStatus === 'PENDINGAPPROVAL' && normalizedQuality === 'PARTIALLYACCEPTED') return 'Chờ duyệt phần đạt';
  if (normalizedStatus === 'APPROVED' && ['ACCEPTED', 'PARTIALLYACCEPTED'].includes(normalizedQuality)) return 'Sẵn sàng ghi sổ kho';
  if (normalizedStatus === 'POSTED' && ['ACCEPTED', 'PARTIALLYACCEPTED'].includes(normalizedQuality)) return 'Đã ghi sổ kho';
  if (normalizedStatus === 'REJECTED' && normalizedQuality === 'REJECTED') return 'Không đạt chất lượng';

  return formatWorkflowStatus(status);
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
