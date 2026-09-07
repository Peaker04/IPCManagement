import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReconciliationIssueHistoryTable } from './ReconciliationIssueHistoryTable'
import type { ReconciliationIssueHistoryItem } from '@/api/reconciliationApi'

const issue = (issueId: string, issueCode: string, lines: ReconciliationIssueHistoryItem['lines']): ReconciliationIssueHistoryItem => ({
  issueId,
  issueCode,
  sourceFamily: 'MATERIAL_RECONCILIATION',
  reconciliationBatchId: 'batch-1',
  issueDate: '2026-09-05',
  createdAt: '2026-09-05T09:00:00Z',
  receivedAt: null,
  issuedBy: 'actor-1',
  issuedByName: 'Thủ kho',
  warehouseId: 'warehouse-1',
  warehouseName: 'Kho chính',
  lines,
})

it('keeps exact issues as separate rows and presents mixed units per line without a fabricated total', () => {
  const onOpenIssue = vi.fn()
  render(<ReconciliationIssueHistoryTable issues={[
    issue('issue-1', 'ISS-001', [
      { issueLineId: 'issue-line-1', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', requestedQty: 1.25, issuedQty: 1.25 },
      { issueLineId: 'issue-line-2', reconciliationBatchLineId: 'batch-line-2', ingredientId: 'ingredient-2', ingredientName: 'Sữa', unitId: 'ml', unitName: 'ml', requestedQty: 900, issuedQty: 900 },
    ]),
    issue('issue-2', 'ISS-002', [
      { issueLineId: 'issue-line-3', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', requestedQty: 0.5, issuedQty: 0.5 },
    ]),
  ]} onOpenIssue={onOpenIssue} />)

  const rows = screen.getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText('ISS-001')).toBeInTheDocument()
  expect(within(rows[1]).getByText('ISS-002')).toBeInTheDocument()
  expect(rows[0]).toHaveTextContent('Gạo: 1,25 kg')
  expect(rows[0]).toHaveTextContent('Sữa: 900 ml')
  expect(screen.queryByText(/901[,.]25/)).not.toBeInTheDocument()
  expect(screen.getAllByText('Vai trò chưa được lưu')).toHaveLength(2)
  expect(screen.getAllByText('Thủ kho')).toHaveLength(2)

  fireEvent.click(within(rows[1]).getByRole('button', { name: 'Xem giao dịch' }))
  expect(onOpenIssue).toHaveBeenCalledWith('issue-2')
})
