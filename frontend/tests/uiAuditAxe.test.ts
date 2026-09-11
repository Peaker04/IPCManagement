import { describe, expect, it, vi } from 'vitest'
import { seriousViolationsWithBrowserPlaceholderEvidence } from './uiAuditAxe'

const contrastViolation = {
  id: 'color-contrast',
  impact: 'serious',
  nodes: [{ target: ['#field'] }],
}

const pageWithColorEvidence = (evidence: {
  hasPlaceholder: boolean
  textColor: string
  placeholderColor: string
}) => ({
  locator: vi.fn(() => ({
    evaluate: vi.fn().mockResolvedValue(evidence),
  })),
})

describe('seriousViolationsWithBrowserPlaceholderEvidence', () => {
  it('retains a serious contrast violation even when the placeholder uses a previously audited color', async () => {
    const page = pageWithColorEvidence({
      hasPlaceholder: true,
      textColor: 'rgb(15, 23, 42)',
      placeholderColor: 'rgb(71, 85, 105)',
    })

    const result = await seriousViolationsWithBrowserPlaceholderEvidence(page as never, [contrastViolation])

    expect(result).toEqual([contrastViolation])
  })

  it('retains a serious contrast violation when text and placeholder colors merely differ', async () => {
    const page = pageWithColorEvidence({
      hasPlaceholder: false,
      textColor: 'rgb(148, 163, 184)',
      placeholderColor: 'rgb(100, 116, 139)',
    })

    const result = await seriousViolationsWithBrowserPlaceholderEvidence(page as never, [contrastViolation])

    expect(result).toEqual([contrastViolation])
  })
})
