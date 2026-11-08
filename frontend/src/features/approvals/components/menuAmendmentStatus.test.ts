import { describe, expect, it } from 'vitest'
import source from './MenuAmendmentInbox.tsx?raw'

describe('menu amendment backend status parity', () => {
  it('uses the exact review lifecycle statuses returned by MenuAmendmentService', () => {
    expect(source).toContain('APPROVED_FOR_EXECUTION')
    expect(source).toContain('CORRECTION_REQUIRED')
    expect(source).toContain('RATIFIED_RECONCILIATION_REQUIRED')
    expect(source).not.toContain("item.status === 'APPROVED'")
  })
})
