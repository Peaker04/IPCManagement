/**
 * Authoritative Status and Shift Dictionaries for Material Reconciliation (MRX)
 */
export const MRX_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  READY: 'Sẵn sàng',
  TRANSFERRED: 'Chờ Kho xuất',
  IN_PROGRESS: 'Đang đối chiếu',
  COMPLETED: 'Hoàn tất',
  WEEK_UNTOUCHED: 'Chưa xuất',
  WEEK_IN_PROGRESS: 'Đang xuất theo ngày',
  WEEK_COMPLETE: 'Đã xuất đủ',
  VARIANCE_REQUIRES_RESOLUTION: 'Cần giải trình lệch',
  MATCHED: 'Khớp định mức',
  EXACT: 'Khớp',
  NEEDS_REVIEW: 'Cần giải trình',
  DISPOSED: 'Đã giải trình',
  RESOLVED: 'Đã giải trình',
  INCOMPLETE: 'Chưa xuất đủ',
  UNDER_ISSUED: 'Chờ xuất đủ',
  OVER_ISSUED: 'Xuất vượt',
  UNTOUCHED: 'Chưa xuất',
  PARTIAL: 'Đang xuất một phần',
  COMPLETE: 'Đã xuất đủ',
  NO_REQUIREMENT: 'Không có nhu cầu',
  OVERAGE_REQUIRES_RESOLUTION: 'Cần giải trình lệch',
  LEGACY_INCOMPATIBLE: 'Không tương thích theo ngày',
};

export const MRX_DISPOSITION_CATEGORY_LABELS: Record<string, string> = {
  ACCEPTED_VARIANCE: 'Chấp nhận chênh lệch',
  CORRECTION_REQUIRED: 'Cần điều chỉnh số liệu',
  FOLLOW_UP_REQUIRED: 'Cần theo dõi thêm',
};

export const MRX_STATUS_VARIANTS: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  READY: 'info',
  TRANSFERRED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'neutral',
};

export interface MrxShiftOption {
  value: 'ALL' | 'MORNING' | 'AFTERNOON';
  label: string;
}

export const MRX_SHIFT_OPTIONS: MrxShiftOption[] = [
  { value: 'ALL', label: 'Tất cả các ca' },
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
];

export function getMrxDishSlotLabel(slot?: string | null): string {
  // Keep persisted slot categories aligned with WeeklyMenuImportSupport.ParsePersistedDishSlot; unknown is not main.
  const labels: Record<string, string> = { main: 'Món chính', sub1: 'Phụ 1', sub2: 'Phụ 2', rau: 'Rau', canh: 'Canh', fruit: 'Trái cây', dessert: 'Tráng miệng' };
  const key = (slot ?? '').replace(/^(savory|vegetarian)-/, '');
  return labels[key] ?? `Chưa rõ phân loại (${slot || 'trống'})`;
}

export function getMrxShiftLabel(shift: string): string {
  if (shift === 'EVENING' || shift === 'Ca tối') return 'Tối';
  if (shift === 'FULLDAY' || shift === 'Cả ngày') return 'Cả ngày';
  const canonical = shift === 'Ca sáng' ? 'MORNING' : shift === 'Ca chiều' ? 'AFTERNOON' : shift;
  return MRX_SHIFT_OPTIONS.find(option => option.value === canonical)?.label ?? `Chưa rõ ca (${shift || 'trống'})`;
}
