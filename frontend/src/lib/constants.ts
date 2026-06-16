/**
 * IPC Management — Shared constants dùng chung giữa các trang
 *
 * Thay vì khai báo DAYS_OF_WEEK, SHIFTS, LOCK_TIME riêng ở mỗi feature,
 * tất cả được gom vào đây để import thống nhất.
 */

/** Mã ngày trong tuần (dùng ở coordination, chef, weekly menu, v.v.) */
export interface DayOfWeek {
  key: string
  label: string
}

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  { key: 't2', label: 'Thứ Hai' },
  { key: 't3', label: 'Thứ Ba' },
  { key: 't4', label: 'Thứ Tư' },
  { key: 't5', label: 'Thứ Năm' },
  { key: 't6', label: 'Thứ Sáu' },
  { key: 't7', label: 'Thứ Bảy' },
  { key: 'cn', label: 'Chủ Nhật' },
] as const

/** Ngày trong tuần có ngày cụ thể (WeeklyMenuPage dùng) */
export interface DayOfWeekWithDate extends DayOfWeek {
  date: string
}

export const DAYS_OF_WEEK_WITH_DATES: readonly DayOfWeekWithDate[] = [
  { key: 't2', label: 'Thứ Hai', date: '6/15/2025' },
  { key: 't3', label: 'Thứ Ba', date: '6/16/2025' },
  { key: 't4', label: 'Thứ Tư', date: '6/17/2025' },
  { key: 't5', label: 'Thứ Năm', date: '6/18/2025' },
  { key: 't6', label: 'Thứ Sáu', date: '6/19/2025' },
  { key: 't7', label: 'Thứ Bảy', date: '6/20/2025' },
] as const

/** Tên ca làm việc */
export const SHIFTS = ['Ca Sáng', 'Ca Chiều'] as const

/** Map nhãn ca (key → label) */
export const SHIFT_LABELS: Record<string, string> = {
  'Ca Sáng': 'Ca Sáng',
  'Ca Chiều': 'Ca Chiều',
} as const

/** Giờ khóa ca sáng (8:30 AM) */
export const LOCK_TIME = { hours: 8, minutes: 30 } as const
