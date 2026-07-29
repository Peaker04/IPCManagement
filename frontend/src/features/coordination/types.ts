export * from '@/types/coordination'

import type {
  OrderRow,
  ShiftType,
  WeeklyMenuState,
} from '@/types/coordination'

export type EditableOrderField = 'forecastQuantity' | 'specialNotes'

export type OrderUpdatePayload =
  | { id: string; field: 'forecastQuantity'; value: number }
  | { id: string; field: 'specialNotes'; value: string }

export interface SyncOrdersPayload {
  dayOfWeek: string
  shift: ShiftType
  orders: OrderRow[]
}

export interface MarkOrdersLockedPayload {
  dayOfWeek: string
  shifts: ShiftType[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  fieldAffected: string
  oldValue: string | number
  newValue: string | number
  reason: string
  orderId: string
  shiftType: ShiftType
}

export interface CoordinationState {
  loading: boolean
  orders: OrderRow[]
  currentShift: ShiftType
  currentServiceDate: string
  currentDayOfWeek: string
  weeklyMenu: WeeklyMenuState
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
