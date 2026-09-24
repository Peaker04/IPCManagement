import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getOperationalKpis: vi.fn(),
  workflowOverview: vi.fn(),
}))

vi.mock('@/api/dashboardApi', () => ({
  useGetOperationalKpisQuery: mocks.getOperationalKpis,
}))

vi.mock('@/api/reportsApi', () => ({
  useWorkflowOverview: mocks.workflowOverview,
}))

vi.mock('@/lib/useHasPermission', () => ({
  useHasPermission: () => true,
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

  it('blocks false zero and empty content when the workflow overview fails', async () => {
    mocks.workflowOverview.mockReturnValue(failedOverview())

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được tổng quan workflow')
    expect(screen.queryByText('Tổng quan ca hôm nay')).toBeNull()
    expect(screen.getByText('Không có việc cần xử lý trong ca này.').closest('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('retries only the failed workflow overview owner', async () => {
    const refetchWorkflow = vi.fn()
    const refetchKpis = vi.fn()
    mocks.workflowOverview.mockReturnValue(failedOverview(refetchWorkflow))
    mocks.getOperationalKpis.mockReturnValue(readyQuery(kpis, { refetch: refetchKpis }))

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Thử tải lại' }))

    expect(refetchWorkflow).toHaveBeenCalledOnce()
    expect(refetchKpis).not.toHaveBeenCalled()
  })

  it('expands the active local filter instead of sending users to the approval route', async () => {
    const kitchenItems = Array.from({ length: 8 }, (_, index) => ({
      ...inboxItem,
      id: `kitchen-${index}`,
      laneId: 'kitchen',
      owner: 'Bếp trưởng',
      title: `Phiếu xuất chờ Bếp ${index + 1}`,
      route: '/chef-dashboard',
    }));
    mocks.workflowOverview.mockReturnValue(readyOverview({ roleInboxItems: kitchenItems }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Chặn bếp/ }));

    expect(await screen.findByRole('button', { name: 'Xem thêm 1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Xem toàn bộ' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm 1' }));
    expect(screen.getByText('Phiếu xuất chờ Bếp 8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeInTheDocument();
  });

  it('keeps KPI signals out of the actionable inbox to avoid duplicating the same fact', async () => {
    mocks.getOperationalKpis.mockReturnValue(readyQuery({ ...kpis, shortageCount: 3, lowStockCount: 2 }))

    renderPage()

    expect(await screen.findByRole('link', { name: /Thiếu \/ tồn thấp/ })).toBeInTheDocument()
    expect(screen.queryByText('Thiếu hoặc tồn thấp nguyên liệu')).toBeNull()
    expect(screen.getByText('Chọn nhà cung cấp cho PR-001')).toBeInTheDocument()
    expect(screen.getByText('Chốt menu và số suất.')).toBeInTheDocument()
    expect(screen.getByText('Kiểm BOM và định lượng.')).toBeInTheDocument()
    expect(screen.getByText('Duyệt và xử lý mua hàng.')).toBeInTheDocument()
    expect(screen.getByText('Xuất kho và Bếp xác nhận.')).toBeInTheDocument()
  })

  it('retires the duplicate aggregate strip while preserving each canonical decision surface', async () => {
    mocks.workflowOverview.mockReturnValue(readyOverview({
      workflowLanes: [{ id: 'purchasing', label: 'Thu mua', waiting: 2, blocked: 1, done: 0, tone: 'warning', status: 'Có ngoại lệ' }],
    }))
    mocks.getOperationalKpis.mockReturnValue(readyQuery({ ...kpis, shortageCount: 3 }))

    renderPage()

    expect(await screen.findByRole('link', { name: /Thiếu \/ tồn thấp/ })).toBeInTheDocument()
    expect(screen.getByText('Chọn nhà cung cấp cho PR-001')).toBeInTheDocument()
    expect(screen.getByText('Tiến độ 4 công đoạn')).toBeInTheDocument()
    expect(screen.queryByText('Tổng quan ca hôm nay')).toBeNull()
    expect(screen.queryByText('Nhóm việc hiển thị')).toBeNull()
    expect(screen.queryByText('Điểm tắc')).toBeNull()
  })

  it('keeps stale operational content visible while the owners refresh', async () => {
    mocks.workflowOverview.mockReturnValue(readyOverview({ isFetching: true }))

    renderPage()

    expect(await screen.findByText('Chọn nhà cung cấp cho PR-001')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật tổng quan vận hành')
  })
})
