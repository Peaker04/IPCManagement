import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import { store } from '@/app/store'
import { ROUTES } from '@/lib/routeConfig'
import { prefetchRouteData } from './routeDataPreloaders'

const jsonResponse = (data: unknown) => new Response(
  JSON.stringify({ success: true, data }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

describe('route data prefetch request ownership', () => {
  beforeEach(() => {
    store.dispatch(apiSlice.util.resetApiState())
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === 'string' && input.startsWith('/')
            ? 'http://localhost' + input
            : input,
          init,
        )
      }
    })
  })

  afterEach(() => {
    store.dispatch(apiSlice.util.resetApiState())
    vi.unstubAllGlobals()
  })

  it('does not repeat dashboard reads across pointer, focus, and touch intent events', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(async (request: Request) => {
      await pending
      const data = new URL(request.url).pathname.endsWith('/operational-kpis') ? {} : []
      return jsonResponse(data)
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      prefetchRouteData(ROUTES.DASHBOARD),
      prefetchRouteData(ROUTES.DASHBOARD),
      prefetchRouteData(ROUTES.DASHBOARD),
    ])

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    release()
  })
})
