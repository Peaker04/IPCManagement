import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { ReconciliationSourceChangeLog } from './ReconciliationSourceChangeLog'

const changes = [
  { changeId: 'change-1', changedAt: '2026-09-03T08:00:00Z', actor: 'Điều phối', businessArea: 'Coordination', entityName: 'MealQuantityPlan', entityId: '5f9abf55-b523-44f7-bef9-837565e7b3a1', fieldName: 'QuickCompleteServings', oldValue: '120', newValue: '140', reason: 'Cập nhật số suất ca sáng' },
  { changeId: 'change-2', changedAt: '2026-09-03T09:00:00Z', actor: 'Quản trị viên', businessArea: 'BOM', entityName: 'BomAdjustment', entityId: 'bom-1', fieldName: 'QuantityAndWaste', oldValue: '0.12 / hao hụt 5%', newValue: '0.14 / hao hụt 4%', reason: 'Cập nhật định lượng món ăn' },
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
  expect(screen.getByText('Điều chỉnh định lượng món ăn')).toBeInTheDocument()
  expect(screen.getAllByText('Cập nhật số suất ca sáng')).not.toHaveLength(0)
  expect(screen.getByText('Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng.')).toBeInTheDocument()
  expect(screen.queryByText('Chờ Kho xuất')).not.toBeInTheDocument()
  expect(screen.queryByText('Đang đối chiếu')).not.toBeInTheDocument()
  expect(screen.queryByText('Reconciliation|ReconciliationBatch|Status')).not.toBeInTheDocument()
  expect(screen.queryByText('Issue|InventoryIssue|FULLDAY')).not.toBeInTheDocument()

  const bomRow = screen.getAllByRole('row')[2]
  const technical = within(bomRow).getByText('Xem thông tin kỹ thuật')
  fireEvent.click(technical)
  expect(within(bomRow).getByText('BOM|BomAdjustment|QuantityAndWaste')).toBeInTheDocument()
})
