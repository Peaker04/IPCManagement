import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { issueState, listState, completionState } = vi.hoisted(() => ({
  issueState: { batchId: 'batch-1' },
  listState: { phase: 'ready' as 'ready' | 'loading' },
  completionState: { allowed: true, shouldFail: false, refreshedVersion: 2, mutate: vi.fn(), unwrap: vi.fn(), refetch: vi.fn() },
}))
const batch = {
  batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-05T08:00:00Z',
  lines: [
    { batchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'kg', canonicalUnitName: 'kg', requiredQuantity: 1.25, issuedQuantity: 1.25, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
    { batchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Sữa', canonicalUnitId: 'ml', canonicalUnitName: 'ml', requiredQuantity: 900, issuedQuantity: 900, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
  ],
}
const ready = <T,>(data: T) => ({ data, currentData: data, isLoading: false, isFetching: false, isError: false, isSuccess: true, isUninitialized: false, refetch: completionState.refetch })
const loading = () => ({ data: undefined, currentData: undefined, isLoading: true, isFetching: true, isError: false, isSuccess: false, isUninitialized: false, refetch: vi.fn() })
const uninitialized = () => ({ data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: false, isSuccess: false, isUninitialized: true, refetch: vi.fn() })
vi.mock('@/api/reconciliationApi', async () => {
  const { useState } = await import('react')
  return {
    useListReconciliationBatchesQuery: () => listState.phase === 'loading' ? loading() : ready([batch]),
    useGetReconciliationBatchQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready(batch),
    useGetReconciliationIssueQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready({
      issueId: 'issue-1', issueCode: 'ISS-001', sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: issueState.batchId,
      issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', receivedAt: null, issuedBy: 'actor-1', issuedByName: 'Thủ kho', warehouseId: 'warehouse-1',
      lines: [{ issueLineId: 'issue-line-1', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', requestedQty: 1.25, issuedQty: 1.25 }],
    }),
    useListReconciliationDispositionCategoriesQuery: () => ready([]),
    useSetReconciliationDispositionMutation: () => [vi.fn(), { isLoading: false }],
    useCompleteReconciliationBatchMutation: () => {
      const [isLoading, setIsLoading] = useState(false)
      return [(args: unknown) => {
        completionState.mutate(args)
        setIsLoading(true)
        return { unwrap: async () => {
          try {
            return await completionState.unwrap()
          } finally {
            setIsLoading(false)
          }
        } }
      }, { isLoading }]
    },
  }
})
vi.mock('../ReconciliationSourceChangeLog', () => ({ ReconciliationSourceChangeLog: ({ batchId }: { batchId: string }) => <div>Nhật ký nguồn lô {batchId}</div> }))
vi.mock('../ReconciliationIssueDetailDialog', () => ({ ReconciliationIssueDetailDialog: ({ issueId, open, onClose }: { issueId: string | null; open: boolean; onClose: () => void }) => open ? <aside role="dialog" aria-label="Chi tiết giao dịch xuất kho đối chiếu"><span>{issueId}</span><button type="button" onClick={onClose}>Đóng</button></aside> : null }))
vi.mock('@/lib/navigationPreferences', () => ({ readReconciliationSelection: () => ({}), writeReconciliationSelection: vi.fn() }))
vi.mock('@/lib/useHasRole', () => ({ useHasRole: () => completionState.allowed }))

import ReconciliationPage from './ReconciliationPage'

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="location">{location.pathname}{location.search}</output><button type="button" onClick={() => navigate(-1)}>Browser Back</button></>
}

const renderPage = (url = '/reconciliation?batchId=batch-1&issueId=issue-1', initialEntries = [url]) => render(<MemoryRouter initialEntries={initialEntries}><Routes><Route path="/reconciliation" element={<><ReconciliationPage /><LocationProbe /></>} /></Routes></MemoryRouter>)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('MXE-09 reconciliation issue deep link', () => {
  beforeEach(() => {
    issueState.batchId = 'batch-1'
    listState.phase = 'ready'
    completionState.allowed = true
    completionState.shouldFail = false
    completionState.refreshedVersion = 2
    completionState.mutate.mockReset()
    completionState.unwrap.mockReset()
    completionState.unwrap.mockImplementation(() => completionState.shouldFail ? Promise.reject({ data: { message: 'Lô đã thay đổi.' } }) : Promise.resolve(batch))
    completionState.refetch.mockReset()
    completionState.refetch.mockResolvedValue({ data: { ...batch, version: completionState.refreshedVersion } })
  })

  it('restores issue detail in the canonical drawer without replacing the all-lot composition', () => {
    renderPage()

    expect(screen.getByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).toHaveTextContent('issue-1')
    expect(screen.getByRole('heading', { name: 'Đối chiếu theo nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByText('Nhật ký nguồn lô batch-1')).toBeInTheDocument()
    expect(screen.getByText('Sẵn sàng hoàn tất')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Kết quả đối chiếu nguyên liệu' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xem toàn bộ' }))
    expect(screen.getByRole('table', { name: 'Kết quả đối chiếu nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByText('Sữa')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/reconciliation?batchId=batch-1')
    expect(screen.getByRole('heading', { name: 'Đối chiếu theo nguyên liệu' })).toBeInTheDocument()
  })

  it('lets browser Back close the issue drawer while preserving the batch page', () => {
    renderPage('/reconciliation?batchId=batch-1&issueId=issue-1', ['/reconciliation?batchId=batch-1', '/reconciliation?batchId=batch-1&issueId=issue-1'])

    expect(screen.getByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }))
    expect(screen.queryByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/reconciliation?batchId=batch-1')
    expect(screen.getByRole('heading', { name: 'Đối chiếu theo nguyên liệu' })).toBeInTheDocument()
  })

  it('uses one visible state surface while the batch list is loading', () => {
    listState.phase = 'loading'
    const view = renderPage()

    expect(view.container.querySelectorAll('[data-query-geometry]')).toHaveLength(1)
    expect(screen.getByText('Đang tải danh sách lô đối chiếu')).toBeInTheDocument()
    expect(screen.queryByText('Chưa khởi tạo lô đối chiếu đã chọn')).not.toBeInTheDocument()
  })

  it('keeps the show-all toggle focused across short and full table states', () => {
    renderPage('/reconciliation?batchId=batch-1')

    const showAll = screen.getAllByRole('button', { name: 'Xem toàn bộ' })[0]
    showAll.focus()
    fireEvent.click(showAll)
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByText('Sữa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chỉ hiện chênh lệch' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Chỉ hiện chênh lệch' }))
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument()
    expect(screen.queryByText('Sữa')).not.toBeInTheDocument()
    expect(screen.getByText('Sẵn sàng hoàn tất')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Xem toàn bộ' })[0]).toHaveFocus()
  })

  it('completes an all-matched IN_PROGRESS batch only after explicit confirmation and refetches', async () => {
    renderPage('/reconciliation?batchId=batch-1')

    expect(screen.getByText(/Lô vẫn ở bước 4\/5/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    expect(screen.getByRole('dialog', { name: 'Hoàn tất đối chiếu?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tất' }))

    await waitFor(() => expect(completionState.mutate).toHaveBeenCalledWith({ id: 'batch-1', expectedVersion: 1 }))
    expect(completionState.refetch).toHaveBeenCalled()
  })

  it('shows the completion owner when an otherwise-ready actor lacks completion authority', () => {
    completionState.allowed = false
    renderPage('/reconciliation?batchId=batch-1')

    expect(screen.queryByRole('button', { name: 'Hoàn tất đối chiếu' })).not.toBeInTheDocument()
    expect(screen.getByText(/Quản trị hoặc Quản lý cần xác nhận/)).toBeInTheDocument()
  })

  it('keeps completion failure and stale-version recovery inside the active dialog', async () => {
    completionState.shouldFail = true
    renderPage('/reconciliation?batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    const dialog = screen.getByRole('dialog', { name: 'Hoàn tất đối chiếu?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Lô đã thay đổi.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    completionState.shouldFail = false
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải lại dữ liệu' }))
    await waitFor(() => expect(completionState.refetch).toHaveBeenCalledTimes(1))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' }))

    await waitFor(() => expect(completionState.mutate).toHaveBeenLastCalledWith({ id: 'batch-1', expectedVersion: 2 }))
  })

  it('clears completion failures on close and fresh reopen', async () => {
    completionState.shouldFail = true
    renderPage('/reconciliation?batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tất' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Lô đã thay đổi.')

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))

    expect(within(screen.getByRole('dialog', { name: 'Hoàn tất đối chiếu?' })).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('owns completion pending state by dialog session', async () => {
    const oldCompletion = deferred<typeof batch>()
    const newCompletion = deferred<typeof batch>()
    completionState.unwrap.mockReturnValueOnce(oldCompletion.promise).mockReturnValueOnce(newCompletion.promise)
    renderPage('/reconciliation?batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tất' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))

    const dialog = screen.getByRole('dialog', { name: 'Hoàn tất đối chiếu?' })
    expect(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' })).toBeEnabled()
    expect(within(dialog).queryByText('Đang hoàn tất...')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải lại dữ liệu' }))
    await waitFor(() => expect(completionState.refetch).toHaveBeenCalledTimes(1))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' }))
    await waitFor(() => expect(completionState.mutate).toHaveBeenLastCalledWith({ id: 'batch-1', expectedVersion: 2 }))

    await act(async () => {
      oldCompletion.resolve(batch)
      await oldCompletion.promise
    })

    expect(screen.getByRole('dialog', { name: 'Hoàn tất đối chiếu?' })).toBe(dialog)
    expect(within(dialog).getByRole('button', { name: 'Đang hoàn tất...' })).toBeDisabled()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => {
      newCompletion.resolve(batch)
      await newCompletion.promise
    })
  })

  it('ignores a rejected refresh from a closed completion dialog session', async () => {
    const oldRefresh = deferred<{ data: typeof batch }>()
    completionState.refetch.mockReturnValueOnce(oldRefresh.promise)
    renderPage('/reconciliation?batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất đối chiếu' }))

    await act(async () => {
      oldRefresh.reject(new Error('old refresh failed'))
      await oldRefresh.promise.catch(() => undefined)
    })

    const dialog = await screen.findByRole('dialog', { name: 'Hoàn tất đối chiếu?' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' })).toBeEnabled())
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tất' }))
    await waitFor(() => expect(completionState.mutate).toHaveBeenLastCalledWith({ id: 'batch-1', expectedVersion: 1 }))
  })

  it('leaves exact issue linkage validation to the canonical drawer and never filters the ledger by issue lines', () => {
    issueState.batchId = 'batch-other'
    renderPage()

    expect(screen.getByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Xem toàn bộ' })[0])
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByText('Sữa')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký nguồn lô batch-1')).toBeInTheDocument()
  })
})
