import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    { batchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'Kilogram', requiredQuantity: 13.3344, issuedQuantity: 13.3344 as number | null, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 },
    { batchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Đậu xanh', canonicalUnitId: 'unit-1', canonicalUnitName: 'Kilogram', requiredQuantity: 2.1234567, issuedQuantity: null, frozenTolerance: 0, triggers: [], status: 'PENDING', version: 1 },
  ],
}
const issue = {
  issueId: 'issue-1', issueCode: 'ISS-001', sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: 'batch-1',
  issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', receivedAt: null, issuedBy: 'actor-1', issuedByName: 'Thủ kho', warehouseId: 'warehouse-1', warehouseName: 'Kho chính',
  lines: Array.from({ length: 67 }, (_, index) => ({ issueLineId: `issue-line-${index + 1}`, reconciliationBatchLineId: `batch-line-${index + 1}`, ingredientId: `ingredient-${index + 1}`, ingredientName: `Nguyên liệu ${index + 1}`, unitId: 'unit-1', unitName: 'kg', requestedQty: index + 1, issuedQty: index + 1 })),
}
const createIssue = vi.fn()
const batchRefetch = vi.fn()
const historyRefetch = vi.fn()
const batchQueryState = { phase: 'ready' as 'ready' | 'loading' | 'error' }
const historyQueryState = { phase: 'ready' as 'ready' | 'loading' | 'error' }
const createMutationState = { loading: false }
const roleState = { allowed: true }
const ready = <T,>(data: T, refetch = vi.fn()) => ({ data, currentData: data, isLoading: false, isFetching: false, isError: false, refetch })
const uninitialized = () => ({ data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })

vi.mock('@/lib/useHasRole', () => ({ useHasRole: () => roleState.allowed }))
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
  useGetReconciliationBatchQuery: (id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : batchQueryState.phase === 'loading'
    ? { data: undefined, currentData: undefined, isLoading: true, isFetching: true, isError: false, refetch: batchRefetch }
    : batchQueryState.phase === 'error'
      ? { data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: true, refetch: batchRefetch }
      : ready(id === batch.batchId ? batch : undefined, batchRefetch),
  useListReconciliationIssueHistoryQuery: (_id: string, options: { skip?: boolean }) => options.skip ? uninitialized() : historyQueryState.phase === 'loading'
    ? { data: undefined, currentData: undefined, isLoading: true, isFetching: true, isError: false, refetch: historyRefetch }
    : historyQueryState.phase === 'error'
      ? { data: undefined, currentData: undefined, isLoading: false, isFetching: false, isError: true, refetch: historyRefetch }
      : ready({ items: [issue], totalCount: 1 }, historyRefetch),
  useCreateReconciliationIssueMutation: () => [createIssue, { isLoading: createMutationState.loading }],
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
  beforeEach(() => {
    dialogProps.length = 0
    vi.clearAllMocks()
    batchQueryState.phase = 'ready'
    historyQueryState.phase = 'ready'
    createMutationState.loading = false
    roleState.allowed = true
    batch.status = 'IN_PROGRESS'
    batch.version = 1
    batch.lines[0].issuedQuantity = 13.3344
    batch.lines[1].issuedQuantity = null
    createIssue.mockReturnValue({ unwrap: () => Promise.resolve({ issueId: 'created-1' }) })
    batchRefetch.mockResolvedValue({ data: batch })
  })

  it('renders an owned loading state instead of an empty demand table while the selected batch loads', () => {
    batchQueryState.phase = 'loading'
    renderPage('/warehouse?view=demand&batchId=batch-1')

    expect(screen.getByText(/Đang tải lô đối chiếu đã chọn/)).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('table', { name: 'Danh sách nguyên liệu cần xuất' })).not.toBeInTheDocument()
  })

  it('renders invalid batch recovery instead of a false empty demand table', () => {
    renderPage('/warehouse?view=demand&batchId=batch-missing')

    expect(screen.getByText('Không tìm thấy lô đối chiếu đã chọn')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở Định lượng xuất kho' })).toHaveAttribute('href', '/weekly-menu?view=demand')
    expect(screen.queryByRole('table', { name: 'Danh sách nguyên liệu cần xuất' })).not.toBeInTheDocument()
  })

  it('renders an owned batch error with retry instead of a false empty demand table', () => {
    batchQueryState.phase = 'error'
    renderPage('/warehouse?view=demand&batchId=batch-1')

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được lô đối chiếu đã chọn')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại tải lô' }))
    expect(batchRefetch).toHaveBeenCalledOnce()
    expect(screen.queryByRole('table', { name: 'Danh sách nguyên liệu cần xuất' })).not.toBeInTheDocument()
  })

  it('keeps history failure retryable without rendering a false empty result', () => {
    historyQueryState.phase = 'error'
    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được lịch sử xuất kho')
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại lịch sử' }))
    expect(historyRefetch).toHaveBeenCalledOnce()
    expect(screen.queryByText('Chưa có phiếu xuất kho liên kết.')).not.toBeInTheDocument()
  })

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

  it('hides initial and supplemental issue controls from a denied route reader', () => {
    roleState.allowed = false
    renderPage('/warehouse?view=demand&batchId=batch-1')

    expect(screen.queryByRole('button', { name: 'Tạo phiếu xuất bổ sung' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /Thực xuất/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Thủ kho hoặc Quản lý cần tạo phiếu xuất/)).toBeInTheDocument()

    batch.status = 'TRANSFERRED'
    batch.lines[0].issuedQuantity = null
    const view = renderPage('/warehouse?view=demand&batchId=batch-1')
    expect(screen.queryByRole('button', { name: /Xác nhận và tạo phiếu xuất/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /Thực xuất/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Lý do xuất vượt/)).not.toBeInTheDocument()
    expect(view.container).toHaveTextContent('Thủ kho hoặc Quản lý cần tạo phiếu xuất')
  })

  it('disables duplicate initial submission while issue creation is pending', () => {
    batch.status = 'TRANSFERRED'
    batch.lines[0].issuedQuantity = null
    createMutationState.loading = true
    renderPage('/warehouse?view=demand&batchId=batch-1')

    expect(screen.getByRole('button', { name: 'Đang xác nhận xuất...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Điền đủ toàn bộ' })).toBeDisabled()
  })

  it('creates the initial issue with exact batch lineage and moves to history after refetch', async () => {
    batch.status = 'TRANSFERRED'
    batch.version = 7
    batch.lines[0].issuedQuantity = null
    renderPage('/warehouse?view=demand&batchId=batch-1')

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và tạo phiếu xuất (2)' }))

    await waitFor(() => expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      commandId: 'reconciliation-issue-batch-1',
      expectedVersion: 7,
      warehouseId: 'warehouse-1',
      reconciliationBatchId: 'batch-1',
      lines: [
        expect.objectContaining({ reconciliationBatchLineId: 'batch-line-1', issuedQty: 13.3344 }),
        expect.objectContaining({ reconciliationBatchLineId: 'batch-line-2', issuedQty: 2.1234567 }),
      ],
    })))
    expect(batchRefetch).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Đã tạo phiếu xuất kho từ đúng lô đối chiếu/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=movement&batchId=batch-1'))
  })

  it('keeps initial issue failure in the demand owner and does not refetch or navigate', async () => {
    batch.status = 'TRANSFERRED'
    batch.lines[0].issuedQuantity = null
    createIssue.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Phiên bản lô đã thay đổi.' } }) })
    renderPage('/warehouse?view=demand&batchId=batch-1')

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và tạo phiếu xuất (2)' }))

    expect(await screen.findByText('Phiên bản lô đã thay đổi.')).toBeInTheDocument()
    expect(batchRefetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=demand&batchId=batch-1')
  })

  it('presents supplemental issue as a secondary consequence-aware action', () => {
    renderPage('/warehouse?view=demand&batchId=batch-1')

    const trigger = screen.getByRole('button', { name: 'Tạo phiếu xuất bổ sung' })
    expect(trigger).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByText(/có thể tạo chênh lệch/)).toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Xuất thêm nguyên liệu' })).toHaveTextContent('Số xuất thêm sẽ được cộng vào tổng đã xuất và có thể tạo chênh lệch cần xử lý.')
  })

  it('creates one supplemental issue with frozen-line lineage and keeps the batch context', async () => {
    renderPage('/warehouse?view=demand&batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu xuất bổ sung' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Chọn nguyên liệu xuất thêm' }))
    fireEvent.click(screen.getByRole('option', { name: 'Gạo' }))
    fireEvent.change(screen.getByLabelText('Số lượng xuất thêm'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Bếp đề nghị bổ sung cho ca trưa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất thêm' }))

    await waitFor(() => expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      commandId: expect.stringMatching(/^reconciliation-supplemental-/),
      expectedVersion: 1,
      warehouseId: 'warehouse-1',
      reconciliationBatchId: 'batch-1',
      isSupplemental: true,
      lines: [expect.objectContaining({ reconciliationBatchLineId: 'batch-line-1', requestedQty: 1.5, issuedQty: 1.5, varianceReason: 'Bếp đề nghị bổ sung cho ca trưa' })],
    })))
    expect(batchRefetch).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Đã tạo phiếu xuất thêm/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Xuất thêm nguyên liệu' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/warehouse?view=demand&batchId=batch-1')
  })

  it('keeps supplemental failure and entered values in the active dialog', async () => {
    createIssue.mockReturnValue({ unwrap: () => Promise.reject({ data: { message: 'Phiên bản lô đã thay đổi.' } }) })
    renderPage('/warehouse?view=demand&batchId=batch-1')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu xuất bổ sung' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Chọn nguyên liệu xuất thêm' }))
    fireEvent.click(screen.getByRole('option', { name: 'Gạo' }))
    fireEvent.change(screen.getByLabelText('Số lượng xuất thêm'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Bếp đề nghị bổ sung cho ca trưa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất thêm' }))

    expect(await screen.findByText('Phiên bản lô đã thay đổi.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Xuất thêm nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByLabelText('Số lượng xuất thêm')).toHaveValue(1.5)
    expect(screen.getByLabelText('Lý do')).toHaveValue('Bếp đề nghị bổ sung cho ca trưa')
    expect(batchRefetch).not.toHaveBeenCalled()
  })

  it('navigates only from the drawer explicit open-batch action with exact batch and issue context', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở lô đối chiếu' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/reconciliation?batchId=batch-1&issueId=issue-1')
  })
})
