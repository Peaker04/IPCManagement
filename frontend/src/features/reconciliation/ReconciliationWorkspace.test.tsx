import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconciliationWorkspace } from './ReconciliationWorkspace'
import type { ReconciliationBatch, ReconciliationDraftSource } from './reconciliationApi'

let batches: ReconciliationBatch[] = []
let sources: ReconciliationDraftSource[] = []
let role = 'dieuphoi'
const refetch = vi.fn()
const createDraft = vi.fn()
const ready = vi.fn()
const complete = vi.fn()
const setDisposition = vi.fn()
const unwrap = (value?: unknown) => ({ unwrap: () => Promise.resolve(value) })

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: { id: 'u1', role, permissions: [], isAdminFullAccess: false } } }),
}))
vi.mock('@/features/system-operation/systemOperationContext', () => ({ useSystemOperation: () => ({ mode: 'MATERIAL_RECONCILIATION' }) }))
vi.mock('./reconciliationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reconciliationApi')>()
  return {
    ...actual,
    useListReconciliationBatchesQuery: () => ({ data: batches, isLoading: false, isError: false, refetch }),
    useListReconciliationDraftSourcesQuery: () => ({ data: sources, isError: false, refetch }),
    useCreateReconciliationDraftMutation: () => [createDraft, { isLoading: false }],
    useReadyReconciliationBatchMutation: () => [ready, { isLoading: false }],
    useCompleteReconciliationBatchMutation: () => [complete, { isLoading: false }],
    useSetReconciliationDispositionMutation: () => [setDisposition, { isLoading: false }],
  }
})

const draft: ReconciliationBatch = { batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'DRAFT', version: 1, createdAt: '2026-08-25', lines: [] }
const triggeredLine = { batchLineId: 'line-1', ingredientId: 'ingredient-1', canonicalUnitId: 'unit-1', requiredQuantity: 10, frozenTolerance: 0.5, purchasedQuantity: 12, purchasedVersion: 1, issuedQuantity: 10, issuedVersion: 1, purchasedRequiredDifference: 2, issuedRequiredDifference: 0, purchasedIssuedDifference: 2, triggers: ['PURCHASED_REQUIRED'], status: 'NEEDS_REVIEW' as const, version: 1, disposition: null }

beforeEach(() => {
  batches = []
  sources = [{ menuVersionId: 'menu-1', menuLabel: 'Tuần 25/08/2026 · phiên bản 1', quantityImportBatchId: 'import-1', importBatchLabel: 'IMPORT-1' }]
  role = 'dieuphoi'
  vi.clearAllMocks()
  createDraft.mockReturnValue(unwrap(draft))
  ready.mockReturnValue(unwrap({ ...draft, status: 'READY', version: 2 }))
  complete.mockReturnValue(unwrap())
  setDisposition.mockReturnValue(unwrap())
})

describe('ReconciliationWorkspace lifecycle', () => {
  it('creates a draft from a committed source and can move draft to ready', async () => {
    const view = render(<ReconciliationWorkspace owner="weekly-menu" />)
    expect(screen.getByText('Chưa có lô đối chiếu.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nguồn đã cam kết'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lô nháp' }))
    await waitFor(() => expect(createDraft).toHaveBeenCalledWith({ menuVersionId: 'menu-1', quantityImportBatchId: 'import-1' }))

    batches = [draft]
    view.rerender(<ReconciliationWorkspace owner="weekly-menu" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sẵn sàng đối chiếu' }))
    await waitFor(() => expect(ready).toHaveBeenCalledWith({ id: 'batch-1', expectedVersion: 1 }))
  })

  it('gates completion and disposition to manager/admin while preserving read access', () => {
    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [triggeredLine] }]
    const view = render(<ReconciliationWorkspace owner="reports" />)
    expect(screen.queryByRole('button', { name: 'Hoàn tất đối chiếu' })).not.toBeInTheDocument()
    expect(screen.getByText('Cần kiểm tra')).toBeInTheDocument()

    role = 'quanly'
    view.rerender(<ReconciliationWorkspace owner="reports" />)
    expect(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xử lý chênh lệch' })).toBeInTheDocument()
  })

  it('records and corrects a typed disposition before completion', async () => {
    role = 'admin'
    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [triggeredLine] }]
    const view = render(<ReconciliationWorkspace owner="reports" />)
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý chênh lệch' }))
    fireEvent.change(screen.getByLabelText('Nhóm xử lý'), { target: { value: 'ACCEPTED_VARIANCE' } })
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đã xác minh chứng từ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận xử lý' }))
    await waitFor(() => expect(setDisposition).toHaveBeenCalledWith({ lineId: 'line-1', category: 'ACCEPTED_VARIANCE', reason: 'Đã xác minh chứng từ', expectedVersion: undefined }))

    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [{ ...triggeredLine, disposition: { category: 'ACCEPTED_VARIANCE', reason: 'Đã xác minh chứng từ', version: 2, disposedAt: '2026-08-25' } }] }]
    view.rerender(<ReconciliationWorkspace owner="reports" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sửa xử lý' }))
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đã kiểm tra lại hóa đơn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }))
    await waitFor(() => expect(setDisposition).toHaveBeenLastCalledWith({ lineId: 'line-1', category: 'ACCEPTED_VARIANCE', reason: 'Đã kiểm tra lại hóa đơn', expectedVersion: 2 }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    expect(complete).toHaveBeenCalledWith({ id: 'batch-1', expectedVersion: 1 })
  })
})
