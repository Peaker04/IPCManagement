import { lazy, Suspense, useEffect } from 'react'
import { HeaderInfo } from '../components/header-info'
import { OrderStatusBanner } from '../components/order-status-banner'
import { useAppDispatch } from '@/lib/reduxHooks'
import { useCoordinationSelector, useCurrentShift } from '../coordinationHooks'
import { syncOrdersForShift } from '../coordinationSlice'
import { useGetCoordinationOrdersQuery, useGetMealQuantityPlansQuery } from '@/api/coordinationApi'
import { toApiShiftName } from '../types'
import { ContextStrip, OperationalFrame, QueryErrorAlert, SectionPanel } from '@/components/common'
import { formatNumber } from '@/lib/formatters'
import { deriveCoordinationStatus } from '../coordinationStatus'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'
import { toLabeledQueryView } from '@/lib/labeledQueryView'

const ActionToolbar = lazy(() => import('../components/action-toolbar').then(({ ActionToolbar: component }) => ({ default: component })))
const OrderTable = lazy(() => import('../components/order-table').then(({ OrderTable: component }) => ({ default: component })))

const capabilityFallback = <div aria-hidden="true" className="min-h-12 rounded-md bg-slate-50 motion-reduce:animate-none" />

export default function CoordinationPage() {
  const dispatch = useAppDispatch()
  const currentShift = useCurrentShift()
  const currentServiceDate = useCoordinationSelector((state) => state.coordination.currentServiceDate)
  const currentDayOfWeek = useCoordinationSelector((state) => state.coordination.currentDayOfWeek)
  const allOrders = useCoordinationSelector((state) => state.coordination.orders)
  const localError = useCoordinationSelector((state) => state.coordination.error)
  const ordersQuery = useGetCoordinationOrdersQuery({ dayOfWeek: currentDayOfWeek, serviceDate: currentServiceDate, shift: currentShift })
  const shiftName = toApiShiftName(currentShift)
  const plansQuery = useGetMealQuantityPlansQuery({ dayOfWeek: currentDayOfWeek, serviceDate: currentServiceDate, shiftName })
  const ordersView = toLabeledQueryView(ordersQuery, 'danh sách suất ăn', {
    instruction: 'Chọn ngày và ca để tải danh sách suất ăn.',
  })
  const plansView = toLabeledQueryView(plansQuery, 'trạng thái chốt số suất', {
    instruction: 'Chọn ngày và ca để tải trạng thái chốt số suất.',
  })
  const plansResponse = plansView.phase === 'ready'
    ? plansView.data
    : plansView.phase === 'error' ? plansQuery.currentData : undefined
  const plans = plansResponse?.data ?? []
  const currentOrdersResponse = ordersQuery.currentData?.success ? ordersQuery.currentData : undefined

  useEffect(() => {
    if (currentOrdersResponse?.data) {
      dispatch(syncOrdersForShift({
        dayOfWeek: currentDayOfWeek,
        shift: currentShift,
        orders: currentOrdersResponse.data,
      }))
    }
  }, [currentDayOfWeek, currentOrdersResponse, currentShift, dispatch])

  // Filter orders by active day and shift
  const filteredOrders = allOrders.filter(
    (order) => order.dayOfWeek === currentDayOfWeek && order.shift === currentShift
  )
  const hasOrderFallback = filteredOrders.length > 0
  const hasPlanFallback = plansResponse !== undefined
  const loading = (ordersView.phase !== 'ready' && !hasOrderFallback)
    || (plansView.phase !== 'ready' && !hasPlanFallback)
  const coordinationStatus = deriveCoordinationStatus(
    plans.map((plan) => plan.status),
    loading,
  )
  const { hasPlans, isReadOnly, canEditForecast, canRequestAdjustment, useFinalServings } = coordinationStatus
  const totalForecast = filteredOrders.reduce((sum, order) => sum + order.forecastQuantity, 0)
  const totalActual = filteredOrders.reduce((sum, order) => sum + order.actualQuantity, 0)
  const totalFinal = filteredOrders.reduce((sum, order) => sum + (isReadOnly ? order.actualQuantity : order.forecastQuantity), 0)
  const totalVariance = totalFinal - totalForecast
  const orderStatus = coordinationStatus.status
  const hasVisibleOrderMetrics = ordersView.phase === 'ready' || hasOrderFallback

  return (
    <OperationalFrame
      command={<HeaderInfo status={orderStatus} />}
      context={
        <ContextStrip
          items={[
            { label: 'Suất dự kiến', value: hasVisibleOrderMetrics ? formatNumber(totalForecast) : '—', tone: 'neutral' },
            { label: 'Suất điều phối', value: !hasVisibleOrderMetrics ? '—' : isReadOnly ? formatNumber(totalActual) : 'Chưa chốt', tone: hasVisibleOrderMetrics && isReadOnly ? 'success' : 'warning' },
            { label: 'Chênh lệch', value: hasVisibleOrderMetrics ? `${totalVariance >= 0 ? '+' : ''}${formatNumber(totalVariance)}` : '—', tone: hasVisibleOrderMetrics && totalVariance === 0 ? 'success' : 'warning' },
          ]}
        />
      }
    >
      <SectionPanel
        tone="dark"
        padded={false}
        className="operation-surface ipc-coordination-workbench overflow-hidden border-slate-200 bg-white shadow-sm"
      >
        {localError && (
          <QueryErrorAlert
            title="Không tải được dữ liệu điều phối"
            isRetrying={ordersQuery.isFetching || plansQuery.isFetching}
            onRetry={() => Promise.all([ordersQuery.refetch(), plansQuery.refetch()])}
          >
            {localError}
            {' '}Dữ liệu cũ được giữ chỉ để đối chiếu; hãy tải lại trước khi khóa hoặc điều chỉnh ca.
          </QueryErrorAlert>
        )}
        <QueryViewBoundary
          preserveFallback={hasOrderFallback || hasPlanFallback}
          queries={[
            { label: 'danh sách suất ăn', view: ordersView },
            { label: 'trạng thái chốt số suất', view: plansView },
          ]}
        >
          <OrderStatusBanner status={orderStatus} />
          <Suspense fallback={capabilityFallback}>
            <ActionToolbar status={orderStatus} hasPlans={hasPlans} />
          </Suspense>

          <div className="min-h-0">
            <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />}>
              <OrderTable
                orders={filteredOrders}
                canEditForecast={canEditForecast}
                canRequestAdjustment={canRequestAdjustment}
                useFinalServings={useFinalServings}
              />
            </Suspense>
          </div>
        </QueryViewBoundary>
      </SectionPanel>
    </OperationalFrame>
  )
}

