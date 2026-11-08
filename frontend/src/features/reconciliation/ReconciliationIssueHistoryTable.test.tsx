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
  expect(screen.queryByText('Vai trò chưa được lưu')).not.toBeInTheDocument()
  expect(screen.getAllByText('Thủ kho')).toHaveLength(2)

  fireEvent.click(within(rows[1]).getByRole('button', { name: 'Xem giao dịch' }))
  expect(onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: 'issue-2' }))
})

it('resolves ingredient name and unit name from batchLines when issue lines lack them', () => {
  const onOpenIssue = vi.fn()
  render(<ReconciliationIssueHistoryTable
    issues={[
      issue('issue-1', 'ISS-001', [
        { issueLineId: 'issue-line-1', reconciliationBatchLineId: 'batch-line-1', ingredientId: 'ingredient-1', ingredientName: null, unitId: 'unit-guid-1', unitName: null, requestedQty: 10, issuedQty: 10 },
      ]),
    ]}
    batchLines={[
      {
        batchLineId: 'batch-line-1',
        ingredientId: 'ingredient-1',
        ingredientCode: 'ING-01',
        ingredientName: 'Thịt heo xay',
        canonicalUnitId: 'unit-guid-1',
        canonicalUnitName: 'kg',
        requiredQuantity: 10,
        frozenTolerance: 0.1,
        status: 'MATCHED',
        triggers: [],
        version: 1,
      },
    ]}
    onOpenIssue={onOpenIssue}
  />)

  const rows = screen.getAllByRole('row').slice(1)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveTextContent('Thịt heo xay: 10 kg')
  expect(rows[0]).not.toHaveTextContent('Nguyên liệu chưa đặt tên')
  expect(rows[0]).not.toHaveTextContent('unit-guid-1')
})

it('keeps one detail trigger and a compact two-line preview per issue', () => {
  const onOpenIssue = vi.fn()
  render(<ReconciliationIssueHistoryTable
    issues={[
      issue('issue-1', 'ISS-001', [
        { issueLineId: 'line-1', reconciliationBatchLineId: 'b-1', ingredientId: 'i-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', requestedQty: 1, issuedQty: 1 },
        { issueLineId: 'line-2', reconciliationBatchLineId: 'b-2', ingredientId: 'i-2', ingredientName: 'Thịt bò', unitId: 'kg', unitName: 'kg', requestedQty: 2, issuedQty: 2 },
        { issueLineId: 'line-3', reconciliationBatchLineId: 'b-3', ingredientId: 'i-3', ingredientName: 'Cà rốt', unitId: 'kg', unitName: 'kg', requestedQty: 3, issuedQty: 3 },
        { issueLineId: 'line-4', reconciliationBatchLineId: 'b-4', ingredientId: 'i-4', ingredientName: 'Hành tây', unitId: 'kg', unitName: 'kg', requestedQty: 4, issuedQty: 4 },
        { issueLineId: 'line-5', reconciliationBatchLineId: 'b-5', ingredientId: 'i-5', ingredientName: 'Khoai tây', unitId: 'kg', unitName: 'kg', requestedQty: 5, issuedQty: 5 },
      ]),
    ]}
    onOpenIssue={onOpenIssue}
  />)

  const row = screen.getAllByRole('row')[1]
  expect(within(row).getByText('Gạo')).toBeInTheDocument()
  expect(within(row).getByText('Thịt bò')).toBeInTheDocument()
  expect(within(row).queryByText('Cà rốt')).not.toBeInTheDocument()
  expect(within(row).getByText('5')).toBeInTheDocument()
  expect(within(row).getByText('loại')).toBeInTheDocument()
  expect(row).toHaveTextContent('Gạo: 1 kg')
  expect(row).toHaveTextContent('+3 mặt hàng khác')
  expect(within(row).queryByRole('button', { name: /mặt hàng khác/ })).not.toBeInTheDocument()

  const action = within(row).getByRole('button', { name: 'Xem giao dịch' })
  expect(within(row).getAllByRole('button')).toEqual([action])
  fireEvent.click(action)
  expect(onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: 'issue-1' }))
})
