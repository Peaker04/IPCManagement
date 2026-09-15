import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { store } from '@/app/store'
import { ToastProvider } from '@/components/common'
import { SystemOperationContext } from '@/lib/systemOperationContext'
import type { SystemOperationSnapshot } from '@/lib/systemOperationTypes'
import {
  writeNavigationPreferences,
  writePageTabPreferences,
  defaultNavigationPreferences,
  defaultPageTabPreferences,
  visibleTabIds,
} from '@/lib/navigationPreferences'
import { eligibleCapabilityIds, eligiblePageTabs } from '@/lib/systemOperationEligibility'
import { ReconciliationAdminDataPage } from '@/app/pages/admin-data/ReconciliationAdminDataPage'

const mrxSnapshot: SystemOperationSnapshot = {
  mode: 'MATERIAL_RECONCILIATION',
  label: 'Đối chiếu nguyên liệu',
  version: 1,
  updatedAt: new Date().toISOString(),
  reasonRequired: false,
  capabilities: {
    navigation: ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'],
    pageTabs: {
      'weekly-menu': ['schedule', 'material-demand'],
      warehouse: ['demand', 'movement'],
      'admin-data': ['bom-import', 'audit'],
    },
  },
}

describe('MATERIAL_RECONCILIATION display and navigation synchronization contract', () => {
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

  it('synchronizes eligible capabilities and tabs identically with user preferences', () => {
    // 1. Navigation items
    const allMrxNavIds = eligibleCapabilityIds(mrxSnapshot.mode, mrxSnapshot.capabilities.navigation)
    expect(allMrxNavIds).toEqual(['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'])

    // Hide reconciliation
    const customizedNav = { ...defaultNavigationPreferences, reconciliation: false }
    writeNavigationPreferences(customizedNav)
    expect(customizedNav.reconciliation).toBe(false)
    expect(customizedNav.warehouse).toBe(true)

    // 2. Weekly Menu tabs
    const weeklyMenuTabsAll = eligiblePageTabs(
      'MATERIAL_RECONCILIATION',
      'weekly-menu',
      mrxSnapshot.capabilities.pageTabs['weekly-menu'],
      ['schedule', 'demand']
    )
    expect(weeklyMenuTabsAll).toEqual(['schedule', 'demand'])

    const weeklyMenuTabsFiltered = eligiblePageTabs(
      'MATERIAL_RECONCILIATION',
      'weekly-menu',
      mrxSnapshot.capabilities.pageTabs['weekly-menu'],
      ['demand']
    )
    expect(weeklyMenuTabsFiltered).toEqual(['demand'])

    // 3. Warehouse tabs
    const warehouseTabsFiltered = eligiblePageTabs(
      'MATERIAL_RECONCILIATION',
      'warehouse',
      mrxSnapshot.capabilities.pageTabs.warehouse,
      ['movement']
    )
    expect(warehouseTabsFiltered).toEqual(['movement'])

    // 4. Admin Data tabs
    const adminTabsFiltered = eligiblePageTabs(
      'MATERIAL_RECONCILIATION',
      'admin-data',
      mrxSnapshot.capabilities.pageTabs['admin-data'],
      ['audit']
    )
    expect(adminTabsFiltered).toEqual(['audit'])
  })

  it('hides disabled tabs in ReconciliationAdminDataPage based on pageTabPreferences', async () => {
    // Hide bom-import tab in admin-data
    const customTabPrefs = structuredClone(defaultPageTabPreferences)
    customTabPrefs['admin-data']['bom-import'] = false
    customTabPrefs['admin-data'].audit = true
    writePageTabPreferences(customTabPrefs)

    expect(visibleTabIds('admin-data')).not.toContain('bom-import')
    expect(visibleTabIds('admin-data')).toContain('audit')

    render(
      <Provider store={store}>
        <ToastProvider>
          <SystemOperationContext.Provider value={mrxSnapshot}>
            <MemoryRouter initialEntries={['/admin-data?view=audit']}>
              <ReconciliationAdminDataPage />
            </MemoryRouter>
          </SystemOperationContext.Provider>
        </ToastProvider>
      </Provider>
    )

    // BOM tab should not be in the ViewSwitcher
    expect(screen.queryByRole('tab', { name: 'BOM theo đơn giá' })).not.toBeInTheDocument()
    // Audit tab should be present
    expect(screen.getByRole('tab', { name: 'Nhật ký thay đổi' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lịch sử thay đổi nguồn' })).toBeInTheDocument()
  })

  it('shows empty state when all tabs in admin-data are disabled', () => {
    const customTabPrefs = structuredClone(defaultPageTabPreferences)
    customTabPrefs['admin-data']['bom-import'] = false
    customTabPrefs['admin-data'].audit = false
    writePageTabPreferences(customTabPrefs)

    render(
      <Provider store={store}>
        <ToastProvider>
          <SystemOperationContext.Provider value={mrxSnapshot}>
            <MemoryRouter initialEntries={['/admin-data']}>
              <ReconciliationAdminDataPage />
            </MemoryRouter>
          </SystemOperationContext.Provider>
        </ToastProvider>
      </Provider>
    )

    expect(screen.getByText('Không còn vùng dữ liệu đang hiển thị')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở thiết lập hiển thị' })).toBeInTheDocument()
  })
})
