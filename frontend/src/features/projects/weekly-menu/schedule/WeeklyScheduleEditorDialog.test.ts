import { describe, expect, it } from 'vitest'
import { resolveSelectedDishLabel } from './WeeklyScheduleEditorDialog'
import { buildMenuDishChanges } from './useWeeklyScheduleEditor'

describe('weekly schedule editor dish labels', () => {
  it('shows the persisted dish when it is outside the section filter', () => {
    const catalog = new Map([
      ['savory-current', 'Cá hố kho'],
      ['vegetarian-option', 'Đậu hũ kho nấm'],
    ])

    expect(resolveSelectedDishLabel(
      'savory-current',
      [{ id: 'vegetarian-option', name: 'Đậu hũ kho nấm' }],
      (dishId) => catalog.get(dishId),
    )).toBe('Cá hố kho')
  })

  it('keeps a changed locked savory slot for amendment submission', () => {
    const changes = buildMenuDishChanges({
      displayDays: [{ key: 't2', label: 'Thứ Hai', date: '10/08/2026' }],
      sections: [{ slotType: 'afternoonSavory', defaultDishId: '' }],
      weeklyMenu: { t2: {
        morningSavory: { dishId: 'morning', portions: 840 },
        morningVegetarian: { dishId: 'morning-vegetarian', portions: 150 },
        afternoonSavory: { dishId: 'dish-current', portions: 840 },
        afternoonVegetarian: { dishId: 'afternoon-vegetarian', portions: 150 },
      } },
      draftMenu: { t2: {
        morningSavory: { dishId: 'morning', portions: 840 },
        morningVegetarian: { dishId: 'morning-vegetarian', portions: 150 },
        afternoonSavory: { dishId: 'dish-replacement', portions: 840 },
        afternoonVegetarian: { dishId: 'afternoon-vegetarian', portions: 150 },
      } },
      serviceDate: () => '2026-08-10',
      isLocked: () => true,
    })

    expect(changes).toEqual([{
      locked: true,
      serviceDate: '2026-08-10',
      shiftName: 'Ca Chiều',
      slotType: 'afternoonSavory',
      dishId: 'dish-replacement',
    }])
  })
})
