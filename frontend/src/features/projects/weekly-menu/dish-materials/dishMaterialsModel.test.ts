import { describe, expect, it } from 'vitest'
import { buildDishMaterialsPresentation, resolveAnalyzedDish } from './dishMaterialsModel'

describe('dish materials model', () => {
  it('prefers the selected catalog dish before the weekly fallback', () => {
    const dishes = [{ id: 'weekly' }, { id: 'selected' }] as never[]
    expect(resolveAnalyzedDish(dishes, 'selected', [{ dishId: 'weekly' }] as never, new Map([['weekly', dishes[0]]]))?.id).toBe('selected')
  })

  it('calculates tray cost, percentage and gross profit from catalog BOM', () => {
    const result = buildDishMaterialsPresentation({ ingredients: [{ name: 'Gạo', unit: 'kg', grossQtyPerServing: 0.2, referencePrice: 20_000 }] } as never, 25_000)
    expect(result.totalTrayCost).toBe(4_000)
    expect(result.foodCostPercent).toBe(16)
    expect(result.grossProfit).toBe(21_000)
  })
})
