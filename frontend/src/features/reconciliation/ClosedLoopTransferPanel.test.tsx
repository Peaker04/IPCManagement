import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ClosedLoopTransferPanel } from './ClosedLoopTransferPanel'

const batches = [
  { batchId: 'batch-other', menuVersionId: 'menu-other', status: 'TRANSFERRED', version: 1 },
  { batchId: 'batch-exact', menuVersionId: 'menu-exact', status: 'READY', version: 2 },
]
const transfer = vi.fn()

vi.mock('./reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./reconciliationApi')>()),
  useListReconciliationBatchesQuery: () => ({ data: batches, isLoading: false, isError: false, refetch: vi.fn() }),
  useTransferReconciliationBatchMutation: () => [transfer, { isLoading: false }],
}))

beforeEach(() => vi.clearAllMocks())

it('fails closed when the selected menu source has no exact batch', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByText(/phạm vi đang chọn chưa có lô định lượng/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /chuyển sang kho/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /mở danh sách cần xuất/i })).not.toBeInTheDocument()
})

it('offers the stock workflow action only for the exact menu source', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-exact" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByRole('button', { name: 'Chuyển sang Kho' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: /mở danh sách cần xuất/i })).not.toBeInTheDocument()
})
