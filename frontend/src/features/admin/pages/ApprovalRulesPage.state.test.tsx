import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/common';

const mocks = vi.hoisted(() => ({
  rules: vi.fn(),
  employees: vi.fn(),
}));

vi.mock('@/api/workflowApi', () => ({
  useGetApprovalRulesQuery: mocks.rules,
  useCreateApprovalRuleMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateApprovalRuleMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteApprovalRuleMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/features/admin/adminApi', () => ({
  useGetAdminEmployeesQuery: mocks.employees,
}));

import ApprovalRulesPage from './ApprovalRulesPage';

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

const rulesResponse = (data: unknown[] = []) => ({ success: true, message: 'OK', data });
const employeesResponse = (items: unknown[] = [], totalCount = items.length) => ({
  success: true,
  message: 'OK',
  data: { items, totalCount, pageNumber: 1, pageSize: 200, totalPages: Math.ceil(totalCount / 200), hasPrev: false, hasNext: totalCount > 200 },
});

const approvalRule = {
  ruleId: 'rule-1',
  ruleName: 'Duyệt đề xuất mua',
  documentType: 'purchase-request',
  minAmount: null,
  maxAmount: null,
  slaHours: 24,
  isActive: true,
  approvalassignments: [],
};

const renderPage = () => render(
  <ToastProvider>
    <ApprovalRulesPage />
  </ToastProvider>,
);

describe('ApprovalRulesPage query state boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rules.mockReturnValue(readyQuery(rulesResponse()));
    mocks.employees.mockReturnValue(readyQuery(employeesResponse()));
  });

  it('renders rules forbidden without retry or a false empty state', () => {
    mocks.rules.mockReturnValue(failedQuery(403));

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xem quy tắc phê duyệt.');
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Chưa có quy tắc phê duyệt nào được thiết lập.')).toBeNull();
  });

  it('keeps a non-forbidden rules failure retryable', () => {
    const refetch = vi.fn();
    mocks.rules.mockReturnValue(failedQuery(500, refetch));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps stale rules visible while refreshing', () => {
    mocks.rules.mockReturnValue(readyQuery(rulesResponse([approvalRule]), { isFetching: true }));

    renderPage();

    expect(screen.getByText('Duyệt đề xuất mua')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật quy tắc phê duyệt')).toBeInTheDocument();
  });

  it('keeps employees uninitialized distinct from an empty employee list', () => {
    mocks.employees.mockReturnValue(uninitializedQuery());

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm quy tắc' }));

    expect(screen.getByText('Mở biểu mẫu quy tắc để tải danh sách nhân viên.')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').at(-1)).toBeDisabled();
  });

  it('renders employee forbidden in the dialog without retry', () => {
    mocks.employees.mockReturnValue(failedQuery(403));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm quy tắc' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xem danh sách nhân viên chỉ định.');
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
  });

  it('keeps an employee loading failure retryable inside the dialog', () => {
    const refetch = vi.fn();
    mocks.employees.mockReturnValue(failedQuery(500, refetch));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm quy tắc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows partial evidence when the employee selector is truncated', () => {
    mocks.employees.mockReturnValue(readyQuery(employeesResponse([
      { userId: 'employee-1', fullName: 'Nhân viên 1', username: 'employee1' },
    ], 201)));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm quy tắc' }));

    expect(screen.getByText('Danh sách nhân viên bị giới hạn')).toBeInTheDocument();
    expect(screen.getByText(/1\/201 nhân viên/)).toBeInTheDocument();
  });
});
