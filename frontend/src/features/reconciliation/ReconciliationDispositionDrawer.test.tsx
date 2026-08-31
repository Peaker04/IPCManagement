import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReconciliationDispositionDrawer } from './ReconciliationDispositionDrawer'

const save = vi.fn()
vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useSetReconciliationDispositionMutation: () => [save, { isLoading: false }],
  useListReconciliationDispositionCategoriesQuery: () => ({
    data: [
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận chênh lệch' },
      { value: 'CORRECTION_REQUIRED', label: 'Cần điều chỉnh số liệu' },
      { value: 'FOLLOW_UP_REQUIRED', label: 'Cần theo dõi thêm' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

const line = { batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo thơm', ingredientCode: 'GAO-01', canonicalUnitId: 'unit-1', requiredQuantity: 10, frozenTolerance: 1, purchasedQuantity: 12, purchasedVersion: 1, issuedQuantity: 10, issuedVersion: 1, triggers: ['PURCHASED_REQUIRED'], status: 'NEEDS_REVIEW' as const, version: 1, disposition: { category: 'ACCEPTED_VARIANCE', reason: 'Lý do cũ', version: 3, disposedAt: '2026-08-25' } }

beforeEach(() => vi.clearAllMocks())

it('preserves a disposition correction and offers refetch on stale version', async () => {
  save.mockReturnValue({ unwrap: () => Promise.reject({ status: 409, data: { message: 'Kết luận đã thay đổi.' } }) })
  const onClose = vi.fn()
  const onRefetch = vi.fn()
  render(<ReconciliationDispositionDrawer line={line} onClose={onClose} onRefetch={onRefetch} />)

  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Lý do điều chỉnh' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kết luận đã thay đổi.'))
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Lý do')).toHaveValue('Lý do điều chỉnh')
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
  expect(onRefetch).toHaveBeenCalled()
})

it('uses the canonical dialog focus contract and identifies the ingredient in user language', async () => {
  const opener = document.createElement('button')
  opener.textContent = 'Mở xử lý Gạo thơm'
  document.body.appendChild(opener)
  opener.focus()
  const onClose = vi.fn()

  render(<ReconciliationDispositionDrawer line={line} onClose={onClose} onRefetch={vi.fn()} />)

  expect(await screen.findByRole('dialog', { name: 'Xử lý chênh lệch' })).toBeInTheDocument()
  expect(screen.getByText('Ghi nhận hoặc sửa kết luận cho Gạo thơm · mã GAO-01.')).toBeInTheDocument()
  expect(document.body.style.overflow).toBe('hidden')
  expect(screen.getByRole('combobox', { name: 'Nhóm xử lý' })).toHaveFocus()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledOnce()

  opener.remove()
})

it('renders only server-owned disposition category options', () => {
  render(<ReconciliationDispositionDrawer line={{ ...line, disposition: null }} onClose={vi.fn()} onRefetch={vi.fn()} />)

  fireEvent.click(screen.getByRole('combobox', { name: 'Nhóm xử lý' }))
  expect(screen.getByRole('option', { name: 'Chấp nhận chênh lệch' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Cần điều chỉnh số liệu' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Cần theo dõi thêm' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Nhóm xử lý' })).not.toBeInTheDocument()
})
