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
import { toLabeledQueryView } from '@/lib/labeledQueryView'

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
  const weekView = toLabeledQueryView(weekQuery, 'kế hoạch sản xuất của tuần', {
    instruction: !scope.customerId
      ? 'Chọn khách hàng để xem kế hoạch sản xuất.'
      : weekDates.length === 0
        ? 'Chọn tuần có ngày phục vụ để xem kế hoạch sản xuất.'
        : 'Mở tab Kế hoạch sản xuất để tải dữ liệu.',
  })
  const weekResponse = weekView.phase === 'ready' ? weekView.data : undefined
  const weekPlans = useMemo(() => weekResponse?.data ?? [], [weekResponse?.data])
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
    dataState: weekView,
    state: { selectedDayKey, selectedServiceDate, pageIndex: safePageIndex },
    status: {
      isUninitialized: weekView.phase === 'uninitialized',
      instruction: weekView.phase === 'uninitialized' ? weekView.instruction : undefined,
      isLoading: weekView.phase === 'loading',
      isForbidden: weekView.phase === 'forbidden',
      forbiddenMessage: weekView.phase === 'forbidden' ? weekView.message : undefined,
      isError: weekView.phase === 'error',
      errorMessage: weekView.phase === 'error' ? weekView.message : undefined,
      isRetrying: weekView.phase === 'error' ? weekView.isRetrying : false,
      isRefreshing: weekView.phase === 'ready' && weekView.isRefreshing,
    },
    actions: {
      selectDay,
      retry: () => weekQuery.refetch(),
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
