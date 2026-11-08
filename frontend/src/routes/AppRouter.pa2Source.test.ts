import { describe, expect, it } from 'vitest'
import appRouterSource from './AppRouter.tsx?raw'

describe('PA-2 route permission source', () => {
  it('fails if the Weekly Menu route permission drifts', () => {
    expect(appRouterSource).toContain("<RoleGuard requiredPermissions={['coordination.read']}>")
  })
})
