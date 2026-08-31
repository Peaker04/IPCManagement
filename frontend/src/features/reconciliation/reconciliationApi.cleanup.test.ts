import { configureStore } from '@reduxjs/toolkit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import { warehouseApi } from '@/api/warehouseApi'
import authReducer from '@/lib/auth/authSlice'
import { clearReconciliationApiResidue, reconciliationApi } from './reconciliationApi'

const createTestStore = () => configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
  preloadedState: {
    auth: {
      user: {
        id: 'user-1',
        username: 'operator',
        fullName: 'Operator',
        role: 'admin' as const,
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isAdminFullAccess: true,
        permissions: ['*'],
      },
      token: 'cleanup-token',
      isAuthenticated: true,
      isLoading: false,
    },
  },
})

const jsonResponse = (data: unknown) => new Response(
  JSON.stringify({ success: true, data }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

describe('reconciliation API residue cleanup', () => {
  beforeEach(() => {
    window.localStorage.clear()
    const NativeRequest = globalThis.Request
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('aborts and removes only reconciliation-owned queries and mutations', () => {
    const queryAbort = vi.fn()
    const oldQueryAbort = vi.fn()
    const mutationAbort = vi.fn()
    const unrelatedMutationAbort = vi.fn()
    const dispatched: Array<{ type?: string; payload?: unknown }> = []
    let thunkCalls = 0

    const dispatch = vi.fn((action: unknown) => {
      if (typeof action === 'function') {
        thunkCalls += 1
        if (thunkCalls === 1) {
          return { endpointName: 'listReconciliationBatches', abort: queryAbort }
        }
        if (thunkCalls === 2) {
          return { endpointName: 'getReconciliationWeeklyMenu', abort: oldQueryAbort }
        }
        if (thunkCalls === 3) {
          return { endpointName: 'setReconciliationDisposition', abort: mutationAbort }
        }
        return undefined
      }
      dispatched.push(action as { type?: string; payload?: unknown })
      return action
    })

    clearReconciliationApiResidue(dispatch, {
      [apiSlice.reducerPath]: {
        queries: {
          'owned-list': { endpointName: 'listReconciliationBatches', originalArgs: undefined },
          'owned-weekly-menu': { endpointName: 'getReconciliationWeeklyMenu', originalArgs: { customerId: 'customer-1' } },
          'shared-selector': { endpointName: 'getWarehouseSelector', originalArgs: undefined },
        },
        mutations: {
          'owned-mutation': { endpointName: 'setReconciliationDisposition', requestId: 'owned-mutation' },
          'shared-mutation': { endpointName: 'recordWarehousePurchaseReceipt', requestId: 'shared-mutation' },
        },
      },
    })

    expect(queryAbort).toHaveBeenCalledOnce()
    expect(oldQueryAbort).toHaveBeenCalledOnce()
    expect(mutationAbort).toHaveBeenCalledOnce()
    expect(unrelatedMutationAbort).not.toHaveBeenCalled()
    expect(dispatched).toEqual([
      expect.objectContaining({ type: expect.stringContaining('/removeQueryResult'), payload: { queryCacheKey: 'owned-list' } }),
      expect.objectContaining({ type: expect.stringContaining('/removeQueryResult'), payload: { queryCacheKey: 'owned-weekly-menu' } }),
      expect.objectContaining({ type: expect.stringContaining('/removeMutationResult'), payload: { requestId: 'owned-mutation', fixedCacheKey: undefined } }),
    ])
  })

  it('prevents deferred reconciliation responses from repopulating removed cache or mutation residue', async () => {
    const store = createTestStore()
    const held = new Map<string, { aborted: boolean; release: () => void }>()

    vi.stubGlobal('fetch', vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === '/api/warehouses/selector') {
        return Promise.resolve(jsonResponse([]))
      }
      if (url.pathname === '/api/reconciliation/batches' && request.method === 'GET') {
        return new Promise<Response>((resolve, reject) => {
          let settled = false
          const abort = () => {
            if (settled) return
            settled = true
            held.set('list', { aborted: true, release: () => undefined })
            reject(new DOMException('Aborted', 'AbortError'))
          }
          request.signal.addEventListener('abort', abort, { once: true })
          held.set('list', {
            aborted: false,
            release: () => {
              if (settled) return
              settled = true
              request.signal.removeEventListener('abort', abort)
              resolve(jsonResponse([]))
            },
          })
        })
      }
      if (url.pathname === '/api/reconciliation/lines/line-1/disposition' && request.method === 'PUT') {
        return new Promise<Response>((resolve, reject) => {
          let settled = false
          const abort = () => {
            if (settled) return
            settled = true
            held.set('mutation', { aborted: true, release: () => undefined })
            reject(new DOMException('Aborted', 'AbortError'))
          }
          request.signal.addEventListener('abort', abort, { once: true })
          held.set('mutation', {
            aborted: false,
            release: () => {
              if (settled) return
              settled = true
              request.signal.removeEventListener('abort', abort)
              resolve(jsonResponse(null))
            },
          })
        })
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`)
    }))

    const sharedSelector = store.dispatch(warehouseApi.endpoints.getWarehouseSelector.initiate())
    const batches = store.dispatch(reconciliationApi.endpoints.listReconciliationBatches.initiate())
    const disposition = store.dispatch(reconciliationApi.endpoints.setReconciliationDisposition.initiate({
      lineId: 'line-1',
      category: 'OTHER',
      reason: 'Giữ lại để kiểm thử',
      expectedVersion: 1,
    }))

    await sharedSelector
    await vi.waitFor(() => {
      const state = store.getState()[apiSlice.reducerPath]
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'listReconciliationBatches' && query.status === 'pending')).toBe(true)
      expect(Object.values(state.mutations).some((mutation) => mutation?.endpointName === 'setReconciliationDisposition' && mutation.status === 'pending')).toBe(true)
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'getWarehouseSelector' && query.status === 'fulfilled')).toBe(true)
    })

    clearReconciliationApiResidue(store.dispatch, store.getState())

    await vi.waitFor(() => {
      const state = store.getState()[apiSlice.reducerPath]
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'listReconciliationBatches')).toBe(false)
      expect(Object.values(state.mutations).some((mutation) => mutation?.endpointName === 'setReconciliationDisposition')).toBe(false)
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'getWarehouseSelector' && query.status === 'fulfilled')).toBe(true)
    })
    await vi.waitFor(() => {
      expect(held.get('list')?.aborted).toBe(true)
      expect(held.get('mutation')?.aborted).toBe(true)
    })

    held.get('list')?.release()
    held.get('mutation')?.release()
    await Promise.all([batches, disposition])

    await vi.waitFor(() => {
      const state = store.getState()[apiSlice.reducerPath]
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'listReconciliationBatches')).toBe(false)
      expect(Object.values(state.mutations).some((mutation) => mutation?.endpointName === 'setReconciliationDisposition')).toBe(false)
      expect(Object.values(state.queries).some((query) => query?.endpointName === 'getWarehouseSelector' && query.status === 'fulfilled')).toBe(true)
    })

    batches.unsubscribe()
    sharedSelector.unsubscribe()
    disposition.reset()
    store.dispatch(apiSlice.util.resetApiState())
  })
})
