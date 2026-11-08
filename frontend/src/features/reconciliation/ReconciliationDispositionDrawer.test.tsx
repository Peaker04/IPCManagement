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
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
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

  expect(await screen.findByRole('dialog', { name: 'Xử lý chênh lệch đối chiếu' })).toBeInTheDocument()
  expect(screen.getByText('Ghi nhận kết luận xử lý cho Gạo thơm.')).toBeInTheDocument()
  expect(screen.queryByText(/GAO-01/)).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('hidden')
  expect(screen.getByRole('combobox', { name: 'Nhóm xử lý' })).toHaveTextContent('Chấp nhận chênh lệch')
  expect(screen.getByRole('combobox', { name: 'Nhóm xử lý' })).not.toHaveTextContent('ACCEPTED_VARIANCE')
  expect(screen.getByRole('combobox', { name: 'Nhóm xử lý' })).toHaveFocus()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledOnce()

  opener.remove()
})

it('does not show validation errors before the user interacts with the form', () => {
  render(<ReconciliationDispositionDrawer line={{ ...line, disposition: null }} onClose={vi.fn()} onRefetch={vi.fn()} />)

  expect(screen.getByRole('combobox', { name: 'Nhóm xử lý' })).not.toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Lý do')).toHaveAttribute('aria-invalid', 'false')
  fireEvent.blur(screen.getByLabelText('Lý do'))
  expect(screen.getByLabelText('Lý do')).toHaveAttribute('aria-invalid', 'true')
})

it('keeps validation submission available and focuses the first invalid owner', async () => {
  render(<ReconciliationDispositionDrawer line={{ ...line, disposition: null }} onClose={vi.fn()} onRefetch={vi.fn()} />)

  const submit = screen.getByRole('button', { name: 'Xác nhận xử lý' })
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
  expect(await screen.findByText('Chọn nhóm xử lý.')).toBeInTheDocument()
  expect(screen.getByText('Nhập lý do xử lý.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('Chọn nhóm xử lý.')).toHaveFocus())
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Chấp nhận hao hụt thực tế' })).toBeInTheDocument()
})

it('renders only server-owned disposition category options', () => {
  render(<ReconciliationDispositionDrawer line={{ ...line, disposition: null }} onClose={vi.fn()} onRefetch={vi.fn()} />)

  fireEvent.click(screen.getByRole('combobox', { name: 'Nhóm xử lý' }))
  expect(screen.getByRole('option', { name: 'Chấp nhận chênh lệch' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Cần điều chỉnh số liệu' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Cần theo dõi thêm' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Nhóm xử lý' })).not.toBeInTheDocument()
})
