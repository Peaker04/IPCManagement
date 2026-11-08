import { describe, expect, it } from 'vitest'
import { reconciliationApi, reconciliationOwnedMutationEndpointNames } from './reconciliationApi'

describe('MRX actual authority public surface', () => {
  it('does not expose legacy purchased or issued actual mutations', () => {
    expect(reconciliationApi.endpoints).not.toHaveProperty('setReconciliationActual')
    expect(reconciliationOwnedMutationEndpointNames).not.toContain('setReconciliationActual')
  })
})
