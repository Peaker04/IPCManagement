import { useMemo, useState } from 'react'
import { useGetProductionPlansQuery } from '../../../coordination/coordinationApi'
import {
  buildProductionDisplayDayByDate,
  buildProductionPlanPages,
  filterProductionPlansForSelection,
  getSafeProductionPlanPageIndex,
} from '../../weeklyMenuPlanning'
import { parseDisplayDateToIso } from '../model/formatters'
import type { WeeklyMenuScope } from '../schedule/types'

const useProductionPlanDay = (customerId: string, serviceDate?: string) =>
  useGetProductionPlansQuery(
    { customerId, serviceDate },
    { skip: !customerId || !serviceDate },
  )

export function useWeeklyProductionPlan(scope: WeeklyMenuScope) {
  const scopeKey = `${scope.customerId}:${scope.weekStartDate}`
  const [navigation, setNavigation] = useState({
    scopeKey,
    selectedDayKey: null as string | null,
    pageIndex: 0,
  })
  const selectedDayKey = navigation.scopeKey === scopeKey ? navigation.selectedDayKey : null
  const pageIndex = navigation.scopeKey === scopeKey ? navigation.pageIndex : 0
  const weekDates = useMemo(
    () => scope.displayDays.map((day) => parseDisplayDateToIso(day.date)).filter((date): date is string => Boolean(date)),
    [scope.displayDays],
  )
  const day0 = useProductionPlanDay(scope.customerId, weekDates[0])
  const day1 = useProductionPlanDay(scope.customerId, weekDates[1])
  const day2 = useProductionPlanDay(scope.customerId, weekDates[2])
  const day3 = useProductionPlanDay(scope.customerId, weekDates[3])
  const day4 = useProductionPlanDay(scope.customerId, weekDates[4])
  const day5 = useProductionPlanDay(scope.customerId, weekDates[5])
  const weekPlans = useMemo(
    () => [
      ...(day0.currentData?.data ?? []),
      ...(day1.currentData?.data ?? []),
      ...(day2.currentData?.data ?? []),
      ...(day3.currentData?.data ?? []),
      ...(day4.currentData?.data ?? []),
      ...(day5.currentData?.data ?? []),
    ],
    [day0.currentData, day1.currentData, day2.currentData, day3.currentData, day4.currentData, day5.currentData],
  )
  const selectedServiceDate = selectedDayKey
    ? parseDisplayDateToIso(scope.displayDays.find((day) => day.key === selectedDayKey)?.date)
    : undefined
  const plans = useMemo(() => {
    if (!scope.customerId) return []
    return filterProductionPlansForSelection(weekPlans, weekDates, selectedServiceDate)
  }, [scope.customerId, selectedServiceDate, weekDates, weekPlans])
  const displayDayByDate = useMemo(
    () => buildProductionDisplayDayByDate(scope.displayDays, parseDisplayDateToIso),
    [scope.displayDays],
  )
  const pages = useMemo(() => buildProductionPlanPages(plans, displayDayByDate), [displayDayByDate, plans])
  const safePageIndex = getSafeProductionPlanPageIndex(pages.length, pageIndex)

  const selectDay = (dayKey: string | null) => {
    setNavigation({ scopeKey, selectedDayKey: dayKey, pageIndex: 0 })
  }

  return {
    scope,
    state: { selectedDayKey, selectedServiceDate, pageIndex: safePageIndex },
    status: { isLoading: !selectedServiceDate && [day0, day1, day2, day3, day4, day5].some((query) => query.isFetching) },
    actions: {
      selectDay,
      setPage: (page: number) => setNavigation({
        scopeKey,
        selectedDayKey,
        pageIndex: page - 1,
      }),
    },
    presentation: { pages, activePage: pages[safePageIndex] },
  }
}

export type WeeklyProductionPlanWorkflow = ReturnType<typeof useWeeklyProductionPlan>
