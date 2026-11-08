import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WarehouseIssueDialog from './WarehouseIssueDialog'

const candidate = {
  materialRequestId: 'request-1',
  materialRequestCode: 'MR-001',
  requestDate: '2026-09-07',
  actionableLineCount: 1,
  actionableQuantity: 2,
  concurrencyVersion: 3,
  customerCode: 'ANV',
  customerName: 'An Vui',
  hasExistingPurchaseRequest: false,
  requestScope: 'FULLDAY',
  status: 'APPROVED',
}

describe('WarehouseIssueDialog', () => {
  it('preserves the validated issue command boundary after the closed dialog is lazy-loaded', () => {
    const onConfirm = vi.fn()

    render(
      <WarehouseIssueDialog
        open
        onOpenChange={vi.fn()}
        selectedMaterialRequestId="request-1"
        onMaterialRequestChange={vi.fn()}
        selectedIssueCandidate={candidate}
        issueCandidates={[candidate]}
        issueCandidatePageNumber={1}
        issueCandidatePageSize={8}
        issueCandidateTotalItems={1}
        onIssueCandidatePageChange={vi.fn()}
        isFetchingIssueCandidates={false}
        isIssueCandidateError={false}
        warehouseName="Kho chính"
        selectedWarehouseId="warehouse-1"
        allocation={{ lines: [{ materialRequestLineId: 'line-1', ingredientId: 'ingredient-1', unitId: 'unit-1', requestedQty: 2, issuedQty: 2 }], remainingLineCount: 1, fullyCoveredLineCount: 1 }}
        isAllocationSourceError={false}
        isIssueAllocationRefreshing={false}
        isCreatingIssue={false}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Tạo phiếu xuất kho' })).toBeInTheDocument()
    expect(screen.getByText('Kho có thể xuất 1/1 nhóm nguyên liệu còn lại; 1 nhóm đủ toàn bộ số lượng.')).toBeInTheDocument()
    expect(screen.getByText('An Vui (ANV)')).toBeVisible()
    expect(screen.getByText('07/09/2026 · Cả ngày')).toBeVisible()
    expect(screen.getByText('MR-001')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất 1 dòng' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
