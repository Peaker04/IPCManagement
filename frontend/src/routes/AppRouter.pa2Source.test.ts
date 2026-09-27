import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { routeRegistry } from './routeRegistry'
import appRouterSource from './AppRouter.tsx?raw'

describe('PA-2 route permission source', () => {
  it('fails if the Weekly Menu route permission drifts', () => {
    expect(routeRegistry[ROUTES.WEEKLY_MENU].requiredPermissions).toEqual(['coordination.read'])
    expect(appRouterSource).toContain('requiredPermissions={routeRegistry[ROUTES.WEEKLY_MENU].requiredPermissions!}')
  })
})
