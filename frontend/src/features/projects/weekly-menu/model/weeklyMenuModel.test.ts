import { describe, expect, it } from 'vitest'
import type { DemandLine } from '@/features/workflow'
import {
  formatImportDate,
  formatMenuDishName,
  isValidWeekStartDate,
  normalizeDishMatchKey,
  parseDisplayDateToIso,
  summarizeImportWarnings,
} from './formatters'
import type { CatalogDish } from '../../dishCatalogApi'
import { aggregateDemandLinesByMaterial, buildPlanRowsMaterialSummary, getQuickServingKey } from './scope'
import type { WeeklyPlanRow } from './types'

const demandLine = (overrides: Partial<DemandLine>): DemandLine => ({
  id: 'line',
  material: 'Gạo tẻ',
  required: 0,
  available: 0,
  reserved: 0,
  unit: 'kg',
  source: '',
  status: 'Đang xử lý',
  nextAction: '',
  tone: 'neutral',
  ...overrides,
})

describe('weekly menu pure model', () => {
  it('normalizes imported dish names without changing the display copy', () => {
    expect(normalizeDishMatchKey('Đậu hũ 120g')).toBe('DAU HU')
    expect(formatMenuDishName('Đậu hũ 120g')).toBe('Đậu hũ')
  })

  it('keeps local date parsing deterministic', () => {
    expect(formatImportDate('2026-07-20')).toBe('20/7/2026')
    expect(parseDisplayDateToIso('20/7/2026')).toBe('2026-07-20')
    expect(isValidWeekStartDate('2026-07-20')).toBe(true)
    expect(isValidWeekStartDate('2026-07-21')).toBe(false)
  })

  it('collapses repeated contract warnings while preserving other warnings', () => {
    expect(summarizeImportWarnings([
      'Không có hợp đồng hiệu lực cho IPC ngày 20/7, dùng giá mặc định 35.000 và BOM 100%.',
      'Không có hợp đồng hiệu lực cho IPC ngày 21/7, dùng giá mặc định 35.000 và BOM 100%.',
      'Thiếu tên món tại B12.',
    ])).toEqual([
      'Không có hợp đồng hiệu lực cho IPC: 2 ca/ngày đang dùng giá mặc định 35.000 và BOM 100%.',
      'Thiếu tên món tại B12.',
    ])
  })

  it('aggregates material demand and derives the next action from real stock', () => {
    const result = aggregateDemandLinesByMaterial([
      demandLine({ id: 'a', ingredientId: 'rice', required: 7, available: 4, reserved: 1, source: 'Cơm', materialRequestId: 'mr-1' }),
      demandLine({ id: 'b', ingredientId: 'rice', required: 2, available: 4, reserved: 0, source: 'Cháo', materialRequestId: 'mr-1' }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      materialRequestId: 'mr-1',
      required: 9,
      available: 4,
      reserved: 1,
      status: 'Thiếu nguyên liệu',
      nextAction: 'Đề xuất mua thêm',
      tone: 'danger',
    })
    expect(result[0].source).toBe('Cơm, Cháo')
    expect(getQuickServingKey('2026-07-20', 'MORNING')).toBe('2026-07-20|MORNING')
  })

  it('keeps same-name ingredients separate by stable identity in BOM and demand aggregation', () => {
    const dish = {
      id: 'dish-1',
      name: 'Món thử',
      ingredients: [
        { ingredientId: 'ingredient-a', unitId: 'unit-kg', name: 'Bột', unit: 'kg', grossQtyPerServing: 1, referencePrice: 10 },
        { ingredientId: 'ingredient-b', unitId: 'unit-kg', name: 'Bột', unit: 'kg', grossQtyPerServing: 2, referencePrice: 20 },
      ],
    } as CatalogDish
    const summary = buildPlanRowsMaterialSummary(
      [{ dishId: dish.id, dishName: dish.name, portions: 3, quantityFactor: 1 }] as WeeklyPlanRow[],
      new Map([[dish.id, dish]]),
      new Map(),
    )

    expect(Object.values(summary).map((entry) => [entry.ingredientId, entry.theory])).toEqual([
      ['ingredient-a', 3],
      ['ingredient-b', 6],
    ])

    const demand = aggregateDemandLinesByMaterial([
      demandLine({ id: 'a', ingredientId: 'ingredient-a', material: 'Bột', required: 3 }),
      demandLine({ id: 'b', ingredientId: 'ingredient-b', material: 'Bột', required: 6 }),
    ])
    expect(demand.map((line) => [line.id, line.required])).toHaveLength(2)
  })
})
