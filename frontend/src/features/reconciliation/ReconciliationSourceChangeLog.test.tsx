import { render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { ReconciliationSourceChangeLog } from './ReconciliationSourceChangeLog'

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useListReconciliationSourceChangesQuery: () => ({
    data: [{ changeId: 'change-1', changedAt: '2026-09-03T08:00:00Z', actor: 'Điều phối', businessArea: 'Coordination', entityName: 'MealQuantityPlan', entityId: 'plan-1', fieldName: 'QuickCompleteServings', oldValue: '120', newValue: '140', reason: 'Cập nhật số suất ca sáng' }],
    isLoading: false, isFetching: false, isError: false, isSuccess: true,
  }),
}))

it('renders batch-scoped source history with actor, old/new values and reason', () => {
  render(<ReconciliationSourceChangeLog batchId="batch-1" />)
  expect(screen.getByText('Số suất')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
  expect(screen.getByText('140')).toBeInTheDocument()
  expect(screen.getByText('Điều phối')).toBeInTheDocument()
  expect(screen.getByText('Cập nhật số suất ca sáng')).toBeInTheDocument()
})
