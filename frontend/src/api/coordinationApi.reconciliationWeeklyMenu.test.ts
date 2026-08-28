import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { coordinationApi } from './coordinationApi'

describe('reconciliation Weekly Menu read adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the selected customer and week only to the retained reconciliation route', async () => {
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
    let requestedUrl = ''
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requestedUrl = request.url
      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))
    const store = configureStore({
      reducer: {
        [coordinationApi.reducerPath]: coordinationApi.reducer,
        auth: (state = { token: null }) => state,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(coordinationApi.middleware),
    })

    await store.dispatch(coordinationApi.endpoints.getReconciliationWeeklyMenu.initiate({
      customerId: 'customer-1',
      weekStartDate: '2026-08-24',
    }))

    const url = new URL(requestedUrl)
    expect(url.pathname).toBe('/api/reconciliation/weekly-menu')
    expect(url.searchParams.get('customerId')).toBe('customer-1')
    expect(url.searchParams.get('weekStartDate')).toBe('2026-08-24')
  })
})
