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

export interface SyncOrdersPayload {
  dayOfWeek: string
  shift: ShiftType
  orders: OrderRow[]
}

export interface MarkOrdersLockedPayload {
  dayOfWeek: string
  shifts: ShiftType[]
}

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
  customComponents?: {
    main?: string
    sub1?: string
    sub2?: string
    rau?: string
    canh?: string
    fruit?: string
    dessert?: string
  }
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

export interface MenuScheduleQuery {
  serviceDate?: string
  dayOfWeek?: string
  weekStartDate?: string
  shiftName?: ApiShiftName
  customerId?: string
}

export interface MenuScheduleDishDto {
  dishId: string
  dishCode: string
  dishName: string
  dishGroup?: string
  dishType?: string
  displayOrder: number
}

export interface MenuScheduleDto {
  menuScheduleId: string
  customerId: string
  customerCode: string
  customerName: string
  menuId: string
  menuCode: string
  menuName: string
  serviceDate: string
  weekStartDate: string
  shiftName: ApiShiftName
  shift: ShiftType
  dayOfWeek: string
  menuPrice: number
  bomRatePercent: number
  status: string
  menuVersionId?: string | null
  menuVersionNo?: number | null
  menuVersionStatus?: string | null
  publishedBy?: string | null
  publishedAt?: string | null
  sourceImportBatch?: string | null
  dishes: MenuScheduleDishDto[]
}

export interface CustomerContractDto {
  contractId?: string | null
  customerId: string
  customerCode: string
  customerName: string
  note?: string | null
  isActive: boolean
  effectiveFrom?: string | null
  effectiveTo?: string | null
  contractStatus: string
  menuScheduleCount: number
  activeWeekDays: string[]
  shiftNames: ApiShiftName[]
  defaultMenuPrice?: number | null
  defaultBomRatePercent?: number | null
  latestServiceDate?: string | null
}

export interface UpdateCustomerContractRequest {
  customerName?: string
  note?: string | null
  isActive?: boolean
  effectiveFrom?: string
  effectiveTo?: string
  activeWeekDays?: string[]
  shiftNames?: ApiShiftName[]
  defaultMenuPrice?: number
  defaultBomRatePercent?: number
}

export interface CreateCustomerContractRequest {
  customerCode: string
  customerName: string
  note?: string | null
  isActive?: boolean
  effectiveFrom?: string
  effectiveTo?: string
  activeWeekDays?: string[]
  shiftNames?: ApiShiftName[]
  defaultMenuPrice?: number
  defaultBomRatePercent?: number
}

export interface UpdateMenuScheduleRulesRequest {
  menuPrice?: number
  bomRatePercent?: number
  status?: string
  reason?: string
}

export interface UpdateMenuScheduleVersionRequest {
  status: string
  reason?: string
}

export interface RollbackMenuVersionRequest {
  customerId: string
  weekStartDate: string
  targetVersionNo?: number
  targetMenuVersionId?: string
  reason: string
}

export interface MenuVersionRollbackResult {
  customerId: string
  weekStartDate: string
  activeMenuVersionId: string
  activeVersionNo: number
  rolledBackFromMenuVersionId: string
  rolledBackFromVersionNo: number
  cancelledDemandCount: number
  cancelledPurchaseCount: number
  reason: string
}

export interface MealQuantityPlanQuery {
  customerId?: string
  serviceDate?: string
  dayOfWeek?: string
  weekStartDate?: string
  shiftName?: ApiShiftName
  status?: string
}

export interface MealQuantityPlanLineDto {
  quantityPlanLineId: string
  menuScheduleId: string
  customerId: string
  customerCode: string
  customerName: string
  menuId: string
  menuCode: string
  menuName: string
  shiftName: ApiShiftName
  shift: ShiftType
  forecastServings: number
  confirmedServings: number
  adjustedServings: number
  finalServings: number
}

export interface MealQuantityPlanDto {
  quantityPlanId: string
  planCode: string
  serviceDate: string
  dayOfWeek: string
  status: 'DRAFT' | 'FORECASTED' | 'CONFIRMED' | 'ADJUSTED' | 'COMPLETED' | 'ARCHIVED' | string
  forecastReceivedAt?: string
  confirmedAt?: string
  lines: MealQuantityPlanLineDto[]
}

export interface SignoffOrderRequest {
  note?: string
}

export interface SignoffOrderResult {
  success: boolean
  quantityPlanId: string
  serviceDate: string
  oldStatus: string
  newStatus: string
  signedOffAt: string
}

export interface ProductionPlanLineDto {
  planLineId: string
  dishId: string
  dishName?: string
  shiftName?: string
  totalServings: number
}

export interface ProductionPlanDto {
  planId: string
  planCode: string
  planDate: string
  customerId?: string
  customerCode?: string
  customerName?: string
  weekStartDate?: string
  menuVersionId?: string
  menuVersionNo?: number
  menuVersionStatus?: string
  status: string
  createdBy?: string
  createdByName?: string
  createdAt: string
  lines: ProductionPlanLineDto[]
}
