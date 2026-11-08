import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import authReducer from '@/lib/auth/authSlice'
import type { User } from '@/lib/auth/authTypes'
import coordinationReducer from '../coordinationSlice'
import type { OrderRow, ShiftType } from '../types'
import type { QuerySnapshot } from '@/lib/queryView'
import CoordinationPage from './CoordinationPage'

const mocks = vi.hoisted(() => ({
  ordersQuery: vi.fn(),
  plansQuery: vi.fn(),
  lockMutation: vi.fn(),
  sendMutation: vi.fn(),
  signoffMutation: vi.fn(),
  unlockMutation: vi.fn(),
  exportMutation: vi.fn(),
  adjustOrderMutation: vi.fn(),
  updateForecastMutation: vi.fn(),
}))

vi.mock('@/api/coordinationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/coordinationApi')>()
  return {
    ...actual,
    useGetCoordinationOrdersQuery: mocks.ordersQuery,
    useGetMealQuantityPlansQuery: mocks.plansQuery,
    useLockCoordinationOrdersMutation: () => [mocks.lockMutation, { isLoading: false }],
    useSendDailyProductionPlanToKitchenMutation: () => [mocks.sendMutation, { isLoading: false }],
    useSignoffCoordinationScopeMutation: () => [mocks.signoffMutation, { isLoading: false }],
    useUnlockCoordinationScopeMutation: () => [mocks.unlockMutation, { isLoading: false }],
    useExportCoordinationOrdersMutation: () => [mocks.exportMutation, { isLoading: false }],
    useAdjustCoordinationOrderMutation: () => [mocks.adjustOrderMutation, { isLoading: false }],
    useUpdateForecastServingsMutation: () => [mocks.updateForecastMutation, { isLoading: false }],
  }
})

const testUser: User = {
  id: 'u1',
  username: 'dieuphoi_user',
  fullName: 'Điều phối viên',
  role: 'dieuphoi',
  roleCode: 'DIEUPHOI',
  roleName: 'Điều phối viên',
  isAdminFullAccess: false,
  permissions: ['coordination.read'],
}

const sampleOrder: OrderRow = {
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
  shift: 'Ca Sáng' as ShiftType,
  shiftName: 'MORNING',
  forecastQuantity: 100,
  actualQuantity: 100,
  unitPrice: 35_000,
  appliedRate: 1,
  specialNotes: '',
  dishes: [],
}

const buildQuerySnapshot = <T,>(overrides: Partial<QuerySnapshot<T>> = {}): QuerySnapshot<T> => ({
  data: undefined,
  currentData: undefined,
  error: undefined,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  ...overrides,
})

const renderWithStore = (ui: ReactNode, preloadedState: Record<string, unknown> = {}) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      coordination: coordinationReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(apiSlice.middleware),
    preloadedState: {
      auth: {
        user: testUser,
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
      },
      coordination: {
        loading: false,
        orders: [],
        currentShift: 'Ca Sáng' as ShiftType,
        currentServiceDate: '2026-08-03',
        currentDayOfWeek: 'MONDAY',
        weeklyMenu: {},
        lossRate: 5,
        isLocked: false,
        lockedShifts: {},
        auditLogs: [],
        error: null,
        lastUpdated: null,
        ...(preloadedState.coordination as object | undefined),
      },
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )
}

describe('CoordinationPage state presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lockMutation.mockReset()
    mocks.sendMutation.mockReset()
    mocks.signoffMutation.mockReset()
    mocks.unlockMutation.mockReset()
    mocks.exportMutation.mockReset()
    mocks.adjustOrderMutation.mockReset()
    mocks.updateForecastMutation.mockReset()
  })

  it('does not present an authoritative empty shift as successful zero variance', async () => {
    mocks.ordersQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: { success: true, data: [] },
        currentData: { success: true, data: [] },
      }),
    )
    mocks.plansQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: { success: true, data: [] },
        currentData: { success: true, data: [] },
      }),
    )

    renderWithStore(<CoordinationPage />)

    // Wait for empty state to mount
    expect(await screen.findByText('Chưa có đơn phục vụ phù hợp.')).toBeInTheDocument()

    // ContextStrip facts must be absent
    expect(screen.queryByText('Suất dự kiến')).not.toBeInTheDocument()
    expect(screen.queryByText('Suất điều phối')).not.toBeInTheDocument()
    expect(screen.queryByText('Chênh lệch')).not.toBeInTheDocument()
    expect(screen.queryByText('+0')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.ipc-context-badge.is-success')).toHaveLength(0)

    // Empty state should be rendered exactly once
    expect(screen.getAllByText('Chưa có đơn phục vụ phù hợp.')).toHaveLength(1)

    // Banner should be absent
    expect(screen.queryByText('Chưa có kế hoạch suất ăn')).not.toBeInTheDocument()

    // Table headers absent
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()

    // ActionToolbar mutation buttons absent
    expect(screen.queryByRole('button', { name: /chốt đơn/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /gửi kế hoạch/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hoàn tất ca/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mở khóa/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /xuất báo cáo/i })).not.toBeInTheDocument()
  })

  it('does not carry a completed banner into a newly selected date while its query is loading', async () => {
    mocks.ordersQuery.mockReturnValue(
      buildQuerySnapshot({
        isFetching: true,
        data: { success: true, data: [sampleOrder] },
      }),
    )
    mocks.plansQuery.mockReturnValue(
      buildQuerySnapshot({
        isFetching: true,
        data: {
          success: true,
          data: [{ quantityPlanId: 'old-plan', status: 'COMPLETED', lines: [] }],
        },
      }),
    )

    renderWithStore(<CoordinationPage />)

    expect(await screen.findByText('Chưa có đơn phục vụ phù hợp.')).toBeInTheDocument()
    expect(screen.queryByText('Ca này đã hoàn tất')).not.toBeInTheDocument()
  })

  it('mounts one visible semantic heading for the scoped work surface', async () => {
    mocks.ordersQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: { success: true, data: [] },
        currentData: { success: true, data: [] },
      }),
    )
    mocks.plansQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: { success: true, data: [] },
        currentData: { success: true, data: [] },
      }),
    )

    renderWithStore(<CoordinationPage />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Suất ăn theo ngày và ca' })).toBeVisible()
    expect(screen.getAllByRole('heading', { name: 'Suất ăn theo ngày và ca' })).toHaveLength(1)
  })

  it('keeps the canonical table and status owner without a duplicate aggregate summary', async () => {
    mocks.ordersQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: { success: true, data: [sampleOrder] },
        currentData: { success: true, data: [sampleOrder] },
      }),
    )
    mocks.plansQuery.mockReturnValue(
      buildQuerySnapshot({
        isSuccess: true,
        data: {
          success: true,
          data: [
            {
              id: 'plan-1',
              serviceDate: '2026-08-03',
              shiftName: 'MORNING',
              status: 'DRAFT',
              lines: [],
            },
          ],
        },
        currentData: {
          success: true,
          data: [
            {
              id: 'plan-1',
              serviceDate: '2026-08-03',
              shiftName: 'MORNING',
              status: 'DRAFT',
              lines: [],
            },
          ],
        },
      }),
    )

    renderWithStore(<CoordinationPage />, {
      coordination: {
        currentDayOfWeek: 'MONDAY',
        currentServiceDate: '2026-08-03',
        currentShift: 'Ca Sáng' as ShiftType,
        orders: [sampleOrder],
      },
    })

    // Work object visible
    expect(await screen.findByText('Công ty ANV')).toBeInTheDocument()

    // The table owns serving quantities and variance; do not repeat them in a page summary.
    expect(screen.queryByText('Suất điều phối')).not.toBeInTheDocument()
    expect(screen.getAllByText('Chênh lệch')).toHaveLength(1)

    // OrderStatusBanner visible
    expect(screen.getByText('Dữ liệu đang ở trạng thái nháp')).toBeInTheDocument()

    // Table mounted
    expect(screen.getByRole('columnheader', { name: 'Khách hàng' })).toBeInTheDocument()
  })

  describe('does not classify loading, forbidden, error, or fallback data as ready-empty', () => {
    it('preserves loading state without rendering ready-empty state', async () => {
      mocks.ordersQuery.mockReturnValue(
        buildQuerySnapshot({
          isLoading: true,
          isFetching: true,
        }),
      )
      mocks.plansQuery.mockReturnValue(
        buildQuerySnapshot({
          isLoading: true,
          isFetching: true,
        }),
      )

      renderWithStore(<CoordinationPage />)

      expect(screen.getByText('Đang tải danh sách suất ăn')).toBeInTheDocument()
      expect(screen.getByText('Chưa có đơn phục vụ phù hợp.').closest('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('preserves forbidden alert without rendering ready-empty state', async () => {
      mocks.ordersQuery.mockReturnValue(
        buildQuerySnapshot({
          isError: true,
          error: { status: 403 },
        }),
      )
      mocks.plansQuery.mockReturnValue(
        buildQuerySnapshot({
          isError: true,
          error: { status: 403 },
        }),
      )

      renderWithStore(<CoordinationPage />)

      expect(screen.getByText('Không có quyền xem danh sách suất ăn')).toBeInTheDocument()
      expect(screen.getByText('Chưa có đơn phục vụ phù hợp.').closest('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('preserves error alert without rendering ready-empty state', async () => {
      mocks.ordersQuery.mockReturnValue(
        buildQuerySnapshot({
          isError: true,
          error: { status: 500, message: 'Internal server error' },
        }),
      )
      mocks.plansQuery.mockReturnValue(
        buildQuerySnapshot({
          isError: true,
          error: { status: 500, message: 'Internal server error' },
        }),
      )

      renderWithStore(<CoordinationPage />)

      expect(screen.getByText('Không tải được danh sách suất ăn')).toBeInTheDocument()
      expect(screen.getByText('Chưa có đơn phục vụ phù hợp.').closest('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('preserves fallback rows and context when current query has error but cached data exists', async () => {
      mocks.ordersQuery.mockReturnValue(
        buildQuerySnapshot({
          isError: true,
          error: { status: 500 },
        }),
      )
      mocks.plansQuery.mockReturnValue(
        buildQuerySnapshot({
          isSuccess: true,
          data: { success: true, data: [] },
          currentData: { success: true, data: [] },
        }),
      )

      renderWithStore(<CoordinationPage />, {
        coordination: {
          currentDayOfWeek: 'MONDAY',
          currentServiceDate: '2026-08-03',
          currentShift: 'Ca Sáng' as ShiftType,
          orders: [sampleOrder],
          error: 'Kết nối máy chủ thất bại.',
        },
      })

      // Fallback row still present
      expect(await screen.findByText('Công ty ANV')).toBeInTheDocument()
      // Cached rows remain the quantity owner without mounting a separate aggregate summary.
      expect(screen.queryByText('Suất điều phối')).not.toBeInTheDocument()
      // Should not be classified as ready-empty
      expect(screen.queryByText('Chưa có đơn phục vụ phù hợp.')).not.toBeInTheDocument()
    })
  })
})
