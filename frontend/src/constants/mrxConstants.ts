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
  { value: 'MORNING', label: 'Ca 1 (Sáng)' },
  { value: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
];
