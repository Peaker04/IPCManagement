import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  exceptions: vi.fn(),
  journal: vi.fn(),
  production: vi.fn(),
  receipts: vi.fn(),
}))

vi.mock('@/components/common', () => ({
  CommandBar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ContextStrip: () => null,
  InlineAlert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  OperationalFrame: ({ command, context, children }: { command?: ReactNode; context?: ReactNode; children?: ReactNode }) => <>{command}{context}{children}</>,
  ViewSwitcher: () => null,
}))

vi.mock('@/lib/coordinationStore', () => ({
  useCoordinationStoreSelector: (selector: (state: unknown) => unknown) => selector({ coordination: { lockedShifts: {} } }),
}))

vi.mock('../ChefQueryBoundary', () => ({
  ChefQueryBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('../components/chef-header', () => ({ ChefHeader: () => null }))
vi.mock('../journal/ChefDocumentsSection', () => ({ ChefDocumentsSection: () => null }))
vi.mock('../production/ChefProductionSection', () => ({ ChefProductionSection: () => null }))
vi.mock('../receipts/KitchenReceiptSection', () => ({ KitchenReceiptSection: () => null }))
vi.mock('../exceptions/useChefExceptions', () => ({ useChefExceptions: mocks.exceptions }))
vi.mock('../journal/useChefJournal', () => ({ useChefJournal: mocks.journal }))
vi.mock('../production/useChefProductionPlan', () => ({ useChefProductionPlan: mocks.production }))
vi.mock('../receipts/useKitchenReceipts', () => ({ useKitchenReceipts: mocks.receipts }))

import ChefDashboardPage from './ChefDashboardPage'

const ready = { phase: 'ready' as const, data: [], isRefreshing: false, truncation: null }

describe('ChefDashboardPage select labels', () => {
  it('shows display shift labels and never the MORNING API enum in the closed trigger', () => {
    mocks.receipts.mockReturnValue({
      hasAdditionalPages: false, queryView: ready, rows: [], pendingCount: 0, page: 1, pageSize: 100,
      totalCount: 0, allReceived: false, isConfirming: false, signedMaterials: [], signOff: vi.fn(), setPage: vi.fn(),
    })
    mocks.production.mockReturnValue({
      status: { isCatalogEmpty: false, isDailyPlanLoading: false, isDailyPlanError: false },
      productionPlan: { date: '2026-07-27', shift: 'Ca Sáng', kitchenAssignment: { kitchenName: 'Bếp', kitchenCode: 'B01', responsibleChefs: [] }, totalMeals: 0, activeDishes: [], receivedMaterials: [], plannedMaterials: [] },
      queryViews: { dailyPlan: ready }, dailyPlanWarnings: [], isLocked: false, dailyPlan: undefined,
      isSendingDailyPlan: false, receiveDailyPlan: vi.fn(),
    })
    mocks.exceptions.mockReturnValue({ queryView: ready, activeReturns: [], isCreatingReturn: false, isSubmittingSupplemental: false, requestSupplemental: vi.fn(), recordReturn: vi.fn() })
    mocks.journal.mockReturnValue({ queryViews: { documents: ready, movements: ready }, returnDocuments: [], kitchenMovements: [] })

    render(<ChefDashboardPage />)

    expect(screen.getByRole('combobox', { name: 'Chọn ca sản xuất' })).toHaveTextContent('Ca Sáng')
    expect(screen.getByRole('combobox', { name: 'Chọn ca sản xuất' })).not.toHaveTextContent('MORNING')
  })
})
