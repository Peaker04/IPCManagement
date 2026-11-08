import type { WeeklyMenuState } from '@/types/coordination'
import type { WeeklyScheduleEditorState } from './types'

export type ScheduleAction =
  | { type: 'open-editor'; menu: WeeklyMenuState }
  | { type: 'close-editor' }
  | { type: 'change-dish'; dayKey: string; slotType: string; dishId: string; slotKey?: string }
  | { type: 'change-serving'; key: string; value: string }
  | { type: 'clear-serving'; key: string }
  | { type: 'reset-quick-servings' }

export const initialWeeklyScheduleState: WeeklyScheduleEditorState = {
  isEditorOpen: false,
  draftMenu: {},
  draftDishes: {},
  quickServingInputs: {},
}

export function weeklyScheduleReducer(
  state: WeeklyScheduleEditorState,
  action: ScheduleAction,
): WeeklyScheduleEditorState {
  switch (action.type) {
    case 'open-editor':
      return { ...state, isEditorOpen: true, draftMenu: action.menu, draftDishes: {}, quickServingInputs: {} }
    case 'close-editor':
      return { ...state, isEditorOpen: false, draftDishes: {}, quickServingInputs: {} }
    case 'change-dish': {
      const slotKey = action.slotKey || `${action.dayKey}|${action.slotType}`
      const nextDraftDishes = { ...state.draftDishes, [slotKey]: action.dishId }
      const currentDay = state.draftMenu[action.dayKey]
      const currentSlot = currentDay?.[action.slotType as keyof WeeklyMenuState[string]]
      const nextDraftMenu = currentDay && currentSlot
        ? {
            ...state.draftMenu,
            [action.dayKey]: {
              ...currentDay,
              [action.slotType]: { ...currentSlot, dishId: action.dishId },
            },
          }
        : state.draftMenu
      return {
        ...state,
        draftDishes: nextDraftDishes,
        draftMenu: nextDraftMenu,
      }
    }
    case 'change-serving':
      return {
        ...state,
        quickServingInputs: { ...state.quickServingInputs, [action.key]: action.value },
      }
    case 'clear-serving': {
      const quickServingInputs = { ...state.quickServingInputs }
      delete quickServingInputs[action.key]
      return { ...state, quickServingInputs }
    }
    case 'reset-quick-servings':
      return { ...state, quickServingInputs: {} }
    default:
      return state
  }
}
