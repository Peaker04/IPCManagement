import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReconciliationBatchTable } from './ReconciliationBatchTable'
import type { ReconciliationBatch } from './reconciliationApi'

const mockBatches: ReconciliationBatch[] = [
  {
    batchId: 'batch-uuid-001-abcd',
    menuVersionId: 'menu-v1',
    quantityImportBatchId: 'import-001',
    status: 'DRAFT',
    version: 1,
    createdAt: '2026-08-28T08:00:00Z',
    lines: [
      {
        batchLineId: 'line-1',
        ingredientId: 'ing-001',
        canonicalUnitId: 'unit-kg',
        requiredQuantity: 10,
        frozenTolerance: 0.5,
        purchasedQuantity: 10,
        purchasedVersion: 1,
        issuedQuantity: 10,
        issuedVersion: 1,
        purchasedRequiredDifference: 0,
        issuedRequiredDifference: 0,
        purchasedIssuedDifference: 0,
        triggers: [],
        status: 'MATCHED',
        version: 1,
        disposition: null,
      },
    ],
  },
  {
    batchId: 'batch-uuid-002-efgh',
    menuVersionId: 'menu-v1',
    quantityImportBatchId: 'import-002',
    status: 'READY',
    version: 1,
    createdAt: '2026-08-28T09:00:00Z',
    lines: [],
  },
  {
    batchId: 'batch-uuid-003-ijkl',
    menuVersionId: 'menu-v1',
    quantityImportBatchId: 'import-003',
    status: 'IN_PROGRESS',
    version: 1,
    createdAt: '2026-08-28T10:00:00Z',
    lines: [],
  },
  {
    batchId: 'batch-uuid-004-mnop',
    menuVersionId: 'menu-v1',
    quantityImportBatchId: 'import-004',
    status: 'COMPLETED',
    version: 1,
    createdAt: '2026-08-28T11:00:00Z',
    lines: [],
  },
]

describe('ReconciliationBatchTable', () => {
  it('renders canonical Vietnamese status badges instead of raw uppercase enums', () => {
    render(<ReconciliationBatchTable batches={mockBatches} onSelect={vi.fn()} />)

    // Verify canonical labels rendered
    expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument()
    expect(screen.getByText('Đang đối chiếu')).toBeInTheDocument()
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument()

    // Verify raw enums are NOT present
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument()
    expect(screen.queryByText('READY')).not.toBeInTheDocument()
    expect(screen.queryByText('IN_PROGRESS')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument()
  })

  it('renders copy button with accessible label and compact batch label', () => {
    render(<ReconciliationBatchTable batches={mockBatches} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sao chép mã lô batch-uuid-001-abcd' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sao chép mã lô batch-uuid-002-efgh' })).toBeInTheDocument()

    const link = screen.getByRole('button', { name: /Lô …001-abcd/ })
    expect(link).toHaveAttribute('title', 'Lô đối chiếu batch-uuid-001-abcd')
  })
})
