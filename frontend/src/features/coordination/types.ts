export type { ShiftType } from '@/lib/types'
import type { ShiftType } from '@/lib/types'
export type ApiShiftName = 'MORNING' | 'AFTERNOON'
export type EditableOrderField = 'forecastQuantity' | 'specialNotes'

export const toApiShiftName = (shift: ShiftType): ApiShiftName =>
  shift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'

export const toDisplayShift = (shiftName: string): ShiftType =>
  shiftName.toUpperCase() === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều'

export type OrderUpdatePayload =
  | { id: string; field: 'forecastQuantity'; value: number }
  | { id: string; field: 'specialNotes'; value: string }

export interface MenuDish {
  dishId: string
  dishCode: string
  dishName: string
}

export interface OrderRow {
  id: string
  quantityPlanLineId?: string
  quantityPlanId?: string
  menuScheduleId?: string
  customerId: string // Internal customer ID
  customerCode: string // Mã KH
  customerName: string // Tên Khách Hàng
  mealType: string // Loại Suất (e.g., "Suất 34K", "Suất Tăng Ca")
  forecastQuantity: number // Suất Dự Kiến (Editable)
  actualQuantity: number // Suất Chốt Thực Tế (Locked after chốt đơn)
  unitPrice: number // Đơn Giá
  appliedRate: number // % Định Mức Áp Dụng
  specialNotes: string // Ghi Chú Đặc Biệt
  serviceDate?: string
  dayOfWeek: string // 't2', 't3', 't4', 't5', 't6', 't7', 'cn'
  shiftName?: ApiShiftName
  shift: ShiftType // 'Ca Sáng' | 'Ca Chiều'
  menuId?: string
  menuCode?: string
  menuName?: string
  dishes?: MenuDish[]
  // Temporary compatibility for Weekly Menu/Chef static workflows.
  // This must be a real dish id, never a menu id.
  dishId: string
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string // Manager name
  fieldAffected: string
  oldValue: string | number
  newValue: string | number
  reason: string
  orderId: string
  shiftType: ShiftType
}

export interface MenuSlot {
  dishId: string
  portions: number
}

export interface DayMenuState {
  morningSavory: MenuSlot
  morningVegetarian: MenuSlot
  afternoonSavory: MenuSlot
  afternoonVegetarian: MenuSlot
}

export interface WeeklyMenuState {
  [day: string]: DayMenuState
}

export interface CoordinationState {
  loading: boolean
  orders: OrderRow[]
  currentShift: ShiftType
  currentDayOfWeek: string // 't2', 't3', etc.
  weeklyMenu: WeeklyMenuState
  menuPrice: number
  lossRate: number
  isLocked: boolean
  lockedShifts: Record<string, boolean>
  auditLogs: AuditLogEntry[]
  error: string | null
  lastUpdated: string | null
}

export interface DashboardState {
  shift: ShiftType
  isLocked: boolean
  orders: OrderRow[]
  editingCell: string | null
}

