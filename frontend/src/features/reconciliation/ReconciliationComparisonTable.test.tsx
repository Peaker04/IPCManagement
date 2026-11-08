import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
