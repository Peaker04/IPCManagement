import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { detailHook, batchHook } = vi.hoisted(() => ({ detailHook: vi.fn(), batchHook: vi.fn(() => ({ data: { batchId: 'batch-mxe08', lines: [] }, currentData: { batchId: 'batch-mxe08', lines: [] }, isFetching: false, isError: false, refetch: vi.fn() })) }))
vi.mock('@/api/reconciliationApi', () => ({ useGetReconciliationIssueQuery: detailHook, useGetReconciliationBatchQuery: batchHook }))

import { AuditIssueEventDialog } from './AuditIssueEventDialog'

const issue = {
  issueId: 'issue-mxe08',
  issueCode: 'ISS-MXE08',
  reconciliationBatchId: 'batch-mxe08',
  issueDate: '2026-09-05',
  createdAt: '2026-09-05T09:00:00Z',
  issuedByName: 'Thủ kho',
  warehouseName: 'Kho chính',
  lines: [
    { issueLineId: 'line-1', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'unit-kg', unitName: 'kg', requestedQty: 1.25, issuedQty: 1.25 },
    { issueLineId: 'line-2', reconciliationBatchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Sữa', unitId: 'unit-ml', unitName: 'ml', requestedQty: 900, issuedQty: 900 },
  ],
}

const resolved = { data: issue, currentData: issue, isLoading: false, isError: false }

describe('MXE-08 audit issue event detail', () => {
  beforeEach(() => detailHook.mockReset())

  it('does not request detail while closed', () => {
    detailHook.mockReturnValue({ data: undefined, currentData: undefined, isLoading: false, isError: false })
    render(<AuditIssueEventDialog open={false} eventId="issue-mxe08" expectedBatchId="batch-mxe08" onOpenChange={vi.fn()} />)
    expect(detailHook).toHaveBeenCalledWith('issue-mxe08', { skip: true })
  })

  it('shows exact per-line quantities without a cross-unit total and closes with Escape', () => {
    const onOpenChange = vi.fn()
    detailHook.mockReturnValue(resolved)
    render(<AuditIssueEventDialog open eventId="issue-mxe08" expectedBatchId="batch-mxe08" onOpenChange={onOpenChange} />)

    expect(detailHook).toHaveBeenCalledWith('issue-mxe08', { skip: false })
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.getByText('Sữa')).toBeInTheDocument()
    expect(screen.getByText(/^1,25 kg$/)).toBeInTheDocument()
    expect(screen.getByText(/^900 ml$/)).toBeInTheDocument()
    expect(screen.queryByText(/901[,.]25/)).not.toBeInTheDocument()
    expect(screen.getByText('Vai trò chưa được lưu')).toBeInTheDocument()
    expect(screen.getByText('issue-mxe08')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mở lô đối chiếu/ })).toHaveAttribute('href', '/reconciliation?batchId=batch-mxe08&issueId=issue-mxe08')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape')
  })

  it('returns focus to the opener after Escape', async () => {
    detailHook.mockReturnValue(resolved)
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>Mở sự kiện</button><AuditIssueEventDialog open={open} eventId="issue-mxe08" expectedBatchId="batch-mxe08" onOpenChange={setOpen} /></>
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Mở sự kiện' })
    opener.focus()
    fireEvent.click(opener)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('fails closed when issue identity or batch linkage does not match the audit event', () => {
    detailHook.mockReturnValue(resolved)
    render(<AuditIssueEventDialog open eventId="issue-mxe08" expectedBatchId="different-batch" onOpenChange={vi.fn()} />)
    expect(screen.getByText('Liên kết lô không khớp')).toBeInTheDocument()
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument()
  })
})
