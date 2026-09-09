import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dialogProps } = vi.hoisted(() => ({
  dialogProps: [] as Array<{
    issueId: string | null
    open?: boolean
    expectedBatchId?: string | null
    initialIssue?: typeof issue
    onClose: () => void
    onOpenBatch?: (batchId: string, issueId: string) => void
  }>,
}))

const batch = {
  batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-05T08:00:00Z',
  lines: [
    { batchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'Kilogram', requiredQuantity: 13.3344, issuedQuantity: 13.3344, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
    { batchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Đậu xanh', canonicalUnitId: 'unit-1', canonicalUnitName: 'Kilogram', requiredQuantity: 2.1234567, issuedQuantity: null, frozenTolerance: 0, triggers: [], status: 'PENDING', version: 1 },
  ],
}
const issue = {
  issueId: 'issue-1', issueCode: 'ISS-001', sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: 'batch-1',
  issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', receivedAt: null, issuedBy: 'actor-1', issuedByName: 'Thủ kho', warehouseId: 'warehouse-1', warehouseName: 'Kho chính',
  lines: Array.from({ length: 67 }, (_, index) => ({ issueLineId: `issue-line-${index + 1}`, reconciliationBatchLineId: `batch-line-${index + 1}`, ingredientId: `ingredient-${index + 1}`, ingredientName: `Nguyên liệu ${index + 1}`, unitId: 'unit-1', unitName: 'kg', requestedQty: index + 1, issuedQty: index + 1 })),
}
const ready = <T,>(data: T) => ({ data, currentData: data, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })
const uninitialized = () => ({ data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })

vi.mock('@/lib/systemOperationContext', () => ({
  useSystemOperation: () => ({ mode: 'MATERIAL_RECONCILIATION', capabilities: { pageTabs: { warehouse: ['demand', 'movement'] } } }),
}))
vi.mock('@/lib/navigationPreferences', () => ({
  readReconciliationSelection: () => ({}),
  writeReconciliationSelection: vi.fn(),
  visibleTabIds: () => ['demand', 'movement'],
}))
vi.mock('@/api/warehouseApi', () => ({
  useGetWarehouseSelectorQuery: () => ready([{ warehouseId: 'warehouse-1', warehouseName: 'Kho chính', isOperational: true }]),
}))
vi.mock('@/api/reconciliationApi', () => ({
  useListReconciliationBatchesQuery: () => ready([batch]),
  useGetReconciliationBatchQuery: (id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready(id === batch.batchId ? batch : undefined),
  useListReconciliationIssueHistoryQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : ready({ items: [issue], totalCount: 1 }),
  useCreateReconciliationIssueMutation: () => [vi.fn(), { isLoading: false }],
}))
vi.mock('@/components/reconciliation/ReconciliationIssueDetailDialog', () => ({
  ReconciliationIssueDetailDialog: (props: typeof dialogProps[number]) => {
    dialogProps.push(props)
    if (!props.open || !props.issueId) return null
    return <div role="dialog" aria-label="Chi tiết giao dịch xuất kho đối chiếu" data-surface="drawer"><span>{props.initialIssue?.issueCode}</span><button type="button" onClick={() => props.onOpenBatch?.(props.expectedBatchId!, props.issueId!)}>Mở lô đối chiếu</button><button type="button" onClick={props.onClose}>Đóng</button></div>
  },
}))

import ReconciliationWarehousePage from './ReconciliationWarehousePage'

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="location">{location.pathname}{location.search}</output><button type="button" onClick={() => navigate(-1)}>Browser Back</button></>
}

const renderPage = (entry = '/warehouse?view=movement&batchId=batch-1') => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/warehouse" element={<><ReconciliationWarehousePage /><LocationProbe /></>} /><Route path="/reconciliation" element={<LocationProbe />} /></Routes></MemoryRouter>)

describe('Warehouse reconciliation issue detail preserve-context behavior', () => {
  beforeEach(() => { dialogProps.length = 0 })

  it('opens one page-level issue dialog from the single row action without leaving the warehouse context', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: /\+64 mặt hàng khác/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }))

    expect(screen.getAllByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).toHaveLength(1)
    expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=movement&batchId=batch-1&issueId=issue-1')
    expect(dialogProps.at(-1)).toMatchObject({ issueId: 'issue-1', open: true, expectedBatchId: 'batch-1', initialIssue: expect.objectContaining({ issueCode: 'ISS-001', lines: expect.arrayContaining([expect.objectContaining({ issueLineId: 'issue-line-67' })]) }) })
  })

  it('restores the overlay drawer from the URL without participating in master layout', () => {
    renderPage('/warehouse?view=movement&batchId=batch-1&issueId=issue-1')

    expect(screen.getByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).toBeInTheDocument()
    expect(document.querySelector('.ipc-drawer-master')).not.toBeInTheDocument()
    expect(document.querySelector('[data-ipc-drawer-portal="true"]')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vòng đời lô đối chiếu' })).toContainElement(screen.getByRole('link', { name: 'Mở đối chiếu' }))
    expect(dialogProps.at(-1)).toMatchObject({ issueId: 'issue-1', initialIssue: expect.objectContaining({ issueCode: 'ISS-001' }) })
  })

  it('lets browser Back close the drawer without losing list context', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }))

    expect(screen.queryByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=movement&batchId=batch-1')
  })

  it('removes issueId on the drawer close control', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=movement&batchId=batch-1')
  })

  it('renders mixed committed quantities honestly with canonical units and six-decimal formatting', () => {
    renderPage('/warehouse?view=demand&batchId=batch-1')

    expect(screen.queryByRole('spinbutton', { name: 'Thực xuất Gạo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'Thực xuất Đậu xanh' })).not.toBeInTheDocument()
    expect(screen.getAllByText('13,3344 kg')).toHaveLength(2)
    expect(screen.getByText('2,123457 kg')).toBeInTheDocument()
    expect(screen.getByText('Chưa xuất')).toBeInTheDocument()
    expect(screen.queryByText('0 kg')).not.toBeInTheDocument()
    expect(screen.queryByText('Kilogram')).not.toBeInTheDocument()
    expect(screen.getAllByText('Không cần')).toHaveLength(2)
    screen.getAllByRole('columnheader').forEach((header) => expect(header).toHaveAttribute('scope', 'col'))
  })

  it('presents supplemental issue as a secondary consequence-aware action', () => {
    renderPage('/warehouse?view=demand&batchId=batch-1')

    const trigger = screen.getByRole('button', { name: 'Tạo phiếu xuất bổ sung' })
    expect(trigger).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByText(/có thể tạo chênh lệch/)).toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Xuất thêm nguyên liệu' })).toHaveTextContent('Số xuất thêm sẽ được cộng vào tổng đã xuất và có thể tạo chênh lệch cần xử lý.')
  })

  it('navigates only from the drawer explicit open-batch action with exact batch and issue context', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở lô đối chiếu' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/reconciliation?batchId=batch-1&issueId=issue-1')
  })
})
