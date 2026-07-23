import type { DemandLine, MaterialDemandStaleness, WorkflowDocument } from '@/features/workflow'
import type { WeeklyPlanRow } from '../model/types'
import type { QuickServingRow, WeeklyMenuScope } from '../schedule/types'

export type DemandApprovalPresentation = {
  status: 'not-created' | 'pending' | 'approved' | 'rejected'
  label: 'Chưa tạo' | 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'
  tone: DemandLine['tone']
  actionLabel: 'Tạo nhu cầu từ KHSX' | 'Mở hàng đợi duyệt' | 'Mở thu mua' | 'Tính lại nhu cầu'
  targetId?: string
  documentCode?: string
  reason?: string
}

export const getDemandApprovalPresentation = (
  lines: DemandLine[],
  serviceDate: string,
  rejectionReason?: string,
): DemandApprovalPresentation => {
  const demand = lines.find((line) => line.serviceDate === serviceDate && line.materialRequestId)
  if (!demand) {
    return {
      status: 'not-created',
      label: 'Chưa tạo',
      tone: 'neutral',
      actionLabel: 'Tạo nhu cầu từ KHSX',
    }
  }

  const shared = {
    targetId: demand.materialRequestId,
    documentCode: demand.sourceDocumentCode,
  }
  switch (demand.materialRequestStatus?.trim().toUpperCase()) {
    case 'MANAGERAPPROVED':
    case 'APPROVED':
      return { ...shared, status: 'approved', label: 'Đã duyệt', tone: 'success', actionLabel: 'Mở thu mua' }
    case 'CANCELLED':
    case 'REJECTED':
      return {
        ...shared,
        status: 'rejected',
        label: 'Từ chối',
        tone: 'danger',
        actionLabel: 'Tính lại nhu cầu',
        reason: rejectionReason,
      }
    default:
      return { ...shared, status: 'pending', label: 'Chờ duyệt', tone: 'warning', actionLabel: 'Mở hàng đợi duyệt' }
  }
}

export const buildDemandApprovalHref = ({
  week,
  serviceDate,
  targetId,
}: {
  week: string
  serviceDate: string
  targetId: string
}) => {
  const params = new URLSearchParams({
    target: 'material-demand',
    week,
    date: serviceDate,
    scope: 'FULLDAY',
    id: targetId,
  })
  return `/approvals?${params.toString()}`
}

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
  const total = totalCount ?? lines.length
  return {
    warningCount,
    staleCount: warningCount,
    shortageCount: shortages,
    enoughCount: Math.max(total - shortages, 0),
    totalCount: total,
    tone: (lines.length === 0 ? 'neutral' : warningCount > 0 ? 'warning' : shortages > 0 ? 'danger' : 'success') as DemandLine['tone'],
    label: lines.length === 0 ? 'Chưa kiểm tồn' : warningCount > 0 ? 'Cần tính lại' : shortages > 0 ? 'Thiếu nguyên liệu' : 'Đủ nguyên liệu',
  }
}

export const aggregateWeekStaleness = (
  results: Array<{ serviceDate: string; staleness: MaterialDemandStaleness }>,
  expectedDateCount = results.length,
): MaterialDemandStaleness | undefined => {
  if (results.length === 0 || results.length < expectedDateCount) return undefined
  const staleResults = results.filter(({ staleness }) => staleness.isStale)
  const generatedTimes = results
    .map(({ staleness }) => staleness.lastGeneratedAt)
    .filter((value): value is string => Boolean(value))
    .sort()

  return {
    hasExistingPlan: results.some(({ staleness }) => staleness.hasExistingPlan),
    isStale: staleResults.length > 0,
    lastGeneratedAt: generatedTimes.at(-1) ?? null,
    reasons: Array.from(new Set(staleResults.flatMap(({ serviceDate, staleness }) =>
      staleness.reasons.map((reason) => `${serviceDate}: ${reason}`),
    ))),
  }
}

type WeekStalenessQueryResult = {
  data?: { data?: MaterialDemandStaleness | null }
  isLoading?: boolean
  isFetching?: boolean
  isError?: boolean
}

export const getWeekStalenessState = (
  serviceDates: string[],
  queryResults: WeekStalenessQueryResult[],
) => {
  const expectedDateCount = serviceDates.length
  if (expectedDateCount === 0) {
    return { status: 'idle' as const, expectedDateCount, completedDateCount: 0, staleness: undefined }
  }

  const requiredResults = queryResults.slice(0, expectedDateCount)
  const completedResults = requiredResults.flatMap((result, index) => result.data?.data
    ? [{ serviceDate: serviceDates[index], staleness: result.data.data }]
    : [])
  const completedDateCount = completedResults.length

  if (requiredResults.some((result) => result.isError)) {
    return { status: 'error' as const, expectedDateCount, completedDateCount, staleness: undefined }
  }
  if (completedDateCount < expectedDateCount || requiredResults.some((result) => result.isLoading || result.isFetching)) {
    return { status: 'loading' as const, expectedDateCount, completedDateCount, staleness: undefined }
  }
  return {
    status: 'ready' as const,
    expectedDateCount,
    completedDateCount,
    staleness: aggregateWeekStaleness(completedResults, expectedDateCount),
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
