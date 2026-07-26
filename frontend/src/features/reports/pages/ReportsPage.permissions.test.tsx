import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import authReducer from '@/features/auth/authSlice';
import type { User } from '@/features/auth/authTypes';

const emptyResult = () => ({ data: undefined, isFetching: false, isError: false, refetch: vi.fn() });

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

vi.mock('@/features/workflow', () => ({
  useGetAuditChangePageQuery: mocks.auditChangePage,
  useGetCurrentStockPageQuery: mocks.currentStockPage,
  useGetDataQualityPageQuery: mocks.dataQualityPage,
  useGetIngredientDemandPageQuery: mocks.ingredientDemandPage,
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
        <ReportsPage />
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
    Object.values(mocks).forEach((mock) => mock.mockReset().mockReturnValue(emptyResult()));
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
    Object.values(mocks).forEach((mock) => mock.mockReset().mockReturnValue(emptyResult()));
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
