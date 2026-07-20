import type { WeeklyMenuState } from '../../../coordination/types'
import type { WeeklyScheduleEditorState } from './types'

type ScheduleAction =
  | { type: 'open-editor'; menu: WeeklyMenuState }
  | { type: 'close-editor' }
  | { type: 'change-dish'; dayKey: string; slotType: keyof WeeklyMenuState[string]; dishId: string }
  | { type: 'change-serving'; key: string; value: string }
  | { type: 'clear-serving'; key: string }
  | { type: 'reset-scope' }

export const initialWeeklyScheduleState: WeeklyScheduleEditorState = {
  isEditorOpen: false,
  draftMenu: {},
  quickServingInputs: {},
}

export function weeklyScheduleReducer(
  state: WeeklyScheduleEditorState,
  action: ScheduleAction,
): WeeklyScheduleEditorState {
  switch (action.type) {
    case 'open-editor':
      return { ...state, isEditorOpen: true, draftMenu: action.menu }
    case 'close-editor':
      return { ...state, isEditorOpen: false }
    case 'change-dish': {
      const currentDay = state.draftMenu[action.dayKey]
      const currentSlot = currentDay?.[action.slotType]
      if (!currentDay || !currentSlot) return state
      return {
        ...state,
        draftMenu: {
          ...state.draftMenu,
          [action.dayKey]: {
            ...currentDay,
            [action.slotType]: { ...currentSlot, dishId: action.dishId },
          },
        },
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
    case 'reset-scope':
      return initialWeeklyScheduleState
    default:
      return state
  }
}
