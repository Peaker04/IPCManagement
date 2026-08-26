import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconciliationWorkspace } from './ReconciliationWorkspace'
import type { ReconciliationBatch, ReconciliationDraftSource } from './reconciliationApi'

let batches: ReconciliationBatch[] = []
let sources: ReconciliationDraftSource[] = []
let role = 'dieuphoi'
let previewState: { data?: unknown; isLoading: boolean; isError: boolean; error?: unknown } = { isLoading: false, isError: false }
const refetch = vi.fn()
const previewQuantityImport = vi.fn()
const commitQuantityImport = vi.fn()
const ready = vi.fn()
const complete = vi.fn()
const setDisposition = vi.fn()
const setActual = vi.fn()
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
    usePreviewReconciliationQuantityImportMutation: () => [previewQuantityImport, previewState],
    useCommitReconciliationQuantityImportMutation: () => [commitQuantityImport, { isLoading: false }],
    useReadyReconciliationBatchMutation: () => [ready, { isLoading: false }],
    useCompleteReconciliationBatchMutation: () => [complete, { isLoading: false }],
    useSetReconciliationDispositionMutation: () => [setDisposition, { isLoading: false }],
    useListReconciliationDispositionCategoriesQuery: () => ({ data: [
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận chênh lệch' },
      { value: 'CORRECTION_REQUIRED', label: 'Cần điều chỉnh số liệu' },
      { value: 'FOLLOW_UP_REQUIRED', label: 'Cần theo dõi thêm' },
    ], isLoading: false, isError: false, refetch: vi.fn() }),
    useSetReconciliationActualMutation: () => [setActual, { isLoading: false }],
  }
})

const draft: ReconciliationBatch = { batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'DRAFT', version: 1, createdAt: '2026-08-25', lines: [] }
const triggeredLine = { batchLineId: 'line-1', ingredientId: 'ingredient-1', canonicalUnitId: 'unit-1', requiredQuantity: 10, frozenTolerance: 0.5, purchasedQuantity: 12, purchasedVersion: 1, issuedQuantity: 10, issuedVersion: 1, purchasedRequiredDifference: 2, issuedRequiredDifference: 0, purchasedIssuedDifference: 2, triggers: ['PURCHASED_REQUIRED'], status: 'NEEDS_REVIEW' as const, version: 1, disposition: null }

beforeEach(() => {
  batches = []
  sources = [{ menuVersionId: 'menu-1', menuLabel: 'Tuần 25/08/2026 · phiên bản 1', quantityImportBatchId: 'import-1', importBatchLabel: 'IMPORT-1' }]
  role = 'dieuphoi'
  vi.clearAllMocks()
  previewState = { isLoading: false, isError: false }
  previewQuantityImport.mockReturnValue(unwrap({
    token: 'preview-token', contentFingerprint: 'A'.repeat(64), fingerprintFormatVersion: 1,
    expiresAt: '2026-08-25T12:00:00Z', diagnostics: [],
    plans: [{ quantityPlanId: 'plan-1', planCode: 'QTY-1', serviceDate: '2026-08-25', status: 'COMPLETED', rowVersion: '2026-08-25T10:00:00Z', lines: [{ quantityPlanLineId: 'source-line-1', menuScheduleId: 'schedule-1', customerId: 'customer-1', menuId: 'menu-1', shift: 'MORNING', finalServings: 10 }] }],
  }))
  commitQuantityImport.mockReturnValue(unwrap({ importBatchId: 'import-1', reconciliationBatchId: 'batch-1', contentFingerprint: 'A'.repeat(64), idempotentReplay: false }))
  ready.mockReturnValue(unwrap({ ...draft, status: 'READY', version: 2 }))
  complete.mockReturnValue(unwrap())
  setDisposition.mockReturnValue(unwrap())
  setActual.mockReturnValue(unwrap())
})

describe('ReconciliationWorkspace lifecycle', () => {
  it('previews and confirms one quantity-import commit before readiness without a second draft action', async () => {
    const view = render(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" menuVersionLabel="ANV · tuần 25/08/2026" />)
    expect(screen.queryByRole('button', { name: 'Tạo lô nháp' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra nguồn số suất' }))
    await waitFor(() => expect(previewQuantityImport).toHaveBeenCalledWith({ menuVersionId: 'menu-1', sourceLabel: 'ANV · tuần 25/08/2026' }))

    previewState = { isLoading: false, isError: false, data: await previewQuantityImport.mock.results[0].value.unwrap() }
    view.rerender(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" menuVersionLabel="ANV · tuần 25/08/2026" />)
    expect(screen.getByText('1 kế hoạch · 1 dòng nguồn')).toBeInTheDocument()
    expect(screen.getByText('AAAAAAAAAAAA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cam kết nguồn số suất' }))
    const dialog = screen.getByRole('dialog', { name: 'Cam kết nguồn số suất?' })
    expect(dialog).toHaveTextContent('ANV · tuần 25/08/2026')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cam kết nguồn' }))
    await waitFor(() => expect(commitQuantityImport).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Đã tạo nguồn số suất và lô đối chiếu nháp.')).toBeInTheDocument()

    batches = [draft]
    view.rerender(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" menuVersionLabel="ANV · tuần 25/08/2026" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sẵn sàng đối chiếu' }))
    await waitFor(() => expect(ready).toHaveBeenCalledWith({ id: 'batch-1', expectedVersion: 1 }))
  })

  it('hides quantity-import instructions from unauthorized actors and distinguishes blocked preview states', async () => {
    role = 'muahang'
    const view = render(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" />)
    expect(screen.queryByText(/nguồn số suất/i)).not.toBeInTheDocument()

    role = 'dieuphoi'
    previewState = { isLoading: false, isError: false, data: { token: 't', contentFingerprint: 'B'.repeat(64), fingerprintFormatVersion: 1, expiresAt: '2026-08-25T12:00:00Z', plans: [], diagnostics: ['Nguồn chưa đủ điều kiện.'] } }
    view.rerender(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Nguồn chưa đủ điều kiện.')
    expect(screen.getByRole('button', { name: 'Cam kết nguồn số suất' })).toBeDisabled()
  })

  it('renders conflict guidance and idempotent replay as server-owned states', async () => {
    const preview = { token: 't', contentFingerprint: 'C'.repeat(64), fingerprintFormatVersion: 1, expiresAt: '2026-08-25T12:00:00Z', diagnostics: [], plans: [{ quantityPlanId: 'p', planCode: 'P', serviceDate: '2026-08-25', status: 'COMPLETED', rowVersion: '2026-08-25T10:00:00Z', lines: [{ quantityPlanLineId: 'l', menuScheduleId: 's', customerId: 'c', menuId: 'm', shift: 'MORNING', finalServings: 1 }] }] }
    previewState = { isLoading: false, isError: false, data: preview }
    commitQuantityImport.mockReturnValueOnce({ unwrap: () => Promise.reject({ status: 409, data: { message: 'Nguồn số suất đã thay đổi.' } }) })
    const view = render(<ReconciliationWorkspace owner="weekly-menu" menuVersionId="menu-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cam kết nguồn số suất' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cam kết nguồn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nguồn số suất đã thay đổi.')

    commitQuantityImport.mockReturnValue(unwrap({ importBatchId: 'import-replay', reconciliationBatchId: 'batch-replay', contentFingerprint: preview.contentFingerprint, idempotentReplay: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Cam kết nguồn số suất' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cam kết nguồn' }))
    expect(await screen.findByText('Nguồn này đã được cam kết trước đó.')).toBeInTheDocument()
    view.unmount()
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

  it('recovers an actual correction after conflict by hydrating the refreshed version', async () => {
    role = 'muahang'
    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [triggeredLine] }]
    setActual
      .mockReturnValueOnce({ unwrap: () => Promise.reject({ status: 409, data: { message: 'Số liệu đã thay đổi.' } }) })
      .mockReturnValueOnce(unwrap())
    const view = render(<ReconciliationWorkspace owner="purchasing" />)

    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật số liệu' }))
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Theo hóa đơn đầu tiên' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))

    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [{ ...triggeredLine, purchasedQuantity: 13, purchasedVersion: 5 }] }]
    view.rerender(<ReconciliationWorkspace owner="purchasing" />)
    expect(screen.getByLabelText('Số lượng')).toHaveValue(13)
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Theo hóa đơn mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(setActual).toHaveBeenLastCalledWith({ lineId: 'line-1', side: 'purchased', quantity: 13, confirmZero: false, expectedVersion: 5, correctionReason: 'Theo hóa đơn mới' }))
  })

  it('recovers a disposition correction after conflict by hydrating the refreshed version', async () => {
    role = 'admin'
    const oldDisposition = { category: 'ACCEPTED_VARIANCE', reason: 'Lý do cũ', version: 2, disposedAt: '2026-08-25' }
    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [{ ...triggeredLine, disposition: oldDisposition }] }]
    setDisposition
      .mockReturnValueOnce({ unwrap: () => Promise.reject({ status: 409, data: { message: 'Kết luận đã thay đổi.' } }) })
      .mockReturnValueOnce(unwrap())
    const view = render(<ReconciliationWorkspace owner="reports" />)

    fireEvent.click(screen.getByRole('button', { name: 'Sửa xử lý' }))
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Lý do xung đột' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))

    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [{ ...triggeredLine, disposition: { ...oldDisposition, reason: 'Kết luận máy chủ', version: 4 } }] }]
    view.rerender(<ReconciliationWorkspace owner="reports" />)
    expect(screen.getByLabelText('Lý do')).toHaveValue('Kết luận máy chủ')
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Kết luận sau tải lại' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }))
    await waitFor(() => expect(setDisposition).toHaveBeenLastCalledWith({ lineId: 'line-1', category: 'ACCEPTED_VARIANCE', reason: 'Kết luận sau tải lại', expectedVersion: 4 }))
  })

  it('records and corrects a typed disposition before completion', async () => {
    role = 'admin'
    batches = [{ ...draft, status: 'IN_PROGRESS', lines: [triggeredLine] }]
    const view = render(<ReconciliationWorkspace owner="reports" />)
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý chênh lệch' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Nhóm xử lý' }))
    fireEvent.click(screen.getByRole('option', { name: 'Chấp nhận chênh lệch' }))
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
