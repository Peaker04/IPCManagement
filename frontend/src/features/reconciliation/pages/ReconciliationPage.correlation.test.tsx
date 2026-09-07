import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { issueState, listState } = vi.hoisted(() => ({
  issueState: { batchId: 'batch-1' },
  listState: { phase: 'ready' as 'ready' | 'loading' },
}))
const batch = {
  batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-05T08:00:00Z',
  lines: [
    { batchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'kg', canonicalUnitName: 'kg', requiredQuantity: 1.25, issuedQuantity: 1.25, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
    { batchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Sữa', canonicalUnitId: 'ml', canonicalUnitName: 'ml', requiredQuantity: 900, issuedQuantity: 900, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
  ],
}
const ready = <T,>(data: T) => ({ data, currentData: data, isLoading: false, isFetching: false, isError: false, isSuccess: true, isUninitialized: false, refetch: vi.fn() })
const loading = () => ({ data: undefined, currentData: undefined, isLoading: true, isFetching: true, isError: false, isSuccess: false, isUninitialized: false, refetch: vi.fn() })
const uninitialized = () => ({ data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: false, isSuccess: false, isUninitialized: true, refetch: vi.fn() })
vi.mock('@/api/reconciliationApi', () => ({
  useListReconciliationBatchesQuery: () => listState.phase === 'loading' ? loading() : ready([batch]),
  useGetReconciliationBatchQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready(batch),
  useGetReconciliationIssueQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready({
    issueId: 'issue-1', issueCode: 'ISS-001', sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: issueState.batchId,
    issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', receivedAt: null, issuedBy: 'actor-1', issuedByName: 'Thủ kho', warehouseId: 'warehouse-1',
    lines: [{ issueLineId: 'issue-line-1', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', requestedQty: 1.25, issuedQty: 1.25 }],
  }),
  useListReconciliationDispositionCategoriesQuery: () => ready([]),
  useSetReconciliationDispositionMutation: () => [vi.fn(), { isLoading: false }],
}))
vi.mock('../ReconciliationSourceChangeLog', () => ({ ReconciliationSourceChangeLog: ({ batchId }: { batchId: string }) => <div>Nhật ký nguồn lô {batchId}</div> }))
vi.mock('@/lib/navigationPreferences', () => ({ readReconciliationSelection: () => ({}), writeReconciliationSelection: vi.fn() }))

import ReconciliationPage from './ReconciliationPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

const renderPage = (url = '/reconciliation?batchId=batch-1&issueId=issue-1') => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/reconciliation" element={<><ReconciliationPage /><LocationProbe /></>} /></Routes></MemoryRouter>)

describe('MXE-09 reconciliation issue deep link', () => {
  beforeEach(() => {
    issueState.batchId = 'batch-1'
    listState.phase = 'ready'
  })

  it('restores exact issue context, keeps batch-scoped source history and returns to the batch', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Giao dịch ISS-001' })).toBeInTheDocument()
    expect(screen.getByText('issue-1')).toBeInTheDocument()
    expect(screen.getByTitle('issue-1')).toHaveClass('ipc-identifier-text')
    expect(screen.getByTitle('batch-1')).toHaveClass('ipc-identifier-text')
    expect(screen.getByText('Thủ kho')).toBeInTheDocument()
    expect(screen.getByText('Vai trò chưa được lưu')).toBeInTheDocument()
    expect(screen.getByText('Đã tạo phiếu')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký nguồn lô batch-1')).toBeInTheDocument()
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.queryByText('Sữa')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại toàn bộ lô' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/reconciliation?batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hiện tất cả (2)' }))
    expect(screen.getByText('Sữa')).toBeInTheDocument()
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

    const showAll = screen.getByRole('button', { name: 'Hiện tất cả (2)' })
    showAll.focus()
    fireEvent.click(showAll)
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByText('Sữa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chỉ hiện chênh lệch' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Chỉ hiện chênh lệch' }))
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument()
    expect(screen.queryByText('Sữa')).not.toBeInTheDocument()
    expect(screen.getByText('Không có dòng cần xử lý. Chọn “Hiện tất cả” để xem các dòng đã khớp.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hiện tất cả (2)' })).toHaveFocus()
  })

  it('fails closed instead of showing issue lines when the persisted batch linkage differs', () => {
    issueState.batchId = 'batch-other'
    renderPage()
    expect(screen.getByText('Liên kết giao dịch không khớp')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Giao dịch ISS-001' })).not.toBeInTheDocument()
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument()
    expect(screen.getByText('Nhật ký nguồn lô batch-1')).toBeInTheDocument()
  })
})
