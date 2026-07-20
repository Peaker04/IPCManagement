import type { DemandLine, WorkflowDocument } from '@/features/workflow'
import type { WeeklyPlanRow } from '../model/types'
import type { QuickServingRow, WeeklyMenuScope } from '../schedule/types'

export const buildDemandDayPages = (scope: WeeklyMenuScope, rows: WeeklyPlanRow[]) =>
  scope.displayDays.map((day) => ({ ...day, rows: rows.filter((row) => row.dayKey === day.key) }))
    .filter((day) => day.rows.length > 0)

export const getDemandDayIndex = (
  pages: ReturnType<typeof buildDemandDayPages>,
  selectedDayKey: string | null,
  activeDayKey?: string,
) => {
  if (pages.length === 0) return 0
  const selectedIndex = selectedDayKey ? pages.findIndex((day) => day.key === selectedDayKey) : -1
  if (selectedIndex >= 0) return selectedIndex
  const activeIndex = activeDayKey ? pages.findIndex((day) => day.key === activeDayKey) : -1
  return activeIndex >= 0 ? activeIndex : 0
}

export const getDemandInventoryStatus = (lines: DemandLine[], totalCount?: number, shortageCount?: number) => {
  const warningCount = lines.filter((line) => line.tone === 'warning').length
  const shortages = shortageCount ?? lines.filter((line) => Math.max(line.required - (line.available - line.reserved), 0) > 0).length
  return {
    warningCount,
    shortageCount: shortages,
    enoughCount: (totalCount ?? lines.length) - shortages - warningCount,
    tone: (lines.length === 0 ? 'neutral' : warningCount > 0 ? 'warning' : shortages > 0 ? 'danger' : 'success') as DemandLine['tone'],
    label: lines.length === 0 ? 'Chưa kiểm tồn' : warningCount > 0 ? 'Cần tính lại' : shortages > 0 ? 'Thiếu nguyên liệu' : 'Đủ nguyên liệu',
  }
}

export const getPendingQuickServingRows = (rows: QuickServingRow[], serviceDates: string[]) => {
  const dateSet = new Set(serviceDates)
  return rows.filter((row) => dateSet.has(row.serviceDate) && !row.isCompleted)
    .map((row) => ({ ...row, nextServings: Math.round(Number.parseFloat(row.inputValue)) }))
    .filter((row) => Number.isFinite(row.nextServings) && row.nextServings > 0)
}

export const buildKhsxDraftDocument = ({
  activeDay,
  allRows,
  customerCode,
  customerLabel,
  hasDemand,
}: {
  activeDay?: ReturnType<typeof buildDemandDayPages>[number]
  allRows: WeeklyPlanRow[]
  customerCode: string
  customerLabel: string
  hasDemand: boolean
}): WorkflowDocument | null => {
  if (!activeDay || allRows.length === 0) return null
  const serviceDates = Array.from(new Set(allRows.map((row) => row.serviceDate).filter(Boolean)))
  const totalPortions = activeDay.rows.reduce((sum, row) => sum + row.portions, 0)
  const missingBom = activeDay.rows.filter((row) => !row.hasCatalogBom).length
  return {
    id: `KHSX-DRAFT-${customerCode}-${activeDay.key}`,
    type: 'KHSX',
    title: 'KHSX theo menu đang xem',
    status: hasDemand ? 'Đã tạo nhu cầu' : 'Bản nháp',
    owner: 'Bếp trưởng',
    summary: hasDemand
      ? 'Nhu cầu nguyên liệu đã được tạo từ KHSX của khách hàng đang chọn.'
      : 'Bản KHSX tạm từ thực đơn tuần; bấm Tạo nhu cầu từ KHSX để hệ thống tính nguyên liệu.',
    route: '/weekly-menu',
    tone: hasDemand ? 'success' : missingBom > 0 ? 'warning' : 'neutral',
    lines: [
      { label: 'Khách hàng', value: customerLabel },
      { label: 'Ngày', value: `${activeDay.label} ${activeDay.date}` },
      { label: 'Ngày tuần', value: serviceDates.length.toString() },
      { label: 'Dòng KHSX', value: activeDay.rows.length.toString() },
      { label: 'Tổng suất ngày', value: totalPortions.toLocaleString('vi-VN') },
      { label: 'Thiếu BOM ngày', value: missingBom.toString(), tone: missingBom > 0 ? 'warning' : 'success' },
    ],
  }
}
