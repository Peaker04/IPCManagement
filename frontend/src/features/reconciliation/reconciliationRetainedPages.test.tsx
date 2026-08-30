import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common'
import authReducer from '@/lib/auth/authSlice'
import PurchasingPage from '@/features/purchasing/pages/PurchasingPage'
import WarehousePage from '@/features/warehouse/pages/WarehousePage'
import ReportsPage from '@/features/reports/pages/ReportsPage'

let mockMode = 'MATERIAL_RECONCILIATION'
let mockPageTabs: Record<string, string[]> = {
  'weekly-menu': [],
  purchasing: [],
  warehouse: [],
  reports: [],
}

vi.mock('@/features/system-operation/systemOperationContext', () => ({
  useSystemOperation: () => ({
    mode: mockMode,
    capabilities: {
      navigation: ['weekly-menu', 'purchasing', 'warehouse', 'reports'],
      pageTabs: mockPageTabs,
      excludedControllers: [],
    },
  }),
}))

vi.mock('./reconciliationApi', () => ({
  useListReconciliationBatchesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useListReconciliationDraftSourcesQuery: () => ({
    data: [],
    isError: false,
    refetch: vi.fn(),
  }),
  usePreviewReconciliationQuantityImportMutation: () => [vi.fn(), { isLoading: false, isError: false }],
  useCommitReconciliationQuantityImportMutation: () => [vi.fn(), { isLoading: false }],
  useReadyReconciliationBatchMutation: () => [vi.fn(), { isLoading: false }],
  useCompleteReconciliationBatchMutation: () => [vi.fn(), { isLoading: false }],
  useSetReconciliationDispositionMutation: () => [vi.fn(), { isLoading: false }],
  useListReconciliationDispositionCategoriesQuery: () => ({ data: [], isLoading: false, isError: false }),
  useSetReconciliationActualMutation: () => [vi.fn(), { isLoading: false }],
}))

vi.mock('@/features/purchasing/quotation/useSupplierQuotations', () => ({
  useSupplierQuotations: () => ({
    ingredients: [],
    suppliers: [],
    ingredientView: { phase: 'uninitialized' },
    supplierView: { phase: 'uninitialized' },
    quotationView: { phase: 'uninitialized' },
  }),
}))

// Mock legacy query hooks so they don't error during render
vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseWorkbenchQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useGetPurchaseOrdersPageQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetSuppliersQuery: () => ({ data: [], isFetching: false, isError: false }),
}))
vi.mock('@/api/warehouseApi', () => ({
  useGetWarehouseSelectorQuery: () => ({ data: [], isError: false }),
  useCreateInventoryIssueMutation: () => [vi.fn(), { isLoading: false }],
}))
vi.mock('@/api/workflowDocumentsApi', () => ({
  useGetWorkflowDocumentsQuery: () => ({ data: [], isFetching: false, isError: false }),
}))
vi.mock('@/api/reportsApi', () => ({
  useGetCurrentStockPageQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetCurrentStockQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetIngredientDemandAggregatePageQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetIngredientDemandQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetMaterialRequestCandidatePageQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useGetKitchenIssuesQuery: () => ({ data: [], isFetching: false, isError: false }),
  useGetStockMovementPageQuery: () => ({ data: undefined, isFetching: false, isError: false }),
  useWorkflowOverview: () => ({ roleInboxItems: [] }),
}))
vi.mock('@/features/reports/reportsApi', () => ({
  useGetSupplyLineReconciliationQuery: () => ({ data: [], isFetching: false, isError: false }),
}))
vi.mock('@/features/reports/pages/useReportsPriceViewModel', () => ({
  useReportsPriceViewModel: () => ({
    exportConfig: undefined,
    view: { phase: 'uninitialized' },
    activePriceView: { phase: 'uninitialized' },
    priceVarianceResult: { data: undefined, isFetching: false, isError: false },
    pricePage: 1,
    pricePageSize: 20,
    priceVarianceRows: [],
    priceTotalRows: 0,
    setPricePage: vi.fn(),
    setPricePageSize: vi.fn(),
  }),
}))
vi.mock('@/features/reports/pages/useReportsDemandPurchaseViewModel', () => ({
  useReportsDemandPurchaseViewModel: () => ({
    exportConfigs: { demand: undefined, purchase: undefined },
    views: { demand: { phase: 'uninitialized' }, purchase: { phase: 'uninitialized' } },
    demandPurchaseRows: [],
    purchasePlanSummary: undefined,
    demandPage: 1,
    demandPageSize: 20,
    demandSearch: '',
    purchasePage: 1,
    purchasePageSize: 20,
    purchaseSearch: '',
    purchasePlanGroupBy: 'supplier',
    setDemandPage: vi.fn(),
    setDemandPageSize: vi.fn(),
    setDemandSearch: vi.fn(),
    setPurchasePage: vi.fn(),
    setPurchasePageSize: vi.fn(),
    setPurchaseSearch: vi.fn(),
    setPurchasePlanGroupBy: vi.fn(),
  }),
}))
vi.mock('@/features/reports/pages/useReportsKitchenUsageViewModel', () => ({
  useReportsKitchenUsageViewModel: () => ({
    exportConfigs: { usage: undefined, kitchenIssue: undefined },
    views: { usage: { phase: 'uninitialized' }, kitchen: { phase: 'uninitialized' }, kitchenIssue: { phase: 'uninitialized' } },
    usageRows: [],
    kitchenIssueRows: [],
    usagePage: 1,
    kitchenPage: 1,
    operationalPageSize: 20,
    setUsagePage: vi.fn(),
    setKitchenPage: vi.fn(),
    setOperationalPageSize: vi.fn(),
  }),
}))
vi.mock('@/features/reports/pages/useReportsStockMovementViewModel', () => ({
  useReportsStockMovementViewModel: () => ({
    exportConfigs: { stock: undefined, movement: undefined },
    views: { stock: { phase: 'uninitialized' }, movement: { phase: 'uninitialized' } },
    currentStockRows: [],
    stockMovementRows: [],
    stockPage: 1,
    stockPageSize: 20,
    stockSearch: '',
    movementSearch: '',
    movementCursors: [],
    setStockPage: vi.fn(),
    setStockPageSize: vi.fn(),
    setStockSearch: vi.fn(),
    setMovementSearch: vi.fn(),
    setMovementCursors: vi.fn(),
    openNextMovementPage: vi.fn(),
  }),
}))
vi.mock('@/features/reports/pages/useReportsAuditQualityViewModel', () => ({
  useReportsAuditQualityViewModel: () => ({
    exportConfigs: { audit: undefined, 'data-quality': undefined },
    views: { audit: { phase: 'uninitialized' }, 'data-quality': { phase: 'uninitialized' } },
    auditRows: [],
    auditCursors: [],
    setAuditCursors: vi.fn(),
    openNextAuditPage: vi.fn(),
  }),
}))

const createTestStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: {
          id: 'u1',
          fullName: 'Admin User',
          username: 'admin',
          role: 'admin' as const,
          permissions: ['*'],
          isAdminFullAccess: true,
        },
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
      },
    },
  })

const renderWithProviders = (ui: React.ReactElement, initialRoute: string) => {
  const store = createTestStore()
  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          {ui}
        </MemoryRouter>
      </ToastProvider>
    </Provider>
  )
}

describe('Retained pages in MATERIAL_RECONCILIATION mode', () => {
  beforeEach(() => {
    mockMode = 'MATERIAL_RECONCILIATION'
    mockPageTabs = {
      'weekly-menu': [],
      purchasing: [],
      warehouse: [],
      reports: [],
    }
    vi.clearAllMocks()
  })

  it('PurchasingPage renders ReconciliationWorkspace and hides legacy ViewSwitcher tabs', () => {
    renderWithProviders(<PurchasingPage />, '/purchasing')

    // Should render Reconciliation workspace
    expect(screen.getByLabelText('Không gian đối chiếu nguyên liệu')).toBeInTheDocument()
    // Should NOT render legacy tabs
    expect(screen.queryByRole('tab', { name: 'Xử lý thu mua' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Mua bổ sung' })).not.toBeInTheDocument()
  })

  it('WarehousePage renders ReconciliationWorkspace and hides legacy tabs', () => {
    renderWithProviders(<WarehousePage />, '/warehouse')

    // Should render Reconciliation workspace
    expect(screen.getByLabelText('Không gian đối chiếu nguyên liệu')).toBeInTheDocument()
    // Should NOT render legacy commands or tabs
    expect(screen.queryByRole('button', { name: 'Tạo phiếu xuất kho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Luân chuyển' })).not.toBeInTheDocument()
  })

  it('ReportsPage renders ReconciliationWorkspace and hides legacy report view tabs', () => {
    renderWithProviders(<ReportsPage />, '/reports')

    // Should render Reconciliation workspace
    expect(screen.getByLabelText('Không gian đối chiếu nguyên liệu')).toBeInTheDocument()
    // Should NOT render legacy report action buttons or filters
    expect(screen.queryByRole('button', { name: /Xuất dữ liệu/i })).not.toBeInTheDocument()
  })
})
