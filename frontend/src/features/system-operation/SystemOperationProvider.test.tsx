import { configureStore } from '@reduxjs/toolkit'
import { render, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiSlice } from '@/api/apiSlice'
import { coordinationReducer } from '@/features/coordination'
import authReducer from '@/lib/auth/authSlice'
import { ROUTES } from '@/lib/routeConfig'
import { SystemOperationProvider } from './SystemOperationProvider'
import { authorityFromSnapshot, createSystemOperationAuthorityChannel } from './systemOperationAuthorityChannel'
import { useSystemOperation } from './systemOperationContext'
import type { SystemOperationSnapshot } from './systemOperationApi'

const mockAuthorityRuntime = vi.hoisted(() => {
  const snapshots = new Map<string, SystemOperationSnapshot>()
  const listeners = new Map<string, Set<(snapshot: SystemOperationSnapshot) => void>>()
  const refetchPlans = new Map<string, Array<() => Promise<SystemOperationSnapshot>>>()
  const refetchCounts = new Map<string, number>()

  return {
    reset() {
      snapshots.clear()
      listeners.clear()
      refetchPlans.clear()
      refetchCounts.clear()
    },
    primeSnapshot(token: string, snapshot: SystemOperationSnapshot) {
      snapshots.set(token, snapshot)
    },
    setSnapshot(token: string, snapshot: SystemOperationSnapshot) {
      snapshots.set(token, snapshot)
      listeners.get(token)?.forEach((listener) => listener(snapshot))
    },
    getSnapshot(token: string) {
      return snapshots.get(token) ?? null
    },
    subscribe(token: string, listener: (snapshot: SystemOperationSnapshot) => void) {
      const tokenListeners = listeners.get(token) ?? new Set<(snapshot: SystemOperationSnapshot) => void>()
      tokenListeners.add(listener)
      listeners.set(token, tokenListeners)
      const snapshot = snapshots.get(token)
      if (snapshot) listener(snapshot)
      return () => {
        tokenListeners.delete(listener)
      }
    },
    queueRefetch(token: string, plan: () => Promise<SystemOperationSnapshot>) {
      const queue = refetchPlans.get(token) ?? []
      queue.push(plan)
      refetchPlans.set(token, queue)
    },
    async refetch(token: string) {
      refetchCounts.set(token, (refetchCounts.get(token) ?? 0) + 1)
      const queue = refetchPlans.get(token) ?? []
      const plan = queue.shift()
      if (queue.length > 0) refetchPlans.set(token, queue)
      else refetchPlans.delete(token)
      const snapshot = plan ? await plan() : snapshots.get(token)
      if (!snapshot) throw new Error(`No snapshot prepared for ${token}`)
      listeners.get(token)?.forEach((listener) => listener(snapshot))
      return { data: snapshot }
    },
    getRefetchCount(token: string) {
      return refetchCounts.get(token) ?? 0
    },
  }
})

vi.mock('./systemOperationApi', async () => {
  const React = await import('react')
  const { useStore } = await import('react-redux')

  return {
    useGetSystemOperationModeQuery: () => {
      const store = useStore() as { getState(): { auth: { token: string | null } } }
      const token = store.getState().auth.token ?? 'anonymous'
      const [data, setData] = React.useState<SystemOperationSnapshot | null>(mockAuthorityRuntime.getSnapshot(token))

      React.useEffect(() => mockAuthorityRuntime.subscribe(token, setData), [token])
      const refetch = React.useCallback(() => mockAuthorityRuntime.refetch(token), [token])

      return {
        data,
        isLoading: !data,
        isError: false,
        refetch,
      }
    },
  }
})

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>()
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  private readonly name: string

  constructor(name: string) {
    this.name = name
    const peers = FakeBroadcastChannel.channels.get(name) ?? new Set<FakeBroadcastChannel>()
    peers.add(this)
    FakeBroadcastChannel.channels.set(name, peers)
  }

  postMessage(message: unknown) {
    for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data: message } as MessageEvent<unknown>)
    }
  }

  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this)
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const user = {
  id: 'user-1',
  username: 'operator',
  fullName: 'Operator',
  role: 'admin' as const,
  roleCode: 'ADMIN',
  roleName: 'Admin',
  isAdminFullAccess: true,
  permissions: ['*'],
}

const buildStore = (token: string) => configureStore({
  reducer: {
    auth: authReducer,
    coordination: coordinationReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }).concat(apiSlice.middleware),
  preloadedState: {
    auth: {
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    },
  },
})

const buildSnapshot = (mode: 'DEFAULT' | 'MATERIAL_RECONCILIATION', version: number): SystemOperationSnapshot => ({
  mode,
  label: mode === 'DEFAULT' ? 'Mặc định' : 'Đối chiếu nguyên liệu',
  version,
  updatedAt: `2026-08-30T00:00:0${version}Z`,
  reasonRequired: false,
  capabilities: mode === 'DEFAULT'
    ? {
        navigation: ['dashboard', 'weekly-menu', 'meal-orders', 'approvals', 'purchasing', 'warehouse', 'chef-dashboard', 'reports', 'admin-data', 'approval-rules'],
        pageTabs: {
          'weekly-menu': ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'],
          warehouse: ['movement', 'demand', 'exceptions'],
          'admin-data': ['bom-import', 'contracts', 'cleanup', 'inventory', 'statistics', 'audit', 'employees'],
        },
      }
    : {
        navigation: ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'],
        pageTabs: {
          'weekly-menu': ['schedule', 'material-demand'],
          warehouse: ['demand', 'movement'],
          'admin-data': ['bom-import', 'audit'],
        },
      },
})

const AuthorityProbe = ({ label }: { label: string }) => {
  const operation = useSystemOperation()
  const location = useLocation()
  return <output data-testid={`authority-${label}`}>{`${operation?.mode}:${operation?.version}:${location.pathname}${location.search}`}</output>
}

const renderTab = ({
  label,
  entry,
  token,
  authorityChannel,
  storage,
}: {
  label: string
  entry: string
  token: string
  authorityChannel: Parameters<typeof SystemOperationProvider>[0]['authorityChannel']
  storage: Storage
}) => {
  const store = buildStore(token)
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="*"
            element={(
              <SystemOperationProvider authorityChannel={authorityChannel} storage={storage}>
                <AuthorityProbe label={label} />
              </SystemOperationProvider>
            )}
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )

  return { store, ...view }
}

describe('SystemOperationProvider authority convergence', () => {
  beforeEach(() => {
    FakeBroadcastChannel.channels.clear()
    mockAuthorityRuntime.reset()
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('keeps two tabs independent and converges monotonically on the newest server-confirmed authority', async () => {
    const defaultSnapshot = buildSnapshot('DEFAULT', 1)
    const reconciliationSnapshotV2 = buildSnapshot('MATERIAL_RECONCILIATION', 2)
    const reconciliationSnapshotV3 = buildSnapshot('MATERIAL_RECONCILIATION', 3)
    mockAuthorityRuntime.primeSnapshot('tab-a', defaultSnapshot)
    mockAuthorityRuntime.primeSnapshot('tab-b', defaultSnapshot)

    let releaseLateResponse!: () => void
    const lateResponse = new Promise<SystemOperationSnapshot>((resolve) => {
      releaseLateResponse = () => resolve(reconciliationSnapshotV2)
    })
    mockAuthorityRuntime.queueRefetch('tab-a', () => lateResponse)
    mockAuthorityRuntime.queueRefetch('tab-a', async () => reconciliationSnapshotV3)

    const tabAChannel = createSystemOperationAuthorityChannel({
      createBroadcastChannel: (name) => new FakeBroadcastChannel(name),
    })
    const tabBChannel = createSystemOperationAuthorityChannel({
      createBroadcastChannel: (name) => new FakeBroadcastChannel(name),
    })
    const tabA = renderTab({
      label: 'a',
      entry: ROUTES.WAREHOUSE,
      token: 'tab-a',
      authorityChannel: tabAChannel,
      storage: new MemoryStorage(),
    })
    const tabB = renderTab({
      label: 'b',
      entry: ROUTES.WEEKLY_MENU,
      token: 'tab-b',
      authorityChannel: tabBChannel,
      storage: new MemoryStorage(),
    })

    await waitFor(() => {
      expect(within(tabA.container).getByTestId('authority-a')).toHaveTextContent('DEFAULT:1:/warehouse')
      expect(within(tabB.container).getByTestId('authority-b')).toHaveTextContent('DEFAULT:1:/weekly-menu')
    })

    mockAuthorityRuntime.setSnapshot('tab-b', reconciliationSnapshotV2)
    tabBChannel.publish(authorityFromSnapshot(reconciliationSnapshotV2))
    tabBChannel.publish(authorityFromSnapshot(reconciliationSnapshotV2))
    tabBChannel.publish(authorityFromSnapshot(defaultSnapshot))

    await waitFor(() => expect(within(tabB.container).getByTestId('authority-b')).toHaveTextContent('MATERIAL_RECONCILIATION:2:/weekly-menu'))
    await waitFor(() => expect(mockAuthorityRuntime.getRefetchCount('tab-a')).toBe(1))
    expect(within(tabA.container).queryByTestId('authority-a')).toBeNull()

    mockAuthorityRuntime.primeSnapshot('tab-a', reconciliationSnapshotV3)
    mockAuthorityRuntime.setSnapshot('tab-b', reconciliationSnapshotV3)
    tabBChannel.publish(authorityFromSnapshot(reconciliationSnapshotV3))

    await waitFor(() => expect(within(tabA.container).getByTestId('authority-a')).toHaveTextContent('MATERIAL_RECONCILIATION:3:/warehouse'))
    expect(mockAuthorityRuntime.getRefetchCount('tab-a')).toBe(2)

    releaseLateResponse()
    await waitFor(() => expect(within(tabA.container).getByTestId('authority-a')).toHaveTextContent('MATERIAL_RECONCILIATION:3:/warehouse'))
    await waitFor(() => expect(mockAuthorityRuntime.getRefetchCount('tab-a')).toBe(3))

    tabA.unmount()
    tabB.unmount()
    tabA.store.dispatch(apiSlice.util.resetApiState())
    tabB.store.dispatch(apiSlice.util.resetApiState())
    tabAChannel.dispose()
    tabBChannel.dispose()
  })
})
