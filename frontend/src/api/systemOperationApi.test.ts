import { describe, expect, it } from 'vitest'
import source from './systemOperationApi.ts?raw'

describe('system operation authority cache lifecycle', () => {
  it('does not upsert the GET endpoint from its own fulfilled lifecycle', () => {
    const getEndpoint = source.slice(
      source.indexOf('getSystemOperationMode: builder.query'),
      source.indexOf('changeSystemOperationMode: builder.mutation'),
    )
    const mutationEndpoint = source.slice(source.indexOf('changeSystemOperationMode: builder.mutation'))

    expect(getEndpoint).toContain('publishAuthoritySnapshot(queryFulfilled)')
    expect(getEndpoint).not.toContain("upsertQueryData('getSystemOperationMode'")
    expect(mutationEndpoint).toContain('updateCachedAuthoritySnapshot(queryFulfilled, dispatch)')
  })
})
