import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CoordinationState, OrderRow, AuditLogEntry, ShiftType, WeeklyMenuState, OrderUpdatePayload, SyncOrdersPayload, MarkOrdersLockedPayload } from './types'
import { toDisplayShift } from './types'
import { coordinationApi } from './coordinationApi'
import { getTodayDayCode } from '@/lib/dateUtils'

const defaultWeeklyMenu: WeeklyMenuState = {}

const initialDay = getTodayDayCode()

const initialState: CoordinationState = {
  loading: false,
  orders: [],
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

interface WeeklyMenuShuffleDish {
  id: string
  menuSlots: string[]
}

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
          order.actualQuantity = action.payload.value
        } else {
          order.specialNotes = action.payload.value
        }
      }
    },
    setOrderActualQuantity: (
      state,
      action: PayloadAction<{ id: string; value: number }>,
    ) => {
      const order = state.orders.find((item) => item.id === action.payload.id)
      if (order) {
        order.actualQuantity = action.payload.value
        state.lastUpdated = new Date().toISOString()
      }
    },
    syncOrdersForShift: (
      state,
      action: PayloadAction<SyncOrdersPayload>,
    ) => {
      const { dayOfWeek, shift, orders } = action.payload
      state.orders = state.orders
        .filter((order) => !(order.dayOfWeek === dayOfWeek && order.shift === shift))
        .concat(orders)
      state.lastUpdated = new Date().toISOString()
      state.error = null
    },
    markOrdersLocked: (
      state,
      action: PayloadAction<MarkOrdersLockedPayload>,
    ) => {
      const { dayOfWeek, shifts } = action.payload
      shifts.forEach((shift) => {
        state.lockedShifts[`${dayOfWeek}-${shift}`] = true
      })
      state.isLocked = shifts.includes(state.currentShift)
      state.orders = state.orders.map((order) => {
        if (order.dayOfWeek === dayOfWeek && shifts.includes(order.shift)) {
          return {
            ...order,
            actualQuantity: order.forecastQuantity,
          }
        }
        return order
      })
      state.lastUpdated = new Date().toISOString()
      state.error = null
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
    setWeeklyMenu: (state, action: PayloadAction<WeeklyMenuState>) => {
      state.weeklyMenu = action.payload
    },
    shuffleWeeklyMenu: (state, action: PayloadAction<{ dishes: WeeklyMenuShuffleDish[] }>) => {
      const dishes = action.payload.dishes
      if (!dishes || dishes.length === 0) return
      
      const morningSavory = dishes.filter(d => d.menuSlots.includes('MENU MẶN CA SÁNG'))
      const morningVeg = dishes.filter(d => d.menuSlots.includes('MENU CHAY CA SÁNG'))
      const afternoonSavory = dishes.filter(d => d.menuSlots.includes('MENU MẶN CA CHIỀU'))
      const afternoonVeg = dishes.filter(d => d.menuSlots.includes('MENU CHAY CA CHIỀU'))

      Object.keys(state.weeklyMenu).forEach((day, index) => {
        if (state.weeklyMenu[day]) {
          if (morningSavory.length > 0) state.weeklyMenu[day].morningSavory.dishId = morningSavory[(index * 2) % morningSavory.length].id
          if (morningVeg.length > 0) state.weeklyMenu[day].morningVegetarian.dishId = morningVeg[(index * 2) % morningVeg.length].id
          if (afternoonSavory.length > 0) state.weeklyMenu[day].afternoonSavory.dishId = afternoonSavory[(index * 2) % afternoonSavory.length].id
          if (afternoonVeg.length > 0) state.weeklyMenu[day].afternoonVegetarian.dishId = afternoonVeg[(index * 2) % afternoonVeg.length].id
        }
      })
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
        const dayOfWeek = state.currentDayOfWeek
        const shift = action.meta.arg
        state.orders = state.orders
          .filter((order) => !(order.dayOfWeek === dayOfWeek && order.shift === shift))
          .concat(incomingOrders)
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchActiveOrders.rejected, (state, action) => {
        state.loading = false
        state.error = (action.payload as string | undefined) || action.error.message || 'Không tải được danh sách đơn.'
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
  setOrderActualQuantity,
  syncOrdersForShift,
  markOrdersLocked,
  setCurrentShift,
  setCurrentDayOfWeek,
  updateOrderDish,
  updateWeeklyMenuDish,
  setMenuPrice,
  setLossRate,
  setWeeklyMenu,
  shuffleWeeklyMenu,
  addAuditLog,
  clearError,
} = coordinationSlice.actions

export default coordinationSlice.reducer

