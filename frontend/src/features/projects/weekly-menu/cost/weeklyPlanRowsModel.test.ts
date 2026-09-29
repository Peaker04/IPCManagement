import { expect, it } from 'vitest'
import { buildWeeklyPlanRows } from './weeklyPlanRowsModel'

it('prices imported Chay rows with vegetarian servings rather than savory servings', () => {
  const rows = ['Mặn', 'Chay'].map((variant, index) => ({
    dayKey: 't3', serviceDate: '2026-09-22', dbShiftName: 'MORNING', variant,
    sourceSection: variant, slot: 'main', dishName: variant, sourceRowNumber: index + 1,
  }))
  const result = buildWeeklyPlanRows({
    committedRows: rows as never,
    displayDays: [{ key: 't3', label: 'Thứ 3', date: '22/9/2026' }],
    weeklyMenu: { t3: { morningSavory: { dishId: '', portions: 102 }, morningVegetarian: { dishId: '', portions: 18 } } } as never,
    dishesById: new Map(), dishesByName: new Map(),
    getServiceDate: () => '2026-09-22',
    getSlotServingInfo: (_day, slot) => ({ portions: slot === 'morningVegetarian' ? 18 : 102, importedPortions: 0, status: 'confirmed', statusLabel: 'Đã chốt suất', hasConfirmedServings: true }),
    getLinePricing: () => ({ menuPrice: 25_000, bomRatePercent: 100, quantityFactor: 1 }),
  })
  expect(result.map((row) => row.portions)).toEqual([102, 18])
})
