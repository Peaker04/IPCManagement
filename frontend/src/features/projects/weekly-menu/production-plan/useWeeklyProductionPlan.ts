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

export function useWeeklyProductionPlan(scope: WeeklyMenuScope, enabled = true) {
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
  const weekQuery = useGetProductionPlansQuery({
    customerId: scope.customerId,
    dateFrom: weekDates[0],
    dateTo: weekDates[weekDates.length - 1],
  }, { skip: !enabled || !scope.customerId || weekDates.length === 0 })
  const weekPlans = useMemo(() => weekQuery.currentData?.data ?? [], [weekQuery.currentData])
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
    status: { isLoading: !selectedServiceDate && weekQuery.isFetching },
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
