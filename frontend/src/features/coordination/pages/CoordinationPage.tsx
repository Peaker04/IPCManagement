import { useEffect } from 'react'
import { HeaderInfo } from '../components/header-info'
import { OrderStatusBanner } from '../components/order-status-banner'
import { OrderTable } from '../components/order-table'
import { ActionToolbar } from '../components/action-toolbar'
import { useCountdown } from '../components/hooks'
import { useAppDispatch, useAppSelector, useCurrentShift } from '@/app/hooks'
import { syncOrdersForShift } from '../coordinationSlice'
import { useGetCoordinationOrdersQuery, useGetMealQuantityPlansQuery, useGetMenuSchedulesQuery } from '../coordinationApi'
import { toApiShiftName } from '../types'
import { ContextStrip, InlineAlert, OperationalFrame, SectionPanel } from '@/components/common'
import { formatNumber } from '@/lib/formatters'

export default function CoordinationPage() {
  const dispatch = useAppDispatch()
  const { timeRemaining, isLocked: countdownLocked } = useCountdown()
  
  const currentShift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const allOrders = useAppSelector((state) => state.coordination.orders)
  const weeklyMenu = useAppSelector((state) => state.coordination.weeklyMenu)
  const reduxLocked = useAppSelector((state) => state.coordination.isLocked)
  const localError = useAppSelector((state) => state.coordination.error)
  const ordersQuery = useGetCoordinationOrdersQuery({ dayOfWeek: currentDayOfWeek, shift: currentShift })
  const shiftName = toApiShiftName(currentShift)
  const menusQuery = useGetMenuSchedulesQuery({ dayOfWeek: currentDayOfWeek, shiftName })
  const plansQuery = useGetMealQuantityPlansQuery({ dayOfWeek: currentDayOfWeek, shiftName })
  const backendStatus = plansQuery.data?.data?.[0]?.status
  const normalizedBackendStatus = (backendStatus ?? '').toUpperCase()
  // Use countdown lock time if it reaches 8:30 AM, or if manually locked
  const effectiveIsLocked =
    reduxLocked ||
    countdownLocked ||
    normalizedBackendStatus === 'CONFIRMED' ||
    normalizedBackendStatus === 'ADJUSTED' ||
    normalizedBackendStatus === 'COMPLETED'

  useEffect(() => {
    if (ordersQuery.data?.success && ordersQuery.data.data) {
      dispatch(syncOrdersForShift({
        dayOfWeek: currentDayOfWeek,
        shift: currentShift,
        orders: ordersQuery.data.data,
      }))
    }
  }, [currentDayOfWeek, currentShift, dispatch, ordersQuery.data])

  // Filter orders by active day and shift
  const filteredOrders = allOrders.filter(
    (order) => order.dayOfWeek === currentDayOfWeek && order.shift === currentShift
  )
  const totalForecast = filteredOrders.reduce((sum, order) => sum + order.forecastQuantity, 0)
  const totalActual = filteredOrders.reduce((sum, order) => sum + order.actualQuantity, 0)
  const totalFinal = filteredOrders.reduce((sum, order) => sum + (effectiveIsLocked ? order.actualQuantity : order.forecastQuantity), 0)
  const totalVariance = totalFinal - totalForecast

  // Get the default planned dish for this shift and day from the Weekly Menu
  const menuShiftKey = currentShift === 'Ca Sáng' ? 'morningSavory' : 'afternoonSavory'
  const plannedDishId = weeklyMenu[currentDayOfWeek]?.[menuShiftKey]?.dishId
  const plannedMenuName = filteredOrders.find((order) => order.menuName)?.menuName
  const backendMenuName = menusQuery.data?.data?.[0]?.menuName
  const plannedDishLabel = backendMenuName || plannedMenuName || (plannedDishId ? 'Theo thực đơn đã nhập' : 'Chưa có dữ liệu')
  const loading = ordersQuery.isLoading || ordersQuery.isFetching || menusQuery.isLoading || plansQuery.isLoading
  const error = ordersQuery.isError
    ? 'Không tải được danh sách suất ăn từ hệ thống điều phối.'
    : localError
  const orderStatus = loading ? 'syncing' : backendStatus || (effectiveIsLocked ? 'locked' : 'draft')

  return (
    <OperationalFrame
      command={<HeaderInfo timeRemaining={timeRemaining} />}
      context={
        <ContextStrip
          items={[
            { label: 'Thực đơn đề xuất', value: plannedDishLabel, tone: plannedMenuName ? 'info' : 'warning' },
            { label: 'Suất dự kiến', value: formatNumber(totalForecast), tone: 'neutral' },
            { label: 'Suất chốt', value: effectiveIsLocked ? formatNumber(totalActual) : 'Chưa chốt', tone: effectiveIsLocked ? 'success' : 'warning' },
            { label: 'Chênh lệch', value: `${totalVariance >= 0 ? '+' : ''}${formatNumber(totalVariance)}`, tone: totalVariance === 0 ? 'success' : 'warning' },
          ]}
        />
      }
    >
      <SectionPanel
        tone="dark"
        padded={false}
        className="operation-surface ipc-coordination-workbench flex min-h-[560px] flex-col overflow-hidden border-slate-200 bg-white shadow-sm"
      >
        {error && (
          <InlineAlert title="Không tải được dữ liệu điều phối" variant="warning">
            {error}
          </InlineAlert>
        )}
        {loading && (
          <InlineAlert title="Đang tải dữ liệu điều phối" variant="info">
            Hệ thống đang lấy danh sách suất ăn mới nhất.
          </InlineAlert>
        )}
        <OrderStatusBanner status={orderStatus} />

        <div className="min-h-0 flex-1 overflow-hidden">
          <OrderTable orders={filteredOrders} isLocked={effectiveIsLocked} />
        </div>

        <ActionToolbar status={orderStatus} />
      </SectionPanel>
    </OperationalFrame>
  )
}

