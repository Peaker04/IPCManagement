/**
 * IPC Management — Shared format helpers
 *
 * Gom các hàm format tiền tệ, số, ngày dùng chung
 * thay vì khai báo inline ở từng component.
 */

/** Định dạng tiền tệ VND (e.g. 35.000 ₫) */
export const formatCurrency = (value: number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits,
  }).format(value)

/** Định dạng số có dấu phân cách hàng nghìn (e.g. 1.234) */
export const formatNumber = (value: number): string =>
  value.toLocaleString('vi-VN')

export const QUANTITY_SCALE = 6
export const MONEY_SCALE = 2
export const PERCENT_SCALE = 2

const QUANTITY_TOLERANCE = 0.000001

const roundToScale = (value: number, scale: number): number => {
  const multiplier = 10 ** scale
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

export const roundQuantity = (value: number): number => {
  const rounded = roundToScale(value, QUANTITY_SCALE)
  return Math.abs(rounded) < QUANTITY_TOLERANCE ? 0 : rounded
}

export const roundMoney = (value: number): number =>
  roundToScale(value, MONEY_SCALE)

export const roundPercent = (value: number): number =>
  roundToScale(value, PERCENT_SCALE)

const UNIT_LABELS: Record<string, string> = {
  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',
  gram: 'g',
  grams: 'g',
  g: 'g',
  liter: 'l',
  litre: 'l',
  l: 'l',
}

export const formatQuantity = (
  value: number,
  options: { maximumFractionDigits?: number } = {},
): string => {
  const normalized = roundQuantity(value)
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 3,
  }).format(normalized)
}

export const formatUnit = (unit: string): string => {
  const key = unit.trim().toLowerCase()
  return UNIT_LABELS[key] ?? unit
}

export const formatQuantityWithUnit = (
  value: number,
  unit: string,
  options?: { maximumFractionDigits?: number },
): string => `${formatQuantity(value, options)} ${formatUnit(unit)}`.trim()

export const formatPercent = (value: number, maximumFractionDigits = 1): string =>
  `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)}%`

/** Định dạng ngày chỉ có phần ngày từ giá trị ISO (e.g. 20/07/2026). */
export const formatDateOnly = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const yearNumber = Number(year)
  const leapYear = yearNumber % 4 === 0 && (yearNumber % 100 !== 0 || yearNumber % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= daysInMonth[monthNumber - 1]
    ? `${day}/${month}/${year}`
    : value
}

/** Định dạng mốc thời gian theo locale Việt Nam, dùng đồng hồ 24 giờ. */
export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return 'Chưa xác định'
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return typeof value === 'string' ? value : 'Chưa xác định'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(parsed)
}

/** Định dạng ngày theo locale Việt Nam (e.g. thứ Hai, 16/06/2025) */
export const formatDateVN = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
