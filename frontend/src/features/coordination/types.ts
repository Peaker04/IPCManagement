export type { ShiftType } from '@/lib/types'
import type { ShiftType } from '@/lib/types'
import type { components, paths } from '@/shared/api/contracts/schema'

type LowerCamelQuery<Query> = {
  [Key in keyof Query as Uncapitalize<Key & string>]: Query[Key]
}

export type ApiShiftName = 'MORNING' | 'AFTERNOON'
export type EditableOrderField = 'forecastQuantity' | 'specialNotes'

export const toApiShiftName = (shift: ShiftType): ApiShiftName =>
  shift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'

/**
 * Trả về `undefined` cho mã ca không nằm trong hai ca đang hỗ trợ. Nhánh mặc định "Ca Chiều"
 * trước đây khiến mọi mã ca lạ (ví dụ ca 3 của khách mới) bị dồn im lặng vào ca chiều.
 */
export const toDisplayShift = (shiftName: string): ShiftType | undefined => {
  const normalized = shiftName.trim().toUpperCase()
  if (normalized === 'MORNING') return 'Ca Sáng'
  if (normalized === 'AFTERNOON') return 'Ca Chiều'
  return undefined
}

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
  dishSlot?: string | null
  dishGroup?: string | null
  dishType?: string | null
  displayOrder?: number
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
  shift: string // Giữ nguyên nhãn server nếu xuất hiện ca chưa được FE hỗ trợ.
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
    main?: string | null
    sub1?: string | null
    sub2?: string | null
    rau?: string | null
    canh?: string | null
    fruit?: string | null
    dessert?: string | null
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

export type MenuScheduleQuery = LowerCamelQuery<
  NonNullable<paths['/api/coordination/menu-schedules']['get']['parameters']['query']>
>
export type MenuScheduleDishDto = components['schemas']['MenuScheduleDishDto']
export type MenuScheduleDto = components['schemas']['MenuScheduleDto']
export type CustomerContractDto = components['schemas']['CustomerContractDto']
export type UpdateCustomerContractRequest = components['schemas']['UpdateCustomerContractRequest']
export type CreateCustomerContractRequest = components['schemas']['CreateCustomerContractRequest']
export type UpdateMenuScheduleRulesRequest = components['schemas']['UpdateMenuScheduleRulesRequest']
export type UpdateMenuScheduleVersionRequest = components['schemas']['UpdateMenuScheduleVersionRequest']
export type RollbackMenuVersionRequest = components['schemas']['RollbackMenuVersionRequest']
export type MenuVersionRollbackResult = components['schemas']['MenuVersionRollbackResultDto']
export type MealQuantityPlanQuery = LowerCamelQuery<
  NonNullable<paths['/api/coordination/meal-quantity-plans']['get']['parameters']['query']>
>
export type MealQuantityPlanLineDto = components['schemas']['MealQuantityPlanLineDto']
export type MealQuantityPlanDto = components['schemas']['MealQuantityPlanDto']
export type SignoffOrderRequest = components['schemas']['SignoffOrderRequest']
export type SignoffOrderResult = components['schemas']['SignoffOrderResultDto']

export type CoordinationScopeActionRequest = Pick<
  components['schemas']['CoordinationScopeActionRequest'],
  'note'
> & { dayOfWeek: string; shift: ShiftType }

export type CoordinationScopeActionResult = components['schemas']['CoordinationScopeActionResultDto']
export type ProductionPlanLineDto = components['schemas']['ProductionPlanLineDto']
export type ProductionPlanDto = components['schemas']['ProductionPlanDto']
