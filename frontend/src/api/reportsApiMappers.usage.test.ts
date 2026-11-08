import { describe, expect, it } from 'vitest'
import { mapUsageReport } from './reportsApiMappers'

describe('mapUsageReport', () => {
  it('uses the issue-line grain as the React row identity', () => {
    const row = mapUsageReport({
      issueLineId: 'line-2', issueId: 'issue-1', issueCode: 'PX-01', issueDate: '2026-09-17',
      ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'unit-1', unitName: 'kg',
      shiftName: 'MORNING', issuedQty: 10, returnedQty: 1, wastedQty: 0, usedQty: 9,
      varianceQty: 0, legacyUnattributedReturnLineCount: 0,
    })

    expect(row.id).toBe('line-2')
  })
})
