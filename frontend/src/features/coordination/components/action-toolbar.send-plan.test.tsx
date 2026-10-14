import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import authReducer from '@/lib/auth/authSlice'
import type { User } from '@/lib/auth/authTypes'
import coordinationReducer from '../coordinationSlice'
import type { OrderRow, ShiftType } from '../types'
import { ActionToolbar } from './action-toolbar'

const mocks = vi.hoisted(() => ({
  sendMutation: vi.fn(),
  lockMutation: vi.fn(),
  exportMutation: vi.fn(),
  signoffMutation: vi.fn(),
  unlockMutation: vi.fn(),
}))

vi.mock('@/api/coordinationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/coordinationApi')>()
  return {
    ...actual,
    useSendDailyProductionPlanToKitchenMutation: () => [mocks.sendMutation, { isLoading: false }],
    useLockCoordinationOrdersMutation: () => [mocks.lockMutation, { isLoading: false }],
    useExportCoordinationOrdersMutation: () => [mocks.exportMutation, { isLoading: false }],
    useSignoffCoordinationScopeMutation: () => [mocks.signoffMutation, { isLoading: false }],
    useUnlockCoordinationScopeMutation: () => [mocks.unlockMutation, { isLoading: false }],
  }
})

const authorizedUser: User = {
  id: 'u-dieuphoi',
  username: 'dieuphoi_user',
  fullName: 'Điều phối viên',
  role: 'dieuphoi',
  roleCode: 'DIEUPHOI',
  roleName: 'Điều phối viên',
  isAdminFullAccess: false,
  permissions: ['coordination.read'],
}

const unauthorizedUser: User = {
  id: 'u-bep',
  username: 'beptruong_user',
  fullName: 'Bếp trưởng',
  role: 'beptruong',
  roleCode: 'BEPTRUONG',
  roleName: 'Bếp trưởng',
  isAdminFullAccess: false,
  permissions: [],
}

const sampleOrder: OrderRow = {
  id: 'order-1',
  quantityPlanLineId: 'line-1',
  customerId: 'cust-1',
  customerCode: 'CUST-1',
  customerName: 'Công ty Test',
  menuId: 'menu-1',
  menuScheduleId: 'sched-1',
  menuCode: 'MN-1',
  menuName: 'Thực đơn trưa',
  dishId: 'dish-1',
  mealType: 'Bữa trưa',
  dayOfWeek: 'MONDAY',
  serviceDate: '2026-08-03',
  shift: 'Ca Sáng' as ShiftType,
  shiftName: 'MORNING',
  forecastQuantity: 100,
  actualQuantity: 100,
  unitPrice: 35000,
  appliedRate: 1,
  specialNotes: '',
  dishes: [],
}

const createTestStore = (customState: {
  user?: User
  orders?: OrderRow[]
  currentShift?: ShiftType
  currentServiceDate?: string
  currentDayOfWeek?: string
} = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      coordination: coordinationReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(apiSlice.middleware),
    preloadedState: {
      auth: {
        user: customState.user ?? authorizedUser,
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
      },
      coordination: {
        loading: false,
        orders: customState.orders ?? [sampleOrder],
        currentShift: customState.currentShift ?? ('Ca Sáng' as ShiftType),
        currentServiceDate: customState.currentServiceDate ?? '2026-08-03',
        currentDayOfWeek: customState.currentDayOfWeek ?? 'MONDAY',
        weeklyMenu: {},
        lossRate: 5,
        isLocked: false,
        lockedShifts: {},
        auditLogs: [],
        error: null,
        lastUpdated: null,
      },
    },
  })
}

const renderComponent = (
  props: { status?: string; hasPlans: boolean } = { status: 'CONFIRMED', hasPlans: true },
  customState = {},
) => {
  const store = createTestStore(customState)
  return render(
    <Provider store={store}>
      <ActionToolbar {...props} />
    </Provider>,
  )
}

describe('Coordination ActionToolbar send-to-kitchen behavioral contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Gửi kế hoạch cho Bếp" when status is confirmed, plans exist, and user is authorized', () => {
    renderComponent({ status: 'CONFIRMED', hasPlans: true })

    const sendButton = screen.getByRole('button', { name: /Gửi kế hoạch cho Bếp/i })
    expect(sendButton).toBeInTheDocument()
    expect(sendButton).not.toBeDisabled()
  })

  it('does not render "Gửi kế hoạch cho Bếp" when user lacks required role (protected by ActionGuard)', () => {
    renderComponent(
      { status: 'CONFIRMED', hasPlans: true },
      { user: unauthorizedUser },
    )

    expect(screen.queryByRole('button', { name: /Gửi kế hoạch cho Bếp/i })).not.toBeInTheDocument()
  })

  it('does not render "Gửi kế hoạch cho Bếp" when orders are not confirmed yet', () => {
    renderComponent({ status: 'DRAFT', hasPlans: true })

    expect(screen.queryByRole('button', { name: /Gửi kế hoạch cho Bếp/i })).not.toBeInTheDocument()
  })

  it('opens confirmation dialog and dispatches sendDailyPlan with correct date and API shift', async () => {
    mocks.sendMutation.mockReturnValue({
      unwrap: () => Promise.resolve({ sentPlans: 2, totalPlans: 2 }),
    })

    renderComponent({ status: 'CONFIRMED', hasPlans: true })

    const sendButton = screen.getByRole('button', { name: /Gửi kế hoạch cho Bếp/i })
    fireEvent.click(sendButton)

    // Dialog appears with confirmation details
    expect(screen.getByRole('heading', { level: 2, name: 'Gửi kế hoạch cho Bếp?' })).toBeInTheDocument()
    expect(
      screen.getByText(/Tất cả kế hoạch thuộc ngày 2026-08-03 và Ca Sáng sẽ được đánh dấu đã gửi Bếp\./i),
    ).toBeInTheDocument()

    // Confirm action
    const confirmButton = screen.getByRole('button', { name: 'Gửi kế hoạch' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mocks.sendMutation).toHaveBeenCalledTimes(1)
    })

    expect(mocks.sendMutation).toHaveBeenCalledWith({
      serviceDate: '2026-08-03',
      shiftName: 'MORNING',
      reason: 'Điều phối gửi kế hoạch sản xuất ngày 2026-08-03, Ca Sáng.',
    })

    // Feedback notification is displayed
    await waitFor(() => {
      expect(screen.getByText('Đã gửi kế hoạch cho Bếp')).toBeInTheDocument()
    })
    expect(screen.getByText('2/2 kế hoạch trong ngày/ca đã được bàn giao.')).toBeInTheDocument()
  })

  it('displays error feedback when sendDailyPlan fails', async () => {
    mocks.sendMutation.mockReturnValue({
      unwrap: () => Promise.reject(new Error('Mạng không ổn định')),
    })

    renderComponent({ status: 'CONFIRMED', hasPlans: true })

    const sendButton = screen.getByRole('button', { name: /Gửi kế hoạch cho Bếp/i })
    fireEvent.click(sendButton)

    const confirmButton = screen.getByRole('button', { name: 'Gửi kế hoạch' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('Chưa gửi được kế hoạch')).toBeInTheDocument()
    })
    expect(screen.getByText('Mạng không ổn định')).toBeInTheDocument()
  })
})
