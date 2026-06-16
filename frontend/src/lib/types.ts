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
  receivedMaterials: Ingredient[]
}

export interface SupplementalRequest {
  ingredientId: string
  ingredientName: string
  unit: string
  currentQty: number
  requestedQty: number
  reason?: string
  requestedAt?: string
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
