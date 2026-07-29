import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import { useGetDailyProductionPlanQuery, useSendDailyProductionPlanToKitchenMutation, type KitchenIssueRow } from '@/api/workflowApi'
import type { OrderRow, ShiftType } from '@/types/coordination'
import { getChefMutationErrorMessage } from '../chefDashboardTypes'
import { toChefView } from '../chefQueryView'
import { buildChefProductionPlan, mapDailyPlanLines } from './chefProductionModel'

export type ChefFeedback = { title: string; message: string; variant: 'info' | 'warning' | 'danger' }
export type ChefShiftScope = { activeDay: string; activeShift: ShiftType; serviceDate: string; apiShiftName: string; isLocked: boolean }
const EMPTY_CHEF_LIST: never[] = []

export function useChefProductionPlan(
  scope: ChefShiftScope,
  kitchenIssues: KitchenIssueRow[],
  signedMaterials: Record<string, boolean>,
  onFeedback: (feedback: ChefFeedback) => void,
  enabled = true,
) {
  const orders = useAppSelector((state) => state.coordination.orders)
  const lossRate = useAppSelector((state) => state.coordination.lossRate)
  const catalogQuery = useGetDishesCatalogQuery(undefined, { skip: !enabled })
  const catalogView = toChefView(catalogQuery, 'danh mục món và BOM')
  const catalogDishes = catalogView.phase === 'ready' ? catalogView.data : EMPTY_CHEF_LIST
  const dailyQuery = useGetDailyProductionPlanQuery(
    { serviceDate: scope.serviceDate, shiftName: scope.apiShiftName },
    { skip: !enabled },
  )
  const dailyPlanView = toChefView(dailyQuery, 'kế hoạch sản xuất trong ngày')
  const dailyPlan = dailyPlanView.phase === 'ready' ? dailyPlanView.data : undefined
  const [sendDailyPlan, sendState] = useSendDailyProductionPlanToKitchenMutation()
  const supportedOrders = useMemo(
    () => orders.filter((order): order is OrderRow & { shift: ShiftType } =>
      order.shift === 'Ca Sáng' || order.shift === 'Ca Chiều'),
    [orders],
  )
  const dailyPlanLines = useMemo(() => mapDailyPlanLines(dailyPlan), [dailyPlan])
  const isLocked = scope.isLocked || Boolean(
    dailyPlan && dailyPlan.totalPlans > 0 && dailyPlan.sentPlans >= dailyPlan.totalPlans,
  )

  const productionPlan = useMemo(() => buildChefProductionPlan({
    orders: supportedOrders,
    catalogDishes,
    kitchenIssues,
    signedMaterials,
    activeDay: scope.activeDay,
    activeShift: scope.activeShift,
    isLocked,
    lossRate,
    serviceDate: scope.serviceDate,
    dailyPlanLines,
    dailyTotalServings: dailyPlan?.totalServings,
  }), [supportedOrders, catalogDishes, kitchenIssues, signedMaterials, scope, isLocked, lossRate, dailyPlanLines, dailyPlan?.totalServings])
  const dailyPlanWarnings = dailyPlan?.warnings ?? EMPTY_CHEF_LIST
  const isCatalogEmpty = catalogView.phase === 'ready' && catalogDishes.length === 0

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
    dailyPlan,
    dailyPlanLines,
    dailyPlanWarnings,
    receiveDailyPlan,
    isSendingDailyPlan: sendState.isLoading,
    isLocked,
    queryViews: {
      catalog: catalogView,
      dailyPlan: dailyPlanView,
    },
    status: {
      isCatalogLoading: catalogView.phase === 'uninitialized' || catalogView.phase === 'loading',
      isCatalogError: catalogView.phase === 'error' || catalogView.phase === 'forbidden',
      isCatalogEmpty,
      isDailyPlanLoading: dailyPlanView.phase === 'uninitialized' || dailyPlanView.phase === 'loading',
      isDailyPlanError: dailyPlanView.phase === 'error' || dailyPlanView.phase === 'forbidden',
    },
  }
}
