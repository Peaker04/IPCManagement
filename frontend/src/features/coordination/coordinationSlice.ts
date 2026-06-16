import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CoordinationState, OrderRow, AuditLogEntry, ShiftType, WeeklyMenuState, OrderUpdatePayload } from './types'
import { toDisplayShift } from './types'
import { coordinationApi } from './coordinationApi'
import { getTodayDayCode } from '@/lib/dateUtils'

const DAYS = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn']
const SHIFTS: ShiftType[] = ['Ca Sáng', 'Ca Chiều']

const DEFAULT_DISHES_BY_DAY_SHIFT: Record<string, Record<ShiftType, string>> = {
  t2: { 'Ca Sáng': 'm1', 'Ca Chiều': 'a1' },
  t3: { 'Ca Sáng': 'm2', 'Ca Chiều': 'a2' },
  t4: { 'Ca Sáng': 'm3', 'Ca Chiều': 'a3' },
  t5: { 'Ca Sáng': 'm1', 'Ca Chiều': 'a1' },
  t6: { 'Ca Sáng': 'm2', 'Ca Chiều': 'a2' },
  t7: { 'Ca Sáng': 'm3', 'Ca Chiều': 'a3' },
  cn: { 'Ca Sáng': 'm1', 'Ca Chiều': 'a1' },
}

const CUSTOMERS = [
  { id: '1', customerId: 'CUST_001', customerCode: 'DAV', customerName: 'DAV Việt Nam', mealType: 'Suất 34K', unitPrice: 34000, appliedRate: 100, forecastQtyMorning: 300, forecastQtyAfternoon: 320 },
  { id: '2', customerId: 'CUST_002', customerCode: 'VCV', customerName: 'VCV Corporation', mealType: 'Suất 34K', unitPrice: 34000, appliedRate: 100, forecastQtyMorning: 150, forecastQtyAfternoon: 160 },
  { id: '3', customerId: 'CUST_003', customerCode: 'AVN', customerName: 'AVN Industries', mealType: 'Suất 29K', unitPrice: 29000, appliedRate: 85, forecastQtyMorning: 240, forecastQtyAfternoon: 250 },
  { id: '4', customerId: 'CUST_004', customerCode: 'Wendler', customerName: 'Wendler Group', mealType: 'Suất Tăng Ca', unitPrice: 42000, appliedRate: 100, forecastQtyMorning: 180, forecastQtyAfternoon: 190 },
  { id: '5', customerId: 'CUST_005', customerCode: 'Yejin', customerName: 'Yejin Solutions', mealType: 'Suất 34K', unitPrice: 34000, appliedRate: 100, forecastQtyMorning: 120, forecastQtyAfternoon: 100 },
]

const generateMockOrders = (): OrderRow[] => {
  const list: OrderRow[] = []
  DAYS.forEach((day) => {
    SHIFTS.forEach((shift) => {
      CUSTOMERS.forEach((cust) => {
        const defaultDish = DEFAULT_DISHES_BY_DAY_SHIFT[day][shift]
        const forecastQty = shift === 'Ca Sáng' ? cust.forecastQtyMorning : cust.forecastQtyAfternoon
        list.push({
          id: `${day}-${shift === 'Ca Sáng' ? 'morning' : 'afternoon'}-${cust.customerId}`,
          customerId: cust.customerId,
          customerCode: cust.customerCode,
          customerName: cust.customerName,
          mealType: cust.mealType,
          forecastQuantity: forecastQty,
          actualQuantity: 0,
          unitPrice: cust.unitPrice,
          appliedRate: cust.appliedRate,
          specialNotes: '',
          dayOfWeek: day,
          shift: shift,
          dishId: defaultDish,
        })
      })
    })
  })
  return list
}



const defaultWeeklyMenu: WeeklyMenuState = {
  t2: {
    morningSavory: { dishId: 'm1', portions: 840 },
    morningVegetarian: { dishId: 'v1', portions: 150 },
    afternoonSavory: { dishId: 'a1', portions: 870 },
    afternoonVegetarian: { dishId: 'v4', portions: 150 },
  },
  t3: {
    morningSavory: { dishId: 'm2', portions: 970 },
    morningVegetarian: { dishId: 'v2', portions: 170 },
    afternoonSavory: { dishId: 'a2', portions: 990 },
    afternoonVegetarian: { dishId: 'v5', portions: 170 },
  },
  t4: {
    morningSavory: { dishId: 'm3', portions: 840 },
    morningVegetarian: { dishId: 'v3', portions: 150 },
    afternoonSavory: { dishId: 'a3', portions: 870 },
    afternoonVegetarian: { dishId: 'v6', portions: 150 },
  },
  t5: {
    morningSavory: { dishId: 'm1', portions: 840 },
    morningVegetarian: { dishId: 'v1', portions: 150 },
    afternoonSavory: { dishId: 'a1', portions: 870 },
    afternoonVegetarian: { dishId: 'v4', portions: 150 },
  },
  t6: {
    morningSavory: { dishId: 'm2', portions: 970 },
    morningVegetarian: { dishId: 'v2', portions: 170 },
    afternoonSavory: { dishId: 'a2', portions: 990 },
    afternoonVegetarian: { dishId: 'v5', portions: 170 },
  },
  t7: {
    morningSavory: { dishId: 'm3', portions: 840 },
    morningVegetarian: { dishId: 'v3', portions: 150 },
    afternoonSavory: { dishId: 'a3', portions: 870 },
    afternoonVegetarian: { dishId: 'v6', portions: 150 },
  },
  cn: {
    morningSavory: { dishId: 'm1', portions: 840 },
    morningVegetarian: { dishId: 'v1', portions: 150 },
    afternoonSavory: { dishId: 'a1', portions: 870 },
    afternoonVegetarian: { dishId: 'v4', portions: 150 },
  },
}

const initialDay = getTodayDayCode()

const initialState: CoordinationState = {
  loading: false,
  orders: generateMockOrders(),
  currentShift: 'Ca Sáng',
  currentDayOfWeek: initialDay,
  weeklyMenu: defaultWeeklyMenu,
  menuPrice: 35000,
  lossRate: 5,
  isLocked: false,
  lockedShifts: {},
  auditLogs: [],
  error: null,
  lastUpdated: null,
}

// Async Thunks - These will connect to .NET 9 Web API endpoints
export const fetchActiveOrders = createAsyncThunk(
  'coordination/fetchActiveOrders',
  async (shift: ShiftType, { dispatch, getState, rejectWithValue }) => {
    const { coordination } = getState() as { coordination: CoordinationState }
    const response = await dispatch(
      coordinationApi.endpoints.getCoordinationOrders.initiate(
        { dayOfWeek: coordination.currentDayOfWeek, shift },
        { forceRefetch: true, subscribe: false },
      ),
    ).unwrap()

    if (!response.success || !response.data) {
      return rejectWithValue(response.message || 'Không tải được danh sách đơn.')
    }

    return response.data
  }
)

export const lockOrderPlan = createAsyncThunk(
  'coordination/lockOrderPlan',
  async (
    payload: { dayOfWeek: string; shift: ShiftType; orders: OrderRow[]; timestamp: string },
    { dispatch, rejectWithValue },
  ) => {
    const response = await dispatch(
      coordinationApi.endpoints.lockCoordinationOrders.initiate({
        dayOfWeek: payload.dayOfWeek,
        shift: payload.shift,
        scope: 'FULLDAY',
        lines: payload.orders.map((order) => ({
          quantityPlanLineId: order.quantityPlanLineId ?? order.id,
          actualQuantity: order.actualQuantity || order.forecastQuantity,
        })),
      }),
    ).unwrap()

    if (!response.success || !response.data) {
      return rejectWithValue(response.message || 'Không chốt được đơn.')
    }

    return response.data
  }
)

export const adjustOrderAfterLock = createAsyncThunk(
  'coordination/adjustOrderAfterLock',
  async (payload: {
    orderId: string
    field: string
    oldValue: string | number
    newValue: string | number
    reason: string
    actor: string
    shift: ShiftType
    dayOfWeek: string
  }, { dispatch, rejectWithValue }) => {
    if (typeof payload.newValue !== 'number') {
      return rejectWithValue('Giá trị điều chỉnh phải là số.')
    }

    const response = await dispatch(
      coordinationApi.endpoints.adjustCoordinationOrder.initiate({
        orderId: payload.orderId,
        field: payload.field,
        newValue: payload.newValue,
        reason: payload.reason,
      }),
    ).unwrap()

    if (!response.success || !response.data) {
      return rejectWithValue(response.message || 'Không điều chỉnh được đơn.')
    }

    return response.data
  }
)

export const exportOrderReport = createAsyncThunk(
  'coordination/exportOrderReport',
  async (
    payload: { shift: ShiftType; dayOfWeek: string; orders: OrderRow[]; format: 'excel' | 'pdf' },
    { dispatch, rejectWithValue },
  ) => {
    const response = await dispatch(
      coordinationApi.endpoints.exportCoordinationOrders.initiate({
        dayOfWeek: payload.dayOfWeek,
        shift: payload.shift,
        format: payload.format,
      }),
    ).unwrap()

    if (!response.success || !response.data) {
      return rejectWithValue(response.message || 'Không xuất được báo cáo.')
    }

    return response.data
  }
)

const coordinationSlice = createSlice({
  name: 'coordination',
  initialState,
  reducers: {
    updateOrder: (
      state,
      action: PayloadAction<OrderUpdatePayload>,
    ) => {
      const order = state.orders.find((o) => o.id === action.payload.id)
      const lockKey = `${state.currentDayOfWeek}-${state.currentShift}`
      const isCurrentlyLocked = !!state.lockedShifts[lockKey]
      if (order && !isCurrentlyLocked) {
        if (action.payload.field === 'forecastQuantity') {
          order.forecastQuantity = action.payload.value
        } else {
          order.specialNotes = action.payload.value
        }
      }
    },
    setCurrentShift: (state, action: PayloadAction<ShiftType>) => {
      state.currentShift = action.payload
      const lockKey = `${state.currentDayOfWeek}-${action.payload}`
      state.isLocked = !!state.lockedShifts[lockKey]
    },
    setCurrentDayOfWeek: (state, action: PayloadAction<string>) => {
      state.currentDayOfWeek = action.payload
      const lockKey = `${action.payload}-${state.currentShift}`
      state.isLocked = !!state.lockedShifts[lockKey]
    },
    updateOrderDish: (
      state,
      action: PayloadAction<{ id: string; dishId: string }>,
    ) => {
      const order = state.orders.find((o) => o.id === action.payload.id)
      const lockKey = `${state.currentDayOfWeek}-${state.currentShift}`
      const isCurrentlyLocked = !!state.lockedShifts[lockKey]
      if (order && !isCurrentlyLocked) {
        order.dishId = action.payload.dishId
      }
    },
    updateWeeklyMenuDish: (
      state,
      action: PayloadAction<{ day: string; slotType: 'morningSavory' | 'morningVegetarian' | 'afternoonSavory' | 'afternoonVegetarian'; dishId: string }>,
    ) => {
      const { day, slotType, dishId } = action.payload
      if (state.weeklyMenu[day]) {
        state.weeklyMenu[day][slotType].dishId = dishId

        // Also update all unlocked customer orders for that day & shift to match this new default dish if it is savory
        if (slotType === 'morningSavory' || slotType === 'afternoonSavory') {
          const targetShift = slotType === 'morningSavory' ? 'Ca Sáng' : 'Ca Chiều'
          const lockKey = `${day}-${targetShift}`
          const isCurrentlyLocked = !!state.lockedShifts[lockKey]
          if (!isCurrentlyLocked) {
            state.orders.forEach((order) => {
              if (order.dayOfWeek === day && order.shift === targetShift) {
                order.dishId = dishId
              }
            })
          }
        }
      }
    },
    setMenuPrice: (state, action: PayloadAction<number>) => {
      state.menuPrice = action.payload
    },
    setLossRate: (state, action: PayloadAction<number>) => {
      state.lossRate = action.payload
    },
    addAuditLog: (state, action: PayloadAction<AuditLogEntry>) => {
      state.auditLogs.push(action.payload)
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch active orders
      .addCase(fetchActiveOrders.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchActiveOrders.fulfilled, (state, action) => {
        state.loading = false
        const incomingOrders = action.payload
        if (incomingOrders.length > 0) {
          const incomingIds = new Set(incomingOrders.map((order) => order.id))
          state.orders = state.orders
            .filter((order) => !incomingIds.has(order.id))
            .concat(incomingOrders)
        }
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchActiveOrders.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch orders'
      })

      // Lock Order Plan
      .addCase(lockOrderPlan.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(lockOrderPlan.fulfilled, (state, action) => {
        state.loading = false
        const { dayOfWeek, shift } = action.meta.arg
        const lockedShifts = action.payload.lockedShiftNames?.length
          ? action.payload.lockedShiftNames.map(toDisplayShift)
          : [shift]

        lockedShifts.forEach((lockedShift) => {
          state.lockedShifts[`${dayOfWeek}-${lockedShift}`] = true
        })

        state.isLocked = true

        // Copy forecastQuantity to actualQuantity for every shift locked by the backend.
        state.orders = state.orders.map((order) => {
          if (order.dayOfWeek === dayOfWeek && lockedShifts.includes(order.shift)) {
            return {
              ...order,
              actualQuantity: order.forecastQuantity,
            }
          }
          return order
        })
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(lockOrderPlan.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to lock orders'
      })

      // Adjust Order After Lock
      .addCase(adjustOrderAfterLock.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(adjustOrderAfterLock.fulfilled, (state, action) => {
        state.loading = false
        const { orderId, field, newValue } = action.meta.arg
        const order = state.orders.find((o) => o.id === orderId)
        if (order) {
          if (field === 'actualQuantity' || field === 'finalServings') {
            order.actualQuantity = Number(newValue)
          }
        }
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(adjustOrderAfterLock.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to adjust order'
      })

      // Export Order Report
      .addCase(exportOrderReport.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(exportOrderReport.fulfilled, (state) => {
        state.loading = false
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(exportOrderReport.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to export report'
      })
  },
})

export const {
  updateOrder,
  setCurrentShift,
  setCurrentDayOfWeek,
  updateOrderDish,
  updateWeeklyMenuDish,
  setMenuPrice,
  setLossRate,
  addAuditLog,
  clearError,
} = coordinationSlice.actions

export default coordinationSlice.reducer

