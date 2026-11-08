/**
 * IPC Meal System - Head Chef Production & Inventory Management
 * TypeScript Type Definitions
 */

export type ShiftType = 'Ca Sáng' | 'Ca Chiều'

export interface Chef {
  name: string
  shortName: string
}

export interface KitchenAssignment {
  kitchenName: string
  kitchenCode: string
  responsibleChefs: Chef[]
}

export interface Ingredient {
  id: string
  name: string
  unit: string
  quantity: number
  status: 'Chờ giao' | 'Đã nhận'
  signed: boolean
  sourceCustomerName?: string
  sourceShiftName?: string
  sourcePriceTierAmount?: number
}

export interface DishIngredient {
  ingredientId: string
  ingredientName: string
  unit: string
  grossQty: number
}

export interface Dish {
  id: string
  name: string
  code?: string
  ingredients: DishIngredient[]
}

export interface ProductionPlan {
  date: string
  shift: ShiftType
  kitchenAssignment: KitchenAssignment
  totalMeals: number
  activeDishes: Dish[]
  /** Chỉ các dòng có phiếu xuất kho thật. Không được trộn định lượng kế hoạch vào đây. */
  receivedMaterials: Ingredient[]
  /** Định lượng theo BOM của ca, dùng để đối chiếu — không phải số bếp đã nhận. */
  plannedMaterials: Ingredient[]
}

export interface ExcessMaterial {
  ingredientId: string
  ingredientName: string
  unit: string
  returnedQty: number
  condition?: 'intact' | 'partially_used' | 'damaged'
  notes?: string
  returnedAt?: string
}

export interface SupplementalRequest {
  ingredientId: string
  ingredientName: string
  unit: string
  requestedQty: number
  reason?: string
}
