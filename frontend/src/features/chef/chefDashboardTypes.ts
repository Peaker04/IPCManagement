import type { Ingredient } from '@/lib/types'

export type ChefMaterial = Ingredient & {
  issueId?: string
  issueCode?: string
  warehouseId?: string
  ingredientId?: string
  unitId?: string
  isReceivedByKitchen?: boolean
}

export const getChefMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data
    if (data && typeof data === 'object' && 'message' in data) return String(data.message)
  }
  return fallback
}
