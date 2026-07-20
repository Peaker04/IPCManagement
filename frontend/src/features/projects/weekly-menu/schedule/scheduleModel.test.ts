import { describe, expect, it } from 'vitest'
import type { MealQuantityPlanDto } from '../../../coordination/types'
import { buildQuantityPlanByDateShift, buildQuickServingRows } from './scheduleModel'
import type { WeeklyMenuScope } from './types'

const plans = [{
  quantityPlanId: 'plan-1',
  serviceDate: '2026-07-20T00:00:00',
  status: 'COMPLETED',
  lines: [{
    quantityPlanLineId: 'line-1',
    customerId: 'customer-1',
    shiftName: 'MORNING',
    forecastServings: 120,
    confirmedServings: 100,
    adjustedServings: 40,
    finalServings: 0,
  }],
}] as MealQuantityPlanDto[]

describe('weekly schedule model', () => {
  it('preserves an authoritative zero final serving instead of falling back to older values', () => {
    const byShift = buildQuantityPlanByDateShift(plans, 'customer-1')
    expect(byShift.get('2026-07-20|MORNING')?.servings).toBe(0)

    const scope = {
      customerId: 'customer-1',
      displayDays: [{ key: 't2', label: 'Thứ 2', date: '20/7/2026' }],
    } as WeeklyMenuScope
    const rows = buildQuickServingRows({
      scope,
      committedRows: [],
      plans,
      inputs: {},
      weeklyPlanRows: [],
    })

    expect(rows.find((row) => row.shiftName === 'MORNING')).toMatchObject({
      currentServings: 0,
      inputValue: '',
    })
  })
})
