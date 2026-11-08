import { describe, expect, it } from 'vitest'
import { mapAuditChange as mapCanonicalAuditChange } from '@/api/reportsApiMappers'
import { mapAuditChange } from '@/api/reportsApiMappers'

describe('reports mapper compatibility facade', () => {
  it('re-exports the canonical shared mapper instead of maintaining a duplicate implementation', () => {
    expect(mapAuditChange).toBe(mapCanonicalAuditChange)
  })
})
