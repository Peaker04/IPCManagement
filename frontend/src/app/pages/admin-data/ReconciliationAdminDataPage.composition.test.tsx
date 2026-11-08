import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ReconciliationAdminDataPage } from './ReconciliationAdminDataPage'

vi.mock('./useReconciliationAdminDataPageModel', () => ({
  useReconciliationAdminDataPageModel: () => ({
    effectiveActiveView: 'bom-import',
    isViewPending: false,
    setActiveView: vi.fn(),
    startViewTransition: (callback: () => void) => callback(),
  }),
}))

vi.mock('./AdminBomPanel', () => ({
  AdminBomPanel: () => <section><h2>Import BOM theo đơn giá</h2></section>,
}))
vi.mock('./AdminAuditPanel', () => ({ AdminAuditPanel: () => null }))
vi.mock('./AdminSourceChangesPanel', () => ({ AdminSourceChangesPanel: () => null }))

describe('MATERIAL_RECONCILIATION Admin page composition', () => {
  it('routes from the shell-owned page identity through view navigation to the selected canonical work surface', async () => {
    render(
      <MemoryRouter>
        <ReconciliationAdminDataPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: 'Quản trị dữ liệu' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'BOM theo đơn giá' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Import BOM theo đơn giá' })).toBeInTheDocument()
  })
})
