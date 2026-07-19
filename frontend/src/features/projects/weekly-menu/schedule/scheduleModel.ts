import type { MealQuantityPlanDto, OrderRow, WeeklyMenuState } from '../../../coordination/types'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import type { WeeklyPlanRow } from '../model/types'
import { getQuickServingKey, QUICK_SERVING_SHIFTS } from '../model/scope'
import { parseDisplayDateToIso } from '../model/formatters'
import type { QuickServingRow, WeeklyMenuScope } from './types'

export const getScheduleServiceDate = (
  rows: WeeklyMenuImportResult['rows'],
  dayKey: string,
) => rows.find((row) => row.dayKey === dayKey)?.serviceDate?.split('T')[0] ?? ''

export const buildQuantityPlanByDateShift = (
  plans: MealQuantityPlanDto[],
  customerId: string,
) => {
  const result = new Map<string, { servings: number; status: 'confirmed' | 'draft' | 'missing'; statusLabel: string }>()
  plans.forEach((plan) => {
    const serviceDate = plan.serviceDate.split('T')[0]
    const confirmedPlan = ['CONFIRMED', 'COMPLETED'].includes(plan.status.toUpperCase())
    plan.lines.filter((line) => !customerId || line.customerId === customerId).forEach((line) => {
      const key = `${serviceDate}|${line.shiftName}`
      const current = result.get(key)
      const servings = line.finalServings || line.confirmedServings || line.adjustedServings || line.forecastServings || 0
      const status = confirmedPlan && servings > 0 ? 'confirmed' : servings > 0 ? 'draft' : 'missing'
      const nextStatus = current?.status === 'confirmed' || status === 'confirmed'
        ? 'confirmed'
        : current?.status === 'draft' || status === 'draft' ? 'draft' : 'missing'
      result.set(key, {
        servings: (current?.servings ?? 0) + servings,
        status: nextStatus,
        statusLabel: nextStatus === 'confirmed' ? 'Đã chốt suất' : `Chưa chốt (${plan.status})`,
      })
    })
  })
  return result
}

export const getShiftServingInfo = ({
  dayKey,
  shiftName,
  serviceDate,
  quantityPlans,
  orders,
  lockedShifts,
}: {
  dayKey: string
  shiftName: 'MORNING' | 'AFTERNOON'
  serviceDate: string
  quantityPlans: ReturnType<typeof buildQuantityPlanByDateShift>
  orders: OrderRow[]
  lockedShifts: Record<string, boolean>
}) => {
  const quantityInfo = serviceDate ? quantityPlans.get(`${serviceDate}|${shiftName}`) : undefined
  if (quantityInfo && quantityInfo.servings > 0) return quantityInfo
  const shiftLabel = shiftName === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều'
  const locked = !!lockedShifts[`${dayKey}-${shiftLabel}`]
  const servings = orders.filter((order) => order.dayOfWeek === dayKey && order.shift === shiftLabel)
    .reduce((sum, order) => sum + (locked ? order.actualQuantity : order.forecastQuantity), 0)
  return servings > 0
    ? { servings, status: 'draft' as const, statusLabel: 'Dự kiến điều phối' }
    : { servings: 0, status: 'missing' as const, statusLabel: 'Chưa có số suất' }
}

export const buildQuickServingRows = ({
  scope,
  committedRows,
  plans,
  inputs,
  weeklyPlanRows,
}: {
  scope: WeeklyMenuScope
  committedRows: WeeklyMenuImportResult['rows']
  plans: MealQuantityPlanDto[]
  inputs: Record<string, string>
  weeklyPlanRows: WeeklyPlanRow[]
}): QuickServingRow[] => scope.displayDays.flatMap((day) => {
  const serviceDate = getScheduleServiceDate(committedRows, day.key) || parseDisplayDateToIso(day.date)
  if (!serviceDate) return []
  return QUICK_SERVING_SHIFTS.map((shift) => {
    const planLines = plans.filter((plan) => plan.serviceDate.split('T')[0] === serviceDate).flatMap((plan) =>
      plan.lines.filter((line) => line.shiftName === shift.shiftName && (!scope.customerId || line.customerId === scope.customerId))
        .map((line) => ({
          planStatus: plan.status,
          quantityPlanId: plan.quantityPlanId,
          quantityPlanLineId: line.quantityPlanLineId,
          servings: line.finalServings || line.confirmedServings || line.adjustedServings || line.forecastServings || 0,
        })),
    )
    const currentServings = planLines.reduce((sum, line) => sum + line.servings, 0)
    const importedServings = Math.max(0, ...weeklyPlanRows.filter((row) => row.dayKey === day.key && (
      shift.shiftName === 'MORNING' ? row.shiftLabel.toLowerCase().includes('sáng') : row.shiftLabel.toLowerCase().includes('chiều')
    )).map((row) => row.importedPortions || row.portions || 0))
    const key = getQuickServingKey(serviceDate, shift.shiftName)
    const statuses = Array.from(new Set(planLines.map((line) => line.planStatus.toUpperCase())))
    const isConfirmed = statuses.some((status) => ['CONFIRMED', 'COMPLETED', 'ADJUSTED'].includes(status))
    const isCompleted = statuses.includes('COMPLETED')
    return {
      key, dayKey: day.key, dayLabel: day.label, date: day.date, serviceDate,
      shiftName: shift.shiftName, shiftLabel: shift.shiftLabel,
      quantityPlanId: planLines[0]?.quantityPlanId,
      quantityPlanIds: Array.from(new Set(planLines.map((line) => line.quantityPlanId).filter(Boolean))),
      lines: planLines.map((line) => ({ quantityPlanLineId: line.quantityPlanLineId, servings: line.servings })),
      currentServings,
      importedServings,
      inputValue: inputs[key] ?? String(currentServings > 0 ? currentServings : importedServings || ''),
      hasPlanLines: planLines.length > 0,
      hasDraftChange: inputs[key] !== undefined && Number(inputs[key]) !== currentServings,
      isConfirmed,
      isCompleted,
      statusLabel: planLines.length === 0 ? 'Chưa có kế hoạch suất' : isCompleted ? 'Đã hoàn tất' : isConfirmed ? 'Đã chốt' : currentServings > 0 ? 'Chưa chốt' : 'Chưa nhập suất',
    }
  })
})

export const cloneWeeklyMenu = (menu: WeeklyMenuState, dayKeys: string[]): WeeklyMenuState =>
  Object.fromEntries(dayKeys.map((dayKey) => [dayKey, {
    morningSavory: { ...menu[dayKey]?.morningSavory },
    morningVegetarian: { ...menu[dayKey]?.morningVegetarian },
    afternoonSavory: { ...menu[dayKey]?.afternoonSavory },
    afternoonVegetarian: { ...menu[dayKey]?.afternoonVegetarian },
  }])) as WeeklyMenuState
