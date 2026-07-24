import { describe, expect, it } from 'vitest'
import type { MenuDish } from './types'
import { getMenuDishRole, getMenuDishSlotLabel, groupMenuDishes } from './dishRole'

const dish = (dishId: string, dishSlot?: string | null, displayOrder?: number): MenuDish => ({
  dishId,
  dishCode: dishId.toUpperCase(),
  dishName: dishId,
  dishSlot,
  displayOrder,
})

describe('menu dish roles', () => {
  it.each([
    ['savory-main', 'main'],
    ['vegetarian-sub1', 'side'],
    ['savory-sub2', 'side'],
    ['savory-rau', 'vegetable'],
    ['savory-canh', 'soup'],
    ['savory-fruit', 'fruit'],
    ['savory-dessert', 'dessert'],
  ] as const)('maps menu slot %s to %s', (slot, role) => {
    expect(getMenuDishRole(dish(slot, slot))).toBe(role)
  })

  it('uses menu metadata fallback without guessing from the dish name', () => {
    expect(getMenuDishRole({ ...dish('canh'), dishGroup: 'Canh' })).toBe('soup')
    expect(getMenuDishRole({ ...dish('sua-chua'), dishName: 'Sữa chua' })).toBe('other')
  })

  it('preserves menu order inside role groups and explains sub slots', () => {
    const groups = groupMenuDishes([
      dish('dessert', 'savory-dessert', 5),
      dish('side-2', 'savory-sub2', 3),
      dish('main', 'savory-main', 1),
      dish('side-1', 'savory-sub1', 2),
    ])

    expect(groups.map((group) => group.label)).toEqual(['Món chính', 'Món phụ', 'Tráng miệng'])
    expect(groups[1].dishes.map((item) => item.dishId)).toEqual(['side-1', 'side-2'])
    expect(getMenuDishSlotLabel(groups[1].dishes[0])).toBe('Phụ 1')
    expect(getMenuDishSlotLabel(groups[1].dishes[1])).toBe('Phụ 2')
  })
})
