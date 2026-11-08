import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OrderRow } from '../types'
import { OrderTable } from './order-table'

const mocks = vi.hoisted(() => ({
  adjustOrder: vi.fn(),
  dispatch: vi.fn(),
  updateForecast: vi.fn(),
}))

vi.mock('@/lib/reduxHooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}))

vi.mock('@/api/coordinationApi', () => ({
  useAdjustCoordinationOrderMutation: () => [mocks.adjustOrder],
  useUpdateForecastServingsMutation: () => [mocks.updateForecast],
}))

const order: OrderRow = {
  id: 'order-1',
  quantityPlanLineId: 'line-1',
  customerId: 'customer-1',
  customerCode: 'ANV',
  customerName: 'Công ty ANV',
  menuId: 'menu-1',
  menuScheduleId: 'schedule-1',
  menuCode: 'MENU-1',
  menuName: 'Thực đơn 1',
  dishId: 'dish-1',
  mealType: 'Bữa trưa',
  dayOfWeek: 'MONDAY',
  serviceDate: '2026-08-03',
  shift: 'Ca Sáng',
  shiftName: 'MORNING',
  forecastQuantity: 120,
  actualQuantity: 120,
  unitPrice: 35_000,
  appliedRate: 1,
  specialNotes: '',
  dishes: [],
}

describe('OrderTable request ownership', () => {
  beforeEach(() => {
    mocks.adjustOrder.mockReset()
    mocks.dispatch.mockReset()
    mocks.updateForecast.mockReset()
    mocks.adjustOrder.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
    mocks.updateForecast.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
  })

  it('keeps actual servings local while typing and sends one request when editing finishes', async () => {
    render(
      <OrderTable
        orders={[order]}
        canEditForecast={false}
        canRequestAdjustment
        useFinalServings
      />,
    )

    const input = screen.getByRole('spinbutton', { name: 'Suất thực tế của Công ty ANV' })
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.change(input, { target: { value: '125' } })

    expect(mocks.adjustOrder).not.toHaveBeenCalled()

    fireEvent.blur(input)

    await vi.waitFor(() => expect(mocks.adjustOrder).toHaveBeenCalledOnce())
    expect(mocks.adjustOrder).toHaveBeenCalledWith({
      orderId: 'line-1',
      field: 'actualQuantity',
      newValue: 125,
      reason: 'Điều phối cập nhật số suất thực tế sau chốt.',
    })
  })
})
