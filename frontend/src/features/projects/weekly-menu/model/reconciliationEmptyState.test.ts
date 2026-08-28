import { describe, expect, it } from 'vitest'
import { getReconciliationScheduleEmptyState } from './reconciliationEmptyState'

describe('reconciliation weekly-menu empty-state contract', () => {
  it('guides the operator to select a customer before loading a weekly plan', () => {
    expect(getReconciliationScheduleEmptyState({ customerId: '', weekStartDate: '2026-08-24', isMenuReady: false, rowCount: 0 })).toMatchObject({
      title: 'Chưa chọn khách hàng',
      action: 'customer',
    })
  })

  it('guides the operator to select a week when the customer is already scoped', () => {
    expect(getReconciliationScheduleEmptyState({ customerId: 'customer-1', weekStartDate: '', isMenuReady: false, rowCount: 0 })).toMatchObject({
      title: 'Chưa chọn tuần bắt đầu',
      action: 'week',
    })
  })

  it('distinguishes a settled empty plan from loading and populated states', () => {
    expect(getReconciliationScheduleEmptyState({ customerId: 'customer-1', weekStartDate: '2026-08-24', isMenuReady: false, rowCount: 0 })).toBeNull()
    expect(getReconciliationScheduleEmptyState({ customerId: 'customer-1', weekStartDate: '2026-08-24', isMenuReady: true, rowCount: 0 })).toMatchObject({
      title: 'Chưa có kế hoạch tuần cho phạm vi đã chọn',
      action: 'customer',
    })
    expect(getReconciliationScheduleEmptyState({ customerId: 'customer-1', weekStartDate: '2026-08-24', isMenuReady: true, rowCount: 12 })).toBeNull()
  })
})
