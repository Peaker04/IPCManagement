import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/common';

import authReducer from '@/lib/auth/authSlice';
import type { User } from '@/lib/auth/authTypes';

const emptyResult = () => ({ data: undefined, isFetching: false, isError: false, refetch: vi.fn() });

const uninitializedResult = () => ({
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

const failedResult = (status: number, refetch = vi.fn()) => ({
  ...uninitializedResult(),
  isUninitialized: false,
  isError: true,
  error: { status },
  refetch,
});

const readyResult = <T,>(data: T, overrides: Record<string, unknown> = {}) => ({
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

const emptyReadyPage = {
  items: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 8,
  totalPages: 0,
  hasPrev: false,
  hasNext: false,
  shortageCount: 0,
  totalShortageQty: 0,
  totalEstimatedAmount: 0,
  page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false },
  totalIssues: 0,
  errorCount: 0,
  warningCount: 0,
  urgentIssueCount: 0,
  resolvedIssueCount: 0,
  missingBomCount: 0,
  missingConversionCount: 0,
};

const readyWhenActive = (_args: unknown, options?: { skip?: boolean }) => options?.skip
  ? uninitializedResult()
  : readyResult(emptyReadyPage);

const mocks = vi.hoisted(() => ({
  auditChangePage: vi.fn(),
  currentStockPage: vi.fn(),
  dataQualityPage: vi.fn(),
  ingredientDemandPage: vi.fn(),
  issueVsReturnPage: vi.fn(),
  kitchenIssuesPage: vi.fn(),
  priceVariancePage: vi.fn(),
  priceVarianceBySupplierPage: vi.fn(),
  priceVarianceByPeriodPage: vi.fn(),
  priceVarianceByDishGroupPage: vi.fn(),
  purchasePlanPage: vi.fn(),
  stockMovementPage: vi.fn(),
}));

vi.mock('@/api/workflowApi', () => ({
  useGetAuditChangePageQuery: mocks.auditChangePage,
  useGetCurrentStockPageQuery: mocks.currentStockPage,
  useGetDataQualityPageQuery: mocks.dataQualityPage,
  useGetIngredientDemandPageQuery: mocks.ingredientDemandPage,
  useGetIngredientDemandAggregatePageQuery: mocks.ingredientDemandPage,
  useGetIssueVsReturnUsagePageQuery: mocks.issueVsReturnPage,
  useGetKitchenIssuesPageQuery: mocks.kitchenIssuesPage,
  useGetPriceVariancePageQuery: mocks.priceVariancePage,
  useGetPriceVarianceBySupplierPageQuery: mocks.priceVarianceBySupplierPage,
  useGetPriceVarianceByPeriodPageQuery: mocks.priceVarianceByPeriodPage,
  useGetPriceVarianceByDishGroupPageQuery: mocks.priceVarianceByDishGroupPage,
  useGetPurchasePlanPageQuery: mocks.purchasePlanPage,
  useGetStockMovementPageQuery: mocks.stockMovementPage,
}));

import ReportsPage from './ReportsPage';

// Permission set do backend AuthorizationPolicies.ResolvePermissions phát cho từng role.
const PERMISSIONS_BY_ROLE = {
  beptruong: ['auth.profile.read', 'dashboard.read', 'catalog.read', 'production.read', 'report.read'],
  thumua: ['auth.profile.read', 'dashboard.read', 'inventory.read', 'purchase.read', 'purchase.generate', 'report.read'],
  thukho: ['auth.profile.read', 'dashboard.read', 'inventory.read', 'warehouse.read', 'report.read'],
  dieuphoi: ['auth.profile.read', 'dashboard.read', 'catalog.read', 'coordination.read', 'demand.generate', 'report.read'],
  admin: ['*'],
} as const;

type TestRole = keyof typeof PERMISSIONS_BY_ROLE;

const buildUser = (role: TestRole): User => ({
  id: `user-${role}`,
  username: role,
  fullName: role,
  role,
  isAdminFullAccess: role === 'admin',
  permissions: [...PERMISSIONS_BY_ROLE[role]],
});

const renderReportsPage = (role: TestRole, initialPath = '/reports') => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user: buildUser(role), token: 'token', isAuthenticated: true, isLoading: false },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ToastProvider><ReportsPage /></ToastProvider>
      </MemoryRouter>
    </Provider>,
  );
};

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

const PURCHASE_ACCESS_TABS = ['Biến động giá', 'Kế hoạch thu mua'];
const ADMIN_ACCESS_TAB = 'Nhật ký thay đổi';
const ALWAYS_VISIBLE_TABS = ['Nhu cầu nguyên liệu', 'Tồn kho', 'Nhập/xuất kho', 'Xuất bếp', 'Sử dụng thực tế', 'Chất lượng dữ liệu'];

describe('ReportsPage tab visibility vs WorkflowReportsController policies', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
  });

  it('hides price-variance, purchase-plan and audit tabs from Bếp trưởng', () => {
    renderReportsPage('beptruong');

    [...PURCHASE_ACCESS_TABS, ADMIN_ACCESS_TAB].forEach((label) => {
      expect(screen.queryByRole('tab', { name: label })).not.toBeInTheDocument();
    });
    ALWAYS_VISIBLE_TABS.forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });
  });

  it('hides the same restricted tabs from Điều phối', () => {
    renderReportsPage('dieuphoi');

    [...PURCHASE_ACCESS_TABS, ADMIN_ACCESS_TAB].forEach((label) => {
      expect(screen.queryByRole('tab', { name: label })).not.toBeInTheDocument();
    });
  });

  it('shows every report tab to Admin', () => {
    renderReportsPage('admin');

    [...PURCHASE_ACCESS_TABS, ADMIN_ACCESS_TAB, ...ALWAYS_VISIBLE_TABS].forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });
  });

  it('shows price tabs to Thu mua but keeps the audit log admin-only', () => {
    renderReportsPage('thumua');

    PURCHASE_ACCESS_TABS.forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });
    expect(screen.queryByRole('tab', { name: ADMIN_ACCESS_TAB })).not.toBeInTheDocument();
    // PurchaseAccess cũng mở 3 cách phân tích tổng hợp của price-variance/*.
    expect(screen.getByRole('tab', { name: 'Theo nhà cung cấp' })).toBeInTheDocument();
  });

  it('gives Thủ kho only the receipt-price-variance sub tab, not the PurchaseAccess aggregates', () => {
    renderReportsPage('thukho');

    // receipt-price-variance dùng PurchaseOrderReadAccess nên Thủ kho vẫn xem được dòng nhập.
    expect(screen.getByRole('tab', { name: 'Biến động giá' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Theo dòng nhập' })).toBeInTheDocument();
    ['Theo nhà cung cấp', 'Theo thời gian', 'Theo nhóm món'].forEach((label) => {
      expect(screen.queryByRole('tab', { name: label })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('tab', { name: 'Kế hoạch thu mua' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: ADMIN_ACCESS_TAB })).not.toBeInTheDocument();
  });
});

describe('ReportsPage falls back when the URL points at a forbidden tab', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
  });

  it('forces Bếp trưởng from ?view=audit to the first allowed tab without calling the audit query', () => {
    renderReportsPage('beptruong', '/reports?view=audit');

    expect(tabNames()).not.toContain(ADMIN_ACCESS_TAB);
    expect(screen.getByRole('tab', { name: 'Nhu cầu nguyên liệu' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.auditChangePage).toHaveBeenCalledWith(expect.anything(), { skip: true });
    expect(mocks.ingredientDemandPage).toHaveBeenCalledWith(expect.anything(), { skip: false });
  });

  it('forces Bếp trưởng from ?view=purchase to the first allowed tab without calling the purchase-plan query', () => {
    renderReportsPage('beptruong', '/reports?view=purchase');

    expect(screen.getByRole('tab', { name: 'Nhu cầu nguyên liệu' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.purchasePlanPage).toHaveBeenCalledWith(expect.anything(), { skip: true });
  });

  it('keeps Thủ kho on the allowed price sub tab when the URL asks for a PurchaseAccess aggregate', () => {
    renderReportsPage('thukho', '/reports?view=price&subview=supplier');

    expect(screen.getByRole('tab', { name: 'Theo dòng nhập' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.priceVarianceBySupplierPage).toHaveBeenCalledWith(expect.anything(), { skip: true });
    expect(mocks.priceVariancePage).toHaveBeenCalledWith(expect.anything(), { skip: false });
  });
});

describe('ReportsPage never turns a rejected report query into an empty state', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockReturnValue(emptyResult()));
  });

  it('shows the error alert instead of "Chưa có dữ liệu" when purchase-plan is rejected', () => {
    mocks.purchasePlanPage.mockReturnValue({ ...emptyResult(), isError: true });
    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được dữ liệu báo cáo');
    expect(screen.queryByText('Chưa có dữ liệu để hiển thị')).not.toBeInTheDocument();
  });
});

describe('ReportsPage query state boundary', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockReturnValue(emptyResult()));
  });

  it('keeps an uninitialized active report distinct from a ready-empty report', () => {
    mocks.purchasePlanPage.mockReturnValue(uninitializedResult());

    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByText('Mở báo cáo kế hoạch thu mua để tải dữ liệu.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có dữ liệu để hiển thị')).toBeNull();
  });

  it('renders query-level forbidden without retry or a false empty table', () => {
    mocks.purchasePlanPage.mockReturnValue(failedResult(403));

    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xem báo cáo kế hoạch thu mua.');
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Chưa có dữ liệu để hiển thị')).toBeNull();
  });

  it('keeps a non-forbidden report failure retryable', () => {
    const refetch = vi.fn();
    mocks.purchasePlanPage.mockReturnValue(failedResult(500, refetch));

    renderReportsPage('thumua', '/reports?view=purchase');
    screen.getByRole('button', { name: 'Thử tải lại' }).click();

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders an empty table only after the active report is ready', () => {
    mocks.purchasePlanPage.mockReturnValue(readyResult({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 8,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
      totalShortageQty: 0,
      totalEstimatedAmount: 0,
    }));

    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByText('Chưa có dữ liệu để hiển thị')).toBeInTheDocument();
  });

  it('keeps stale price rows visible while refreshing', () => {
    mocks.priceVariancePage.mockReturnValue(readyResult({
      items: [{
        id: 'price-1',
        name: 'Gạo tẻ',
        unit: 'kg',
        receiptCode: 'PN-20260729-01',
        receiptDate: '2026-07-29',
        quantity: 120,
        pricePrev: 20_000,
        priceCurrent: 22_000,
        supplier: 'NCC A',
        change: 10,
        warning: true,
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 6,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    }, { isFetching: true }));

    renderReportsPage('admin');

    expect(screen.getAllByText('Gạo tẻ').length).toBeGreaterThan(0);
    expect(screen.getByText('PN-20260729-01')).toBeInTheDocument();
    expect(screen.getByText('29/07/2026')).toBeInTheDocument();
    expect(screen.getByText('120 kg')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật báo cáo')).toBeInTheDocument();
  });

  it('renders the report shift label instead of its enum value', async () => {
    const user = userEvent.setup();
    renderReportsPage('admin');

    const shift = screen.getByRole('combobox', { name: 'Ca' });
    await user.click(shift);
    await user.click(await screen.findByRole('option', { name: 'Ca sáng' }));

    expect(shift).toHaveTextContent('Ca sáng');
    expect(shift).not.toHaveTextContent('MORNING');
  });
});

describe('ReportsPage server-side stock search', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
  });

  it('filters the current-stock snapshot before page-number pagination', async () => {
    renderReportsPage('admin', '/reports?view=stock');
    fireEvent.change(screen.getByLabelText('Tìm trong snapshot tồn kho hiện tại'), { target: { value: 'Lá lốt' } });

    await waitFor(() => expect(mocks.currentStockPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchKeyword: 'Lá lốt', pageNumber: 1 }),
      { skip: false },
    ));
  });

  it('filters stock movements before cursor pagination', async () => {
    renderReportsPage('admin', '/reports?view=movement');
    fireEvent.change(screen.getByLabelText('Tìm bút toán trong khoảng ngày'), { target: { value: 'RETURN' } });

    await waitFor(() => expect(mocks.stockMovementPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchKeyword: 'RETURN', cursorDate: undefined, cursorOffset: undefined }),
      { skip: false },
    ));
  });
});
