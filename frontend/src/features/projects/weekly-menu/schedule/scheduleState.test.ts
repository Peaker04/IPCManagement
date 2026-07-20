import { describe, expect, it } from 'vitest'
import { initialWeeklyScheduleState, weeklyScheduleReducer } from './scheduleState'
import type { WeeklyMenuState } from '../../../coordination/types'

const menu: WeeklyMenuState = {
  t2: {
    morningSavory: { dishId: 'dish-old', portions: 120 },
    morningVegetarian: { dishId: 'dish-veg', portions: 20 },
    afternoonSavory: { dishId: 'dish-afternoon', portions: 80 },
    afternoonVegetarian: { dishId: 'dish-afternoon-veg', portions: 10 },
  },
}

describe('weekly schedule state', () => {
  it('opens an isolated draft and changes a dish without mutating the source menu', () => {
    const opened = weeklyScheduleReducer(initialWeeklyScheduleState, { type: 'open-editor', menu })
    const changed = weeklyScheduleReducer(opened, {
      type: 'change-dish',
      dayKey: 't2',
      slotType: 'morningSavory',
      dishId: 'dish-new',
    })

    expect(changed.draftMenu.t2.morningSavory.dishId).toBe('dish-new')
    expect(menu.t2.morningSavory.dishId).toBe('dish-old')
  })

  it('owns quick-serving drafts and clears them after persistence', () => {
    const changed = weeklyScheduleReducer(initialWeeklyScheduleState, {
      type: 'change-serving',
      key: '2026-07-20|MORNING',
      value: '125',
    })
    expect(changed.quickServingInputs).toEqual({ '2026-07-20|MORNING': '125' })

    const cleared = weeklyScheduleReducer(changed, { type: 'clear-serving', key: '2026-07-20|MORNING' })
    expect(cleared.quickServingInputs).toEqual({})
  })
})
