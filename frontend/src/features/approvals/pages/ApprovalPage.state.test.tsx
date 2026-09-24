import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainLayout } from '@/app/layout/MainLayout';
import { ToastProvider } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';

const mocks = vi.hoisted(() => ({
  getApprovals: vi.fn(),
  getDocuments: vi.fn(),
  getPurchaseRequests: vi.fn(),
  getHistory: vi.fn(),
  executeDecision: vi.fn(),
  getMenuDecisions: vi.fn(),
  getReceipt: vi.fn(),
}));

vi.mock('@/lib/useHasRole', () => ({ useHasRole: () => false }));
vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({
    fullName: 'Quản lý vận hành',
    role: 'quanly',
    permissions: ['purchase.request.approve', 'purchase.read', 'warehouse.read'],
    isAdminFullAccess: false,
  }),
}));
vi.mock('@/app/providers/SystemOperationProvider', () => ({
  SystemOperationProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/systemOperationContext', () => ({
  useSystemOperation: () => ({ mode: 'DEFAULT', label: 'Mặc định' }),
}));
vi.mock('@/features/auth/components/IdleSessionGuard', () => ({ IdleSessionGuard: () => null }));
vi.mock('@/routes/routeLoaders', () => ({ preloadRoute: vi.fn(), preloadRouteData: vi.fn() }));

vi.mock('@/api/approvalsApi', () => ({
  useGetApprovalRecordsQuery: mocks.getApprovals,
  useGetApprovalHistoryQuery: mocks.getHistory,
  useExecuteApprovalDecisionMutation: () => [mocks.executeDecision, { isLoading: false }],
}));

vi.mock('@/api/workflowDocumentsApi', () => ({
  useGetWorkflowDocumentsQuery: mocks.getDocuments,
}));

vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseRequestsPageQuery: mocks.getPurchaseRequests,
}));

vi.mock('@/api/warehouseApi', () => ({
  useGetInventoryReceiptByIdQuery: mocks.getReceipt,
}));

vi.mock('@/api/coordinationApi', () => ({
  useGetCoordinationCustomersQuery: () => ({ data: { data: [{ customerId: 'anv', customerCode: 'ANV', customerName: 'Công ty ANV' }, { customerId: 'dav', customerCode: 'DAV', customerName: 'Công ty DAV' }] } }),
  useGetMenuAmendmentsQuery: () => readyQuery({ success: true, data: [] }),
  useReviewMenuAmendmentMutation: () => [vi.fn(), { isLoading: false }],
  useExecuteMenuAmendmentMutation: () => [vi.fn(), { isLoading: false }],
  useGetMenuAmendmentDecisionPageQuery: mocks.getMenuDecisions,
  useExecuteMenuAmendmentDecisionMutation: () => [vi.fn(), { isLoading: false }],
}));

import ApprovalPage from './ApprovalPage';

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
});

const uninitializedQuery = () => ({
  data: undefined,
  currentData: undefined,
  isUninitialized: true,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

const failedQuery = (status: number, refetch = vi.fn()) => ({
  ...uninitializedQuery(),
  isUninitialized: false,
  isError: true,
  error: { status },
  refetch,
});

const approvalRecord = {
  id: 'approval-1',
  targetType: 'purchase-request',
  targetId: 'purchase-1',
  targetCode: 'PR-001',
  type: 'purchase',
  title: 'Duyệt đề xuất mua PR-001',
  source: 'PR-001',
  owner: 'Quản lý',
  submittedBy: 'Nhân viên thu mua',
  deadline: '27/07/2026',
  status: 'PENDING',
  reason: 'Chờ quản lý duyệt.',
  nextAction: 'Duyệt đề xuất mua',
  tone: 'warning',
  materials: [],
};

const approvalPage = (items: unknown[] = []) => ({
  items,
  limit: 20,
  hasNext: false,
  nextCursor: null,
});

const purchaseRequestPage = {
  items: [{
    purchaseRequestId: 'purchase-1',
    purchaseRequestCode: 'PR-001',
    materialRequestId: 'material-1',
    purchaseForDate: '2026-07-27',
    shiftName: 'FULLDAY',
    status: 'APPROVED',
    lines: [],
  }],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 8,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
};

const historyResponse = {
  success: true,
  message: 'OK',
  data: [{
    historyId: 'history-1',
    targetType: 'purchaserequest',
    targetId: 'purchase-1',
    decision: 'APPROVE',
    oldStatus: 'PENDING',
    newStatus: 'APPROVED',
    reason: 'Đủ điều kiện.',
    actionBy: 'manager-1',
    actionByName: 'Quản lý vận hành',
    actionAt: '2026-07-27T08:00:00Z',
  }],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/approvals']}>
    <ToastProvider>
      <ApprovalPage />
    </ToastProvider>
  </MemoryRouter>,
);

const openHistory = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử đề xuất mua' }));
};

describe('ApprovalPage query state boundary', () => {
  it('does not present a global workflow-document list as selected approval detail', async () => {
    const source = await import('./ApprovalPage.tsx?raw').then((module) => module.default);
    expect(source).not.toContain('useGetWorkflowDocumentsQuery');
    expect(source).not.toContain('detailLabel="Chứng từ"');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeDecision.mockReturnValue({ unwrap: vi.fn() });
    mocks.getMenuDecisions.mockReturnValue({ data: undefined, isError: false, isLoading: false, refetch: vi.fn() });
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage()));
    mocks.getDocuments.mockReturnValue(readyQuery([]));
    mocks.getPurchaseRequests.mockReturnValue(readyQuery(purchaseRequestPage));
    mocks.getReceipt.mockReturnValue(uninitializedQuery());
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : readyQuery({ success: true, message: 'OK', data: [] }));
  });

  it('mounts the selected approval queue as h2 below the shell route heading', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Danh sách cần duyệt' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Danh sách cần duyệt' })).not.toBeInTheDocument();
  });

  it('renders approval-inbox forbidden without a retry or false empty state', async () => {
    mocks.getApprovals.mockReturnValue(failedQuery(403));

    renderPage();

    expect((await screen.findAllByText('Bạn không có quyền xem hàng đợi phê duyệt.', {}, { timeout: 3_000 }))[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Không có chứng từ chờ duyệt')).toBeNull();
  });

  it('renders one purposeful surface for a ready empty approval queue', async () => {
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([])));

    const { container } = renderPage();

    expect(await screen.findByText('Chưa có chứng từ chờ duyệt.')).toBeInTheDocument();
    expect(screen.queryByText('Không có chứng từ chờ duyệt')).toBeNull();
    expect(screen.getByText(/Các chứng từ đã xử lý vẫn có thể xem trong tab Lịch sử/)).toBeInTheDocument();
    expect(container.querySelector('.ipc-context-strip')).toBeNull();
    expect(screen.queryByText('Đơn mua')).toBeNull();
    expect(screen.queryByText('Nhu cầu xuất')).toBeNull();
    expect(screen.queryByText('Người duyệt')).toBeNull();
    expect(screen.queryByText(/Nguồn:/)).toBeNull();
  });

  it('keeps populated approval status, deadline and actions with the canonical queue instead of a page summary', async () => {
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([approvalRecord])));

    const { container } = renderPage();

    const row = await screen.findByRole('row', { name: /Duyệt đề xuất mua PR-001/i });
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();
    expect(within(row).getAllByText('27/07/2026')).toHaveLength(2);
    expect(within(row).getByRole('button', { name: /Duyệt chứng từ:/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /Từ chối chứng từ:/i })).toBeInTheDocument();
    expect(container.querySelector('.ipc-context-strip')).toBeNull();
  });

  it('keeps a non-forbidden approval-inbox failure retryable', async () => {
    const refetch = vi.fn();
    mocks.getApprovals.mockReturnValue(failedQuery(500, refetch));

    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Thử tải lại' }))[0]);

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps approval records visible while the inbox refreshes', async () => {
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([approvalRecord]), { isFetching: true }));

    renderPage();

    expect((await screen.findAllByText('Duyệt đề xuất mua PR-001'))[0]).toBeInTheDocument();
    expect(screen.getAllByText('Đang cập nhật hàng đợi')[0]).toBeInTheDocument();
  });

  it('opens the purchase-request approval dialog from that row and announces success once', async () => {
    mocks.executeDecision.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(undefined) });
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([{
      ...approvalRecord,
      targetCode: 'PR-20260810-FULLDAY',
      title: 'Duyệt đề xuất mua PR-20260810-FULLDAY',
      source: 'PR-20260810-FULLDAY',
    }])));

    const { container } = renderPage();

    expect(container.querySelector('.ipc-command-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();

    const row = await screen.findByRole('row', { name: /Duyệt đề xuất mua PR-20260810-FULLDAY/i });
    fireEvent.click(within(row).getByRole('button', { name: /Duyệt chứng từ:/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Duyệt đề xuất mua?' });
    expect(dialog).toBeInTheDocument();
    expect(mocks.executeDecision).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt chứng từ' }));

    await waitFor(() => expect(mocks.executeDecision).toHaveBeenCalledWith({
      targetType: 'purchase-request',
      targetId: 'purchase-1',
      status: 'Approve',
      reason: null,
      week: undefined,
    }));
    await waitFor(() => expect(screen.getAllByRole('status').filter((node) => node.textContent?.includes('Đã duyệt chứng từ'))).toHaveLength(1));
  });

  it('sends deep-link week target and server search filters to the inbox query', async () => {
    render(
      <MemoryRouter initialEntries={['/approvals?targetType=material-demand&targetId=demand-1&week=2026-07-20']}>
        <ToastProvider>
          <ApprovalPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(mocks.getApprovals).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'material-demand',
      targetId: 'demand-1',
      week: '2026-07-20',
    }));
    expect(screen.getAllByText('Phạm vi: Tuần từ 20/07/2026')[0]).toBeInTheDocument();

    fireEvent.change((await screen.findAllByLabelText('Tìm chứng từ hoặc nguyên liệu'))[0], {
      target: { value: 'Bột nở' },
    });
    await waitFor(() => expect(mocks.getApprovals).toHaveBeenLastCalledWith(expect.objectContaining({
      searchKeyword: 'Bột nở',
    })));
  });

  it('does not query or render an unrelated global document rail', () => {
    renderPage();

    expect(mocks.getDocuments).not.toHaveBeenCalled();
    expect(screen.queryByText('Bạn không có quyền xem chứng từ workflow.')).not.toBeInTheDocument();
  });

  it('defers the history detail rail while purchase requests load', async () => {
    mocks.getPurchaseRequests.mockReturnValue({
      ...uninitializedQuery(),
      isUninitialized: false,
      isLoading: true,
    });

    renderPage();
    openHistory();

    expect(await screen.findByText('Đang tải danh sách đề xuất mua hàng...')).toHaveAttribute('role', 'status');
    expect(screen.queryByLabelText('Tiến trình phê duyệt')).toBeNull();
  });

  it('renders purchase-request forbidden on the history tab without a false empty list', async () => {
    mocks.getPurchaseRequests.mockReturnValue(failedQuery(403));

    renderPage();
    openHistory();

    expect(await screen.findByText('Bạn không có quyền xem danh sách đề xuất mua hàng.')).toBeInTheDocument();
    expect(screen.queryByText('Không có đề xuất mua hàng nào.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('keeps approval history uninitialized until a purchase request is selected', async () => {
    renderPage();
    openHistory();

    expect(await screen.findByText('Chọn một đề xuất mua hàng ở bên trái để xem tiến trình duyệt')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy bước duyệt nào.')).toBeNull();
  });

  it('moves keyboard focus to selected history detail and restores it on close', async () => {
    const user = userEvent.setup();
    renderPage();
    openHistory();

    const requestButton = await screen.findByRole('button', { name: /PR-001/ });
    requestButton.focus();
    await user.keyboard('{Enter}');

    const detail = (await screen.findByRole('heading', { name: 'Lịch sử phê duyệt' })).closest('[tabindex="-1"]');
    await waitFor(() => expect(detail).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(requestButton).toHaveFocus());
  });

  it('renders approval-history forbidden without a retry', async () => {
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : failedQuery(403));

    renderPage();
    openHistory();
    fireEvent.click(await screen.findByRole('button', { name: /PR-001/ }));

    expect(await screen.findByText('Bạn không có quyền xem lịch sử phê duyệt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('keeps history entries visible while refreshing', async () => {
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : readyQuery(historyResponse, { isFetching: true }));

    renderPage();
    openHistory();
    fireEvent.click(await screen.findByRole('button', { name: /PR-001/ }));

    expect(await screen.findByText('Quản lý vận hành')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật...')).toBeInTheDocument();
  });

  it('keeps shell navigation and record actions after retiring generic page shortcuts', async () => {
    const user = userEvent.setup();
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([approvalRecord])));

    render(
      <MemoryRouter initialEntries={[ROUTES.APPROVALS]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.APPROVALS} element={<ToastProvider><ApprovalPage /></ToastProvider>} />
            <Route path={ROUTES.PURCHASING} element={<h2>Điểm đến thu mua</h2>} />
            <Route path={ROUTES.WAREHOUSE} element={<h2>Điểm đến kho nguyên liệu</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const purchasingLink = within(navigation).getByRole('link', { name: 'Thu mua' });
    expect(purchasingLink).toHaveAttribute('href', ROUTES.PURCHASING);
    expect(within(navigation).getByRole('link', { name: 'Kho nguyên liệu' })).toHaveAttribute('href', ROUTES.WAREHOUSE);
    expect(screen.queryByRole('link', { name: 'Sang thu mua' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kiểm tra kho' })).not.toBeInTheDocument();

    const row = await screen.findByRole('row', { name: /Duyệt đề xuất mua PR-001/i });
    expect(within(row).getByRole('button', { name: /Duyệt chứng từ:/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /Từ chối chứng từ:/i })).toBeInTheDocument();

    purchasingLink.focus();
    expect(purchasingLink).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Điểm đến thu mua' })).toBeInTheDocument();
  });
});
