import { useEffect } from 'react'
import { HeaderInfo } from '../components/header-info'
import { OrderStatusBanner } from '../components/order-status-banner'
import { OrderTable } from '../components/order-table'
import { ActionToolbar } from '../components/action-toolbar'
import { useAppDispatch, useAppSelector, useCurrentShift } from '@/app/hooks'
import { syncOrdersForShift } from '../coordinationSlice'
import { useGetCoordinationOrdersQuery, useGetMealQuantityPlansQuery } from '../coordinationApi'
import { toApiShiftName } from '../types'
import { ContextStrip, InlineAlert, OperationalFrame, SectionPanel } from '@/components/common'
import { formatNumber } from '@/lib/formatters'
import { deriveCoordinationStatus } from '../coordinationStatus'

export default function CoordinationPage() {
  const dispatch = useAppDispatch()
  const currentShift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const allOrders = useAppSelector((state) => state.coordination.orders)
  const localError = useAppSelector((state) => state.coordination.error)
  const ordersQuery = useGetCoordinationOrdersQuery({ dayOfWeek: currentDayOfWeek, shift: currentShift })
  const shiftName = toApiShiftName(currentShift)
  const plansQuery = useGetMealQuantityPlansQuery({ dayOfWeek: currentDayOfWeek, shiftName })
  const plans = plansQuery.currentData?.data ?? []
  const loading = ordersQuery.isLoading || ordersQuery.isFetching || plansQuery.isLoading
  const coordinationStatus = deriveCoordinationStatus(
    plans.map((plan) => plan.status),
    loading,
  )
  const { hasPlans, isReadOnly, canEditForecast, canRequestAdjustment, useFinalServings } = coordinationStatus

  useEffect(() => {
    if (ordersQuery.currentData?.success && ordersQuery.currentData.data) {
      dispatch(syncOrdersForShift({
        dayOfWeek: currentDayOfWeek,
        shift: currentShift,
        orders: ordersQuery.currentData.data,
      }))
    }
  }, [currentDayOfWeek, currentShift, dispatch, ordersQuery.currentData])

  // Filter orders by active day and shift
  const filteredOrders = allOrders.filter(
    (order) => order.dayOfWeek === currentDayOfWeek && order.shift === currentShift
  )
  const totalForecast = filteredOrders.reduce((sum, order) => sum + order.forecastQuantity, 0)
  const totalActual = filteredOrders.reduce((sum, order) => sum + order.actualQuantity, 0)
  const totalFinal = filteredOrders.reduce((sum, order) => sum + (isReadOnly ? order.actualQuantity : order.forecastQuantity), 0)
  const totalVariance = totalFinal - totalForecast

  const error = ordersQuery.isError
    ? 'Không tải được danh sách suất ăn từ hệ thống điều phối.'
    : localError
  const orderStatus = coordinationStatus.status

  return (
    <OperationalFrame
      command={<HeaderInfo status={orderStatus} />}
      context={
        <ContextStrip
          items={[
            { label: 'Suất dự kiến', value: formatNumber(totalForecast), tone: 'neutral' },
            { label: 'Suất điều phối', value: isReadOnly ? formatNumber(totalActual) : 'Chưa chốt', tone: isReadOnly ? 'success' : 'warning' },
            { label: 'Chênh lệch', value: `${totalVariance >= 0 ? '+' : ''}${formatNumber(totalVariance)}`, tone: totalVariance === 0 ? 'success' : 'warning' },
          ]}
        />
      }
    >
      <SectionPanel
        tone="dark"
        padded={false}
        className="operation-surface ipc-coordination-workbench overflow-hidden border-slate-200 bg-white shadow-sm"
      >
        {error && (
          <InlineAlert title="Không tải được dữ liệu điều phối" variant="warning">
            {error}
          </InlineAlert>
        )}
        <OrderStatusBanner status={orderStatus} />
        <ActionToolbar status={orderStatus} hasPlans={hasPlans} />

        <div className="min-h-0">
          <OrderTable
            orders={filteredOrders}
            canEditForecast={canEditForecast}
            canRequestAdjustment={canRequestAdjustment}
            useFinalServings={useFinalServings}
          />
        </div>
      </SectionPanel>
    </OperationalFrame>
  )
}

