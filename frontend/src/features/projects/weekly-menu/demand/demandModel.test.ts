import { describe, expect, it } from 'vitest'
import type { DemandLine } from '@/features/workflow'
import type { QuickServingRow } from '../schedule/types'
import { aggregateWeekStaleness, getDemandDayIndex, getDemandInventoryStatus, getPendingQuickServingRows, getWeekStalenessState } from './demandModel'

describe('material demand model', () => {
  it('uses server totals when summarizing a paged inventory result', () => {
    const lines = [{
      tone: 'warning',
      required: 12,
      available: 4,
      reserved: 1,
    }] as DemandLine[]

    expect(getDemandInventoryStatus(lines, 42, 7)).toEqual({
      warningCount: 1,
      staleCount: 1,
      shortageCount: 7,
      enoughCount: 35,
      totalCount: 42,
      tone: 'warning',
      label: 'Cần tính lại',
    })
  })

  it('marks the week stale when any service date is stale and keeps date-specific reasons', () => {
    expect(aggregateWeekStaleness([
      { serviceDate: '2026-07-20', staleness: { hasExistingPlan: true, isStale: false, lastGeneratedAt: '2026-07-20T08:00:00Z', reasons: [] } },
      { serviceDate: '2026-07-22', staleness: { hasExistingPlan: true, isStale: true, lastGeneratedAt: '2026-07-22T09:00:00Z', reasons: ['Số suất đã thay đổi'] } },
    ])).toEqual({
      hasExistingPlan: true,
      isStale: true,
      lastGeneratedAt: '2026-07-22T09:00:00Z',
      reasons: ['2026-07-22: Số suất đã thay đổi'],
    })
    expect(aggregateWeekStaleness([
      { serviceDate: '2026-07-20', staleness: { hasExistingPlan: true, isStale: false, reasons: [] } },
    ], 2)).toBeUndefined()
  })

  it('keeps partial week staleness loading and exposes a failed day instead of treating the week as clean', () => {
    const dates = ['2026-07-20', '2026-07-21']
    const cleanResult = { data: { data: { hasExistingPlan: true, isStale: false, reasons: [] } } }

    expect(getWeekStalenessState(dates, [cleanResult, { isFetching: true }])).toEqual({
      status: 'loading',
      expectedDateCount: 2,
      completedDateCount: 1,
      staleness: undefined,
    })
    expect(getWeekStalenessState(dates, [cleanResult, { isError: true }])).toEqual({
      status: 'error',
      expectedDateCount: 2,
      completedDateCount: 1,
      staleness: undefined,
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

  it('uses the consolidated selector for only positive, unfinished servings in the generated week', () => {
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
