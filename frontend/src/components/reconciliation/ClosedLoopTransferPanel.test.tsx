import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ClosedLoopTransferPanel } from '@/components/reconciliation/ClosedLoopTransferPanel'

const batches = [
  { batchId: 'batch-other', menuVersionId: 'menu-other', status: 'TRANSFERRED', version: 1 },
  { batchId: 'batch-exact', menuVersionId: 'menu-exact', status: 'READY', version: 2 },
]
const transfer = vi.fn()
const preview = vi.fn()
const commit = vi.fn()
const ready = vi.fn()
const initializeTolerance = vi.fn()

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useInitializeReconciliationToleranceMutation: () => [initializeTolerance, { isLoading: false }],
  useListReconciliationBatchesQuery: () => ({ data: batches, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreviewReconciliationQuantityImportMutation: () => [preview, { isLoading: false }],
  useCommitReconciliationQuantityImportMutation: () => [commit, { isLoading: false }],
  useReadyReconciliationBatchMutation: () => [ready, { isLoading: false }],
  useTransferReconciliationBatchMutation: () => [transfer, { isLoading: false }],
}))

beforeEach(() => vi.clearAllMocks())

it('fails closed when the selected menu source has no exact batch', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByText(/chưa có lô định lượng/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /chuyển sang kho/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /mở danh sách cần xuất/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /kiểm tra nguồn định lượng/i })).toBeEnabled()
})

it('blocks preview and routes the user to publish when the imported menu is still draft', () => {
  const publish = vi.fn()
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" menuVersionStatus="DRAFT" scopeLabel="ANV · tuần 31/8/2026" onPublishMenu={publish} /></MemoryRouter>)

  expect(screen.getByText('Thực đơn tuần chưa được phát hành')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /kiểm tra nguồn định lượng/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Xuất bản tuần' }))
  expect(publish).toHaveBeenCalledOnce()
})

it('blocks preview and opens the serving editor while plans are still forecasted', () => {
  const editServings = vi.fn()
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" menuVersionStatus="ACTIVE" incompleteServingPlanCount={12} onEditServings={editServings} scopeLabel="ANV · tuần 31/8/2026" /></MemoryRouter>)

  expect(screen.getByText('Số suất chưa hoàn tất')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /kiểm tra nguồn định lượng/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Nhập và hoàn tất số suất' }))
  expect(editServings).toHaveBeenCalledOnce()
})

it('previews and exposes commit authority for a complete serving source', async () => {
  preview.mockReturnValue({ unwrap: () => Promise.resolve({ token: 'token-1', contentFingerprint: 'fingerprint-1', plans: [{ status: 'COMPLETED', serviceDate: '2026-08-24', lines: [{ quantityPlanLineId: 'line-1', shift: 'MORNING', finalServings: 120, dishes: [] }] }] }) })
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: /kiểm tra nguồn định lượng/i }))
  expect(await screen.findByText('Kế hoạch theo ngày và ca')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Ngày' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Ca' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Số suất' })).toBeInTheDocument()
  expect(screen.getByText('Ca sáng')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
  expect(screen.queryByText(/dấu vân tay/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /tạo lô định lượng/i })).toBeEnabled()
  expect(preview).toHaveBeenCalledWith({ menuVersionId: 'menu-missing', sourceLabel: 'ANV · tuần 24/8/2026' })
})

it('offers the stock workflow action only for the exact menu source', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-exact" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByRole('button', { name: 'Chuyển sang Kho' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: /mở danh sách cần xuất/i })).not.toBeInTheDocument()
})
