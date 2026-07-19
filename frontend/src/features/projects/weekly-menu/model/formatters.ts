import { formatQuantityWithUnit } from '@/lib/formatters'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import type { WeeklyMenuImportJobStatus } from './types'

export const importSlotLabels: Record<string, string> = {
  main: 'Món chính',
  sub1: 'Phụ 1',
  sub2: 'Phụ 2',
  rau: 'Rau',
  canh: 'Canh',
  fruit: 'Trái cây',
  dessert: 'Sữa chua',
}

export const normalizeDishMatchKey = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'd')
    .replace(/\b\d+\s*(g|gram)\b/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('vi-VN')

export const getShiftLabel = (shiftName?: string) => {
  if (shiftName === 'MORNING') return 'Ca sáng'
  if (shiftName === 'AFTERNOON') return 'Ca chiều'
  return shiftName || 'Chưa xác định ca'
}

export const getVariantLabel = (variant?: string) => {
  const normalized = (variant ?? '').toLowerCase()
  if (normalized === 'savory') return 'Mặn'
  if (normalized === 'vegetarian') return 'Chay'
  return variant || 'Theo file'
}

export const stripDishDisplayWeight = (value?: string | null) =>
  (value ?? '')
    .replace(/\s*\b\d+(?:[.,]\d+)?\s*(?:g|gram|kg)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

export const formatMenuDishName = (value?: string | null) => {
  const stripped = stripDishDisplayWeight(value)
  return stripped || value || '-'
}

export const normalizeMenuDisplayDiff = (value?: string | null) =>
  normalizeDishMatchKey(stripDishDisplayWeight(value))

export const isMeaningfulMenuDiff = (
  row: WeeklyMenuImportResult['previewDiff']['rows'][number],
) => {
  if (row.changeType === 'unchanged') return false
  return normalizeMenuDisplayDiff(row.currentDishName) !== normalizeMenuDisplayDiff(row.importedDishName)
}

export const summarizeImportWarnings = (warnings: string[]) => {
  const uniqueWarnings = Array.from(new Set(warnings.filter(Boolean)))
  const contractWarnings = uniqueWarnings.filter(
    (warning) => warning.includes('Không có hợp đồng hiệu lực') && warning.includes('dùng giá mặc định'),
  )
  const otherWarnings = uniqueWarnings.filter((warning) => !contractWarnings.includes(warning))

  if (contractWarnings.length === 0) return otherWarnings

  const firstMatch = /cho\s+(.+?)\s+ngày/i.exec(contractWarnings[0])
  const customer = firstMatch?.[1]?.trim()
  const priceMatch = /dùng giá mặc định\s+(.+?)(?:\s+và\s+BOM|$)/i.exec(contractWarnings[0])
  const price = priceMatch?.[1]?.trim()

  return [
    `Không có hợp đồng hiệu lực${customer ? ` cho ${customer}` : ''}: ${contractWarnings.length} ca/ngày đang dùng giá mặc định${price ? ` ${price}` : ''} và BOM 100%.`,
    ...otherWarnings,
  ]
}

export const formatMaterialDishSource = (dishNames: string[]) => {
  const uniqueNames = Array.from(new Set(dishNames.filter(Boolean)))
  if (uniqueNames.length === 0) return 'Chưa xác định'
  if (uniqueNames.length <= 2) return uniqueNames.join(', ')
  return `${uniqueNames.slice(0, 2).join(', ')} +${uniqueNames.length - 2} món`
}

export const formatQuantityVariance = (value: number, unit: string) => {
  if (value > 0) return `+${formatQuantityWithUnit(value, unit)}`
  if (value < 0) return `-${formatQuantityWithUnit(Math.abs(value), unit)}`
  return formatQuantityWithUnit(0, unit)
}

export const formatImportDate = (value?: string) => {
  if (!value) return 'Chưa xác định'
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (dateOnlyMatch) return `${Number(dateOnlyMatch[3])}/${Number(dateOnlyMatch[2])}/${dateOnlyMatch[1]}`

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN')
}

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('vi-VN')} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
}

export const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseDisplayDateToIso = (value?: string) => {
  if (!value) return ''
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!displayMatch) return ''

  return `${displayMatch[3]}-${displayMatch[2].padStart(2, '0')}-${displayMatch[1].padStart(2, '0')}`
}

export const LAST_WEEKLY_MENU_CUSTOMER_KEY = 'ipc.weeklyMenu.lastCustomerId'
export const LAST_WEEKLY_MENU_WEEK_KEY = 'ipc.weeklyMenu.lastWeekStartDate'

export const isValidWeekStartDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return true
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay() === 1
}

export const getStoredWeekStartDate = () => {
  const stored = window.localStorage.getItem(LAST_WEEKLY_MENU_WEEK_KEY) ?? ''
  if (stored && !isValidWeekStartDate(stored)) {
    window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY)
    return ''
  }
  return stored
}

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as { data?: { message?: string }; message?: string }
  return apiError.data?.message || apiError.message || fallback
}

export const getImportJobStatusLabel = (status: WeeklyMenuImportJobStatus) => {
  switch (status) {
    case 'previewing': return 'Đang kiểm tra'
    case 'previewed': return 'Có thể lưu'
    case 'committing': return 'Đang lưu'
    case 'committed': return 'Đã lưu'
    case 'failed': return 'Cần sửa'
    default: return 'Chưa kiểm tra'
  }
}
