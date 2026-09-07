import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { ReconciliationSourceChangeLog } from './ReconciliationSourceChangeLog'

const changes = [
  { changeId: 'change-1', changedAt: '2026-09-03T08:00:00Z', actor: 'Điều phối', businessArea: 'Coordination', entityName: 'MealQuantityPlan', entityId: '5f9abf55-b523-44f7-bef9-837565e7b3a1', fieldName: 'QuickCompleteServings', oldValue: '120', newValue: '140', reason: 'Cập nhật số suất ca sáng' },
  { changeId: 'change-2', changedAt: '2026-09-03T09:00:00Z', actor: 'Điều phối', businessArea: 'Reconciliation', entityName: 'ReconciliationBatch', entityId: 'batch-1', fieldName: 'Status', oldValue: 'TRANSFERRED', newValue: 'IN_PROGRESS', reason: '{"issueId":"5f9abf55-b523-44f7-bef9-837565e7b3a1"}' },
]

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useListReconciliationSourceChangesQuery: () => ({ data: changes, currentData: changes, isLoading: false, isFetching: false, isError: false, isSuccess: true }),
}))

it('keeps source history secondary and presents business language before technical disclosure', () => {
  render(<ReconciliationSourceChangeLog batchId="batch-1" />)

  const disclosure = screen.getByText('Xem lịch sử thay đổi nguồn (2)')
  expect(disclosure).toBeInTheDocument()
  fireEvent.click(disclosure)

  expect(screen.getByRole('columnheader', { name: 'Hoạt động' })).toBeInTheDocument()
  expect(screen.getByText('Hoàn tất số suất')).toBeInTheDocument()
  expect(screen.getByText('Chờ Kho xác nhận xuất')).toBeInTheDocument()
  expect(screen.getByText('Đang đối chiếu')).toBeInTheDocument()
  expect(screen.getAllByText('Cập nhật số suất ca sáng')).not.toHaveLength(0)
  expect(screen.getByText('Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng.')).toBeInTheDocument()
  const statusRow = screen.getAllByRole('row')[2]
  const primaryCells = Array.from(statusRow.querySelectorAll(':scope > td')).slice(0, 5).map((cell) => cell.textContent).join(' ')
  expect(primaryCells).not.toContain('TRANSFERRED')
  expect(primaryCells).not.toContain('IN_PROGRESS')
  expect(primaryCells).not.toContain('5f9abf55-b523-44f7-bef9-837565e7b3a1')

  const technical = within(statusRow).getByText('Xem thông tin kỹ thuật')
  fireEvent.click(technical)
  const row = technical.closest('tr')!
  expect(within(row).getByText('Reconciliation|ReconciliationBatch|Status')).toBeInTheDocument()
  expect(within(row).getByText('{"issueId":"5f9abf55-b523-44f7-bef9-837565e7b3a1"}')).toBeInTheDocument()
})
