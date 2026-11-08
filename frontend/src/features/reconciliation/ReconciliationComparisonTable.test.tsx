import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReconciliationComparisonTable } from './ReconciliationComparisonTable'

describe('ReconciliationComparisonTable ledger honesty', () => {
  it('does not fabricate a numeric variance before any linked issue exists', () => {
    render(<ReconciliationComparisonTable showAll lines={[{
      batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
      requiredQuantity: 10, issuedQuantity: null, issuedRequiredDifference: null, frozenTolerance: 0,
      triggers: [], status: 'INCOMPLETE', version: 1,
    }]} />)

    const row = screen.getByRole('row', { name: /Gạo/ })
    expect(within(row).getAllByText('Chưa xuất')).toHaveLength(2)
    expect(within(row).queryByText('-10 kg')).not.toBeInTheDocument()
  })

  it('renders "Đã xử lý" badge when a line has an existing disposition', () => {
    render(<ReconciliationComparisonTable showAll lines={[{
      batchLineId: 'line-2', ingredientId: 'ingredient-2', ingredientName: 'Bí đao', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
      requiredQuantity: 127.412, issuedQuantity: 128, issuedRequiredDifference: 0.588, frozenTolerance: 0.5,
      triggers: ['EXCEEDS_TOLERANCE'], status: 'NEEDS_REVIEW', version: 1,
      disposition: {
        category: 'ACCEPT_VARIANCE',
        reason: 'Chấp nhận sai số',
        version: 1,
        disposedAt: '2026-09-12T16:00:00Z',
      },
    }]} />)

    const row = screen.getByRole('row', { name: /Bí đao/ })
    expect(within(row).getByText('Đã xử lý')).toBeInTheDocument()
    expect(within(row).queryByText('Cần kiểm tra')).not.toBeInTheDocument()
  })

  it('uses one bounded action button that opens line detail', () => {
    const onDetail = vi.fn()
    render(<ReconciliationComparisonTable showAll onDetail={onDetail} lines={[{
      batchLineId: 'line-3', ingredientId: 'ingredient-3', ingredientName: 'Tôm', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
      requiredQuantity: 100, issuedQuantity: 101, issuedRequiredDifference: 1, frozenTolerance: 0.5,
      triggers: ['EXCEEDS_TOLERANCE'], status: 'NEEDS_REVIEW', version: 1,
      disposition: {
        category: 'ACCEPT_VARIANCE',
        reason: 'Chấp nhận sai số',
        version: 1,
        disposedAt: '2026-09-12T16:00:00Z',
      },
    }]} />)

    const row = screen.getByRole('row', { name: /Tôm/ })
    expect(screen.getByRole('columnheader', { name: 'Chi tiết' })).toHaveClass('w-28')
    const action = within(row).getByRole('button', { name: 'Thao tác' })
    expect(within(row).getAllByRole('button')).toHaveLength(1)
    action.click()
    expect(onDetail).toHaveBeenCalledWith(expect.objectContaining({ batchLineId: 'line-3' }))
  })

  it('keeps review rows neutral instead of painting the table as a warning surface', () => {
    render(<ReconciliationComparisonTable lines={[{
      batchLineId: 'line-4', ingredientId: 'ingredient-4', ingredientName: 'Cà rốt', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
      requiredQuantity: 10, issuedQuantity: 5, issuedRequiredDifference: -5, frozenTolerance: 0,
      triggers: ['UNDER_ISSUED'], status: 'NEEDS_REVIEW', version: 1,
    }]} />)

    const row = screen.getByRole('row', { name: /Cà rốt/ })
    expect(row).not.toHaveClass('bg-rose-50/25', 'bg-amber-50/25')
  })
})
