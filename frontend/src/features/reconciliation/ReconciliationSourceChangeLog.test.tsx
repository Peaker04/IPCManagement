import { fireEvent, render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { ReconciliationSourceChangeLog } from './ReconciliationSourceChangeLog'

const changes = [
  { changeId: 'change-1', changedAt: '2026-09-03T08:00:00Z', actor: 'Điều phối', businessArea: 'Coordination', entityName: 'MealQuantityPlan', entityId: '5f9abf55-b523-44f7-bef9-837565e7b3a1', fieldName: 'QuickCompleteServings', oldValue: '120', newValue: '140', reason: 'Cập nhật số suất ca sáng' },
  { changeId: 'change-2', changedAt: '2026-09-03T09:00:00Z', actor: 'Quản trị viên', businessArea: 'BOM', entityName: 'BomAdjustment', entityId: 'bom-1', fieldName: 'QuantityAndWaste', oldValue: '0.12 / hao hụt 5%', newValue: '0.14 / hao hụt 4%', reason: 'Cập nhật định lượng món ăn' },
  { changeId: 'change-3', changedAt: '2026-09-03T10:00:00Z', actor: '10000000-0000-0000-0000-000000000001', businessArea: 'Coordination', entityName: 'MealQuantityPlan', entityId: '5f9abf55-b523-44f7-bef9-837565e7b3a1', fieldName: 'QuickCompleteServings', oldValue: '140', newValue: '150', reason: 'KHSX cập nhật nhanh số suất vận hành' },
]

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useListReconciliationSourceChangesQuery: () => ({ data: changes, currentData: changes, isLoading: false, isFetching: false, isError: false, isSuccess: true }),
}))

it('keeps source history secondary and presents business language with dedicated columns without technical clutter', () => {
  render(<ReconciliationSourceChangeLog batchId="batch-1" />)

  const disclosure = screen.getByText('Xem lịch sử thay đổi nguồn (3)')
  expect(disclosure).toBeInTheDocument()
  fireEvent.click(disclosure)

  expect(screen.getByRole('columnheader', { name: 'Thời điểm' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Hoạt động' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Trước' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Sau / kết quả' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Người thực hiện' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Lý do' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Chi tiết' })).not.toBeInTheDocument()

  expect(screen.getAllByText('Hoàn tất số suất')).not.toHaveLength(0)
  expect(screen.getByText('Điều chỉnh định lượng món ăn')).toBeInTheDocument()
  expect(screen.getAllByText('Cập nhật số suất ca sáng')).not.toHaveLength(0)
  expect(screen.getByText('Tài khoản hệ thống')).toBeInTheDocument()
  expect(screen.queryByText('10000000-0000-0000-0000-000000000001')).not.toBeInTheDocument()
  expect(screen.queryByText('Xem thông tin kỹ thuật')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }))
  expect(screen.getByText('Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng.')).toBeInTheDocument()

  // Kiểm tra phân bổ cột trước và sau
  expect(screen.getByText('120 suất')).toBeInTheDocument()
  expect(screen.getAllByText('140 suất')).toHaveLength(2)
  expect(screen.getByText('150 suất')).toBeInTheDocument()
  expect(screen.getByText('KHSX cập nhật nhanh số suất vận hành')).toBeInTheDocument()
})
