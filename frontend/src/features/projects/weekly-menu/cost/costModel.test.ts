import { describe, expect, it } from 'vitest'
import { buildCostDayPages, getDishUnitCost, resolveCostDayIndex } from './costModel'
import type { WeeklyPlanRow } from '../model/types'

const row = { dayKey: 'mon' } as WeeklyPlanRow

describe('menu cost model', () => {
  it('keeps only days that have plan rows and prioritizes the explicit selection', () => {
    const pages = buildCostDayPages([
      { key: 'mon', label: 'Thứ 2', date: '20/07' },
      { key: 'tue', label: 'Thứ 3', date: '21/07' },
    ], [row])
    expect(pages.map((page) => page.key)).toEqual(['mon'])
    expect(resolveCostDayIndex(pages, 'mon', 'tue')).toBe(0)
  })

  it('calculates unit cost with the row quantity factor', () => {
    expect(getDishUnitCost({ ingredients: [{ grossQtyPerServing: 0.2, referencePrice: 50_000 }] } as never, 1.1)).toBe(11_000)
  })
})
