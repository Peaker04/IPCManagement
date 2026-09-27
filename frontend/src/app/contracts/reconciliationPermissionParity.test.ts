import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { routeRegistry } from '@/routes/routeRegistry'
import appRouterSource from '@/routes/AppRouter.tsx?raw'
import mainLayoutSource from '@/app/layout/MainLayout.tsx?raw'

describe('MRX emitted-permission parity', () => {
  it('gates the reconciliation route and navigation with report.read', () => {
    expect(routeRegistry[ROUTES.RECONCILIATION]).toMatchObject({
      navLabel: 'Đối chiếu',
      requiredPermissions: ['report.read'],
      reconciliationOnly: true,
    })
    expect(appRouterSource).toContain('requiredPermissions={routeRegistry[ROUTES.RECONCILIATION].requiredPermissions!}')
    expect(mainLayoutSource).toContain('const menuItems = navigationRoutes')
  })
})
