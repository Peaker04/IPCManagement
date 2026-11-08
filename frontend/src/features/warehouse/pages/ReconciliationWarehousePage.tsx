import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Info, Plus, Trash2 } from 'lucide-react'
import { EmptyState, InfoNote, InlineAlert, OperationalFrame, PaginationBar, SearchField, SectionPanel, StatusBadge, TableSkeleton, TabContentSkeleton, TableViewport, ViewSwitcher } from '@/components/common'
import { Button } from '@/components/ui/button'
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGetWarehouseSelectorQuery } from '@/api/warehouseApi'
import { resolveOperationalWarehouseContext } from '@/lib/operationalWarehouseContext'
import { formatDateOnly, formatQuantityWithUnit, formatUnit, getDateTimeFormat, roundQuantity } from '@/lib/formatters'
import { compareIssueQuantity, issueQuantityDifference } from './reconciliationIssueQuantity'
import { buildWeeklyMenuRoute, ROUTES } from '@/lib/routeConfig'
import { readReconciliationSelection, type ReconciliationWarehouseView, writeReconciliationSelection, visibleTabIds } from '@/lib/navigationPreferences'
import { cn } from '@/lib/utils'
import { eligiblePageTabs } from '@/lib/systemOperationEligibility'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { useCreateReconciliationIssueMutation, useGetReconciliationBatchQuery, useGetReconciliationWarehouseDailyQuery, useListReconciliationBatchesQuery, useListReconciliationBatchDishesQuery, useListReconciliationIssueHistoryQuery, type ReconciliationIssueHistoryItem, type ReconciliationLine, type ReconciliationWarehouseDailyLine } from '@/api/reconciliationApi'
import { ReconciliationIssueDetailDialog } from '@/components/reconciliation/ReconciliationIssueDetailDialog'
import { ReconciliationIssueHistoryTable } from '@/components/reconciliation/ReconciliationIssueHistoryTable'
import { ReconciliationLifecycleStrip } from '@/components/reconciliation/ReconciliationLifecycleStrip'
import { getReconciliationLifecyclePresentation } from '@/lib/reconciliationLifecyclePresentation'
import { useHasRole } from '@/lib/useHasRole'
import { useLocalPagination } from '@/lib/useLocalPagination'

const isReconciliationWarehouseView = (value: string | null | undefined): value is ReconciliationWarehouseView => value === 'demand' || value === 'movement'

const weeklyStatusLabel: Record<string, string> = {
  WEEK_UNTOUCHED: 'Chưa xuất',
  IN_PROGRESS: 'Đang xuất theo ngày',
  VARIANCE_REQUIRES_RESOLUTION: 'Cần xử lý chênh lệch',
  WEEK_COMPLETE: 'Đã xuất đủ',
}

const errorMessage = (error: unknown, fallback = 'Không tạo được phiếu xuất. Hãy tải lại danh sách cần xuất rồi thử lại.') => {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

type DailyDemandLine = ReconciliationLine & { dailyLineId: string; serviceDate: string }
type WeeklyDemandLine = {
  batchLineId: string
  ingredientCode?: string | null
  ingredientName?: string | null
  canonicalUnitName?: string | null
  requiredQuantity: number
  issuedQuantity: number | null
  remainingQuantity: number
  applicableDateCount: number
  completedDateCount: number
  hasUnresolvedOverage: boolean
}

const WeeklyDemandRow = memo(function WeeklyDemandRow({ line }: { line: WeeklyDemandLine }) {
  const untouched = line.issuedQuantity == null
  const complete = line.completedDateCount === line.applicableDateCount
  const label = line.hasUnresolvedOverage
    ? 'Cần xử lý chênh lệch'
    : complete
      ? `Đã xử lý đủ ${line.completedDateCount}/${line.applicableDateCount} ngày`
      : untouched
        ? 'Chưa xuất'
        : `Đang xuất ${line.completedDateCount}/${line.applicableDateCount} ngày`
  return <tr>
    <td className="w-80"><span className="block font-medium">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span>{line.ingredientCode && <span className="text-xs text-slate-500">{line.ingredientCode}</span>}</td>
    <td className="text-right tabular-nums">{formatQuantityWithUnit(line.requiredQuantity, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</td>
    <td className="text-right tabular-nums">{untouched ? <span className="text-slate-600">Chưa xuất</span> : formatQuantityWithUnit(line.issuedQuantity!, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</td>
    <td className="text-right tabular-nums">{formatQuantityWithUnit(line.remainingQuantity, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</td>
    <td className="w-44 whitespace-nowrap"><StatusBadge tone={line.hasUnresolvedOverage ? 'warning' : complete ? 'success' : untouched ? 'neutral' : 'info'}>{label}</StatusBadge></td>
  </tr>
})

interface ReconciliationDemandRowProps {
  line: DailyDemandLine
  enteredQuantity?: string
  varianceReason?: string
  canCreateIssue: boolean
  hasLinkedIssue: boolean
  onQuantityChange: (lineId: string, value: string) => void
  onReasonChange: (lineId: string, value: string) => void
}

const ReconciliationDemandRow = memo(function ReconciliationDemandRow({
  line,
  enteredQuantity,
  varianceReason,
  canCreateIssue,
  hasLinkedIssue,
  onQuantityChange,
  onReasonChange,
}: ReconciliationDemandRowProps) {
  const inputId = line.dailyLineId
  const entered = Number(enteredQuantity ?? 0)
  const relation = compareIssueQuantity(entered, line.requiredQuantity)
  const committedRelation = line.issuedQuantity == null ? null : compareIssueQuantity(line.issuedQuantity, line.requiredQuantity)
  const difference = issueQuantityDifference(entered, line.requiredQuantity)
  const overIssued = relation === 'over'
  const statusRelation = committedRelation ?? relation
  const statusLabel = committedRelation
    ? committedRelation === 'over' ? 'Đã xuất vượt' : committedRelation === 'under' ? 'Đã xuất thiếu' : 'Đã xuất đủ'
    : relation === 'over' ? 'Dự kiến xuất vượt' : relation === 'under' ? 'Dự kiến xuất thiếu' : relation === 'exact' ? 'Dự kiến xuất đủ' : 'Chưa nhập'

  const rowHighlight = !hasLinkedIssue && canCreateIssue
    ? relation === 'over'
      ? 'bg-amber-50/40'
      : relation === 'under'
      ? 'bg-rose-50/30'
      : undefined
    : undefined

  return (
    <tr className={rowHighlight}>
      <td className="w-80"><span className="block font-medium">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span>{line.ingredientCode && <span className="text-xs text-slate-500">{line.ingredientCode}</span>}</td>
      <td className="text-right tabular-nums">{formatQuantityWithUnit(line.requiredQuantity, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}</td>
      <td className="text-right tabular-nums">
        {canCreateIssue && !hasLinkedIssue ? (
          <>
            <label className="sr-only" htmlFor={`issued-${inputId}`}>Thực xuất {line.ingredientName}</label>
            <div className="flex items-center justify-end gap-2">
              <Input
                id={`issued-${inputId}`}
                aria-label={`Thực xuất ${line.ingredientName}`}
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                value={enteredQuantity ?? '0'}
                onChange={(event) => onQuantityChange(inputId, event.target.value)}
                className="w-36 text-right tabular-nums"
              />
              <span className="w-16 text-xs text-slate-600">{formatUnit(line.canonicalUnitName ?? '')}</span>
            </div>
          </>
        ) : line.issuedQuantity == null ? <span className="text-slate-600">Chưa xuất</span> : (
          <span title={String(line.issuedQuantity)}>
            {formatQuantityWithUnit(line.issuedQuantity, line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
          </span>
        )}
      </td>
      <td>
        {canCreateIssue && !hasLinkedIssue ? (
          overIssued ? (
            <div>
              <Textarea
                aria-label={`Lý do xuất vượt ${line.ingredientName}`}
                value={varianceReason ?? ''}
                onChange={(event) => onReasonChange(inputId, event.target.value)}
                placeholder="Nhập lý do xuất vượt"
                rows={2}
                className="min-h-16 min-w-48 resize-y text-xs"
              />
              <div className="mt-1 flex flex-wrap gap-1" aria-label="Gợi ý lý do xuất vượt">
                {['Bù hao hụt sơ chế', 'Quy cách nguyên liệu', 'Bếp yêu cầu thêm'].map((preset) => (
                  <span
                    key={preset}
                    role="button"
                    tabIndex={0}
                    className="inline-flex cursor-pointer rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-caption text-slate-700 transition hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={() => onReasonChange(inputId, preset)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onReasonChange(inputId, preset)
                      }
                    }}
                  >
                    {preset}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-600">Không cần</span>
          )
        ) : line.issueNotes?.length ? (
          <div className="text-sm text-slate-900 space-y-0.5">
            {line.issueNotes.map((note, idx) => (
              <span key={`${note}-${idx}`} className="block">{note}</span>
            ))}
          </div>
        ) : statusRelation === 'over' ? (
          <span className="text-sm text-slate-500 italic">Chưa ghi nhận</span>
        ) : (
          <span className="text-sm text-slate-600">Không cần</span>
        )}
      </td>
      <td className="w-44 whitespace-nowrap">
        <StatusBadge tone={statusRelation === 'over' ? 'warning' : statusRelation === 'under' ? 'danger' : statusRelation === 'invalid' ? 'neutral' : 'success'}>
          {statusLabel}
        </StatusBadge>
        {!committedRelation && (relation === 'under' || relation === 'over') && (
          <span className="mt-1 block text-xs text-slate-600">
            {relation === 'under' ? 'Thiếu' : 'Vượt'} {formatQuantityWithUnit(Math.abs(difference), line.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
          </span>
        )}
      </td>
    </tr>
  )
})

export default function ReconciliationWarehousePage() {
  const operation = useSystemOperation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const persistedSelection = readReconciliationSelection()
  const rawBatchId = searchParams.get('batchId') ?? persistedSelection.batchId ?? ''
  const tabs = eligiblePageTabs('MATERIAL_RECONCILIATION', 'warehouse', operation?.capabilities.pageTabs.warehouse ?? [], visibleTabIds('warehouse'))
  const requestedView = searchParams.get('view') ?? persistedSelection.warehouseView
  const activeView = tabs.includes(requestedView ?? '') && isReconciliationWarehouseView(requestedView)
    ? requestedView
    : (tabs[0] as ReconciliationWarehouseView | undefined)
  const batchesQuery = useListReconciliationBatchesQuery()

  const allEligibleBatches = useMemo(() => {
    return (batchesQuery.data ?? []).filter((item) => ['READY', 'TRANSFERRED', 'IN_PROGRESS', 'COMPLETED'].includes(item.status))
  }, [batchesQuery.data])

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(persistedSelection.customerId ?? 'ALL')
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [batchStatusFilter, setBatchStatusFilter] = useState<string>('ALL')

  const customers = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; customerCode?: string }>()
    allEligibleBatches.forEach((b) => {
      if (b.customerId) {
        map.set(b.customerId, {
          customerId: b.customerId,
          customerName: b.customerName || b.customerCode || b.customerId,
          customerCode: b.customerCode || undefined,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [allEligibleBatches])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    allEligibleBatches.forEach((b) => {
      const year = Number(b.weekStartDate?.slice(0, 4))
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [allEligibleBatches])

  const filteredEligibleBatches = useMemo(() => {
    return allEligibleBatches.filter((b) => {
      if (selectedCustomerId !== 'ALL' && b.customerId !== selectedCustomerId) return false
      const serviceYear = b.weekStartDate?.slice(0, 4)
      const serviceMonth = b.weekStartDate ? String(Number(b.weekStartDate.slice(5, 7))) : undefined
      if (selectedYear !== 'ALL' && serviceYear !== selectedYear) return false
      if (selectedMonth !== 'ALL' && serviceMonth !== selectedMonth) return false
      if (batchStatusFilter !== 'ALL' && b.status !== batchStatusFilter) return false
      return true
    })
  }, [allEligibleBatches, selectedCustomerId, selectedYear, selectedMonth, batchStatusFilter])

  const batchId = !batchesQuery.isSuccess
    ? rawBatchId
    : filteredEligibleBatches.some((batch) => batch.batchId === rawBatchId)
      ? rawBatchId
      : filteredEligibleBatches[0]?.batchId ?? ''

  const batchQuery = useGetReconciliationBatchQuery(batchId, { skip: !batchId, refetchOnMountOrArgChange: true })
  const dailyQuery = useGetReconciliationWarehouseDailyQuery(batchId, { skip: !batchId, refetchOnMountOrArgChange: true })
  const historyQuery = useListReconciliationIssueHistoryQuery(batchId, { skip: !batchId || activeView !== 'movement', refetchOnMountOrArgChange: true })
  const { data: warehouses = [], isError: warehouseError } = useGetWarehouseSelectorQuery()
  const warehouse = resolveOperationalWarehouseContext(warehouses)
  const [createIssue, { isLoading: isCreating }] = useCreateReconciliationIssueMutation()
  const canCreateIssue = useHasRole(['thukho'])
  const batch = batchId ? (batchQuery.currentData ?? batchQuery.data) : undefined
  const selectedBatchSummary = filteredEligibleBatches.find((item) => item.batchId === batchId)

  useEffect(() => {
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: batchId || undefined,
      customerId: selectedBatchSummary?.customerId || (selectedCustomerId !== 'ALL' ? selectedCustomerId : undefined),
      weekStartDate: selectedBatchSummary?.weekStartDate || undefined,
      weekEndDate: selectedBatchSummary?.weekEndDate || undefined,
    })
  }, [batchId, selectedBatchSummary?.customerId, selectedBatchSummary?.weekEndDate, selectedBatchSummary?.weekStartDate, selectedCustomerId])

  const batchLabel = (item: typeof allEligibleBatches[number]) =>
    `${item.customerName ? `[${item.customerName}] ` : item.customerCode ? `[${item.customerCode}] ` : ''}${item.weekStartDate ? `Tuần ${formatDateOnly(item.weekStartDate)}` : 'Chưa xác định tuần phục vụ'} · ${getReconciliationLifecyclePresentation(item.status).label}`
  const selectedBatchLabel = selectedBatchSummary
    ? batchLabel(selectedBatchSummary)
    : filteredEligibleBatches.length === 0
    ? 'Không có lô phù hợp'
    : 'Chọn lô'

  const selectedCustomerLabel = selectedCustomerId === 'ALL'
    ? 'Tất cả khách hàng'
    : customers.find((c) => c.customerId === selectedCustomerId)?.customerName ?? 'Khách hàng'

  const selectedYearLabel = selectedYear === 'ALL'
    ? 'Tất cả năm'
    : `Năm ${selectedYear}`

  const selectedMonthLabel = selectedMonth === 'ALL'
    ? 'Tất cả tháng'
    : `Tháng ${Number(selectedMonth) < 10 ? `0${Number(selectedMonth)}` : selectedMonth}`

  const batchStatusLabels: Record<string, string> = {
    ALL: 'Tất cả trạng thái',
    TRANSFERRED: 'Chờ Kho xuất',
    IN_PROGRESS: 'Đang đối chiếu',
    COMPLETED: 'Đã hoàn tất',
  }
  const selectedStatusLabel = batchStatusLabels[batchStatusFilter] ?? 'Tất cả trạng thái'
  const dayFilter = searchParams.get('day') ?? 'ALL'
  const dailyProjection = dailyQuery.currentData ?? (!dailyQuery.isFetching ? dailyQuery.data : undefined)
  const applicableDates = useMemo(() => dailyProjection?.dates.filter((date) => date.isApplicable) ?? [], [dailyProjection?.dates])
  const dayKey = (serviceDate: string) => ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${serviceDate}T00:00:00`).getDay()]
  const selectedDate = dayFilter === 'ALL' ? undefined : applicableDates.find((date) => dayKey(date.serviceDate) === dayFilter)
  const hasLinkedIssue = Boolean(selectedDate?.lines.some((line) => line.issuedQuantity != null))
  const remainingLines = useMemo(() => selectedDate?.lines.filter((line) => line.quantityStatus === 'UNTOUCHED') ?? [], [selectedDate])

  const [demandSearch, setDemandSearch] = useState('')
  const [demandPageSize, setDemandPageSize] = useState(15)

  const dailyDemandLines = useMemo<DailyDemandLine[]>(() => selectedDate?.lines.map((line: ReconciliationWarehouseDailyLine) => ({
    ...line,
    serviceDate: selectedDate.serviceDate,
    frozenTolerance: 0,
    purchasedQuantity: null,
    purchasedVersion: null,
    issuedVersion: null,
    purchasedRequiredDifference: null,
    issuedRequiredDifference: line.issuedQuantity == null ? null : line.issuedQuantity - line.requiredQuantity,
    purchasedIssuedDifference: null,
    triggers: [],
    status: line.quantityStatus === 'EXACT' ? 'MATCHED' : line.quantityStatus === 'UNTOUCHED' ? 'INCOMPLETE' : 'NEEDS_REVIEW',
    version: 1,
    disposition: line.hasValidDisposition ? { category: 'ACCEPTED_VARIANCE', reason: '', version: 1, disposedAt: '' } : null,
  })) ?? [], [selectedDate])
  const weeklyDemandLines = useMemo<WeeklyDemandLine[]>(() => {
    const grouped = new Map<string, WeeklyDemandLine>()
    for (const date of applicableDates) for (const line of date.lines) {
      const current = grouped.get(line.batchLineId) ?? {
        batchLineId: line.batchLineId,
        ingredientCode: line.ingredientCode,
        ingredientName: line.ingredientName,
        canonicalUnitName: line.canonicalUnitName,
        requiredQuantity: 0,
        issuedQuantity: null,
        remainingQuantity: 0,
        applicableDateCount: 0,
        completedDateCount: 0,
        hasUnresolvedOverage: false,
      }
      current.requiredQuantity += line.requiredQuantity
      if (line.issuedQuantity != null) current.issuedQuantity = (current.issuedQuantity ?? 0) + line.issuedQuantity
      current.remainingQuantity += Math.max(0, line.remainingQuantity)
      current.applicableDateCount += 1
      if (line.quantityStatus === 'EXACT' || line.hasValidDisposition) current.completedDateCount += 1
      if (line.quantityStatus === 'OVER_ISSUED' && !line.hasValidDisposition) current.hasUnresolvedOverage = true
      grouped.set(line.batchLineId, current)
    }
    return [...grouped.values()].sort((left, right) => (left.ingredientName ?? '').localeCompare(right.ingredientName ?? '', 'vi'))
  }, [applicableDates])
  const demandLines = dayFilter === 'ALL' ? weeklyDemandLines : dailyDemandLines
  const filteredDemandLines = useMemo(() => {
    if (!demandSearch.trim()) return demandLines
    const query = demandSearch.trim().toLowerCase()
    return demandLines.filter((line) => {
      const nameMatch = line.ingredientName?.toLowerCase().includes(query)
      const codeMatch = line.ingredientCode?.toLowerCase().includes(query)
      return nameMatch || codeMatch
    })
  }, [demandLines, demandSearch])

  const demandPagination = useLocalPagination(filteredDemandLines, demandPageSize)
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, string>>({})
  const [varianceReasons, setVarianceReasons] = useState<Record<string, string>>({})
  const handleQuantityChange = useCallback((lineId: string, value: string) => {
    setIssuedQuantities((current) => ({ ...current, [lineId]: value }))
  }, [])
  const handleReasonChange = useCallback((lineId: string, value: string) => {
    setVarianceReasons((current) => ({ ...current, [lineId]: value }))
  }, [])
  const [feedback, setFeedback] = useState<string>()
  const selectedIssueId = searchParams.get('issueId')
  const selectedIssue = historyQuery.data?.items.find((issue) => issue.issueId === selectedIssueId)
  const dishesQuery = useListReconciliationBatchDishesQuery(batchId, { skip: !batchId })
  // Only the current batch's successful projection may drive a physical issue calculation.
  const availableDishes = useMemo(() => dishesQuery.isError || dishesQuery.isLoading
    ? []
    : dishesQuery.currentData ?? [], [dishesQuery.isError, dishesQuery.isLoading, dishesQuery.currentData])

  const [supplementalOpen, setSupplementalOpen] = useState(false)
  const [supplementalMode, setSupplementalMode] = useState<'by_day' | 'by_dish' | 'custom'>('by_day')
  const [supplementalServiceDate, setSupplementalServiceDate] = useState('')
  const [supplementalDishSearch, setSupplementalDishSearch] = useState('')
  const [supplementalDishId, setSupplementalDishId] = useState('')
  const [supplementalServings, setSupplementalServings] = useState('')
  const [supplementalDishAdjustments, setSupplementalDishAdjustments] = useState<Record<string, string>>({})
  const [customSupplementalLines, setCustomSupplementalLines] = useState<Array<{ lineId: string; quantity: string }>>([
    { lineId: '', quantity: '' },
  ])
  const [supplementalReason, setSupplementalReason] = useState('')

  const selectedDish = useMemo(() => {
    return availableDishes.find((d) => d.dishId === supplementalDishId)
  }, [availableDishes, supplementalDishId])

  const calculatedDishMaterials = useMemo(() => {
    if (!selectedDish) return []
    const portions = Number(supplementalServings)
    const validPortions = Number.isFinite(portions) && portions > 0 ? portions : 0
    return selectedDish.materials.filter((mat) => mat.serviceDate === selectedDate?.serviceDate).map((mat) => {
      const batchLine = batch?.lines.find((l) => l.batchLineId === mat.batchLineId)
      const baseCalc = validPortions > 0 ? roundQuantity(validPortions * mat.grossQtyPerServing) : 0
      const entered = supplementalDishAdjustments[mat.batchLineId]
      const actualQty = entered !== undefined && entered.trim() !== '' ? Number(entered) : baseCalc
      const currentIssued = batchLine?.issuedQuantity ?? 0
      const required = batchLine?.requiredQuantity ?? 0
      const totalAfter = Number.isFinite(actualQty) && actualQty > 0 ? currentIssued + actualQty : currentIssued
      const diffAfter = totalAfter - required
      return {
        ...mat,
        baseCalc,
        actualQty,
        enteredValue: entered !== undefined ? entered : (baseCalc > 0 ? String(baseCalc) : ''),
        currentIssued,
        required,
        totalAfter,
        diffAfter,
      }
    })
  }, [selectedDish, selectedDate?.serviceDate, supplementalServings, supplementalDishAdjustments, batch?.lines])

  const changedServiceDates = useMemo(() => [...new Set(availableDishes.flatMap((dish) => dish.scopes ?? []).filter((scope) => scope.additionalServings > 0).map((scope) => scope.serviceDate))].sort(), [availableDishes])
  const selectedChangedDate = supplementalServiceDate || changedServiceDates[0] || ''
  const changedDishesForDate = useMemo(() => availableDishes.flatMap((dish) => (dish.scopes ?? []).filter((scope) => scope.serviceDate === selectedChangedDate && scope.additionalServings > 0).map((scope) => ({ ...dish, scope }))), [availableDishes, selectedChangedDate])
  const changedServingScopesForDate = useMemo(() => [...new Map(changedDishesForDate.map(({ scope }) => [`${scope.shiftName}:${scope.frozenServings}:${scope.currentServings}`, scope])).values()], [changedDishesForDate])
  const filteredDishes = useMemo(() => { const query = supplementalDishSearch.trim().toLocaleLowerCase('vi-VN'); return query ? availableDishes.filter((dish) => `${dish.dishCode} ${dish.dishName}`.toLocaleLowerCase('vi-VN').includes(query)) : availableDishes }, [availableDishes, supplementalDishSearch])
  const calculatedDayMaterials = useMemo(() => {
    const grouped = new Map<string, (typeof calculatedDishMaterials)[number]>()
    for (const dish of changedDishesForDate) for (const material of dish.materials) {
      const batchLine = batch?.lines.find((line) => line.batchLineId === material.batchLineId)
      const added = roundQuantity(dish.scope.additionalServings * material.grossQtyPerServing)
      const current = grouped.get(material.batchLineId)
      const baseCalc = roundQuantity((current?.baseCalc ?? 0) + added)
      const entered = supplementalDishAdjustments[material.batchLineId]
      const actualQty = entered !== undefined && entered.trim() !== '' ? Number(entered) : baseCalc
      const currentIssued = batchLine?.issuedQuantity ?? 0
      const required = batchLine?.requiredQuantity ?? 0
      const totalAfter = currentIssued + (Number.isFinite(actualQty) ? actualQty : 0)
      grouped.set(material.batchLineId, { ...material, baseCalc, actualQty, enteredValue: entered !== undefined ? entered : String(baseCalc), currentIssued, required, totalAfter, diffAfter: totalAfter - required })
    }
    return [...grouped.values()]
  }, [batch?.lines, changedDishesForDate, supplementalDishAdjustments])
  const visibleSupplementalMode = supplementalMode === 'by_day' && changedServiceDates.length === 0 ? 'custom' : supplementalMode
  const dishSupplementalEnabled = true
  const displayedSupplementalMaterials = visibleSupplementalMode === 'by_day' ? calculatedDayMaterials : calculatedDishMaterials
  const effectiveSupplementalMode = availableDishes.length > 0 ? visibleSupplementalMode : 'custom'
  const effectiveSupplementalReason = supplementalReason.trim() || (effectiveSupplementalMode === 'by_day' && selectedChangedDate ? `Bổ sung theo thay đổi thực đơn ngày ${selectedChangedDate}` : '')

  const validSupplementalCount = useMemo(() => {
    if (effectiveSupplementalMode === 'by_day' || effectiveSupplementalMode === 'by_dish') return displayedSupplementalMaterials.filter((material) => Number.isFinite(material.actualQty) && material.actualQty > 0).length
    return customSupplementalLines.filter((line) => line.lineId && Number(line.quantity) > 0).length
  }, [effectiveSupplementalMode, displayedSupplementalMaterials, customSupplementalLines])

  const issueInputInvalid = remainingLines.some((line) => {
    const quantity = Number(issuedQuantities[line.dailyLineId] ?? 0)
    const relation = compareIssueQuantity(quantity, line.requiredQuantity)
    return relation === 'invalid' || (relation === 'over' && !varianceReasons[line.dailyLineId]?.trim())
  })

  const fillExactRequiredQuantities = () => {
    setIssuedQuantities(Object.fromEntries(remainingLines.map((line) => [line.dailyLineId, String(line.requiredQuantity)])))
    setVarianceReasons({})
  }

  const updateRoute = (updates: { view?: ReconciliationWarehouseView; batchId?: string; day?: string }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.batchId !== undefined) {
      if (updates.batchId) next.set('batchId', updates.batchId)
      else next.delete('batchId')
      next.delete('issueId')
    }
    if (updates.view !== undefined) {
      next.set('view', updates.view)
      if (updates.view !== 'movement') next.delete('issueId')
    }
    if (updates.day !== undefined) {
      if (updates.day) next.set('day', updates.day)
      else next.delete('day')
    }
    setSearchParams(next, { replace: true })
  }

  const openIssue = (issue: ReconciliationIssueHistoryItem) => {
    const next = new URLSearchParams(searchParams)
    next.set('issueId', issue.issueId)
    setSearchParams(next)
  }

  const closeIssue = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('issueId')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!activeView) return
    const hasCorrectView = searchParams.get('view') === activeView
    const hasCorrectBatch = (searchParams.get('batchId') ?? '') === batchId
    if (hasCorrectView && hasCorrectBatch) return
    const next = new URLSearchParams(searchParams)
    next.set('view', activeView)
    if (batchId) {
      next.set('batchId', batchId)
    } else {
      next.delete('batchId')
      next.delete('issueId')
    }
    setSearchParams(next, { replace: true })
  }, [activeView, batchId, searchParams, setSearchParams])

  useEffect(() => {
    writeReconciliationSelection({
      ...readReconciliationSelection(),
      batchId: batchId || undefined,
      warehouseView: activeView,
    })
  }, [activeView, batchId])

  const create = async () => {
    if (!batch || !selectedDate || !warehouse.warehouse?.warehouseId || remainingLines.length === 0) return
    setFeedback(undefined)
    try {
      await createIssue({
        commandId: `reconciliation-issue-${batch.batchId}-${selectedDate.serviceDate}`,
        expectedVersion: batch.version,
        issueDate: selectedDate.serviceDate,
        warehouseId: warehouse.warehouse.warehouseId,
        reconciliationBatchId: batch.batchId,
        lines: remainingLines.map((line) => ({
          ingredientId: line.ingredientId,
          unitId: line.canonicalUnitId,
          reconciliationBatchLineId: line.batchLineId,
          reconciliationBatchDailyLineId: line.dailyLineId,
          requestedQty: line.requiredQuantity,
          issuedQty: Number(issuedQuantities[line.dailyLineId] ?? 0),
          varianceReason: varianceReasons[line.dailyLineId]?.trim() || undefined,
        })),
      }).unwrap()
      setFeedback('Đã tạo phiếu xuất kho từ đúng lô đối chiếu. Số đã xuất đang được cập nhật từ phiếu liên kết.')
      await batchQuery.refetch()
      updateRoute({ view: 'movement' })
    } catch (error) {
      setFeedback(errorMessage(error))
    }
  }

  const openSupplemental = (fillRemaining = false) => {
    if (!selectedDate) return
    setSupplementalMode('custom')
    setCustomSupplementalLines(fillRemaining
      ? selectedDate.lines.filter((line) => line.remainingQuantity > 0).map((line) => ({ lineId: line.dailyLineId, quantity: String(line.remainingQuantity) }))
      : [{ lineId: '', quantity: '' }])
    setSupplementalReason(fillRemaining ? `Xuất phần còn thiếu ngày ${formatDateOnly(selectedDate.serviceDate)}` : '')
    setSupplementalOpen(true)
  }

  const createSupplemental = async () => {
    if (!batch || !selectedDate || !warehouse.warehouse?.warehouseId || !effectiveSupplementalReason) return

    const linesToIssue: Array<{
      ingredientId: string
      unitId: string
      reconciliationBatchLineId: string
      reconciliationBatchDailyLineId?: string
      quantity: number
    }> = effectiveSupplementalMode === 'by_day' || effectiveSupplementalMode === 'by_dish'
      ? displayedSupplementalMaterials
          .filter((material) => Number.isFinite(material.actualQty) && material.actualQty > 0)
          .map((material) => ({
            ingredientId: material.ingredientId,
            unitId: material.canonicalUnitId,
            reconciliationBatchLineId: material.batchLineId,
            reconciliationBatchDailyLineId: material.dailyLineId,
            quantity: material.actualQty,
          }))
      : customSupplementalLines
          .map((item) => {
            const dailyLine = selectedDate.lines.find((line) => line.dailyLineId === item.lineId)
            const quantity = Number(item.quantity)
            if (!dailyLine || !Number.isFinite(quantity) || quantity <= 0) return null
            return {
              ingredientId: dailyLine.ingredientId,
              unitId: dailyLine.canonicalUnitId,
              reconciliationBatchLineId: dailyLine.batchLineId,
              reconciliationBatchDailyLineId: dailyLine.dailyLineId,
              quantity,
            }
          })
          .filter((item): item is NonNullable<typeof item> => item != null)

    if (linesToIssue.length === 0) return

    setFeedback(undefined)
    try {
      await createIssue({
        commandId: `reconciliation-supplemental-${crypto.randomUUID()}`,
        expectedVersion: batch.version,
        issueDate: selectedDate.serviceDate,
        warehouseId: warehouse.warehouse.warehouseId,
        reconciliationBatchId: batch.batchId,
        isSupplemental: true,
        lines: linesToIssue.map((line) => ({
          ingredientId: line.ingredientId,
          unitId: line.unitId,
          reconciliationBatchLineId: line.reconciliationBatchLineId,
          reconciliationBatchDailyLineId: 'reconciliationBatchDailyLineId' in line ? line.reconciliationBatchDailyLineId : selectedDate.lines.find((dailyLine) => dailyLine.batchLineId === line.reconciliationBatchLineId)?.dailyLineId,
          requestedQty: line.quantity,
          issuedQty: line.quantity,
          varianceReason: effectiveSupplementalReason,
        })),
      }).unwrap()
      setSupplementalOpen(false)
      setSupplementalDishId('')
      setSupplementalServings('')
      setSupplementalDishAdjustments({})
      setCustomSupplementalLines([{ lineId: '', quantity: '' }])
      setSupplementalReason('')
      setFeedback(`Đã tạo phiếu xuất thêm gồm ${linesToIssue.length} nguyên liệu và cộng dồn vào lô đối chiếu.`)
      await Promise.all([batchQuery.refetch(), dailyQuery.refetch(), historyQuery.refetch()])
    } catch (error) {
      setFeedback(errorMessage(error))
    }
  }

  const demandActions = canCreateIssue && dailyProjection?.compatibility.canIssueByDate && activeView === 'demand' && selectedDate
    ? <div className="flex flex-wrap justify-end gap-2">
        {hasLinkedIssue && batch?.status === 'IN_PROGRESS' && <>
          {selectedDate.lines.some((line) => line.remainingQuantity > 0) && <Button type="button" variant="outline" size="sm" disabled={isCreating} onClick={() => openSupplemental(true)}>Xuất phần còn thiếu</Button>}
          <Button type="button" variant="outline" size="sm" disabled={isCreating} onClick={() => openSupplemental(false)}>Tạo phiếu xuất bổ sung</Button>
        </>}
        {remainingLines.length > 0 && ['TRANSFERRED', 'IN_PROGRESS'].includes(batch?.status ?? '') && <>
          <Button type="button" variant="outline" size="sm" disabled={isCreating} onClick={fillExactRequiredQuantities}>Điền đủ ngày</Button>
          <Button type="button" size="sm" disabled={warehouse.state !== 'ready' || isCreating || issueInputInvalid} onClick={() => void create()}>{isCreating ? 'Đang xác nhận xuất...' : `Xác nhận ngày ${formatDateOnly(selectedDate.serviceDate)} (${remainingLines.length})`}</Button>
        </>}
      </div>
    : undefined

  if (tabs.length === 0) return <OperationalFrame><section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Không còn khu vực Kho đang hiển thị</h2><p className="mt-2 text-sm text-slate-600">Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.</p><Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>Mở thiết lập hiển thị</Link></section></OperationalFrame>

  return <OperationalFrame>
    <div className="space-y-4">
      {(batchesQuery.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs" data-ui-work-surface="warehouse-batch-scope">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Phạm vi lô xuất kho</h3>
              <InfoNote
                title="Phạm vi lô xuất kho"
                content="Lọc theo khách hàng và thời gian để chọn đúng lô cần xuất."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {customers.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className="text-slate-500 text-caption uppercase tracking-wider">Khách hàng:</span>
                  <Select value={selectedCustomerId} onValueChange={(val) => setSelectedCustomerId(val ?? 'ALL')}>
                    <SelectTrigger className="h-8 min-w-[180px] w-auto text-xs" aria-label="Lọc theo khách hàng">
                      <SelectValue placeholder="Khách hàng" className="whitespace-nowrap">{selectedCustomerLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả khách hàng</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.customerId} value={c.customerId}>
                          {c.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Năm:</span>
                <Select value={selectedYear} onValueChange={(val) => setSelectedYear(val ?? 'ALL')}>
                  <SelectTrigger className="h-8 min-w-[125px] w-auto text-xs" aria-label="Lọc theo năm">
                    <SelectValue placeholder="Năm" className="whitespace-nowrap">{selectedYearLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả năm</SelectItem>
                    {availableYears.map((yr) => (
                      <SelectItem key={yr} value={yr.toString()}>Năm {yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Tháng:</span>
                <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val ?? 'ALL')}>
                  <SelectTrigger className="h-8 min-w-[130px] w-auto text-xs" aria-label="Lọc theo tháng">
                    <SelectValue placeholder="Tháng" className="whitespace-nowrap">{selectedMonthLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả tháng</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>Tháng {m < 10 ? `0${m}` : m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className="text-slate-500 text-caption uppercase tracking-wider whitespace-nowrap">Trạng thái:</span>
                <Select value={batchStatusFilter} onValueChange={(val) => setBatchStatusFilter(val ?? 'ALL')}>
                  <SelectTrigger className="h-8 min-w-[170px] w-auto text-xs" aria-label="Lọc theo trạng thái">
                    <SelectValue placeholder="Trạng thái" className="whitespace-nowrap">{selectedStatusLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                    <SelectItem value="TRANSFERRED">Chờ Kho xuất</SelectItem>
                    <SelectItem value="IN_PROGRESS">Đang đối chiếu</SelectItem>
                    <SelectItem value="COMPLETED">Đã hoàn tất</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-800 font-semibold">
                <span className="text-slate-700 text-xs whitespace-nowrap">Lô ({filteredEligibleBatches.length}):</span>
                <Select value={batchId || null} onValueChange={(value) => value && updateRoute({ batchId: value, view: activeView ?? 'demand' })}>
                  <SelectTrigger className="h-8 w-80 max-w-[calc(100vw-3rem)] text-xs sm:w-[28rem]" aria-label="Chọn lô cần xuất" title={selectedBatchLabel}>
                    <SelectValue placeholder="Chọn lô" className="min-w-0 truncate whitespace-nowrap">{selectedBatchLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72 w-80 max-w-[calc(100vw-3rem)] overflow-y-auto sm:w-[28rem]">
                    {filteredEligibleBatches.map((item) => (
                      <SelectItem key={item.batchId} value={item.batchId} title={batchLabel(item)} className="truncate">{batchLabel(item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>
        </div>
      )}
      {batchId && dailyQuery.isError && <InlineAlert variant="danger" action={<Button type="button" variant="link" className="h-auto p-0" onClick={() => void dailyQuery.refetch()}>Thử lại</Button>}>Không tải được định lượng xuất kho theo ngày. Lịch sử và thông tin lô vẫn có thể xem.</InlineAlert>}
      {batchId && batch && <ReconciliationLifecycleStrip status={batch.status} batchId={batch.batchId} showAction={false} />}
      {feedback && <p role="status" className="rounded-md border border-slate-200 bg-white p-3 text-sm">{feedback}</p>}
      {warehouseError && <InlineAlert variant="danger">Không tải được kho vận hành. Chưa thể tạo phiếu xuất.</InlineAlert>}
      {(batchesQuery.data?.length ?? 0) > 0 && filteredEligibleBatches.length === 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h3 className="text-sm font-semibold text-slate-900">Không có lô nào phù hợp với bộ lọc</h3>
          <p className="mt-1 text-xs text-slate-500">Thử thay đổi hoặc đặt lại bộ lọc khách hàng, năm, tháng hoặc trạng thái.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 text-xs"
            onClick={() => {
              setSelectedCustomerId('ALL')
              setSelectedYear('ALL')
              setSelectedMonth('ALL')
              setBatchStatusFilter('ALL')
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </section>
      )}
      {!batchId && (filteredEligibleBatches.length > 0 || (batchesQuery.data?.length ?? 0) === 0) && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Chưa chọn lô cần xuất</h2><p className="mt-2 text-sm text-slate-600">Mở Định lượng xuất kho từ Thực đơn tuần để giữ đúng phạm vi khách hàng và tuần.</p><Link className="ipc-button ipc-button-primary mt-4" to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở Định lượng xuất kho</Link></section>}
      {batchId && batchQuery.isLoading && <TabContentSkeleton geometry="workspace" rows={5} columns={6} message="Đang tải lô đối chiếu đã chọn..." />}
      {batchId && batchQuery.isError && (
        <InlineAlert
          role="alert"
          variant="danger"
          className="p-6"
          action={<Button type="button" variant="link" className="h-auto p-0" onClick={() => void batchQuery.refetch()}>Thử lại tải lô</Button>}
        >
          Không tải được lô đối chiếu đã chọn.
        </InlineAlert>
      )}
      {batchId && !batchQuery.isLoading && !batchQuery.isError && !batch && <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Không tìm thấy lô đối chiếu đã chọn</h2><p className="mt-2 text-sm text-slate-600">Liên kết có thể đã cũ hoặc lô không còn thuộc phạm vi hiện tại.</p><Link className="ipc-button ipc-button-primary mt-4" to={buildWeeklyMenuRoute({ view: 'demand' })}>Mở Định lượng xuất kho</Link></section>}
      {batchId && batch && activeView && !batchQuery.isLoading && !batchQuery.isError && <>
        <ViewSwitcher compact ariaLabel="Chọn góc nhìn kho đối chiếu" tabs={tabs.map((id) => ({ id: `warehouse-${id}`, label: id === 'demand' ? 'Danh sách cần xuất' : 'Lịch sử xuất kho' }))} activeTab={`warehouse-${activeView}`} onTabChange={(id) => updateRoute({ view: id.replace('warehouse-', '') as ReconciliationWarehouseView })} />
        {activeView === 'demand' && dailyProjection && !dailyProjection.compatibility.canIssueByDate && <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"><EmptyState
          variant="empty"
          title="Lô này không có dữ liệu xuất theo ngày"
          description="Bạn vẫn có thể xem các phiếu đã xuất trong lịch sử xuất kho."
          action={<Button type="button" variant="outline" onClick={() => updateRoute({ view: 'movement' })}>Xem lịch sử xuất kho</Button>}
          className="rounded-lg border border-slate-200 bg-white"
        /></div>}
        {activeView === 'demand' && dailyQuery.isFetching && dailyProjection && <span className="sr-only" role="status" aria-label="Đang cập nhật định lượng xuất kho">Đang cập nhật định lượng xuất kho</span>}
        {activeView === 'demand' && !dailyProjection && dailyQuery.isFetching && <TabContentSkeleton geometry="table" rows={6} columns={5} message="Đang tải định lượng xuất kho..." />}
        {activeView === 'demand' && dailyProjection?.compatibility.canIssueByDate && <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-sm font-semibold text-slate-900">Trạng thái tuần: {weeklyStatusLabel[dailyProjection.weeklyStatus] ?? 'Chưa xác định'}</p></div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Lọc ngày xuất kho">
              <Button type="button" size="sm" variant={dayFilter === 'ALL' ? 'default' : 'outline'} onClick={() => updateRoute({ day: 'ALL' })}>Cả tuần</Button>
              {applicableDates.map((date) => { const key = dayKey(date.serviceDate); return <Button key={date.serviceDate} type="button" size="sm" variant={dayFilter === key ? 'default' : 'outline'} onClick={() => updateRoute({ day: key })}>{getDateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${date.serviceDate}T00:00:00`))}</Button> })}
            </div>
          </div>
        </div>}
        {activeView === 'demand' && dailyProjection?.compatibility.canIssueByDate && <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab"><SectionPanel
          title={dayFilter === 'ALL' ? 'Tổng hợp nguyên liệu cả tuần' : 'Danh sách cần xuất'}
          actions={dayFilter === 'ALL' ? <span aria-hidden="true" className="block h-9 w-px" /> : demandActions}
          description={dayFilter === 'ALL'
            ? (batch.customerName ? `Khách hàng: ${batch.customerName}` : undefined)
            : batch.customerName
              ? `Khách hàng: ${batch.customerName} · ${hasLinkedIssue ? 'Phiếu xuất của lô đã được tạo. Số thực xuất bên dưới chỉ đọc và được dùng để đối chiếu.' : 'Nhập số thực tế xuất cho từng nguyên liệu. Nếu xuất vượt số cần, nhập lý do trước khi xác nhận phiếu.'}`
              : hasLinkedIssue
              ? 'Phiếu xuất của lô đã được tạo. Số thực xuất bên dưới chỉ đọc và được dùng để đối chiếu.'
              : 'Nhập số thực tế xuất cho từng nguyên liệu. Nếu xuất vượt số cần, nhập lý do trước khi xác nhận phiếu.'
          }
        >
          {!canCreateIssue && batch && ['TRANSFERRED', 'IN_PROGRESS'].includes(batch.status) && <p className="mb-3 text-xs text-slate-600">Thủ kho cần tạo phiếu xuất cho lô này.</p>}
          {demandLines.length > 5 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5">
              <div className="w-full sm:w-72">
                <SearchField
                  id="warehouse-ingredient-search"
                  label="Tìm nguyên liệu cần xuất"
                  value={demandSearch}
                  onChange={(e) => {
                    setDemandSearch(e.target.value)
                    demandPagination.resetPage()
                  }}
                  placeholder="Tìm theo mã hoặc tên..."
                  hideLabel
                  width="standard"
                />
              </div>
              <p className="text-xs text-slate-600">
                Tìm thấy {filteredDemandLines.length}/{demandLines.length} nguyên liệu
              </p>
            </div>
          )}
          <TableViewport ariaLabel={dayFilter === 'ALL' ? 'Tổng hợp nguyên liệu cần xuất cả tuần' : 'Danh sách nguyên liệu cần xuất'} caption={dayFilter === 'ALL' ? 'Mỗi nguyên liệu được gộp một dòng cho toàn bộ tuần' : 'Danh sách nguyên liệu của ngày đang chọn'}>
            {dayFilter === 'ALL' ? <table className="ipc-data-table">
              <thead><tr><th scope="col" className="w-80">Nguyên liệu</th><th scope="col" className="text-right">Tổng cần tuần</th><th scope="col" className="text-right">Đã xuất</th><th scope="col" className="text-right">Còn lại</th><th scope="col" className="w-44 whitespace-nowrap">Tiến độ theo ngày</th></tr></thead>
              <tbody>{demandPagination.rows.map((line) => <WeeklyDemandRow key={line.batchLineId} line={line as WeeklyDemandLine} />)}</tbody>
            </table> : <table className="ipc-data-table">
              <thead><tr><th scope="col" className="w-80">Nguyên liệu</th><th scope="col" className="text-right">Cần xuất</th><th scope="col" className="text-right">Thực xuất</th><th scope="col">Lý do xuất vượt</th><th scope="col" className="w-44 whitespace-nowrap">Trạng thái</th></tr></thead>
              <tbody>{demandPagination.rows.map((line) => (
                <ReconciliationDemandRow
                  key={(line as DailyDemandLine).dailyLineId}
                  line={line as DailyDemandLine}
                  enteredQuantity={issuedQuantities[(line as DailyDemandLine).dailyLineId]}
                  varianceReason={varianceReasons[(line as DailyDemandLine).dailyLineId]}
                  canCreateIssue={canCreateIssue && Boolean(selectedDate)}
                  hasLinkedIssue={hasLinkedIssue}
                  onQuantityChange={handleQuantityChange}
                  onReasonChange={handleReasonChange}
                />
              ))}</tbody>
            </table>}
          </TableViewport>
          {filteredDemandLines.length > 10 && (
            <div className="mt-3">
              <PaginationBar
                page={demandPagination.page}
                pageSize={demandPagination.pageSize}
                totalItems={demandPagination.totalItems}
                pageSizeOptions={[10, 15, 25, 50]}
                onPageChange={demandPagination.setPage}
                onPageSizeChange={(newSize) => {
                  setDemandPageSize(newSize)
                  demandPagination.resetPage()
                }}
                itemLabel="nguyên liệu"
              />
            </div>
          )}
        </SectionPanel></div>}
        {activeView === 'movement' && <div id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab"><SectionPanel title="Lịch sử xuất kho" description="Chỉ các phiếu xuất có liên kết chính xác với lô đang chọn.">
          <div className="min-h-[112px]">
          {historyQuery.isLoading ? (
            <TableSkeleton
              rows={1}
              columns={[
                { width: '1.25fr' }, { width: '0.9fr' }, { width: '0.8fr', align: 'right' },
                { width: '1.8fr' }, { width: '0.9fr' }, { width: '0.9fr' }, { width: '1fr' },
              ]}
              ariaLabel="Đang tải lịch sử xuất kho..."
            />
          ) : historyQuery.isError ? (
            <InlineAlert
              role="alert"
              variant="danger"
              action={<Button type="button" variant="link" className="h-auto p-0" onClick={() => void historyQuery.refetch()}>Thử tải lại lịch sử</Button>}
            >
              Không tải được lịch sử xuất kho.
            </InlineAlert>
          ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
            <p>Chưa có phiếu xuất kho liên kết.</p>
          ) : (
            <ReconciliationIssueHistoryTable issues={historyQuery.data?.items ?? []} batchLines={batch?.lines} onOpenIssue={openIssue} />
          )}
          </div>
        </SectionPanel></div>}
      </>}
    </div>
    <ReconciliationIssueDetailDialog
      issueId={selectedIssueId}
      open={Boolean(selectedIssueId)}
      expectedBatchId={batchId}
      initialIssue={selectedIssue}
      onClose={closeIssue}
      onOpenBatch={(selectedBatchId) => navigate(`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(selectedBatchId)}`)}
    />
    <Dialog open={supplementalOpen} onOpenChange={setSupplementalOpen}>
      <DialogContent size={availableDishes.length > 0 ? "lg" : "sm"} aria-label="Xuất thêm nguyên liệu" className="gap-0">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Xuất thêm nguyên liệu</DialogTitle>
            <span
              className="inline-flex cursor-help text-slate-400 hover:text-slate-600 transition-colors"
              title="Chọn một hoặc nhiều nguyên liệu đã có trong lô hoặc tính theo món phát sinh. Số xuất thêm sẽ được cộng vào tổng đã xuất và có thể tạo chênh lệch cần xử lý."
              aria-label="Chọn một hoặc nhiều nguyên liệu đã có trong lô hoặc tính theo món phát sinh. Số xuất thêm sẽ được cộng vào tổng đã xuất và có thể tạo chênh lệch cần xử lý."
            >
              <Info size={16} aria-hidden="true" />
            </span>
          </div>
          <DialogDescription className="sr-only">
            Chọn một hoặc nhiều nguyên liệu đã có trong lô hoặc tính theo món phát sinh. Số xuất thêm sẽ được cộng vào tổng đã xuất và có thể tạo chênh lệch cần xử lý.
          </DialogDescription>
        </DialogHeader>

        {dishesQuery.isError ? (
          <QueryErrorAlert
            title="Không tải được định lượng món"
            onRetry={dishesQuery.refetch}
            isRetrying={dishesQuery.isFetching}
          >
            {errorMessage(dishesQuery.error, 'Không xác minh được định lượng món của lô. Hãy thử tải lại.')}
            {' '}Vẫn có thể chọn trực tiếp nguyên liệu đã đóng băng bên dưới để xuất thêm.
          </QueryErrorAlert>
        ) : dishesQuery.isLoading || dishesQuery.currentData === undefined ? (
          <p role="status">Đang tải định lượng món. Vẫn có thể chọn trực tiếp nguyên liệu đã đóng băng bên dưới để xuất thêm.</p>
        ) : availableDishes.length === 0 ? (
          <p>Lô chưa có định lượng món để tính xuất thêm. Chọn trực tiếp nguyên liệu đã đóng băng bên dưới để xuất thêm.</p>
        ) : null}

        {dishSupplementalEnabled && availableDishes.length > 0 && (
          <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-100/70 text-xs font-medium mt-1">
            {changedServiceDates.length > 0 && <button type="button" className={cn("flex-1 py-1.5 px-3 rounded-md transition-all text-center", supplementalMode === 'by_day' ? "bg-white text-slate-950 font-semibold shadow-xs" : "text-slate-600 hover:text-slate-900")} onClick={() => setSupplementalMode('by_day')}>Theo ngày đã chỉnh</button>}
            <button type="button" className={cn("flex-1 py-1.5 px-3 rounded-md transition-all text-center", visibleSupplementalMode === 'by_dish' ? "bg-white text-slate-950 font-semibold shadow-xs" : "text-slate-600 hover:text-slate-900")} onClick={() => setSupplementalMode('by_dish')}>Theo món</button>
            <button
              type="button"
              className={cn(
                "flex-1 py-1.5 px-3 rounded-md transition-all text-center",
                visibleSupplementalMode === 'custom'
                  ? "bg-white text-slate-950 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setSupplementalMode('custom')}
            >
              Bổ sung thủ công
            </button>
          </div>
        )}

        {dishSupplementalEnabled && (visibleSupplementalMode === 'by_day' || visibleSupplementalMode === 'by_dish') && availableDishes.length > 0 ? (
          <div className="space-y-3">
            {visibleSupplementalMode === 'by_day' && (
              <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-slate-700">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-1.5">
                    <span className="font-semibold">Ngày có thay đổi số suất</span>
                    <Select value={selectedChangedDate || null} onValueChange={(value) => setSupplementalServiceDate(value ?? '')}>
                      <SelectTrigger className="w-36" aria-label="Chọn ngày cần xuất thêm"><SelectValue placeholder="Chọn ngày">{selectedChangedDate ? formatDateOnly(selectedChangedDate) : undefined}</SelectValue></SelectTrigger>
                      <SelectContent>{changedServiceDates.map((date) => <SelectItem key={date} value={date}>{formatDateOnly(date)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="pb-2"><strong>Số suất tăng:</strong> {changedServingScopesForDate.map((scope) => `${scope.shiftName === 'MORNING' ? 'Ca sáng' : scope.shiftName === 'AFTERNOON' ? 'Ca chiều' : scope.shiftName} +${scope.additionalServings}`).join(', ')}</p>
                </div>
                <p className="truncate" title={changedDishesForDate.map((dish) => dish.dishName).join(', ')}><strong>Món áp dụng ({changedDishesForDate.length}):</strong> {changedDishesForDate.slice(0, 3).map((dish) => dish.dishName).join(', ')}{changedDishesForDate.length > 3 ? ` và ${changedDishesForDate.length - 3} món khác` : ''}</p>
              </div>
            )}
            {visibleSupplementalMode === 'by_dish' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="grid gap-1.5 text-xs font-semibold text-slate-700">
                <span>Món ăn phát sinh</span>
                <SearchField label="Tìm món cần xuất thêm" hideLabel width="full" placeholder="Tìm theo tên hoặc mã món" value={supplementalDishSearch} onChange={(event) => setSupplementalDishSearch(event.target.value)} />
                <Select
                  value={supplementalDishId || null}
                  onValueChange={(val) => {
                    setSupplementalDishId(val ?? '')
                    const dish = availableDishes.find((d) => d.dishId === val)
                    if (dish) {
                      setSupplementalReason(`Tăng ${supplementalServings || '50'} suất món ${dish.dishName}`)
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-9 text-xs" aria-label="Chọn món ăn phát sinh">
                    <SelectValue placeholder="Chọn món trong thực đơn">
                      {selectedDish ? `${selectedDish.dishName} (${selectedDish.materials.length} NL)` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDishes.map((dish) => (
                      <SelectItem key={dish.dishId} value={dish.dishId}>
                        {dish.dishName} ({dish.materials.length} nguyên liệu)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                <span>Số suất tăng thêm</span>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ví dụ: 50"
                    value={supplementalServings}
                    onChange={(e) => {
                      setSupplementalServings(e.target.value)
                      if (selectedDish) {
                        setSupplementalReason(`Tăng ${e.target.value || '0'} suất món ${selectedDish.dishName}`)
                      }
                    }}
                    className="h-9 w-full pr-12 text-right tabular-nums text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    suất
                  </span>
                </div>
              </label>
            </div>}

            {(visibleSupplementalMode === 'by_day' ? changedDishesForDate.length > 0 : selectedDish) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>Lượng cần xuất thêm ({displayedSupplementalMaterials.length} nguyên liệu):</span>
                  <span className="text-caption text-slate-500">Hệ thống tính phần cần; Kho nhập thực xuất, phần thiếu có thể bổ sung sau.</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="ipc-data-table w-full text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-medium">
                      <tr>
                        <th className="p-2">Nguyên liệu</th>
                        <th className="p-2 text-right">ĐL/suất</th>
                        <th className="p-2 text-right">Đã xuất</th>
                        <th className="p-2 text-right">Cần xuất thêm</th>
                        <th className="p-2 text-right w-28">Thực xuất</th>
                        <th className="p-2 text-right">Tổng sau xuất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedSupplementalMaterials.map((mat) => (
                        <tr key={mat.batchLineId} className="hover:bg-slate-50/50">
                          <td className="p-2 font-medium text-slate-900">{mat.ingredientName}</td>
                          <td className="p-2 text-right tabular-nums text-slate-600">
                            {mat.grossQtyPerServing} {formatUnit(mat.canonicalUnitName ?? '')}
                          </td>
                          <td className="p-2 text-right tabular-nums text-slate-600">
                            {formatQuantityWithUnit(mat.currentIssued, mat.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                          </td>
                          <td className="p-2 text-right font-semibold tabular-nums text-blue-700">
                            {formatQuantityWithUnit(mat.baseCalc, mat.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0.000001"
                                step="0.000001"
                                value={mat.enteredValue}
                                onChange={(e) => setSupplementalDishAdjustments((prev) => ({ ...prev, [mat.batchLineId]: e.target.value }))}
                                className="h-7 w-20 text-right tabular-nums text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-slate-500 text-caption w-6 shrink-0">{formatUnit(mat.canonicalUnitName ?? '')}</span>
                            </div>
                          </td>
                          <td className="p-2 text-right tabular-nums font-semibold text-slate-900">
                            {formatQuantityWithUnit(mat.totalAfter, mat.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {customSupplementalLines.length === 1 ? (
              <>
                {(() => {
                  const singleLine = selectedDate?.lines.find((line) => line.dailyLineId === customSupplementalLines[0]?.lineId)
                  const amt = Number(customSupplementalLines[0]?.quantity)
                  const total = singleLine && Number.isFinite(amt) && amt > 0 ? (singleLine.issuedQuantity ?? 0) + amt : null
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                          <span>Nguyên liệu</span>
                          <Select
                            value={customSupplementalLines[0]?.lineId || null}
                            onValueChange={(value) => setCustomSupplementalLines([{ ...customSupplementalLines[0], lineId: value ?? '' }])}
                          >
                            <SelectTrigger className="w-full h-9 text-xs" aria-label="Chọn nguyên liệu xuất thêm">
                              <SelectValue placeholder="Chọn nguyên liệu">
                                {singleLine?.ingredientName}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDate?.lines.map((line) => (
                                <SelectItem key={line.dailyLineId} value={line.dailyLineId}>
                                  {line.ingredientName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>

                        <div className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                          <label htmlFor="custom-supplemental-qty">Số lượng xuất thêm</label>
                          <div className="relative">
                            <Input
                              id="custom-supplemental-qty"
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              placeholder="0.00"
                              value={customSupplementalLines[0]?.quantity ?? ''}
                              onChange={(event) => setCustomSupplementalLines([{ ...customSupplementalLines[0], quantity: event.target.value }])}
                              className="h-9 w-full pr-12 text-right tabular-nums text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            {singleLine?.canonicalUnitName && (
                              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                {formatUnit(singleLine.canonicalUnitName)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {singleLine && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-slate-50 p-3 text-xs">
                          <dt className="text-slate-600">Nguyên liệu</dt>
                          <dd className="font-medium">{singleLine.ingredientName}</dd>
                          <dt className="text-slate-600">Đã xuất hiện tại</dt>
                          <dd className="text-right tabular-nums">
                            {formatQuantityWithUnit(singleLine.issuedQuantity ?? 0, singleLine.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                          </dd>
                          {total != null && (
                            <>
                              <dt className="text-slate-600">Sau khi bổ sung</dt>
                              <dd className="text-right tabular-nums">
                                {formatQuantityWithUnit(total, singleLine.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                              </dd>
                              <dt className="text-slate-600">Chênh lệch mới</dt>
                              <dd className="text-right tabular-nums">
                                {formatQuantityWithUnit(total - singleLine.requiredQuantity, singleLine.canonicalUnitName ?? '', { maximumFractionDigits: 6 })}
                              </dd>
                            </>
                          )}
                        </dl>
                      )}
                    </>
                  )
                })()}

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => setCustomSupplementalLines((prev) => [...prev, { lineId: '', quantity: '' }])}
                  >
                    <Plus size={13} aria-hidden="true" />
                    Thêm nguyên liệu khác cùng phiếu
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {customSupplementalLines.map((row, index) => {
                    const currentLine = selectedDate?.lines.find((line) => line.dailyLineId === row.lineId)
                    const qty = Number(row.quantity)
                    const currentIssued = currentLine?.issuedQuantity ?? 0
                    const totalAfter = Number.isFinite(qty) && qty > 0 ? currentIssued + qty : currentIssued
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-slate-200/80 bg-slate-50/60">
                        <div className="flex-1 min-w-[180px]">
                          <Select
                            value={row.lineId || null}
                            onValueChange={(val) => {
                              setCustomSupplementalLines((prev) => prev.map((item, i) => (i === index ? { ...item, lineId: val ?? '' } : item)))
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs" aria-label={`Chọn nguyên liệu dòng ${index + 1}`}>
                              <SelectValue placeholder="Chọn nguyên liệu trong lô">{currentLine?.ingredientName}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDate?.lines.map((line) => (
                                <SelectItem key={line.dailyLineId} value={line.dailyLineId}>
                                  {line.ingredientName} ({formatUnit(line.canonicalUnitName ?? '')})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            placeholder="Số lượng"
                            value={row.quantity}
                            onChange={(e) => setCustomSupplementalLines((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)))}
                            className="h-8 w-24 text-right tabular-nums text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-xs text-slate-600 w-7 shrink-0">{formatUnit(currentLine?.canonicalUnitName ?? '')}</span>
                        </div>

                        {currentLine && (
                          <div className="text-caption text-slate-600 tabular-nums">
                            Đã xuất: {currentIssued} → Sau thêm: <span className="font-semibold text-slate-900">{totalAfter}</span>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => setCustomSupplementalLines((prev) => prev.filter((_, i) => i !== index))}
                          aria-label="Xóa dòng"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => setCustomSupplementalLines((prev) => [...prev, { lineId: '', quantity: '' }])}
                >
                  <Plus size={13} aria-hidden="true" />
                  Thêm nguyên liệu khác
                </Button>
              </div>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 mt-2" htmlFor="supplemental-reason">
          <span>Lý do</span>
          <Textarea
            id="supplemental-reason"
            className="min-h-[64px] h-[64px] resize-y text-xs"
            value={supplementalReason}
            onChange={(event) => setSupplementalReason(event.target.value)}
            placeholder="Ví dụ: Bếp đề nghị bổ sung cho ca trưa"
          />
        </label>
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lý do mẫu">
            {[
              'Bếp đề nghị bổ sung',
              'Bù hao hụt chế biến',
              'Tăng suất ăn đột xuất',
            ].map((preset) => {
              const isSelected = supplementalReason.trim() === preset
              return (
                <button
                  key={preset}
                  type="button"
                  className={cn(
                    "cursor-pointer rounded border px-2.5 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                    isSelected
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-medium shadow-2xs"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                  )}
                  onClick={() => setSupplementalReason(preset)}
                >
                  {preset}
                </button>
              )
            })}
          </div>
          {validSupplementalCount > 0 && !effectiveSupplementalReason && (
            <p className="text-xs text-amber-700 mt-0.5">
              * Vui lòng chọn hoặc nhập lý do để có thể xác nhận xuất thêm.
            </p>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" onClick={() => setSupplementalOpen(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={isCreating || validSupplementalCount === 0 || !effectiveSupplementalReason}
            onClick={() => void createSupplemental()}
          >
            {isCreating ? 'Đang tạo phiếu...' : validSupplementalCount > 1 ? `Xác nhận xuất thêm (${validSupplementalCount})` : 'Xác nhận xuất thêm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </OperationalFrame>
}
