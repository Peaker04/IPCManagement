import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { coordinationApi } from './coordinationApi'

describe('menu amendment decision command adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the exact decision id in both path and command body', async () => {
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
    let requestBody: unknown
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requestBody = await request.json()
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const store = configureStore({
      reducer: { [coordinationApi.reducerPath]: coordinationApi.reducer, auth: (state = { token: null }) => state },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(coordinationApi.middleware),
    })

    await store.dispatch(coordinationApi.endpoints.executeMenuAmendmentDecision.initiate({
      decisionItemId: 'decision-1', action: 'APPEND_CORRECTION', commandId: 'command-1', expectedVersion: 0, reason: 'Đối soát',
    }))

    expect(requestBody).toMatchObject({ decisionItemId: 'decision-1', commandId: 'command-1' })
  })
})
