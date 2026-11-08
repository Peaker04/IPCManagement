import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { normalizeAuthorityLocation } from '@/lib/systemOperationLocation'

describe('SystemOperationProvider authority relocation', () => {
  it('relocates inaccessible reconciliation routes to a safe DEFAULT entry point', () => {
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.RECONCILIATION, '?batchId=batch-1')).toBe(ROUTES.DASHBOARD)
    expect(normalizeAuthorityLocation('MATERIAL_RECONCILIATION', ROUTES.REPORTS, '')).toBe(ROUTES.DASHBOARD)
  })

  it('strips reconciliation-only identity but preserves valid DEFAULT views', () => {
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WAREHOUSE, '?batchId=batch-1&view=demand')).toBe(`${ROUTES.WAREHOUSE}?view=demand`)
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WAREHOUSE, '?view=receiving')).toBeNull()
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WAREHOUSE, '?view=exceptions')).toBeNull()
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WAREHOUSE, '?view=invalid')).toBe(ROUTES.WAREHOUSE)
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WEEKLY_MENU, '?view=demand&customerId=customer-1&weekStartDate=2026-08-24')).toBeNull()
  })

  it('leaves eligible routes untouched when no reconciliation-only state remains', () => {
    expect(normalizeAuthorityLocation('DEFAULT', ROUTES.WAREHOUSE, '')).toBeNull()
    expect(normalizeAuthorityLocation('MATERIAL_RECONCILIATION', ROUTES.WAREHOUSE, '?batchId=batch-1&view=movement')).toBeNull()
  })
})
