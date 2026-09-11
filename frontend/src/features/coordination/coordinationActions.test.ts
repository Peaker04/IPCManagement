import { describe, expect, it } from 'vitest'

import { setWeeklyMenu, updateWeeklyMenuDish } from '@/lib/coordinationActions'
import coordinationReducer, { syncOrdersForShift } from './coordinationSlice'

describe('coordination lower action contracts', () => {
  it('preserves public action types and reducer behavior', () => {
    expect(setWeeklyMenu.type).toBe('coordination/setWeeklyMenu')
    expect(updateWeeklyMenuDish.type).toBe('coordination/updateWeeklyMenuDish')

    const menu = {
      t2: {
        morningSavory: { dishId: 'dish-old', portions: 10 },
        morningVegetarian: { dishId: 'veg-morning', portions: 2 },
        afternoonSavory: { dishId: 'dish-afternoon', portions: 8 },
        afternoonVegetarian: { dishId: 'veg-afternoon', portions: 1 },
      },
    }
    let state = coordinationReducer(undefined, setWeeklyMenu(menu))
    state = coordinationReducer(state, syncOrdersForShift({
      dayOfWeek: 't2',
      shift: 'Ca Sáng',
      orders: [{
        id: 'order-1',
        customerId: 'customer-1',
        customerCode: 'C01',
        customerName: 'Khách hàng 01',
        mealType: 'Suất 34K',
        forecastQuantity: 10,
        actualQuantity: 0,
        unitPrice: 34_000,
        appliedRate: 100,
        specialNotes: '',
        dayOfWeek: 't2',
        shift: 'Ca Sáng',
        dishId: 'dish-old',
      }],
    }))
    state = coordinationReducer(state, updateWeeklyMenuDish({
      day: 't2',
      slotType: 'morningSavory',
      dishId: 'dish-new',
    }))

    expect(state.weeklyMenu.t2?.morningSavory.dishId).toBe('dish-new')
    expect(state.orders[0]?.dishId).toBe('dish-new')
  })
})
