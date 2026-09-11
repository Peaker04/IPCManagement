import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildWarehousePageHeader } from '@/features/warehouse/pages/WarehousePageHeader'

const primarySelector = '.ipc-button-primary, .ipc-button-success, .ipc-button-warning, [data-variant="default"], [data-variant="success"], [data-variant="warning"]'

describe('CommandBar action hierarchy', () => {
  it('exposes exactly one primary action in the mounted Warehouse command context', () => {
    const header = buildWarehousePageHeader({
      warehouseName: 'Kho mẫu',
      canCreateIssue: true,
      isFetchingIssueCandidates: false,
      onOpenIssueDialog: () => undefined,
      receiptCountLabel: '0',
      issueCountLabel: '0',
      stockCountLabel: '0',
      shortageLabel: 'Không có',
      kitchenReceiptLabel: 'Không còn chờ ký',
      workflowDocumentError: false,
      currentStockError: false,
      hasCurrentStock: true,
      demandError: false,
      hasShortage: false,
      kitchenIssueError: false,
      hasPendingKitchenReceipt: false,
    })
    const { container } = render(<MemoryRouter>{header.command}</MemoryRouter>)
    expect(container.querySelectorAll(`.ipc-command-bar-actions ${primarySelector}`)).toHaveLength(1)
  })
})
