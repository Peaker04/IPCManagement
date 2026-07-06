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

/** Định dạng ngày theo locale Việt Nam (e.g. thứ Hai, 16/06/2025) */
export const formatDateVN = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
