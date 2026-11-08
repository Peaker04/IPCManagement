import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  exceptions: vi.fn(),
  journal: vi.fn(),
  production: vi.fn(),
  receipts: vi.fn(),
}))

vi.mock('@/components/common', () => ({
  CommandBar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ContextStrip: ({ items }: { items: Array<{ label: string; value: ReactNode }> }) => (
    <dl role="group" aria-label="Tóm tắt ca bếp">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
  ),
  InlineAlert: ({ title, children }: { title?: ReactNode; children?: ReactNode }) => <div><strong>{title}</strong>{children}</div>,
  KeepAliveTabPanel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  OperationalFrame: ({ command, context, children }: { command?: ReactNode; context?: ReactNode; children?: ReactNode }) => <>{command}{context}{children}</>,
  TabContentSkeleton: () => <div role="status">Đang tải nội dung...</div>,
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
  it('shows display shift labels and never the MORNING API enum in the closed trigger', async () => {
    mocks.receipts.mockReturnValue({
      hasAdditionalPages: false, queryView: ready, rows: [], pendingCount: 0, page: 1, pageSize: 100,
      totalCount: 0, allReceived: false, isConfirming: false, signedMaterials: [], signOff: vi.fn(), setPage: vi.fn(),
    })
    mocks.production.mockReturnValue({
      status: { isCatalogEmpty: false, isDailyPlanLoading: false, isDailyPlanError: false },
      productionPlan: { date: '2026-07-27', shift: 'Ca Sáng', kitchenAssignment: { kitchenName: 'Bếp', kitchenCode: 'B01', responsibleChefs: [] }, totalMeals: 1, activeDishes: [], receivedMaterials: [], plannedMaterials: [] },
      queryViews: { dailyPlan: ready }, dailyPlanWarnings: ['Có kế hoạch chưa gửi bếp.'], isLocked: false, dailyPlan: undefined,

    })
    mocks.exceptions.mockReturnValue({ queryView: ready, activeReturns: [], isCreatingReturn: false, isSubmittingSupplemental: false, requestSupplemental: vi.fn(), recordReturn: vi.fn() })
    mocks.journal.mockReturnValue({ queryViews: { documents: ready, movements: ready }, returnDocuments: [], kitchenMovements: [] })

    render(<MemoryRouter><ChefDashboardPage /></MemoryRouter>)

    expect(await screen.findByRole('combobox', { name: 'Chọn ca sản xuất' })).toHaveTextContent('Ca Sáng')
    expect(screen.getByRole('combobox', { name: 'Chọn ca sản xuất' })).not.toHaveTextContent('MORNING')
    expect(screen.getByText('Kế hoạch điều phối chưa chốt')).toBeInTheDocument()
    expect(screen.queryByText('Kế hoạch điều phối chưa đồng bộ; điều này không chặn checklist nhận nguyên liệu.')).toBeNull()
    expect(screen.queryByText('Trạng thái dữ liệu bếp')).toBeNull()
  })

  it('keeps plan, receipt and return facts with their workflow owners instead of a duplicate page summary', () => {
    mocks.receipts.mockReturnValue({
      hasAdditionalPages: false, queryView: ready, rows: [], pendingCount: 0, page: 1, pageSize: 20,
      totalCount: 0, totalSignedCount: 0, actionRowCount: 0, allReceived: false, isConfirming: false,
      signedMaterials: [], actionRows: [], signOff: vi.fn(), setPage: vi.fn(),
    })
    mocks.production.mockReturnValue({
      status: { isCatalogEmpty: false, isDailyPlanLoading: false, isDailyPlanError: false },
      productionPlan: { date: '2026-07-27', shift: 'Ca Sáng', kitchenAssignment: { kitchenName: 'Bếp', kitchenCode: 'B01', responsibleChefs: [] }, totalMeals: 1, activeDishes: [], receivedMaterials: [], plannedMaterials: [] },
      queryViews: { catalog: ready, dailyPlan: ready }, dailyPlanWarnings: [], isLocked: true,
      dailyPlan: { totalPlans: 1, sentPlans: 1, plans: [] }, dailyPlanLines: [],
    })
    mocks.exceptions.mockReturnValue({ queryView: ready, activeReturns: [], isCreatingReturn: false, isSubmittingSupplemental: false, requestSupplemental: vi.fn(), recordReturn: vi.fn() })
    mocks.journal.mockReturnValue({ queryViews: { documents: ready, movements: ready }, returnDocuments: [], kitchenMovements: [] })

    render(<MemoryRouter><ChefDashboardPage /></MemoryRouter>)

    expect(screen.queryByRole('group', { name: 'Tóm tắt ca bếp' })).not.toBeInTheDocument()
    expect(screen.getByText('Lệnh sản xuất chính thức')).toBeInTheDocument()
  })
})
