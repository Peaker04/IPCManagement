import { configureStore } from '@reduxjs/toolkit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from './apiSlice'
import authReducer, { setCredentials } from '@/lib/auth/authSlice'

const requestOwnershipApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRequestOwnershipProbe: builder.query<unknown, string>({
      query: (id) => '/request-ownership/' + id,
    }),
    updateRequestOwnershipProbe: builder.mutation<unknown, { id: string; value: number }>({
      query: (body) => ({
        url: '/request-ownership/' + body.id,
        method: 'PATCH',
        body,
      }),
    }),
  }),
  overrideExisting: false,
})

const createTestStore = () => configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
})

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
)

const user = {
  id: 'user-1',
  username: 'admin',
  fullName: 'Admin',
  role: 'admin' as const,
  roleCode: 'ADMIN',
  roleName: 'Admin',
  isAdminFullAccess: true,
  permissions: ['*'],
}

describe('API request ownership', () => {
  beforeEach(() => {
    localStorage.clear()
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
    vi.unstubAllGlobals()
  })

  it('coalesces concurrent subscribers for the same endpoint and cache key', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(async () => {
      await pending
      return jsonResponse({ success: true, data: { ok: true } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = createTestStore()

    const first = store.dispatch(requestOwnershipApi.endpoints.getRequestOwnershipProbe.initiate('same'))
    const second = store.dispatch(requestOwnershipApi.endpoints.getRequestOwnershipProbe.initiate('same'))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    release()
    await Promise.all([first, second])
  })

  it('coalesces an exact duplicate mutation while the first request is in flight', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.fn(async () => {
      await pending
      return jsonResponse({ success: true, data: { ok: true } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = createTestStore()
    const body = { id: 'same', value: 125 }

    const first = store.dispatch(requestOwnershipApi.endpoints.updateRequestOwnershipProbe.initiate(body))
    const second = store.dispatch(requestOwnershipApi.endpoints.updateRequestOwnershipProbe.initiate(body))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    release()
    await Promise.all([first, second])
  })

  it('keeps distinct or sequential mutations independent', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { ok: true } }))
    vi.stubGlobal('fetch', fetchMock)
    const store = createTestStore()

    await Promise.all([
      store.dispatch(requestOwnershipApi.endpoints.updateRequestOwnershipProbe.initiate({ id: 'same', value: 125 })),
      store.dispatch(requestOwnershipApi.endpoints.updateRequestOwnershipProbe.initiate({ id: 'same', value: 126 })),
    ])
    await store.dispatch(requestOwnershipApi.endpoints.updateRequestOwnershipProbe.initiate({ id: 'same', value: 125 }))

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not refresh twice when a late 401 belongs to the superseded access token', async () => {
    let releaseLate401!: () => void
    const late401 = new Promise<void>((resolve) => {
      releaseLate401 = resolve
    })
    let refreshCount = 0
    const attempts = new Map<string, number>()
    const fetchMock = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      const authorization = request.headers.get('authorization')

      if (path === '/api/auth/refresh') {
        refreshCount += 1
        return jsonResponse({
          success: true,
          data: {
            accessToken: 'fresh-token',
            user: {
              userId: user.id,
              username: user.username,
              fullName: user.fullName,
              roleCode: user.roleCode,
              roleName: user.roleName,
              isAdminFullAccess: true,
              permissions: user.permissions,
            },
          },
        })
      }

      attempts.set(path, (attempts.get(path) ?? 0) + 1)
      if (authorization === 'Bearer expired-token') {
        if (path.endsWith('/late')) await late401
        return jsonResponse({ success: false, message: 'expired' }, 401)
      }

      return jsonResponse({ success: true, data: { path } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = createTestStore()
    store.dispatch(setCredentials({ user, token: 'expired-token' }))

    const fast = store.dispatch(requestOwnershipApi.endpoints.getRequestOwnershipProbe.initiate('fast'))
    const late = store.dispatch(requestOwnershipApi.endpoints.getRequestOwnershipProbe.initiate('late'))

    await vi.waitFor(() => expect(refreshCount).toBe(1))
    releaseLate401()
    await Promise.all([fast, late])

    expect(refreshCount).toBe(1)
    expect(attempts.get('/api/request-ownership/fast')).toBe(2)
    expect(attempts.get('/api/request-ownership/late')).toBe(2)
  })
})
