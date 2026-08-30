import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReconciliationComparisonTable } from './ReconciliationComparisonTable'
import type { ReconciliationLine } from './reconciliationApi'

const mockLines: ReconciliationLine[] = [
  {
    batchLineId: 'line-1',
    ingredientId: '00000000-0000-0000-0000-000000000001',
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
  {
    batchLineId: 'line-2',
    ingredientId: '00000000-0000-0000-0000-000000000002',
    canonicalUnitId: 'unit-kg',
    requiredQuantity: 15,
    frozenTolerance: 0.5,
    purchasedQuantity: 12,
    purchasedVersion: 1,
    issuedQuantity: 12,
    issuedVersion: 1,
    purchasedRequiredDifference: -3,
    issuedRequiredDifference: -3,
    purchasedIssuedDifference: 0,
    triggers: ['PURCHASED_REQUIRED'],
    status: 'NEEDS_REVIEW',
    version: 1,
    disposition: null,
  },
  {
    batchLineId: 'line-3',
    ingredientId: '00000000-0000-0000-0000-000000000003',
    canonicalUnitId: 'unit-kg',
    requiredQuantity: 20,
    frozenTolerance: 0.5,
    purchasedQuantity: null,
    purchasedVersion: null,
    issuedQuantity: null,
    issuedVersion: null,
    purchasedRequiredDifference: null,
    issuedRequiredDifference: null,
    purchasedIssuedDifference: null,
    triggers: [],
    status: 'INCOMPLETE',
    version: 1,
    disposition: null,
  },
]

describe('ReconciliationComparisonTable', () => {
  it('renders canonical status badges and filters matched lines when showAll is false', () => {
    const { rerender } = render(
      <ReconciliationComparisonTable
        lines={mockLines}
        showAll={false}
        onEdit={vi.fn()}
        onDisposition={vi.fn()}
      />
    )

    // In filtered view (showAll = false), MATCHED line is hidden
    expect(screen.queryByText('Khớp')).not.toBeInTheDocument()
    expect(screen.getByText('Cần kiểm tra')).toBeInTheDocument()
    expect(screen.getByText('Chưa đủ số liệu')).toBeInTheDocument()

    // When showAll = true, all lines are rendered
    rerender(
      <ReconciliationComparisonTable
        lines={mockLines}
        showAll={true}
        onEdit={vi.fn()}
        onDisposition={vi.fn()}
      />
    )
    expect(screen.getByText('Khớp')).toBeInTheDocument()
  })

  it('renders accessible labels on action buttons for line editing and disposition', () => {
    render(
      <ReconciliationComparisonTable
        lines={mockLines}
        showAll={true}
        onEdit={vi.fn()}
        onDisposition={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Cập nhật số liệu cho dòng …00000002' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xử lý chênh lệch cho dòng …00000002' })).toBeInTheDocument()
  })
})
