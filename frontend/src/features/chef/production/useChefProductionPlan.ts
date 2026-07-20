import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { useGetDishesCatalogQuery } from '@/features/projects/dishCatalogApi'
import { useGetDailyProductionPlanQuery, useSendDailyProductionPlanToKitchenMutation, type KitchenIssueRow } from '@/features/workflow'
import type { ShiftType } from '../../coordination/types'
import { getChefMutationErrorMessage } from '../chefDashboardTypes'
import { buildChefProductionPlan, mapDailyPlanLines } from './chefProductionModel'

export type ChefFeedback = { title: string; message: string; variant: 'info' | 'warning' | 'danger' }
export type ChefShiftScope = { activeDay: string; activeShift: ShiftType; serviceDate: string; apiShiftName: string; isLocked: boolean }

export function useChefProductionPlan(
  scope: ChefShiftScope,
  kitchenIssues: KitchenIssueRow[],
  signedMaterials: Record<string, boolean>,
  onFeedback: (feedback: ChefFeedback) => void,
) {
  const orders = useAppSelector((state) => state.coordination.orders)
  const menuPrice = useAppSelector((state) => state.coordination.menuPrice)
  const lossRate = useAppSelector((state) => state.coordination.lossRate)
  const catalog = useGetDishesCatalogQuery()
  const daily = useGetDailyProductionPlanQuery({ serviceDate: scope.serviceDate, shiftName: scope.apiShiftName })
  const [sendDailyPlan, sendState] = useSendDailyProductionPlanToKitchenMutation()

  const productionPlan = useMemo(() => buildChefProductionPlan({
    orders,
    catalogDishes: catalog.data ?? [],
    kitchenIssues,
    signedMaterials,
    activeDay: scope.activeDay,
    activeShift: scope.activeShift,
    isLocked: scope.isLocked,
    menuPrice,
    lossRate,
    serviceDate: scope.serviceDate,
  }), [orders, catalog.data, kitchenIssues, signedMaterials, scope, menuPrice, lossRate])
  const dailyPlanLines = useMemo(() => mapDailyPlanLines(daily.data), [daily.data])
  const dailyPlanWarnings = daily.data?.warnings ?? []
  const isCatalogEmpty = !catalog.isLoading && !catalog.isError && (catalog.data?.length ?? 0) === 0

  const receiveDailyPlan = async () => {
    try {
      const result = await sendDailyPlan({
        serviceDate: scope.serviceDate,
        shiftName: scope.apiShiftName,
        reason: `Bếp trưởng nhận kế hoạch sản xuất ${scope.serviceDate} ${scope.apiShiftName}.`,
      }).unwrap()
      onFeedback({
        title: 'Đã nhận kế hoạch sản xuất',
        message: `${result.sentPlans}/${result.totalPlans} kế hoạch sản xuất đã được đánh dấu gửi bếp.`,
        variant: 'info',
      })
    } catch (error) {
      onFeedback({
        title: 'Chưa nhận được kế hoạch sản xuất',
        message: getChefMutationErrorMessage(error, 'Không thể đánh dấu gửi bếp cho kế hoạch hôm nay.'),
        variant: 'warning',
      })
    }
  }

  return {
    productionPlan,
    dailyPlan: daily.data,
    dailyPlanLines,
    dailyPlanWarnings,
    receiveDailyPlan,
    isSendingDailyPlan: sendState.isLoading,
    status: {
      isCatalogLoading: catalog.isLoading,
      isCatalogError: catalog.isError,
      isCatalogEmpty,
      isDailyPlanLoading: daily.isLoading,
      isDailyPlanError: daily.isError,
    },
  }
}
