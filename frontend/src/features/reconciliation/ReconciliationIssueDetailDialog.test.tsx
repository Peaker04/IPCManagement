import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { issueQueryArgs, batchQueryArgs, queryState } = vi.hoisted(() => ({
  issueQueryArgs: [] as Array<{ id: string; skip?: boolean }>,
  batchQueryArgs: [] as Array<{ id: string; skip?: boolean }>,
  queryState: {
    issuePhase: 'ready' as 'ready' | 'loading' | 'error',
    batchPhase: 'ready' as 'ready' | 'loading' | 'error',
    issueBatchId: 'batch-1',
    missingBatchLineLinkage: false,
    issueRefetch: vi.fn(),
    batchRefetch: vi.fn(),
  },
}))

const issue = () => ({
  issueId: 'issue-1', issueCode: 'ISS-001', sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: queryState.issueBatchId,
  issueDate: '2026-09-05', createdAt: '2026-09-05T09:00:00Z', receivedAt: null, receivedBy: null, receivedByName: null,
  issuedBy: 'actor-1', issuedByName: 'Thủ kho', warehouseId: 'warehouse-1', warehouseName: 'Kho chính',
  lines: [{ issueLineId: 'issue-line-1', reconciliationBatchLineId: queryState.missingBatchLineLinkage ? null : 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: queryState.missingBatchLineLinkage ? null : 'Gạo', unitId: 'unit-1', unitName: queryState.missingBatchLineLinkage ? null : 'kg', requestedQty: 5, issuedQty: 5 }],
})
const batch = {
  batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-05T08:00:00Z',
  lines: [{ batchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo đông lạnh', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 5, issuedQuantity: 5, frozenTolerance: 0, triggers: [], status: 'MATCHED', version: 1 }],
}
const result = <T,>(phase: 'ready' | 'loading' | 'error', data: T, refetch: () => void) => ({
  data: phase === 'ready' ? data : undefined,
  currentData: phase === 'ready' ? data : undefined,
  isLoading: phase === 'loading',
  isFetching: phase === 'loading',
  isError: phase === 'error',
  refetch,
})

vi.mock('@/api/reconciliationApi', () => ({
  useGetReconciliationIssueQuery: (id: string, options: { skip?: boolean }) => {
    issueQueryArgs.push({ id, skip: options.skip })
    return result(queryState.issuePhase, issue(), queryState.issueRefetch)
  },
  useGetReconciliationBatchQuery: (id: string, options: { skip?: boolean }) => {
    batchQueryArgs.push({ id, skip: options.skip })
    return result(queryState.batchPhase, batch, queryState.batchRefetch)
  },
}))

import { ReconciliationIssueDetailDialog } from './ReconciliationIssueDetailDialog'

function FocusFixture() {
  const [open, setOpen] = useState(false)
  return <><button type="button" onClick={() => setOpen(true)}>Mở giao dịch</button><ReconciliationIssueDetailDialog issueId={open ? 'issue-1' : null} open={open} expectedBatchId="batch-1" onClose={() => setOpen(false)} /></>
}

describe('ReconciliationIssueDetailDialog behavior', () => {
  beforeEach(() => {
    issueQueryArgs.length = 0
    batchQueryArgs.length = 0
    queryState.issuePhase = 'ready'
    queryState.batchPhase = 'ready'
    queryState.issueBatchId = 'batch-1'
    queryState.missingBatchLineLinkage = false
    queryState.issueRefetch.mockReset()
    queryState.batchRefetch.mockReset()
  })

  it('does not mount the drawer or eagerly query while closed', () => {
    render(<ReconciliationIssueDetailDialog issueId={null} open={false} expectedBatchId="batch-1" onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(issueQueryArgs.at(-1)).toEqual({ id: '', skip: true })
    expect(batchQueryArgs.at(-1)).toEqual({ id: '', skip: true })
  })

  it('queries the exact issue, shows loading and retries an issue error', () => {
    queryState.issuePhase = 'loading'
    const view = render(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" onClose={vi.fn()} />)
    expect(issueQueryArgs.at(-1)).toEqual({ id: 'issue-1', skip: false })
    expect(screen.getByRole('status', { name: 'Đang tải chi tiết phiếu' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Đang tải các dòng giao dịch' })).toBeInTheDocument()

    queryState.issuePhase = 'error'
    view.rerender(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(queryState.issueRefetch).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the persisted issue belongs to another batch', () => {
    queryState.issueBatchId = 'batch-other'
    render(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" onClose={vi.fn()} />)

    expect(screen.getByText('Liên kết lô không khớp')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dòng giao dịch' })).not.toBeInTheDocument()
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument()
  })

  it('returns focus after Escape and exposes batch navigation only as an explicit action', async () => {
    const user = userEvent.setup()
    const onOpenBatch = vi.fn()
    const view = render(<FocusFixture />)
    const opener = screen.getByRole('button', { name: 'Mở giao dịch' })
    await user.click(opener)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(view.container).not.toHaveAttribute('inert')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())

    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(opener).toHaveFocus())

    view.rerender(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" onClose={vi.fn()} onOpenBatch={onOpenBatch} />)
    await user.click(screen.getByRole('button', { name: /Mở lô đối chiếu/ }))
    expect(onOpenBatch).toHaveBeenCalledWith('batch-1', 'issue-1')
  })

  it('uses only exact reconciliation batch-line lineage when issue display fields are absent', () => {
    queryState.missingBatchLineLinkage = true
    render(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" onClose={vi.fn()} />)

    expect(screen.getByText('Nguyên liệu chưa đặt tên')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('unit-1')).toBeInTheDocument()
    expect(screen.queryByText('Gạo đông lạnh')).not.toBeInTheDocument()
    expect(batchQueryArgs.at(-1)).toEqual({ id: 'batch-1', skip: false })
  })

  it('uses a non-modal bounded drawer, semantic line table, and list-known data while refreshing', () => {
    queryState.issuePhase = 'loading'
    render(<ReconciliationIssueDetailDialog issueId="issue-1" open expectedBatchId="batch-1" initialIssue={issue()} onClose={vi.fn()} />)

    const drawer = screen.getByRole('dialog', { name: 'Chi tiết giao dịch xuất kho đối chiếu' })
    expect(drawer).toHaveAttribute('data-surface', 'drawer')
    expect(drawer).toHaveAttribute('aria-modal', 'false')
    expect(drawer).toHaveClass('inset-y-0', 'max-w-3xl')
    expect(screen.getAllByText('ISS-001')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật dữ liệu chi tiết...')
    expect(screen.getByRole('region', { name: 'Các dòng giao dịch xuất kho' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByText('Xem mã dòng')).toBeInTheDocument()
    expect(batchQueryArgs.at(-1)).toEqual({ id: '', skip: true })
  })
})
