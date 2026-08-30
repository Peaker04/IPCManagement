import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReconciliationActualDrawer } from './ReconciliationActualDrawer'

const save = vi.fn()
vi.mock('./reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./reconciliationApi')>()),
  useSetReconciliationActualMutation: () => [save, { isLoading: false }],
}))

const line = { batchLineId: 'line-1', ingredientId: 'ingredient-1', canonicalUnitId: 'unit-1', requiredQuantity: 10, frozenTolerance: 1, purchasedQuantity: 12, purchasedVersion: 4, issuedQuantity: null, issuedVersion: null, triggers: [], status: 'MATCHED' as const, version: 1, disposition: null }

beforeEach(() => vi.clearAllMocks())

it('requires a correction reason and keeps the editor open with refetch on stale conflict', async () => {
  save.mockReturnValue({ unwrap: () => Promise.reject({ status: 409, data: { message: 'Lô đối chiếu đã thay đổi.' } }) })
  const onClose = vi.fn()
  const onRefetch = vi.fn()
  render(<ReconciliationActualDrawer line={line} side="purchased" onClose={onClose} onRefetch={onRefetch} />)

  expect(screen.getByRole('button', { name: 'Lưu số lượng' })).toBeDisabled()
  fireEvent.change(screen.getByPlaceholderText(/Nhập lý do điều chỉnh/i), { target: { value: 'Sửa theo hóa đơn' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu số lượng' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Lô đối chiếu đã thay đổi.'))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
  expect(onRefetch).toHaveBeenCalled()
})
