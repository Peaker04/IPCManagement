import { describe, expect, it } from 'vitest'
import type { DemandLine } from '@/features/workflow'
import type { QuickServingRow } from '../schedule/types'
import { getDemandDayIndex, getDemandInventoryStatus, getPendingQuickServingRows } from './demandModel'

describe('material demand model', () => {
  it('uses server totals when summarizing a paged inventory result', () => {
    const lines = [{
      tone: 'danger',
      required: 12,
      available: 4,
      reserved: 1,
    }] as DemandLine[]

    expect(getDemandInventoryStatus(lines, 42, 7)).toEqual({
      warningCount: 0,
      shortageCount: 7,
      enoughCount: 35,
      tone: 'danger',
      label: 'Thiếu nguyên liệu',
    })
  })

  it('selects the requested day before falling back to the active day', () => {
    const pages = [
      { key: 't2', label: 'Thứ 2', date: '20/07/2026', rows: [] },
      { key: 't3', label: 'Thứ 3', date: '21/07/2026', rows: [] },
    ] as Parameters<typeof getDemandDayIndex>[0]

    expect(getDemandDayIndex(pages, 't3', 't2')).toBe(1)
    expect(getDemandDayIndex(pages, null, 't2')).toBe(0)
  })

  it('completes only positive, unfinished servings in the generated week', () => {
    const rows = [
      { serviceDate: '2026-07-20', inputValue: '125.4', isCompleted: false },
      { serviceDate: '2026-07-20', inputValue: '0', isCompleted: false },
      { serviceDate: '2026-07-20', inputValue: '90', isCompleted: true },
      { serviceDate: '2026-07-27', inputValue: '70', isCompleted: false },
    ] as QuickServingRow[]

    const pending = getPendingQuickServingRows(rows, ['2026-07-20'])

    expect(pending).toHaveLength(1)
    expect(pending[0].nextServings).toBe(125)
  })
})
