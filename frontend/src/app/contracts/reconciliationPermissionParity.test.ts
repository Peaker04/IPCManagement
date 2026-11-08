import { describe, expect, it } from 'vitest'
import appRouterSource from '@/routes/AppRouter.tsx?raw'
import mainLayoutSource from '@/app/layout/MainLayout.tsx?raw'

describe('MRX emitted-permission parity', () => {
  it('gates the reconciliation route and navigation with report.read', () => {
    expect(appRouterSource).toContain("path={ROUTES.RECONCILIATION} element={<ModeGuard><RoleGuard requiredPermissions={['report.read']}")
    expect(mainLayoutSource).toContain("path: ROUTES.RECONCILIATION, label: 'Đối chiếu'")
    expect(mainLayoutSource).toContain("requiredPermissions: ['report.read'], reconciliationOnly: true")
  })

})
