import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getOperationalKpis: vi.fn(),
  workflowOverview: vi.fn(),
}))

vi.mock('@/features/dashboard/dashboardApi', () => ({
  useGetOperationalKpisQuery: mocks.getOperationalKpis,
}))

vi.mock('@/features/reports/reportsApi', () => ({
  useWorkflowOverview: mocks.workflowOverview,
}))

import DashboardPage from './DashboardPage'

const kpis = {
  shortageCount: 0,
  lowStockCount: 0,
  overduePurchaseRequestCount: 0,
  lateReceiptCount: 0,
  pendingKitchenConfirmationCount: 0,
  failedWorkflowCount: 0,
  criticalDataQualityCount: 0,
  overdueApprovalCount: 0,
}

const inboxItem = {
  id: 'inbox-1',
  laneId: 'purchasing',
  owner: 'Thu mua',
  title: 'Chọn nhà cung cấp cho PR-001',
  description: 'Đề xuất mua đang chờ xử lý.',
  due: 'Hôm nay',
  nextAction: 'Mở đề xuất mua',
  tone: 'warning',
  route: '/purchasing',
}

const readyQuery = <T,>(data: T, overrides: Record<string, unknown> = {}) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
  ...overrides,
})

const readyOverview = (overrides: Record<string, unknown> = {}) => {
  const data = { roleInboxItems: [inboxItem], workflowLanes: [] }
  return {
    ...readyQuery(data),
    ...data,
    blockedItems: [],
    documents: [],
    demandLines: [],
    movements: [],
    ...overrides,
  }
}

const failedOverview = (refetch = vi.fn()) => ({
  ...readyOverview(),
  data: undefined,
  currentData: undefined,
  roleInboxItems: [],
  isSuccess: false,
  isError: true,
  error: { status: 500 },
  refetch,
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <DashboardPage />
  </MemoryRouter>,
)

describe('DashboardPage query state boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workflowOverview.mockReturnValue(readyOverview())
    mocks.getOperationalKpis.mockReturnValue(readyQuery(kpis))
  })

  it('blocks false zero and empty content when the workflow overview fails', () => {
    mocks.workflowOverview.mockReturnValue(failedOverview())

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được tổng quan workflow')
    expect(screen.queryByText('Tổng quan ca hôm nay')).toBeNull()
    expect(screen.queryByText('Không có việc cần xử lý trong ca này.')).toBeNull()
  })

  it('retries only the failed workflow overview owner', () => {
    const refetchWorkflow = vi.fn()
    const refetchKpis = vi.fn()
    mocks.workflowOverview.mockReturnValue(failedOverview(refetchWorkflow))
    mocks.getOperationalKpis.mockReturnValue(readyQuery(kpis, { refetch: refetchKpis }))

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))

    expect(refetchWorkflow).toHaveBeenCalledOnce()
    expect(refetchKpis).not.toHaveBeenCalled()
  })

  it('keeps stale operational content visible while the owners refresh', () => {
    mocks.workflowOverview.mockReturnValue(readyOverview({ isFetching: true }))

    renderPage()

    expect(screen.getByText('Chọn nhà cung cấp cho PR-001')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật tổng quan vận hành')
  })
})
