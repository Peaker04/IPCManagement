import { configureStore } from '@reduxjs/toolkit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coordinationApi } from './coordinationApi'

const createStore = () => configureStore({
  reducer: {
    [coordinationApi.reducerPath]: coordinationApi.reducer,
    auth: (state = { token: null }) => state,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(coordinationApi.middleware),
})

const response = (data: unknown) => new Response(JSON.stringify({ success: true, data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('coordination cache invalidation fan-out', () => {
  beforeEach(() => {
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('quick servings refetches meal plans without refetching contracts, menu, or schedules', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      requests.push(`${request.method} ${path}`)
      if (path === '/api/coordination/meal-quantity-plans/quick-servings') {
        return response({ mealQuantityPlanId: 'plan-1' })
      }
      return response(path === '/api/coordination/weekly-menu' ? null : [])
    }))
    const store = createStore()

    await Promise.all([
      store.dispatch(coordinationApi.endpoints.getCustomerContracts.initiate()),
      store.dispatch(coordinationApi.endpoints.getCommittedWeeklyMenu.initiate({ customerId: 'customer-1', weekStartDate: '2026-09-14' })),
      store.dispatch(coordinationApi.endpoints.getMenuSchedules.initiate({ customerId: 'customer-1', weekStartDate: '2026-09-14' })),
      store.dispatch(coordinationApi.endpoints.getMealQuantityPlans.initiate({ customerId: 'customer-1', weekStartDate: '2026-09-14' })),
      store.dispatch(coordinationApi.endpoints.getCoordinationOrders.initiate({ dayOfWeek: 't2', serviceDate: '2026-09-14', shift: 'Ca Sáng' })),
    ])
    requests.length = 0

    await store.dispatch(coordinationApi.endpoints.upsertQuickServings.initiate({
      customerId: 'customer-1',
      serviceDate: '2026-09-14',
      shiftName: 'MORNING',
      servings: 120,
      complete: false,
    }))

    await vi.waitFor(() => {
      expect(requests).toContain('GET /api/coordination/meal-quantity-plans')
      expect(requests).toContain('GET /api/coordination/orders')
    })
    expect(requests).not.toContain('GET /api/coordination/customer-contracts')
    expect(requests).not.toContain('GET /api/coordination/weekly-menu')
    expect(requests).not.toContain('GET /api/coordination/menu-schedules')
  })

  it('forecast updates refetch orders and meal plans without unrelated weekly-menu reads', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      return response([])
    }))
    const store = createStore()

    await Promise.all([
      store.dispatch(coordinationApi.endpoints.getCoordinationOrders.initiate({ dayOfWeek: 't2', serviceDate: '2026-09-14', shift: 'Ca Sáng' })),
      store.dispatch(coordinationApi.endpoints.getMealQuantityPlans.initiate({ customerId: 'customer-1', weekStartDate: '2026-09-14' })),
      store.dispatch(coordinationApi.endpoints.getCommittedWeeklyMenu.initiate({ customerId: 'customer-1', weekStartDate: '2026-09-14' })),
    ])
    requests.length = 0

    await store.dispatch(coordinationApi.endpoints.updateForecastServings.initiate({ orderId: 'line-1', servingsQuantity: 125, reason: 'Điều chỉnh dự kiến' }))

    await vi.waitFor(() => {
      expect(requests).toContain('GET /api/coordination/orders')
      expect(requests).toContain('GET /api/coordination/meal-quantity-plans')
    })
    expect(requests).not.toContain('GET /api/coordination/weekly-menu')
  })
})
