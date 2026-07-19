import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateWeeklyMenuDish } from '../../../coordination/coordinationSlice'
import type { MealQuantityPlanDto, MenuScheduleDto, OrderRow, WeeklyMenuState } from '../../../coordination/types'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import { useUpdateWeeklyMenuBulkMutation, useUpsertQuickServingsMutation } from '../../../coordination/coordinationApi'
import type { CatalogDish } from '../../dishCatalogApi'
import { normalizeBomPriceTier } from '../../weeklyMenuPlanning'
import { getApiErrorMessage } from '../model/formatters'
import { matchesCategory, matchesShift, runInBatches, SECTIONS } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'
import { buildQuantityPlanByDateShift, buildQuickServingRows, cloneWeeklyMenu, getScheduleServiceDate, getShiftServingInfo } from './scheduleModel'
import { initialWeeklyScheduleState, weeklyScheduleReducer } from './scheduleState'
import type { QuickServingRow, WeeklyMenuScope, WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from './types'

type Options = {
  scope: WeeklyMenuScope
  committedRows: WeeklyMenuImportResult['rows']
  importedMenu: WeeklyMenuState
  mealQuantityPlans: MealQuantityPlanDto[]
  menuSchedules: MenuScheduleDto[]
  orders: OrderRow[]
  lockedShifts: Record<string, boolean>
  catalogDishes: CatalogDish[]
  onMenuFeedback: (feedback: WeeklyScheduleFeedback) => void
  onQuickServingFeedback: (feedback: WeeklyScheduleFeedback) => void
}

export function useWeeklyScheduleEditor({
  scope,
  committedRows,
  importedMenu,
  mealQuantityPlans,
  menuSchedules,
  orders,
  lockedShifts,
  catalogDishes,
  onMenuFeedback,
  onQuickServingFeedback,
}: Options): WeeklyScheduleEditorWorkflow {
  const reduxDispatch = useAppDispatch()
  const [state, dispatch] = useReducer(weeklyScheduleReducer, initialWeeklyScheduleState)
  const [updateWeeklyMenuBulk, { isLoading: isSavingMenu }] = useUpdateWeeklyMenuBulkMutation()
  const [upsertQuickServings, { isLoading: isSavingQuickServings }] = useUpsertQuickServingsMutation()

  useEffect(() => {
    dispatch({ type: 'reset-scope' })
  }, [scope.customerId, scope.weekStartDate])

  const activeOrders = useMemo(
    () => orders.filter((order) => order.customerId === scope.customerId),
    [orders, scope.customerId],
  )
  const quantityPlans = useMemo(
    () => buildQuantityPlanByDateShift(mealQuantityPlans, scope.customerId),
    [mealQuantityPlans, scope.customerId],
  )
  const sections = useMemo(() => SECTIONS.map((section) => {
    const dishes = catalogDishes.filter((dish) => matchesShift(dish, section.shift) && matchesCategory(dish, section.category))
    return {
      label: section.label,
      slotType: section.slotType,
      dishes: dishes.map(({ id, name }) => ({ id, name })),
      defaultDishId: dishes[0]?.id ?? catalogDishes[0]?.id ?? '',
    }
  }), [catalogDishes])
  const serviceDate = useCallback(
    (dayKey: string) => getScheduleServiceDate(committedRows, dayKey),
    [committedRows],
  )
  const isLocked = useCallback((dayKey: string, slotType: keyof WeeklyMenuState[string]) => {
    const shift = slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'
    return !!lockedShifts[`${dayKey}-${shift}`]
  }, [lockedShifts])
  const getSlotServingInfo = useCallback((dayKey: string, slotType: keyof WeeklyMenuState[string]) => {
    const shiftInfo = getShiftServingInfo({
      dayKey,
      shiftName: slotType.startsWith('morning') ? 'MORNING' : 'AFTERNOON',
      serviceDate: serviceDate(dayKey),
      quantityPlans,
      orders: activeOrders,
      lockedShifts,
    })
    const savoryPortions = Math.round(shiftInfo.servings * 0.85)
    const calculatedPortions = slotType.endsWith('Vegetarian')
      ? shiftInfo.servings - savoryPortions
      : savoryPortions
    const importedPortions = importedMenu[dayKey]?.[slotType]?.portions ?? 0
    if (shiftInfo.servings > 0) {
      return {
        portions: calculatedPortions,
        importedPortions,
        status: shiftInfo.status,
        statusLabel: shiftInfo.statusLabel,
        hasConfirmedServings: shiftInfo.status === 'confirmed',
      }
    }
    return {
      portions: importedPortions,
      importedPortions,
      status: importedPortions > 0 ? 'import-default' as const : 'missing' as const,
      statusLabel: importedPortions > 0 ? 'Suất tạm từ import' : 'Chưa có số suất',
      hasConfirmedServings: importedPortions > 0,
    }
  }, [activeOrders, importedMenu, lockedShifts, quantityPlans, serviceDate])
  const weeklyMenu = useMemo(() => {
    const merged: WeeklyMenuState = {}
    scope.displayDays.forEach(({ key }) => {
      const slots = importedMenu[key]
      if (!slots) return
      merged[key] = {
        morningSavory: { dishId: slots.morningSavory?.dishId || sections[0]?.defaultDishId || '', portions: getSlotServingInfo(key, 'morningSavory').portions, customComponents: slots.morningSavory?.customComponents },
        morningVegetarian: { dishId: slots.morningVegetarian?.dishId || sections[1]?.defaultDishId || '', portions: getSlotServingInfo(key, 'morningVegetarian').portions, customComponents: slots.morningVegetarian?.customComponents },
        afternoonSavory: { dishId: slots.afternoonSavory?.dishId || sections[2]?.defaultDishId || '', portions: getSlotServingInfo(key, 'afternoonSavory').portions, customComponents: slots.afternoonSavory?.customComponents },
        afternoonVegetarian: { dishId: slots.afternoonVegetarian?.dishId || sections[3]?.defaultDishId || '', portions: getSlotServingInfo(key, 'afternoonVegetarian').portions, customComponents: slots.afternoonVegetarian?.customComponents },
      }
    })
    return merged
  }, [getSlotServingInfo, importedMenu, scope.displayDays, sections])
  const scheduleByDateShift = useMemo(() => new Map(menuSchedules
    .filter((schedule) => !scope.customerId || schedule.customerId === scope.customerId)
    .map((schedule) => [`${schedule.serviceDate.split('T')[0]}|${schedule.shiftName}`, schedule])), [menuSchedules, scope.customerId])
  const getLinePricing = useCallback((date: string, shiftName: string) => ({
    menuPrice: normalizeBomPriceTier(scheduleByDateShift.get(`${date.split('T')[0]}|${shiftName}`)?.menuPrice ?? scope.menuPrice),
    bomRatePercent: scope.fixedBomRatePercent,
    quantityFactor: 1,
  }), [scheduleByDateShift, scope.fixedBomRatePercent, scope.menuPrice])
  const openEditor = useCallback(() => dispatch({
    type: 'open-editor',
    menu: cloneWeeklyMenu(weeklyMenu, scope.displayDays.map((day) => day.key)),
  }), [scope.displayDays, weeklyMenu])
  const saveEditor = useCallback(async () => {
    const slots = scope.displayDays.flatMap((day) => sections.flatMap((section) => {
      if (isLocked(day.key, section.slotType)) return []
      const currentDishId = weeklyMenu[day.key]?.[section.slotType]?.dishId || section.defaultDishId
      const dishId = state.draftMenu[day.key]?.[section.slotType]?.dishId
      const date = serviceDate(day.key)
      return dishId && dishId !== currentDishId && date ? [{
        serviceDate: date,
        shiftName: section.slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều',
        slotType: section.slotType,
        dishId,
      }] : []
    }))
    if (slots.length === 0) {
      dispatch({ type: 'close-editor' })
      return
    }
    try {
      onMenuFeedback({ title: 'Đang lưu chỉnh sửa', message: 'Hệ thống đang ghi các thay đổi thực đơn vào backend...', variant: 'info' })
      const response = await updateWeeklyMenuBulk({ customerId: scope.customerId, slots }).unwrap()
      if (!response.success) throw new Error(response.message || 'Không thể lưu chỉnh sửa thực đơn.')
      slots.forEach((slot) => {
        const dayKey = scope.displayDays.find((day) => serviceDate(day.key) === slot.serviceDate)?.key
        if (dayKey) reduxDispatch(updateWeeklyMenuDish({ day: dayKey, slotType: slot.slotType, dishId: slot.dishId }))
      })
      onMenuFeedback(response.data?.length
        ? { title: 'Lưu thành công (Có cảnh báo)', message: `${response.message}\nCảnh báo:\n${response.data.map((warning) => `- ${warning}`).join('\n')}`, variant: 'warning' }
        : { title: 'Cập nhật thực đơn thành công', message: response.message || 'Thay đổi đã được lưu vào database.', variant: 'info' })
      dispatch({ type: 'close-editor' })
    } catch (error) {
      onMenuFeedback({ title: 'Chỉnh sửa thực đơn thất bại', message: getApiErrorMessage(error, 'Không thể lưu thay đổi vào backend.'), variant: 'danger' })
    }
  }, [isLocked, onMenuFeedback, reduxDispatch, scope.customerId, scope.displayDays, sections, serviceDate, state.draftMenu, updateWeeklyMenuBulk, weeklyMenu])
  const saveQuickServing = useCallback(async (row: QuickServingRow) => {
    if (!row.hasDraftChange) return
    try {
      if (row.isConfirmed) throw new Error('Ca đã chốt. Điều chỉnh sau chốt cần thực hiện ở Điều phối đơn.')
      if (!scope.customerId) throw new Error('Vui lòng chọn khách hàng trước khi lưu số suất.')
      const servings = Number(row.inputValue)
      if (!Number.isFinite(servings) || servings < 0) throw new Error('Số suất phải lớn hơn hoặc bằng 0.')
      await upsertQuickServings({ customerId: scope.customerId, serviceDate: row.serviceDate, shiftName: row.shiftName, servings: Math.round(servings), complete: false }).unwrap()
      dispatch({ type: 'clear-serving', key: row.key })
      onQuickServingFeedback({ title: 'Đã lưu số suất', message: `${row.dayLabel} ${row.date} - ${row.shiftLabel}: đã cập nhật số suất dự kiến.`, variant: 'info' })
    } catch (error) {
      onQuickServingFeedback({ title: 'Chưa lưu được số suất', message: error instanceof Error ? error.message : 'Vui lòng kiểm tra lại số suất.', variant: 'danger' })
    }
  }, [onQuickServingFeedback, scope.customerId, upsertQuickServings])
  const completeQuickServing = useCallback(async (row: QuickServingRow) => {
    try {
      const parsed = Number(row.inputValue)
      const servings = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : row.currentServings
      if (servings <= 0) throw new Error('Cần nhập số suất lớn hơn 0 trước khi hoàn tất ca.')
      if (!scope.customerId) throw new Error('Vui lòng chọn khách hàng trước khi hoàn tất ca.')
      await upsertQuickServings({ customerId: scope.customerId, serviceDate: row.serviceDate, shiftName: row.shiftName, servings, complete: true }).unwrap()
      dispatch({ type: 'clear-serving', key: row.key })
      onQuickServingFeedback({ title: 'Đã hoàn tất suất cho KHSX', message: `${row.dayLabel} ${row.date} - ${row.shiftLabel}: đã hoàn tất kế hoạch suất. Có thể tạo demand nguyên liệu.`, variant: 'info' })
    } catch (error) {
      onQuickServingFeedback({ title: 'Chưa hoàn tất được suất', message: error instanceof Error ? error.message : 'Vui lòng kiểm tra kế hoạch suất trước khi hoàn tất.', variant: 'danger' })
    }
  }, [onQuickServingFeedback, scope.customerId, upsertQuickServings])
  const completePendingQuickServings = useCallback(async (rows: QuickServingRow[], serviceDates: string[]) => {
    const dateSet = new Set(serviceDates)
    const pending = rows.filter((row) => dateSet.has(row.serviceDate) && !row.isCompleted)
      .map((row) => ({ ...row, nextServings: Math.round(Number.parseFloat(row.inputValue)) }))
      .filter((row) => Number.isFinite(row.nextServings) && row.nextServings > 0)
    await runInBatches(pending, 3, async (row) => {
      const response = await upsertQuickServings({ customerId: scope.customerId, serviceDate: row.serviceDate, shiftName: row.shiftName, servings: row.nextServings, complete: true }).unwrap()
      if (!response.success) throw new Error(response.message || 'Không hoàn tất được số suất.')
      dispatch({ type: 'clear-serving', key: row.key })
    })
    return pending.length
  }, [scope.customerId, upsertQuickServings])

  return {
    scope,
    state: { ...state, weeklyMenu },
    status: { isSavingMenu, isSavingQuickServings },
    actions: {
      openEditor,
      closeEditor: () => dispatch({ type: 'close-editor' }),
      changeDish: (dayKey, slotType, dishId) => dispatch({ type: 'change-dish', dayKey, slotType, dishId }),
      saveEditor,
      changeQuickServing: (key, value) => dispatch({ type: 'change-serving', key, value }),
      discardQuickServing: (key) => dispatch({ type: 'clear-serving', key }),
      saveQuickServing,
      completeQuickServing,
      completePendingQuickServings,
    },
    presentation: {
      sections,
      isLocked,
      getServiceDate: serviceDate,
      getSlotServingInfo,
      getLinePricing,
      buildQuickServingRows: (weeklyPlanRows: WeeklyPlanRow[]) => buildQuickServingRows({ scope, committedRows, plans: mealQuantityPlans, inputs: state.quickServingInputs, weeklyPlanRows }),
      getQuickServingRow: (rows, planRow) => rows.find((row) => row.serviceDate === planRow.serviceDate && row.shiftName === (planRow.shiftLabel.toLowerCase().includes('sáng') ? 'MORNING' : 'AFTERNOON')),
    },
  }
}
