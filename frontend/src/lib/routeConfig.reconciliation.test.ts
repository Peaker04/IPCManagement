import { describe, expect, it } from 'vitest'
import { readReconciliationWeeklyMenuRoute } from './routeConfig'

describe('reconciliation weekly-menu route scope', () => {
  it('restores the selected workflow view, customer and week from a deep link', () => {
    expect(readReconciliationWeeklyMenuRoute(new URLSearchParams({
      view: 'demand',
      customerId: ' customer-1 ',
      weekStartDate: '2026-09-09',
    }))).toEqual({
      view: 'demand',
      customerId: 'customer-1',
      weekStartDate: '2026-09-09',
    })
  })

  it('fails closed to schedule and empty scope for unsupported values', () => {
    expect(readReconciliationWeeklyMenuRoute(new URLSearchParams({
      view: 'purchase-summary',
      customerId: '   ',
      weekStartDate: 'not-a-date',
    }))).toEqual({ view: 'schedule', customerId: '', weekStartDate: '' })
  })
})
