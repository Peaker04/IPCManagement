import type { StatusTone, StatusPresentation } from '@/lib/statusPresentation';
export type { StatusTone, StatusPresentation };

export type StatusDomain =
  | 'purchase'
  | 'warehouse'
  | 'reconciliation'
  | 'chef'
  | 'weekly_menu'
  | 'admin'
  | 'coordination'
  | 'general';

const normalizeStatusKey = (status: string) => status.toUpperCase().replace(/[\s_-]/g, '');

// ==========================================
// 1. PURCHASE DOMAIN REGISTRY
// ==========================================
export const purchaseStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PENDINGAPPROVAL: { label: 'Chờ duyệt', tone: 'warning' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'neutral' },
  ORDERED: { label: 'Đã đặt hàng', tone: 'info' },
  PARTIALLYRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  PARTIALRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  RECEIVED: { label: 'Đã nhận đủ', tone: 'success' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  SELECTED: { label: 'Đang chọn', tone: 'info' },
  BLOCKED: { label: 'Cần xử lý', tone: 'warning' },
};

// ==========================================
// 2. WAREHOUSE DOMAIN REGISTRY
// ==========================================
export const warehouseStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  PENDING: { label: 'Chờ xuất', tone: 'warning' },
  PENDINGRECEIPT: { label: 'Chờ nhập', tone: 'warning' },
  READY: { label: 'Sẵn sàng', tone: 'neutral' },
  ISSUED: { label: 'Đã xuất', tone: 'info' },
  PARTIALLYISSUED: { label: 'Xuất một phần', tone: 'warning' },
  PARTIALLYRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  PARTIALRECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  RECEIVED: { label: 'Đã nhận', tone: 'success' },
  CONFIRMED: { label: 'Đã ký nhận', tone: 'success' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  ORDERED: { label: 'Đã đặt hàng', tone: 'info' },
  RETURNED: { label: 'Đã trả kho', tone: 'neutral' },
  ADJUSTED: { label: 'Đã điều chỉnh', tone: 'info' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  BLOCKED: { label: 'Đang bị chặn', tone: 'danger' },
};

// ==========================================
// 3. RECONCILIATION / MRX REGISTRY
// ==========================================
export const reconciliationStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  DRAFT: { label: 'Đang chuẩn bị', tone: 'neutral' },
  READY: { label: 'Đã khóa', tone: 'neutral' },
  TRANSFERRED: { label: 'Chờ Kho xuất', tone: 'warning' },
  INPROGRESS: { label: 'Đang đối chiếu', tone: 'info' },
  IN_PROGRESS: { label: 'Đang đối chiếu', tone: 'info' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  MATCHED: { label: 'Khớp', tone: 'success' },
  MATCHEDTHRESHOLD: { label: 'Khớp trong ngưỡng', tone: 'success' },
  MATCHED_THRESHOLD: { label: 'Khớp trong ngưỡng', tone: 'success' },
  NEEDSREVIEW: { label: 'Cần kiểm tra', tone: 'warning' },
  NEEDS_REVIEW: { label: 'Cần kiểm tra', tone: 'warning' },
  DISPOSITIONED: { label: 'Đã xử lý', tone: 'info' },
  DISPOSED: { label: 'Đã xử lý', tone: 'info' },
  SHORTAGE: { label: 'Chưa xuất đủ', tone: 'danger' },
  UNDER_ISSUED: { label: 'Chưa xuất đủ', tone: 'danger' },
  OVER: { label: 'Xuất dư', tone: 'warning' },
  UNDER: { label: 'Chưa xuất đủ', tone: 'danger' },
  INVALID: { label: 'Chưa hợp lệ', tone: 'neutral' },
};

// ==========================================
// 4. CHEF / PRODUCTION REGISTRY
// ==========================================
export const chefStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  PLANNED: { label: 'Kế hoạch', tone: 'neutral' },
  READYTOPRODUCE: { label: 'Sẵn sàng', tone: 'neutral' },
  READY_TO_PRODUCE: { label: 'Sẵn sàng', tone: 'neutral' },
  INSERVICE: { label: 'Đang phục vụ', tone: 'info' },
  IN_SERVICE: { label: 'Đang phục vụ', tone: 'info' },
  READYTOCLOSE: { label: 'Sẵn sàng đóng ca', tone: 'neutral' },
  READY_TO_CLOSE: { label: 'Sẵn sàng đóng ca', tone: 'neutral' },
  CLOSED: { label: 'Hoàn tất', tone: 'success' },
  BLOCKED: { label: 'Bị chặn', tone: 'danger' },
  SIGNED: { label: 'Đã nhận', tone: 'success' },
  SIGNEDALL: { label: 'Đã nhận đủ', tone: 'success' },
  UNRECEIVED: { label: 'Chờ nhận', tone: 'warning' },
  SYNCED: { label: 'Kế hoạch đã đồng bộ', tone: 'success' },
  LOADING: { label: 'Đang tải', tone: 'neutral' },
  FAILED: { label: 'Không tải được', tone: 'danger' },
  WAITINGCOORDINATION: { label: 'Chờ Điều phối gửi', tone: 'warning' },
};

// ==========================================
// 5. WEEKLY MENU REGISTRY
// ==========================================
export const weeklyMenuStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  IDLE: { label: 'Chờ kiểm tra', tone: 'neutral' },
  PREVIEWING: { label: 'Đang kiểm tra', tone: 'warning' },
  PREVIEWED: { label: 'Đã kiểm tra', tone: 'info' },
  COMMITTING: { label: 'Đang lưu', tone: 'warning' },
  COMMITTED: { label: 'Đã lưu', tone: 'success' },
  FAILED: { label: 'Lỗi import', tone: 'danger' },
  CONFIRMED: { label: 'Đã chốt', tone: 'success' },
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  ACTIVE: { label: 'Đang áp dụng', tone: 'neutral' },
  SUPERSEDED: { label: 'Đã thay thế', tone: 'neutral' },
  LOCKED: { label: 'Đã khóa', tone: 'neutral' },
  PUBLISHED: { label: 'Hoàn tất', tone: 'success' },
  CONFIGURED: { label: 'Đã cấu hình', tone: 'success' },
  UNCONFIGURED: { label: 'Chưa cấu hình', tone: 'warning' },
};

// ==========================================
// 6. ADMIN DATA & QUALITY REGISTRY
// ==========================================
export const adminStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'success' },
  INACTIVE: { label: 'Tạm ngưng', tone: 'neutral' },
  EFFECTIVE: { label: 'Đang hiệu lực', tone: 'success' },
  EXPIRED: { label: 'Hết hiệu lực', tone: 'neutral' },
  OPEN: { label: 'Chưa xử lý', tone: 'warning' },
  RESOLVED: { label: 'Đã xử lý', tone: 'success' },
  REOPENED: { label: 'Đã mở lại', tone: 'danger' },
  ERROR: { label: 'Lỗi', tone: 'danger' },
  WARNING: { label: 'Cảnh báo', tone: 'warning' },
  INFO: { label: 'Thông tin', tone: 'info' },
};

// ==========================================
// 7. COORDINATION DOMAIN REGISTRY
// ==========================================
export const coordinationStatusRegistry: Readonly<Record<string, StatusPresentation>> = {
  DRAFT: { label: 'Bản nháp', tone: 'warning' },
  LOCKED: { label: 'Đã khóa', tone: 'info' },
  CONFIRMED: { label: 'Đã chốt', tone: 'info' },
  ADJUSTED: { label: 'Đã điều chỉnh', tone: 'info' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  ARCHIVED: { label: 'Lưu trữ', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  SYNCING: { label: 'Đang đồng bộ', tone: 'info' },
  EMPTY: { label: 'Chưa có kế hoạch', tone: 'neutral' },
  MIXED: { label: 'Chưa đồng nhất', tone: 'warning' },
};

const domainRegistries: Record<StatusDomain, Readonly<Record<string, StatusPresentation>>> = {
  purchase: purchaseStatusRegistry,
  warehouse: warehouseStatusRegistry,
  reconciliation: reconciliationStatusRegistry,
  chef: chefStatusRegistry,
  weekly_menu: weeklyMenuStatusRegistry,
  admin: adminStatusRegistry,
  coordination: coordinationStatusRegistry,
  general: {},
};

/**
 * Resolves any raw status string into a presentation (label + tone) via domain registry
 * with automatic fallback to general dictionary.
 */
export function resolveStatus(status?: string | null, domain?: StatusDomain): StatusPresentation {
  if (!status || !status.trim()) {
    return { label: 'Chưa xác định', tone: 'neutral' };
  }

  const normalized = normalizeStatusKey(status.trim());

  if (domain && domainRegistries[domain]?.[normalized]) {
    return domainRegistries[domain][normalized];
  }

  // Fallback search across all domains
  for (const dom of Object.values(domainRegistries)) {
    if (dom[normalized]) {
      return dom[normalized];
    }
  }

  // Text-based fallback detection for unstructured display text
  const lower = status.toLowerCase();
  if (['lỗi', 'thất bại', 'từ chối', 'hủy', 'bị chặn', 'vượt ngưỡng'].some((t) => lower.includes(t))) {
    return { label: status, tone: 'danger' };
  }
  if (['chờ', 'cảnh báo', 'nhận một phần', 'đang mở', 'cần xử lý', 'theo dõi'].some((t) => lower.includes(t))) {
    return { label: status, tone: 'warning' };
  }
  if (['hoàn tất', 'đã duyệt', 'đã nhận', 'thành công', 'khớp', 'hoạt động'].some((t) => lower.includes(t))) {
    return { label: status, tone: 'success' };
  }
  if (['đang', 'tiến trình', 'thông tin', 'đặt hàng'].some((t) => lower.includes(t))) {
    return { label: status, tone: 'info' };
  }

  return { label: status, tone: 'neutral' };
}

/**
 * Standard resolver for boolean active/inactive flags (Rules, Contracts, Employees, etc.)
 */
export function resolveActiveStatus(
  isActive: boolean,
  activeLabel = 'Đang hoạt động',
  inactiveLabel = 'Tạm ngưng',
): StatusPresentation {
  return {
    label: isActive ? activeLabel : inactiveLabel,
    tone: isActive ? 'success' : 'neutral',
  };
}

/**
 * Standard resolver for price variance warnings (Reports module)
 */
export function resolvePriceVarianceStatus(isWarning: boolean, change: number): StatusPresentation | null {
  if (isWarning) {
    return { label: 'Vượt ngưỡng', tone: 'danger' };
  }
  if (change > 0) {
    return { label: 'Theo dõi', tone: 'warning' };
  }
  return null;
}
