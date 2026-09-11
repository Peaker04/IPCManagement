import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initiate: vi.fn(),
  logOutAction: { type: 'auth/logOut' },
}))

vi.mock('@/features/auth/authApi', () => ({
  authApi: {
    endpoints: {
      logout: {
        initiate: mocks.initiate,
      },
    },
  },
}))

vi.mock('@/lib/auth/authSlice', () => ({
  logOut: () => mocks.logOutAction,
}))

import { logoutSession } from './logoutSession'

describe('logoutSession request ownership', () => {
  beforeEach(() => {
    mocks.initiate.mockReset()
  })

  it('shares one revoke request across concurrent logout actions', async () => {
    let release!: () => void
    const request = new Promise<void>((resolve) => {
      release = resolve
    })
    const dispatched: unknown[] = []
    const dispatch = vi.fn((action: unknown) => {
      dispatched.push(action)
      return action === mocks.logOutAction
        ? action
        : { unwrap: () => request }
    })
    mocks.initiate.mockReturnValue({ type: 'api/logout' })
    const getState = () => ({ auth: { token: 'access-token' } })

    const first = logoutSession(dispatch as never, getState as never)
    const second = logoutSession(dispatch as never, getState as never)

    expect(first).toBe(second)
    expect(mocks.initiate).toHaveBeenCalledOnce()
    release()
    await Promise.all([first, second])
    expect(dispatched.filter((action) => action === mocks.logOutAction)).toHaveLength(1)
  })
})
