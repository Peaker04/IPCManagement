/**
 * IPC Management — Shared format helpers
 *
 * Gom các hàm format tiền tệ, số, ngày dùng chung
 * thay vì khai báo inline ở từng component.
 */

/** Định dạng tiền tệ VND (e.g. 35.000 ₫) */
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

/** Định dạng số có dấu phân cách hàng nghìn (e.g. 1.234) */
export const formatNumber = (value: number): string =>
  value.toLocaleString('vi-VN')

/** Định dạng ngày theo locale Việt Nam (e.g. thứ Hai, 16/06/2025) */
export const formatDateVN = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
