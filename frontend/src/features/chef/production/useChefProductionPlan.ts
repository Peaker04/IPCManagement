import { useMemo } from 'react'
import { useCoordinationStoreSelector } from '@/lib/coordinationStore'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import { useGetDailyProductionPlanQuery } from '@/api/chefApi'
import type { KitchenIssueRow } from '@/api/workflowApiTypes'
import type { OrderRow, ShiftType } from '@/types/coordination'
import { toChefView } from '../chefQueryView'
import { buildChefProductionPlan, mapDailyPlanLines } from './chefProductionModel'

export type ChefFeedback = { title: string; message: string; variant: 'info' | 'warning' | 'danger' }
export type ChefShiftScope = { activeDay: string; activeShift: ShiftType; serviceDate: string; apiShiftName: string; isLocked: boolean }
const EMPTY_CHEF_LIST: never[] = []

export function useChefProductionPlan(
  scope: ChefShiftScope,
  kitchenIssues: KitchenIssueRow[],
  signedMaterials: Record<string, boolean>,
  enabled = true,
) {
  const orders = useCoordinationStoreSelector((state) => state.coordination.orders)
  const lossRate = useCoordinationStoreSelector((state) => state.coordination.lossRate)
  const catalogQuery = useGetDishesCatalogQuery(undefined, { skip: !enabled })
  const catalogView = toChefView(catalogQuery, 'danh mục món và BOM')
  const catalogDishes = catalogView.phase === 'ready' ? catalogView.data : EMPTY_CHEF_LIST
  const dailyQuery = useGetDailyProductionPlanQuery(
    { serviceDate: scope.serviceDate, shiftName: scope.apiShiftName },
    { skip: !enabled },
  )
  const dailyPlanView = toChefView(dailyQuery, 'kế hoạch sản xuất trong ngày')
  const dailyPlan = dailyPlanView.phase === 'ready' ? dailyPlanView.data : undefined
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

  return {
    productionPlan,
    dailyPlan,
    dailyPlanLines,
    dailyPlanWarnings,
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
