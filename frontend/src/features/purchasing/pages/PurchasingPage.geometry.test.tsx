import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWorkbench: vi.fn(),
  getServiceRunPage: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseWorkbenchQuery: mocks.getWorkbench,
  useGetServiceRunPageQuery: mocks.getServiceRunPage,
}))

vi.mock('../quotation/useSupplierQuotations', () => ({
  useSupplierQuotations: () => ({
    ingredients: [],
    suppliers: [],
    response: undefined,
    ingredientView: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
    supplierView: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
    quotationView: { phase: 'uninitialized', instruction: 'Chọn nguyên liệu.' },
    isLookupError: false,
    isLookupForbidden: false,
  }),
}))

vi.mock('../PurchaseDecisionPanel', () => ({
  PurchaseDecisionPanel: () => <div data-testid="purchase-decision-panel" />,
}))
vi.mock('../SupplementalPurchasingWorkbench', () => ({
  SupplementalPurchasingWorkbench: () => <div data-testid="supplemental-workbench" />,
}))
vi.mock('../PurchaseServiceDateWorkbench', () => ({
  PurchaseServiceDateWorkbench: () => <div data-testid="service-date-workbench" />,
}))
vi.mock('../PurchaseWorkflowGuide', () => ({
  PurchaseWorkflowGuide: () => <nav data-testid="purchase-workflow-guide" />,
}))
vi.mock('../quotation/SupplierQuotationSection', () => ({
  SupplierQuotationSection: () => <div data-testid="supplier-quotation-section" />,
}))
vi.mock('@/components/common/ServiceRunBlockerPanel', () => ({
  ServiceRunBlockerPanel: () => <div data-testid="service-run-blocker" />,
}))

import PurchasingPage from './PurchasingPage'

describe('Purchasing command geometry DOM behavioral contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServiceRunPage.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
    })
  })

  it('renders command bar navigation without invisible spacer elements when no next action exists', () => {
    mocks.getWorkbench.mockReturnValue({
      data: {
        selectedDate: '2026-07-20',
        selectedStage: 'demand',
        stageCounts: {
          demand: 1,
          supplierPrice: 0,
          exception: 0,
          submittedRequest: 0,
          approvedOrder: 0,
          receivingProgress: 0,
        },
        serviceDates: [
          {
            serviceDate: '2026-07-20',
            scope: 'FULLDAY',
            currentStage: 'demand',
            approvedDemandCount: 1,
            shortageLineCount: 1,
            supplierReadyLineCount: 0,
            blockingExceptionCount: 0,
            orderCount: 0,
            receivingLineCount: 0,
            fullyReceivedLineCount: 0,
            approvedDemands: [],
            purchaseLines: [],
          },
        ],
        page: 1,
        pageSize: 8,
        totalItems: 1,
      },
      isSuccess: true,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/purchasing?stage=demand']}>
        <PurchasingPage />
      </MemoryRouter>,
    )

    // Verify navigation buttons exist
    expect(screen.getByRole('button', { name: 'Tuần trước' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tuần hiện tại' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tuần sau' })).toBeInTheDocument()

    // Verify no invisible / ghost placeholder reserved element exists in the command bar
    const ghostSpacers = container.querySelectorAll('.min-w-\\[10\\.25rem\\]')
    expect(ghostSpacers.length).toBe(0)
  })

  it('renders actionable command button when a recovery action exists', () => {
    mocks.getWorkbench.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: { data: { message: 'Lỗi tải dữ liệu' } },
      refetch: mocks.refetch,
    })

    render(
      <MemoryRouter initialEntries={['/purchasing']}>
        <PurchasingPage />
      </MemoryRouter>,
    )

    const retryButton = screen.getByRole('button', { name: 'Thử lại' })
    expect(retryButton).toBeInTheDocument()
    expect(retryButton).toHaveClass('min-w-[10.25rem]')
  })
})
