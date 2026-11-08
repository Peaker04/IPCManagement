import { describe, expect, it } from 'vitest'
import { compareIssueQuantity, issueQuantityDifference } from './reconciliationIssueQuantity'

describe('reconciliation issue quantity comparison', () => {
  it.each([
    [13.3344, 13.3344, 'exact'],
    [13.334, 13.3344, 'under'],
    [13.335, 13.3344, 'over'],
    [106.6656, 106.6656, 'exact'],
    [106.666, 106.6656, 'over'],
    [12.8, 12.8, 'exact'],
  ] as const)('classifies entered %s against required %s as %s', (entered, required, expected) => {
    expect(compareIssueQuantity(entered, required)).toBe(expected)
  })

  it('uses the shared six-decimal tolerance for near-zero differences', () => {
    expect(compareIssueQuantity(1.0000004, 1)).toBe('exact')
    expect(issueQuantityDifference(1.0000004, 1)).toBe(0)
  })

  it.each([Number.NaN, 0, -1])('rejects invalid issued quantity %s', (quantity) => {
    expect(compareIssueQuantity(quantity, 1)).toBe('invalid')
  })
})
