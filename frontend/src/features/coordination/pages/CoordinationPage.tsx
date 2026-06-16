import { HeaderInfo } from '../components/header-info'
import { OrderStatusBanner } from '../components/order-status-banner'
import { OrderTable } from '../components/order-table'
import { ActionToolbar } from '../components/action-toolbar'
import { useCountdown } from '../components/hooks'
import { useAppSelector, useCurrentShift } from '@/app/hooks'
import { DISHES } from '../../projects/menuData'
import { ContextStrip, OperationalFrame, SectionPanel } from '@/components/common'
import { formatNumber } from '@/lib/formatters'

export default function CoordinationPage() {
  const { timeRemaining, isLocked: countdownLocked } = useCountdown()
  
  const currentShift = useCurrentShift()
  const currentDayOfWeek = useAppSelector((state) => state.coordination.currentDayOfWeek)
  const allOrders = useAppSelector((state) => state.coordination.orders)
  const weeklyMenu = useAppSelector((state) => state.coordination.weeklyMenu)
  const reduxLocked = useAppSelector((state) => state.coordination.isLocked)
  // Use countdown lock time if it reaches 8:30 AM, or if manually locked
  const effectiveIsLocked = reduxLocked || countdownLocked

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
  const plannedDish = DISHES.find((d) => d.id === plannedDishId)

  return (
    <OperationalFrame
      eyebrow="Điều phối ca"
      title="Chốt suất ăn theo ngày và ca"
      command={<HeaderInfo timeRemaining={timeRemaining} />}
      context={
        <ContextStrip
          items={[
            { label: 'Thực đơn đề xuất', value: plannedDish?.name || 'Chưa có thực đơn', tone: plannedDish ? 'info' : 'warning' },
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
        <OrderStatusBanner isLocked={effectiveIsLocked} />

        <div className="min-h-0 flex-1 overflow-hidden">
          <OrderTable orders={filteredOrders} isLocked={effectiveIsLocked} />
        </div>

        <ActionToolbar />
      </SectionPanel>
    </OperationalFrame>
  )
}

