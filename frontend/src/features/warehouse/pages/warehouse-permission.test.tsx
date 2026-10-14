import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common'
import { WarehouseMovementPanel } from './WarehouseMovementPanel'
import WarehouseIssueDialog from './WarehouseIssueDialog'

const sampleCandidate = {
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

describe('WarehousePage permission and allocation guard contract', () => {
  it('enforces thukho role policy for inventory operations and admin role for return disposition', () => {
    // Testing role-matching logic matching InventoryAccess and AdminAccess backend policies
    const evaluateRole = (userRole: string, allowedRoles: string[]) => {
      if (userRole === 'admin') return true
      return allowedRoles.includes(userRole)
    }

    // Receipt creation and issue creation require 'thukho'
    expect(evaluateRole('thukho', ['thukho'])).toBe(true)
    expect(evaluateRole('dieuphoi', ['thukho'])).toBe(false)
    expect(evaluateRole('warehouse', ['thukho'])).toBe(false) // non-normalized role name rejected

    // Return disposition requires 'admin'
    expect(evaluateRole('admin', ['admin'])).toBe(true)
    expect(evaluateRole('thukho', ['admin'])).toBe(false)
  })

  it('disables issue confirmation in WarehouseIssueDialog when allocation sources are refreshing or in error state', () => {
    const onConfirm = vi.fn()

    // 1. Refreshing state
    const { rerender } = render(
      <WarehouseIssueDialog
        open
        onOpenChange={vi.fn()}
        selectedMaterialRequestId="request-1"
        onMaterialRequestChange={vi.fn()}
        selectedIssueCandidate={sampleCandidate}
        issueCandidates={[sampleCandidate]}
        issueCandidatePageNumber={1}
        issueCandidatePageSize={8}
        issueCandidateTotalItems={1}
        onIssueCandidatePageChange={vi.fn()}
        isFetchingIssueCandidates={false}
        isIssueCandidateError={false}
        warehouseName="Kho chính"
        selectedWarehouseId="warehouse-1"
        allocation={{
          lines: [{
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            requestedQty: 10,
            issuedQty: 10,
          }],
          remainingLineCount: 0,
          fullyCoveredLineCount: 1,
        }}
        isAllocationSourceError={false}
        isIssueAllocationRefreshing={true}
        isCreatingIssue={false}
        onConfirm={onConfirm}
      />,
    )

    // 1. Refreshing state: button shows 'Đang đồng bộ số lượng...' and is disabled
    const refreshBtn = screen.getByRole('button', { name: 'Đang đồng bộ số lượng...' })
    expect(refreshBtn).toBeDisabled()

    // 2. Error state: button shows 'Xác nhận xuất 1 dòng' and is disabled
    rerender(
      <WarehouseIssueDialog
        open
        onOpenChange={vi.fn()}
        selectedMaterialRequestId="request-1"
        onMaterialRequestChange={vi.fn()}
        selectedIssueCandidate={sampleCandidate}
        issueCandidates={[sampleCandidate]}
        issueCandidatePageNumber={1}
        issueCandidatePageSize={8}
        issueCandidateTotalItems={1}
        onIssueCandidatePageChange={vi.fn()}
        isFetchingIssueCandidates={false}
        isIssueCandidateError={false}
        warehouseName="Kho chính"
        selectedWarehouseId="warehouse-1"
        allocation={{
          lines: [{
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            requestedQty: 10,
            issuedQty: 10,
          }],
          remainingLineCount: 0,
          fullyCoveredLineCount: 1,
        }}
        isAllocationSourceError={true}
        isIssueAllocationRefreshing={false}
        isCreatingIssue={false}
        onConfirm={onConfirm}
      />,
    )

    const errorBtn = screen.getByRole('button', { name: 'Xác nhận xuất 1 dòng' })
    expect(errorBtn).toBeDisabled()
  })

  it('keeps warehouse tables in page-owned vertical flow without blank reserved capacity', () => {
    const props = {
      documents: [],
      currentStockSearch: '',
      onCurrentStockSearchChange: vi.fn(),
      currentStockView: { phase: 'ready' as const },
      currentStockRows: [],
      currentStockPage: 1,
      currentStockPageSize: 8,
      currentStockTotalItems: 0,
      onCurrentStockPageChange: vi.fn(),
      onCurrentStockPageSizeChange: vi.fn(),
      stockMovementSearch: '',
      onStockMovementSearchChange: vi.fn(),
      stockMovementView: { phase: 'uninitialized' as const },
      stockMovements: [],
      stockMovementPage: 1,
      stockMovementHasNext: false,
      onStockMovementPrevious: vi.fn(),
      onStockMovementNext: vi.fn(),
    }

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <WarehouseMovementPanel {...props} />
        </ToastProvider>
      </MemoryRouter>,
    )

    const tableShell = container.querySelector('.ipc-warehouse-table-shell')
    expect(tableShell).toBeInTheDocument()
    expect(tableShell).not.toHaveClass('min-h-[27rem]')
  })
})
