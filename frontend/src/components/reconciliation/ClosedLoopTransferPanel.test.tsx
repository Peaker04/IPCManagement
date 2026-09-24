import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ClosedLoopTransferPanel } from '@/components/reconciliation/ClosedLoopTransferPanel'

const batches = [
  { batchId: 'batch-other', menuVersionId: 'menu-other', status: 'TRANSFERRED', version: 1 },
  { batchId: 'batch-draft', menuVersionId: 'menu-draft', status: 'DRAFT', version: 5, lines: [{ batchLineId: 'line-1' }] },
  { batchId: 'batch-exact', menuVersionId: 'menu-exact', status: 'READY', version: 2, lines: [{ batchLineId: 'line-1' }] },
  { batchId: 'batch-progress', menuVersionId: 'menu-progress', status: 'IN_PROGRESS', version: 3 },
  { batchId: 'batch-completed', menuVersionId: 'menu-completed', status: 'COMPLETED', version: 4 },
]
const transfer = vi.fn()
const preview = vi.fn()
const commit = vi.fn()
const ready = vi.fn()
const initializeTolerance = vi.fn()
const refetch = vi.fn()

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useInitializeReconciliationToleranceMutation: () => [initializeTolerance, { isLoading: false }],
  useListReconciliationBatchesQuery: () => ({ data: batches, isLoading: false, isError: false, refetch }),
  usePreviewReconciliationQuantityImportMutation: () => [preview, { isLoading: false }],
  useCommitReconciliationQuantityImportMutation: () => [commit, { isLoading: false }],
  useReadyReconciliationBatchMutation: () => [ready, { isLoading: false }],
  useTransferReconciliationBatchMutation: () => [transfer, { isLoading: false }],
}))

beforeEach(() => {
  vi.clearAllMocks()
  refetch.mockResolvedValue({ data: batches })
  commit.mockReturnValue({ unwrap: () => Promise.resolve({}) })
  ready.mockReturnValue({ unwrap: () => Promise.resolve({}) })
  transfer.mockReturnValue({ unwrap: () => Promise.resolve({}) })
})

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

it('shows missing material definitions and blocks batch creation', async () => {
  preview.mockReturnValue({ unwrap: () => Promise.resolve({ token: 'token-bom', contentFingerprint: 'fingerprint-bom', diagnostics: ["31/08/2026 · Ca sáng · món 'Cá kho' chưa có định mức nguyên liệu phù hợp."], plans: [{ status: 'COMPLETED', serviceDate: '2026-08-31', lines: [{ quantityPlanLineId: 'line-bom', shift: 'MORNING', finalServings: 100, dishes: [] }] }] }) })
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" scopeLabel="ANV · tuần 31/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: /kiểm tra nguồn định lượng/i }))

  expect(await screen.findByText('Cần bổ sung định mức nguyên liệu')).toBeInTheDocument()
  expect(screen.getByText(/món 'Cá kho'/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /tạo lô định lượng/i })).toBeDisabled()
})

it('commits the exact preview authority and refetches the canonical batch', async () => {
  preview.mockReturnValue({ unwrap: () => Promise.resolve({ token: 'token-commit', contentFingerprint: 'fingerprint-commit', plans: [{ status: 'COMPLETED', serviceDate: '2026-08-24', lines: [{ quantityPlanLineId: 'line-1', shift: 'MORNING', finalServings: 120, dishes: [] }] }] }) })
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-missing" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: /kiểm tra nguồn định lượng/i }))
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo lô định lượng' }))

  await waitFor(() => expect(commit).toHaveBeenCalledWith({ token: 'token-commit', contentFingerprint: 'fingerprint-commit', sourceLabel: 'ANV · tuần 24/8/2026' }))
  expect(refetch).toHaveBeenCalledOnce()
  expect(await screen.findByText('Đã tạo lô định lượng')).toBeInTheDocument()
})

it('freezes the exact draft version and refetches after success', async () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-draft" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và khóa' }))

  await waitFor(() => expect(ready).toHaveBeenCalledWith({ id: 'batch-draft', expectedVersion: 5 }))
  expect(refetch).toHaveBeenCalledOnce()
  expect(await screen.findByText('Đã khóa định lượng')).toBeInTheDocument()
})

it('transfers the exact ready version, refetches, and confirms the Warehouse handoff', async () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-exact" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang Kho' }))

  await waitFor(() => expect(transfer).toHaveBeenCalledWith({ id: 'batch-exact', expectedVersion: 2 }))
  expect(refetch).toHaveBeenCalledOnce()
  expect(await screen.findByText('Đã chuyển sang Kho')).toBeInTheDocument()
})

it('keeps a transfer conflict inside the owning panel without refetching stale success', async () => {
  transfer.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Lô đã thay đổi.' } }) })
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-exact" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang Kho' }))

  expect(await screen.findByText('Chưa chuyển được sang Kho')).toBeInTheDocument()
  expect(screen.getByText('Lô đã thay đổi.')).toBeInTheDocument()
  expect(refetch).not.toHaveBeenCalled()
})

it('offers the stock workflow action only for the exact menu source', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-exact" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByRole('button', { name: 'Chuyển sang Kho' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: /mở danh sách cần xuất/i })).not.toBeInTheDocument()
})

it('does not invent a serving-change warning from batch lifecycle alone', () => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId="menu-progress" scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.queryByText('Số suất thay đổi sau khi đã khóa định lượng')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mở phiếu xuất bổ sung' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mở đối chiếu' })).toHaveAttribute('href', '/reconciliation?batchId=batch-progress')
})

it.each([
  ['menu-progress', 'Mở đối chiếu', '/reconciliation?batchId=batch-progress'],
  ['menu-completed', 'Mở kết quả', '/reconciliation?batchId=batch-completed'],
])('keeps lifecycle status and next action aligned for %s', (menuVersionId, action, href) => {
  render(<MemoryRouter><ClosedLoopTransferPanel menuVersionId={menuVersionId} scopeLabel="ANV · tuần 24/8/2026" /></MemoryRouter>)

  expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', href)
  expect(screen.queryByRole('link', { name: 'Mở danh sách cần xuất' })).not.toBeInTheDocument()
})
