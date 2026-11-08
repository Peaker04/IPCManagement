import { createAction } from '@reduxjs/toolkit'

import type { WeeklyMenuState } from '@/types/coordination'

export type WeeklyMenuSlotType =
  | 'morningSavory'
  | 'morningVegetarian'
  | 'afternoonSavory'
  | 'afternoonVegetarian'

export const setWeeklyMenu = createAction<WeeklyMenuState>('coordination/setWeeklyMenu')

export const updateWeeklyMenuDish = createAction<{
  day: string
  slotType: WeeklyMenuSlotType
  dishId: string
}>('coordination/updateWeeklyMenuDish')
