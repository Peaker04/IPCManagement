import type { DemandLine, WorkflowDocument } from '@/types/workflow'
import type { MaterialDemandStaleness } from '@/api/workflowApiTypes'
import type { WeeklyPlanRow } from '../model/types'
import type { QuickServingRow, WeeklyMenuScope } from '../schedule/types'
import { formatMaterialDishSource } from '../model/formatters'
import { formatNumber } from '@/lib/formatters'

export type DemandApprovalPresentation = {
  status: 'not-created' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'terminal'
  label: 'Chưa tạo' | 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | 'Đã hủy' | 'Đã gửi kho' | 'Đã xuất kho'
  tone: DemandLine['tone']
  actionLabel: 'Tạo nhu cầu từ KHSX' | 'Mở hàng đợi duyệt' | 'Mở thu mua' | 'Tính lại nhu cầu'
  targetId?: string
  documentCode?: string
  reason?: string
}

export const getDemandActionPresentation = (
  approvalStatus: DemandApprovalPresentation['status'],
  isStale = false,
  canRegenerate = true,
) => ({
  primaryAction: approvalStatus === 'terminal'
    ? 'none' as const
    : approvalStatus === 'approved'
    ? 'purchasing' as const
    : approvalStatus === 'pending'
      ? 'approval' as const
      : 'generate' as const,
  showGenerate: canRegenerate && (approvalStatus === 'not-created' || approvalStatus === 'pending' || approvalStatus === 'rejected' || approvalStatus === 'cancelled' || (approvalStatus === 'approved' && isStale)),
  generateIsSecondary: approvalStatus === 'pending' || (approvalStatus === 'approved' && isStale),
  requiresRegenerateConfirmation: approvalStatus === 'approved',
})

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
    case 'SENTTOWAREHOUSE':
      return { ...shared, status: 'terminal', label: 'Đã gửi kho', tone: 'success', actionLabel: 'Mở thu mua' }
    case 'EXPORTED':
      return { ...shared, status: 'terminal', label: 'Đã xuất kho', tone: 'success', actionLabel: 'Mở thu mua' }
    case 'REJECTED':
      return {
        ...shared,
        status: 'rejected',
        label: 'Từ chối',
        tone: 'danger',
        actionLabel: 'Tính lại nhu cầu',
        reason: rejectionReason,
      }
    case 'CANCELLED':
      return {
        ...shared,
        status: 'cancelled',
        label: 'Đã hủy',
        tone: 'neutral',
        actionLabel: 'Tính lại nhu cầu',
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
  const pendingKitchenCount = lines.filter((line) => (line.pendingKitchenReceiptQty ?? 0) > 0).length
  const staleCount = lines.filter((line) => line.tone === 'warning' && (line.pendingKitchenReceiptQty ?? 0) <= 0).length
  const shortages = shortageCount ?? lines.filter((line) => (line.unissuedQty ?? Math.max(line.required - (line.available - line.reserved), 0)) > 0).length
  const total = totalCount ?? lines.length
  return {
    warningCount: staleCount + pendingKitchenCount,
    staleCount,
    pendingKitchenCount,
    shortageCount: shortages,
    enoughCount: Math.max(total - shortages - pendingKitchenCount - staleCount, 0),
    totalCount: total,
    tone: (lines.length === 0 ? 'neutral' : shortages > 0 ? 'danger' : pendingKitchenCount > 0 || staleCount > 0 ? 'warning' : 'success') as DemandLine['tone'],
    label: lines.length === 0 ? 'Chưa có vật tư' : shortages > 0 ? 'Thiếu hàng' : pendingKitchenCount > 0 ? 'Chờ Bếp nhận' : staleCount > 0 ? 'Cần tính lại' : 'Đủ hàng',
  }
}

export const isDemandLineException = (line: DemandLine) =>
  line.tone === 'warning' || (line.unissuedQty ?? Math.max(line.required - (line.available - line.reserved), 0)) > 0

export const partitionDemandLines = (lines: DemandLine[]) => ({
  exceptionLines: lines.filter(isDemandLineException),
  sufficientLines: lines.filter((line) => !isDemandLineException(line)),
})

const demandDishSourceKey = (line: DemandLine, fallbackServiceDate?: string) => {
  const date = line.serviceDate || fallbackServiceDate
  const unitIdentity = line.unitId || line.unit
  return date && line.ingredientId && unitIdentity
    ? `${date}__${String(line.ingredientId).trim().toLowerCase()}__${String(unitIdentity).trim().toLowerCase()}__${line.priceTierAmount ? Number(line.priceTierAmount) : 'no-tier'}`
    : `source__${line.id}`
}

export const attachDemandDishSources = (
  aggregateLines: DemandLine[],
  detailLines: DemandLine[],
  serviceDate: string,
  fallbackDishSources?: Record<string, { dishNames?: string[] } | string[] | undefined> | Map<string, string[]>,
) => {
  const sourcesByMaterial = new Map<string, Set<string>>()
  const sourcesByIngredient = new Map<string, Set<string>>()
  const sourcesByName = new Map<string, Set<string>>()

  const addSource = (map: Map<string, Set<string>>, key: string | undefined, source: string | undefined) => {
    if (!key || !source || source === 'Chưa xác định') return
    const normalized = key.trim().toLowerCase()
    const set = map.get(normalized) ?? new Set<string>()
    set.add(source)
    map.set(normalized, set)
  }

  detailLines
    .filter((line) => line.serviceDate === serviceDate)
    .forEach((line) => {
      const key = demandDishSourceKey(line, serviceDate)
      addSource(sourcesByMaterial, key, line.source)
      if (line.ingredientId) {
        addSource(sourcesByIngredient, line.ingredientId, line.source)
      }
      if (line.material) {
        addSource(sourcesByName, `${line.material}|${line.unit ?? ''}`, line.source)
        addSource(sourcesByName, line.material, line.source)
      }
    })

  return aggregateLines.map((line) => {
    const key = demandDishSourceKey(line, serviceDate)
    let foundSources = Array.from(sourcesByMaterial.get(key) ?? [])

    if (foundSources.length === 0 && line.ingredientId) {
      foundSources = Array.from(sourcesByIngredient.get(line.ingredientId.trim().toLowerCase()) ?? [])
    }
    if (foundSources.length === 0 && line.material) {
      foundSources = Array.from(
        sourcesByName.get(`${line.material.trim().toLowerCase()}|${(line.unit ?? '').trim().toLowerCase()}`)
          ?? sourcesByName.get(line.material.trim().toLowerCase())
          ?? [],
      )
    }

    if (foundSources.length === 0 && fallbackDishSources) {
      if (fallbackDishSources instanceof Map) {
        const fromMap = fallbackDishSources.get(line.ingredientId?.trim().toLowerCase() ?? '')
          ?? fallbackDishSources.get(`${line.material?.trim().toLowerCase()}|${(line.unit ?? '').trim().toLowerCase()}`)
          ?? fallbackDishSources.get(line.material?.trim().toLowerCase() ?? '')
        if (fromMap && fromMap.length > 0) {
          foundSources = fromMap
        }
      } else {
        const entry = fallbackDishSources[line.ingredientId ?? '']
          ?? fallbackDishSources[`${line.ingredientId}|${line.unitId}`]
          ?? fallbackDishSources[`${line.material}|${line.unit}`]
          ?? fallbackDishSources[line.material ?? '']

        if (entry) {
          const names = Array.isArray(entry) ? entry : (entry.dishNames ?? [])
          if (names.length > 0) {
            foundSources = names
          }
        }
      }
    }

    return {
      ...line,
      source: formatMaterialDishSource(foundSources),
    }
  })
}

const demandDocumentDateTokens = (serviceDate: string) => {
  const [year, month, day] = serviceDate.split('-')
  if (!year || !month || !day) return []
  return [serviceDate, `${year}${month}${day}`, `${day}/${month}/${year}`]
}

export const isDemandDocumentForDate = (document: WorkflowDocument, serviceDate: string) => {
  const searchableText = [
    document.id,
    document.title,
    document.summary,
    ...document.lines.flatMap((line) => [line.label, line.value]),
  ].join(' ').toLocaleLowerCase('vi-VN')

  return demandDocumentDateTokens(serviceDate).some((token) => searchableText.includes(token.toLocaleLowerCase('vi-VN')))
}

export const aggregateWeekStaleness = (
  results: Array<{ serviceDate: string; staleness: MaterialDemandStaleness }>,
  expectedDateCount = results.length,
): MaterialDemandStaleness | undefined => {
  if (results.length === 0 || results.length < expectedDateCount) return undefined
  const staleResults = results.filter(({ staleness }) => staleness.isStale)
  const canRegenerate = results.some(({ staleness }) => staleness.canRegenerate !== false)
  const regenerationBlockReasons = results.flatMap(({ serviceDate, staleness }) =>
    staleness.regenerationBlockReason ? [`${serviceDate}: ${staleness.regenerationBlockReason}`] : [],
  )
  const generatedTimes = results
    .map(({ staleness }) => staleness.lastGeneratedAt)
    .filter((value): value is string => Boolean(value))
    .sort()

  return {
    hasExistingPlan: results.some(({ staleness }) => staleness.hasExistingPlan),
    isStale: staleResults.length > 0,
    canRegenerate,
    regenerationBlockReason: canRegenerate ? null : Array.from(new Set(regenerationBlockReasons)).join(' | ') || null,
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
      { label: 'Tổng suất ngày', value: formatNumber(totalPortions) },
      { label: 'Thiếu BOM ngày', value: missingBom.toString(), tone: missingBom > 0 ? 'warning' : 'success' },
    ],
  }
}
