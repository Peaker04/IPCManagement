import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconciliationWorkspace } from './ReconciliationWorkspace'
import type { ReconciliationBatch } from '@/api/reconciliationApi'

let batches: ReconciliationBatch[] = []
const refetch = vi.fn()
vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/reconciliationApi')>()),
  useListReconciliationBatchesQuery: () => ({ data: batches, isLoading: false, isError: false, refetch }),
  useSetReconciliationDispositionMutation: () => [vi.fn(), { isLoading: false }],
  useListReconciliationDispositionCategoriesQuery: () => ({ data: [], isLoading: false, isError: false, refetch }),
}))

beforeEach(() => { batches = []; vi.clearAllMocks() })

describe('route-owned ReconciliationWorkspace', () => {
  it('does not expose purchased or issued actual mutation controls', () => {
    batches = [{
      batchId: 'batch-1', menuVersionId: 'menu-1', quantityImportBatchId: 'import-1', status: 'TRANSFERRED', version: 2, createdAt: '2026-08-28',
      lines: [{ batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', ingredientCode: 'NL-01', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 10, issuedQuantity: 8, issuedRequiredDifference: -2, frozenTolerance: 0.1, triggers: ['ISSUED_REQUIRED'], status: 'NEEDS_REVIEW', version: 1 }],
    }]
    render(<ReconciliationWorkspace />)
    expect(screen.getByText('Gạo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cập nhật số liệu/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/đã mua/i)).not.toBeInTheDocument()
  })
})
