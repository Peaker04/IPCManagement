import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useAppDispatch } from '@/lib/reduxHooks'
import { updateWeeklyMenuDish } from '@/lib/coordinationActions'
import type { MealQuantityPlanDto, MenuScheduleDto, OrderRow, WeeklyMenuState } from '@/types/coordination'
import type { WeeklyMenuImportResult } from '@/api/coordinationApi'
import { useCreateMenuAmendmentMutation, useUpdateWeeklyMenuBulkMutation, useUpsertQuickServingsMutation } from '@/api/coordinationApi'
import type { CatalogDish } from '@/api/dishCatalogApi'
import { normalizeBomPriceTier } from '../../weeklyMenuPlanning'
import { getApiErrorMessage } from '../model/formatters'
import { matchesCategory, matchesShift, SECTIONS } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'
import { buildQuantityPlanByDateShift, buildQuickServingRows, cloneWeeklyMenu, getScheduleServiceDate, getShiftServingInfo, resolveSlotServingInfo } from './scheduleModel'
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

type MenuDishChange = {
  locked: boolean
  serviceDate: string
  shiftName: 'Ca Sáng' | 'Ca Chiều'
  slotType: keyof WeeklyMenuState[string]
  dishId: string
}

export const buildMenuDishChanges = ({
  displayDays,
  sections,
  weeklyMenu,
  draftMenu,
  serviceDate,
  isLocked,
}: {
  displayDays: WeeklyMenuScope['displayDays']
  sections: Array<{ slotType: keyof WeeklyMenuState[string]; defaultDishId: string }>
  weeklyMenu: WeeklyMenuState
  draftMenu: WeeklyMenuState
  serviceDate: (dayKey: string) => string
  isLocked: (dayKey: string, slotType: keyof WeeklyMenuState[string]) => boolean
}): MenuDishChange[] => displayDays.flatMap((day) => sections.flatMap((section) => {
  const currentDishId = weeklyMenu[day.key]?.[section.slotType]?.dishId || section.defaultDishId
  const dishId = draftMenu[day.key]?.[section.slotType]?.dishId
  const date = serviceDate(day.key)
  return dishId && dishId !== currentDishId && date ? [{
    locked: isLocked(day.key, section.slotType),
    serviceDate: date,
    shiftName: section.slotType.startsWith('morning') ? 'Ca Sáng' as const : 'Ca Chiều' as const,
    slotType: section.slotType,
    dishId,
  }] : []
}))

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
  const [createMenuAmendment, { isLoading: isSubmittingAmendment }] = useCreateMenuAmendmentMutation()
  const [upsertQuickServings, { isLoading: isSavingQuickServings }] = useUpsertQuickServingsMutation()

  useEffect(() => {
    dispatch({ type: 'reset-quick-servings' })
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
    const apiShift = slotType.startsWith('morning') ? 'MORNING' : 'AFTERNOON'
    const persistedStatus = menuSchedules.find((schedule) =>
      schedule.customerId === scope.customerId
      && schedule.serviceDate.split('T')[0] === serviceDate(dayKey)
      && schedule.shiftName === apiShift,
    )?.status
    return persistedStatus !== undefined && persistedStatus !== 'DRAFT'
      || !!lockedShifts[`${dayKey}-${shift}`]
  }, [lockedShifts, menuSchedules, scope.customerId, serviceDate])
  const getSlotServingInfo = useCallback((dayKey: string, slotType: keyof WeeklyMenuState[string]) => {
    const shiftInfo = getShiftServingInfo({
      dayKey,
      shiftName: slotType.startsWith('morning') ? 'MORNING' : 'AFTERNOON',
      serviceDate: serviceDate(dayKey),
      quantityPlans,
      orders: activeOrders,
      lockedShifts,
    })
    const importedPortions = importedMenu[dayKey]?.[slotType]?.portions ?? 0
    return resolveSlotServingInfo(shiftInfo, importedPortions, slotType.endsWith('Vegetarian'))
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
  const pendingChanges = useMemo(() => buildMenuDishChanges({
    displayDays: scope.displayDays,
    sections,
    weeklyMenu,
    draftMenu: state.draftMenu,
    serviceDate,
    isLocked,
  }), [isLocked, scope.displayDays, sections, serviceDate, state.draftMenu, weeklyMenu])
  const saveEditor = useCallback(async (amendmentReason?: string) => {
    const changes = pendingChanges
    if (changes.length === 0) {
      dispatch({ type: 'close-editor' })
      return
    }
    try {
      const directSlots = changes.filter((slot) => !slot.locked)
      const amendmentSlots = changes.filter((slot) => slot.locked)
      if (directSlots.length > 0 && amendmentSlots.length > 0) {
        throw new Error('Không thể lưu đồng thời bản nháp và lịch đã khóa. Hãy lưu từng nhóm thay đổi để giữ chứng từ nhất quán.')
      }
      if (amendmentSlots.length > 0 && !amendmentReason?.trim()) throw new Error('Cần nêu lý do trước khi gửi thay đổi cho lịch đã khóa.')
      if (directSlots.length > 0) {
        const response = await updateWeeklyMenuBulk({ customerId: scope.customerId, slots: directSlots }).unwrap()
        if (!response.success) throw new Error(response.message || 'Không thể lưu chỉnh sửa thực đơn.')
      }
      if (amendmentSlots.length > 0) {
        const response = await createMenuAmendment({ customerId: scope.customerId, weekStartDate: scope.weekStartDate, reason: amendmentReason!, lines: amendmentSlots.map((slot) => ({ serviceDate: slot.serviceDate, shiftName: slot.shiftName === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON', dishSlot: slot.slotType.includes('Vegetarian') ? 'vegetarian-main' : 'savory-main', newDishId: slot.dishId })) }).unwrap()
        onMenuFeedback({ title: 'Đã gửi yêu cầu thay đổi', message: response.data?.requiresReconciliation ? 'Đã có chứng từ phía sau; yêu cầu cần đối soát và hậu kiểm.' : 'Yêu cầu đang chờ review trước khi thực thi.', variant: 'warning' })
      }
      directSlots.forEach((slot) => {
        const dayKey = scope.displayDays.find((day) => serviceDate(day.key) === slot.serviceDate)?.key
        if (dayKey) reduxDispatch(updateWeeklyMenuDish({ day: dayKey, slotType: slot.slotType, dishId: slot.dishId }))
      })
      if (directSlots.length > 0 && amendmentSlots.length === 0) onMenuFeedback({ title: 'Cập nhật thực đơn thành công', message: 'Thay đổi bản nháp đã được lưu.', variant: 'info' })
      dispatch({ type: 'close-editor' })
    } catch (error) {
      onMenuFeedback({ title: 'Chỉnh sửa thực đơn thất bại', message: getApiErrorMessage(error, 'Không thể lưu thay đổi vào hệ thống.'), variant: 'danger' })
    }
  }, [createMenuAmendment, onMenuFeedback, pendingChanges, reduxDispatch, scope.customerId, scope.displayDays, scope.weekStartDate, serviceDate, updateWeeklyMenuBulk])
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
  const buildServingRows = useCallback(
    (weeklyPlanRows: WeeklyPlanRow[]) => buildQuickServingRows({
      scope,
      committedRows,
      plans: mealQuantityPlans,
      inputs: state.quickServingInputs,
      weeklyPlanRows,
    }),
    [committedRows, mealQuantityPlans, scope, state.quickServingInputs],
  )
  return {
    scope,
    state: { ...state, weeklyMenu },
    status: { isSavingMenu: isSavingMenu || isSubmittingAmendment, isSavingQuickServings },
    actions: {
      openEditor,
      closeEditor: () => dispatch({ type: 'close-editor' }),
      changeDish: (dayKey, slotType, dishId) => dispatch({ type: 'change-dish', dayKey, slotType, dishId }),
      saveEditor,
      changeQuickServing: (key, value) => dispatch({ type: 'change-serving', key, value }),
      discardQuickServing: (key) => dispatch({ type: 'clear-serving', key }),
      saveQuickServing,
      completeQuickServing,
    },
    presentation: {
      pendingChangeCount: pendingChanges.length,
      sections,
      getDishName: (dishId) => catalogDishes.find((dish) => dish.id === dishId)?.name,
      isLocked,
      getServiceDate: serviceDate,
      getSlotServingInfo,
      getLinePricing,
      buildQuickServingRows: buildServingRows,
      getQuickServingRow: (rows, planRow) => rows.find((row) => row.serviceDate === planRow.serviceDate && row.shiftName === (planRow.shiftLabel.toLowerCase().includes('sáng') ? 'MORNING' : 'AFTERNOON')),
    },
  }
}
