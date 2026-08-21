import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/common';

const mocks = vi.hoisted(() => ({
  getApprovals: vi.fn(),
  getDocuments: vi.fn(),
  getPurchaseRequests: vi.fn(),
  getHistory: vi.fn(),
  executeDecision: vi.fn(),
  getMenuDecisions: vi.fn(),
}));

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

vi.mock('@/api/coordinationApi', () => ({
  useGetCoordinationCustomersQuery: () => ({ data: { data: [{ customerId: 'anv', customerCode: 'ANV', customerName: 'Công ty ANV' }, { customerId: 'dav', customerCode: 'DAV', customerName: 'Công ty DAV' }] } }),
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
  fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử' }));
};

describe('ApprovalPage query state boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeDecision.mockReturnValue({ unwrap: vi.fn() });
    mocks.getMenuDecisions.mockReturnValue({ data: undefined, isError: false, isLoading: false, refetch: vi.fn() });
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage()));
    mocks.getDocuments.mockReturnValue(readyQuery([]));
    mocks.getPurchaseRequests.mockReturnValue(readyQuery(purchaseRequestPage));
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : readyQuery({ success: true, message: 'OK', data: [] }));
  });

  it('renders approval-inbox forbidden without a retry or false empty state', () => {
    mocks.getApprovals.mockReturnValue(failedQuery(403));

    renderPage();

    expect(screen.getAllByText('Bạn không có quyền xem hàng đợi phê duyệt.')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Không có chứng từ chờ duyệt')).toBeNull();
  });

  it('keeps a non-forbidden approval-inbox failure retryable', () => {
    const refetch = vi.fn();
    mocks.getApprovals.mockReturnValue(failedQuery(500, refetch));

    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Thử tải lại' })[0]);

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps approval records visible while the inbox refreshes', () => {
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([approvalRecord]), { isFetching: true }));

    renderPage();

    expect(screen.getAllByText('Duyệt đề xuất mua PR-001')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Đang cập nhật hàng đợi')[0]).toBeInTheDocument();
  });

  it('opens the purchase-request approval dialog from that row and mutates only after confirmation', async () => {
    mocks.getApprovals.mockReturnValue(readyQuery(approvalPage([{
      ...approvalRecord,
      targetCode: 'PR-20260810-FULLDAY',
      title: 'Duyệt đề xuất mua PR-20260810-FULLDAY',
      source: 'PR-20260810-FULLDAY',
    }])));

    renderPage();

    const row = screen.getAllByText('Duyệt đề xuất mua PR-20260810-FULLDAY')[0].closest('article');
    if (!row) throw new Error('Expected the PR approval row to be rendered.');
    fireEvent.click(within(row).getByRole('button', { name: 'Duyệt chứng từ' }));

    const dialog = screen.getByRole('dialog', { name: 'Duyệt đề xuất mua?' });
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

    fireEvent.change(screen.getAllByLabelText('Tìm chứng từ hoặc nguyên liệu')[0], {
      target: { value: 'Bột nở' },
    });
    await waitFor(() => expect(mocks.getApprovals).toHaveBeenLastCalledWith(expect.objectContaining({
      searchKeyword: 'Bột nở',
    })));
  });

  it('renders workflow-document forbidden without pretending the rail is empty', () => {
    mocks.getDocuments.mockReturnValue(failedQuery(403));

    renderPage();

    expect(screen.getByText('Bạn không có quyền xem chứng từ workflow.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('renders purchase-request forbidden on the history tab without a false empty list', () => {
    mocks.getPurchaseRequests.mockReturnValue(failedQuery(403));

    renderPage();
    openHistory();

    expect(screen.getByText('Bạn không có quyền xem danh sách đề xuất mua hàng.')).toBeInTheDocument();
    expect(screen.queryByText('Không có đề xuất mua hàng nào.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('keeps approval history uninitialized until a purchase request is selected', () => {
    renderPage();
    openHistory();

    expect(screen.getByText('Chọn một đề xuất mua hàng ở bên trái để xem tiến trình duyệt')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy bước duyệt nào.')).toBeNull();
  });

  it('renders approval-history forbidden without a retry', () => {
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : failedQuery(403));

    renderPage();
    openHistory();
    fireEvent.click(screen.getByRole('button', { name: /PR-001/ }));

    expect(screen.getByText('Bạn không có quyền xem lịch sử phê duyệt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('keeps history entries visible while refreshing', () => {
    mocks.getHistory.mockImplementation((_args, options) => options.skip
      ? uninitializedQuery()
      : readyQuery(historyResponse, { isFetching: true }));

    renderPage();
    openHistory();
    fireEvent.click(screen.getByRole('button', { name: /PR-001/ }));

    expect(screen.getByText('Quản lý vận hành')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật...')).toBeInTheDocument();
  });
});
