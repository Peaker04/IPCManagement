import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/common';

import { mapDemandAggregateLine } from '@/api/reportMappers';
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

const failedResult = (status: number | 'FETCH_ERROR', refetch = vi.fn()) => ({
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
  remainingToIssueCount: 0,
  pendingKitchenReceiptCount: 0,
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
  serviceRunPage: vi.fn(),
  supplyLineReconciliation: vi.fn(),
}));

vi.mock('@/api/reportsApi', () => ({
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
  useGetServiceRunPageQuery: mocks.serviceRunPage,
  useGetSupplyLineReconciliationQuery: mocks.supplyLineReconciliation,
}));

vi.mock('@/api/chefApi', () => ({
  useGetServiceRunPageQuery: mocks.serviceRunPage,
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

const renderPriceReportsPage = async (role: TestRole, initialPath = '/reports') => {
  // Resolve the lazy price panel before rendering so aggregate CPU contention cannot
  // consume the assertion window while Vite transforms the dynamic import.
  await import('./ReportsPricePanel');
  return renderReportsPage(role, initialPath);
};

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

const PURCHASE_ACCESS_TABS = ['Biến động giá', 'Kế hoạch thu mua'];
const ADMIN_ACCESS_TAB = 'Nhật ký thay đổi';

describe('ReportsPage tab visibility vs WorkflowReportsController policies', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
  });

  it('mounts the selected primary Reports panel as h2 below the shell route heading', () => {
    renderReportsPage('admin', '/reports?view=demand');

    expect(screen.getByRole('heading', { level: 2, name: 'Nhu cầu theo ngày trong khoảng chọn' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Nhu cầu theo ngày trong khoảng chọn' })).not.toBeInTheDocument();
  });

  it.each(['beptruong', 'thukho', 'dieuphoi'] as const)('keeps physical demand read-only for %s without destination authority', (role) => {
    const row = mapDemandAggregateLine({
      requestDate: '2026-08-15', customerId: 'customer-a', customerName: 'Khách A', priceTierAmount: 25000,
      ingredientId: 'rice', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', totalRequiredQty: 200,
      currentStockQty: 200, suggestedPurchaseQty: 0, fulfilledQty: 200, unissuedQty: 0,
      pendingKitchenReceiptQty: 0, outstandingQty: 0, fulfillmentStatus: 'FULFILLED', lineCount: 2, hasCancelledLine: false,
      issuedQty: 0, receivedByKitchenQty: 0, remainingToIssueQty: 200,
    });
    mocks.ingredientDemandPage.mockReturnValue(readyResult({ ...emptyReadyPage, items: [row], totalCount: 42, remainingToIssueCount: 17 }));
    renderReportsPage(role, '/reports?view=demand');
    expect(screen.getByRole('columnheader', { name: 'Đã xuất' })).toBeInTheDocument();
    expect(screen.getByText('Kho xử lý xuất')).toBeInTheDocument();
    expect(screen.getByText('Khách A · 25k · 2 dòng nhu cầu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mở thu mua|Đề xuất mua|Mở checklist/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã đáp ứng đủ')).not.toBeInTheDocument();
  });

  it('hides restricted groups from Bếp trưởng and shows only the active group children', () => {
    renderReportsPage('beptruong');

    expect(screen.queryByRole('tab', { name: 'Chi phí & giá' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kế hoạch & nhu cầu' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kho & sử dụng' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kiểm soát' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Nhu cầu nguyên liệu' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Tồn kho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: ADMIN_ACCESS_TAB })).not.toBeInTheDocument();
  });

  it('hides the same restricted tabs from Điều phối', () => {
    renderReportsPage('dieuphoi');

    [...PURCHASE_ACCESS_TABS, ADMIN_ACCESS_TAB].forEach((label) => {
      expect(screen.queryByRole('tab', { name: label })).not.toBeInTheDocument();
    });
  });

  it('shows every report group to Admin while limiting children to the active group', () => {
    renderReportsPage('admin');

    ['Chi phí & giá', 'Kế hoạch & nhu cầu', 'Kho & sử dụng', 'Kiểm soát'].forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Biến động giá' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Kế hoạch thu mua' })).not.toBeInTheDocument();
  });

  it('shows Thu mua price access and keeps the audit report admin-only', async () => {
    const user = userEvent.setup();
    await renderPriceReportsPage('thumua');

    expect(screen.getByRole('tab', { name: 'Biến động giá' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Kế hoạch & nhu cầu' }));
    expect(await screen.findByRole('tab', { name: 'Kế hoạch thu mua' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: ADMIN_ACCESS_TAB })).not.toBeInTheDocument();
  });

  it('gives Thủ kho only the receipt-price-variance sub tab, not the PurchaseAccess aggregates', async () => {
    await renderPriceReportsPage('thukho');

    // receipt-price-variance dùng PurchaseOrderReadAccess nên Thủ kho vẫn xem được dòng nhập.
    expect(screen.getByRole('tab', { name: 'Biến động giá' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Góc nhìn phân tích biến động giá' })).toBeInTheDocument();
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

  it('keeps Thủ kho on the allowed price sub tab when the URL asks for a PurchaseAccess aggregate', async () => {
    await renderPriceReportsPage('thukho', '/reports?view=price&subview=supplier');

    expect(await screen.findByRole('combobox', { name: 'Góc nhìn phân tích biến động giá' })).toBeInTheDocument();
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

  it('renders an offline request failure as recoverable without a false empty result', () => {
    const refetch = vi.fn();
    mocks.purchasePlanPage.mockReturnValue(failedResult('FETCH_ERROR', refetch));

    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được dữ liệu báo cáo');
    expect(screen.queryByText('Chưa có bản ghi báo cáo.')).toBeNull();
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

    expect(screen.getByText('Chưa có bản ghi báo cáo.')).toBeInTheDocument();
  });

  it('renders source-line reconciliation without grouping legacy lineage into a demand row', async () => {
    const user = userEvent.setup();
    mocks.issueVsReturnPage.mockReturnValue(readyResult(emptyReadyPage));
    mocks.supplyLineReconciliation.mockImplementation((_args: unknown, options?: { skip?: boolean }) => options?.skip
      ? uninitializedResult()
      : readyResult([{
        materialRequestId: 'MR-1',
        materialRequestLineId: 'MRL-1',
        materialRequestCode: 'MR-TEST-001',
        requestDate: '2026-08-09',
        ingredientId: 'ING-1',
        ingredientName: 'Gạo',
        unitId: 'UNIT-1',
        unitName: 'kg',
        demandQty: 10,
        purchaseRequestAllocatedQty: 10,
        purchaseOrderAllocatedQty: 10,
        postedAcceptedReceiptQty: 10,
        issuedQty: 10,
        kitchenAcknowledgedQty: 8,
        returnedQty: 0,
        wastedQty: 0,
        supplementalRequestedQty: 3,
        supplementalFulfilledQty: 2,
        supplementalPurchaseAllocatedQty: 2.5,
        deltaQty: 0,
        disposition: 'LEGACY_LINEAGE_RECONCILIATION_REQUIRED',
        legacyLineageExceptionCount: 3,
      }]));
    renderReportsPage('admin');
    await user.click(screen.getByRole('tab', { name: 'Kho & sử dụng' }));
    await user.click(await screen.findByRole('tab', { name: 'Sử dụng thực tế' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Sử dụng thực tế' })).toHaveAttribute('aria-selected', 'true'));

    expect(await screen.findByText(/Đối soát.*theo dòng nhu cầu/)).toBeInTheDocument();
    expect(screen.getByText('MR-TEST-001')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Đã xuất' })).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: /Bổ sung/ })).toBeInTheDocument();
    expect(screen.getByText('3 kg / 2 kg / 2,5 kg')).toBeInTheDocument();
    expect(screen.getByText('Cần quyết định · 3 dòng')).toBeInTheDocument();
  });

  it('bounds long audit values in a fixed-layout seven-column table', () => {
    mocks.auditChangePage.mockReturnValue(readyResult({
      items: [{
        id: 'audit-1',
        timestamp: '2026-07-30T01:11:07Z',
        actor: 'Admin User',
        businessArea: 'StorekeeperReturnReceipt',
        entityName: 'InventoryReturn',
        fieldName: 'StorekeeperReceived',
        fieldAffected: 'InventoryReturn / StorekeeperReceived',
        oldValue: 'receivedAt=2026-07-29T18:11:07Z',
        newValue: 'receivedAt=2026-07-30T01:11:07Z',
        reason: 'Warehouse receipt reconciled from the source document',
      }],
      hasNext: false,
    }));

    renderReportsPage('admin', '/reports?view=audit');

    const table = document.querySelector<HTMLTableElement>('table.ipc-reports-audit-table');
    if (!table) throw new Error('Không tìm thấy bảng Audit.')
    expect(table).toHaveClass('ipc-reports-audit-table');
    expect(table.querySelectorAll('thead th')).toHaveLength(7);
    expect(table.querySelectorAll('.ipc-reports-audit-value')).toHaveLength(3);
  });

  it('keeps stale price rows visible while refreshing', async () => {
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

    expect((await screen.findAllByText('Gạo tẻ')).length).toBeGreaterThan(0);
    expect(screen.getByText('PN-20260729-01')).toBeInTheDocument();
    expect(screen.getByText('29/07/2026')).toBeInTheDocument();
    expect(screen.getByText('120 kg')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật...')).toBeInTheDocument();
  });

  it('renders the report shift label instead of its enum value', async () => {
    const user = userEvent.setup();
    renderReportsPage('admin');

    const shift = await screen.findByRole('combobox', { name: 'Ca' });
    await user.click(shift);
    await user.click(await screen.findByRole('option', { name: 'Ca sáng' }));

    expect(shift).toHaveTextContent('Ca sáng');
    expect(shift).not.toHaveTextContent('MORNING');
  });
});

describe('ReportsPage composition ownership', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
  });

  it('does not repeat inactive report summaries above the selected report', () => {
    renderReportsPage('admin', '/reports?view=stock');

    expect(screen.queryByText('Cảnh báo giá trên trang')).not.toBeInTheDocument();
    expect(screen.queryByText('Dòng chưa xuất')).not.toBeInTheDocument();
    expect(screen.queryByText('Dòng tồn kho')).not.toBeInTheDocument();
    expect(screen.getByText('Tồn kho hiện tại theo kho')).toBeInTheDocument();
  });

  it('keeps price exceptions and watch states without labeling zero-variance rows as stable', async () => {
    const priceRow = {
      id: 'price-1', name: 'Gạo tẻ', supplier: 'Nhà cung cấp A', receiptCode: 'PN-20260914-01',
      receiptDate: '2026-09-14', quantity: 10, unit: 'kg', pricePrev: 20_000, priceCurrent: 20_000,
      change: 0, warning: false,
    };
    mocks.priceVariancePage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [
        { ...priceRow, id: 'price-warning', name: 'Thịt bò', priceCurrent: 24_000, change: 20, warning: true },
        { ...priceRow, id: 'price-watch', name: 'Thịt gà', priceCurrent: 22_000, change: 10 },
        { ...priceRow, id: 'price-normal' },
      ],
      totalCount: 3,
      pageSize: 6,
    }));

    await renderPriceReportsPage('thumua', '/reports?view=price&subview=lines');

    expect(await screen.findByText('Vượt ngưỡng')).toBeInTheDocument();
    expect(screen.getByText('Theo dõi')).toBeInTheDocument();
    expect(screen.queryByText('Ổn định')).not.toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ').closest('tr')?.querySelector('td:last-child')).toHaveTextContent('0%');
  });

  it('keeps supplier aggregate warning and watch rows without labeling zero variance as stable', async () => {
    const supplierRow = {
      ingredientId: 'ingredient-rice', ingredientName: 'Gạo tẻ', supplierId: 'supplier-a', supplierName: 'Nhà cung cấp A',
      unitId: 'unit-kg', unitName: 'kg', receiptCount: 2, avgUnitPrice: 20_000, minUnitPrice: 20_000,
      maxUnitPrice: 20_000, referencePrice: 20_000, variancePercent: 0, isWarning: false,
    };
    mocks.priceVarianceBySupplierPage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [
        { ...supplierRow, ingredientId: 'ingredient-beef', ingredientName: 'Thịt bò', avgUnitPrice: 24_000, maxUnitPrice: 24_000, variancePercent: 20, isWarning: true },
        { ...supplierRow, ingredientId: 'ingredient-chicken', ingredientName: 'Thịt gà', avgUnitPrice: 22_000, maxUnitPrice: 22_000, variancePercent: 10 },
        supplierRow,
      ],
      totalCount: 3,
    }));

    await renderPriceReportsPage('thumua', '/reports?view=price&subview=supplier');

    expect(await screen.findByText('Vượt ngưỡng')).toBeInTheDocument();
    expect(screen.getByText('Theo dõi')).toBeInTheDocument();
    expect(screen.queryByText('Ổn định')).not.toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ').closest('tr')?.querySelector('td:last-child')).toHaveTextContent('0%');
  });

  it('keeps period aggregate warning and watch rows without labeling zero variance as stable', async () => {
    const periodRow = {
      ingredientId: 'ingredient-rice', ingredientName: 'Gạo tẻ', unitId: 'unit-kg', unitName: 'kg',
      periodLabel: '2026-09', periodStart: '2026-09-01', avgUnitPrice: 20_000, referencePrice: 20_000,
      variancePercentVsReference: 0, variancePercentVsPreviousPeriod: 0, isWarning: false,
    };
    mocks.priceVarianceByPeriodPage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [
        { ...periodRow, ingredientId: 'ingredient-beef', ingredientName: 'Thịt bò', avgUnitPrice: 24_000, variancePercentVsReference: 20, variancePercentVsPreviousPeriod: 18, isWarning: true },
        { ...periodRow, ingredientId: 'ingredient-chicken', ingredientName: 'Thịt gà', avgUnitPrice: 22_000, variancePercentVsReference: 10, variancePercentVsPreviousPeriod: 5 },
        periodRow,
      ],
      totalCount: 3,
    }));

    await renderPriceReportsPage('thumua', '/reports?view=price&subview=period');

    expect(await screen.findByText('Vượt ngưỡng')).toBeInTheDocument();
    expect(screen.getByText('Theo dõi')).toBeInTheDocument();
    expect(screen.queryByText('Ổn định')).not.toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ').closest('tr')).toHaveTextContent('0%0%');
  });

  it('keeps supplier aggregate unit grains distinguishable with collision-free row keys', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supplierRow = {
      ingredientId: 'ingredient-rice', ingredientName: 'Gạo tẻ', supplierId: 'supplier-a', supplierName: 'Nhà cung cấp A',
      unitId: 'unit-kg', unitName: 'kg', receiptCount: 2, avgUnitPrice: 20_000, minUnitPrice: 20_000,
      maxUnitPrice: 20_000, referencePrice: 20_000, variancePercent: 0, isWarning: false,
    };
    mocks.priceVarianceBySupplierPage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [supplierRow, { ...supplierRow, unitId: 'unit-box', unitName: 'thùng' }],
      totalCount: 2,
    }));

    await renderPriceReportsPage('thumua', '/reports?view=price&subview=supplier');

    const rows = (await screen.findAllByText('Gạo tẻ')).map((cell) => cell.closest('tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('ĐVT: kg');
    expect(rows[1]).toHaveTextContent('ĐVT: thùng');
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key|unique "key"/i);
    consoleError.mockRestore();
  });

  it('keeps period aggregate unit grains distinguishable with collision-free row keys', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const periodRow = {
      ingredientId: 'ingredient-rice', ingredientName: 'Gạo tẻ', unitId: 'unit-kg', unitName: 'kg',
      periodLabel: '2026-09', periodStart: '2026-09-01', avgUnitPrice: 20_000, referencePrice: 20_000,
      variancePercentVsReference: 0, variancePercentVsPreviousPeriod: 0, isWarning: false,
    };
    mocks.priceVarianceByPeriodPage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [periodRow, { ...periodRow, unitId: 'unit-box', unitName: 'thùng' }],
      totalCount: 2,
    }));

    await renderPriceReportsPage('thumua', '/reports?view=price&subview=period');

    const rows = (await screen.findAllByText('Gạo tẻ')).map((cell) => cell.closest('tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('ĐVT: kg');
    expect(rows[1]).toHaveTextContent('ĐVT: thùng');
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key|unique "key"/i);
    consoleError.mockRestore();
  });

  it('keeps purchase exceptions visible without labeling warning-free rows as ready', () => {
    const purchaseRow = {
      periodKey: '2026-09-14', groupBy: 'day', periodStart: '2026-09-14', periodEnd: '2026-09-14',
      ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitId: 'unit-kg', unitName: 'kg',
      requiredQty: 10, currentStockQty: 2, pendingReceiptQty: 3, shortageQty: 5,
      suggestedPurchaseQty: 8, estimatedUnitPrice: 20000, estimatedAmount: 100000,
      supplierId: 'supplier-1', supplierName: 'Nhà cung cấp A', expectedDeliveryDate: '2026-09-14',
      warnings: [] as string[],
    };
    mocks.purchasePlanPage.mockReturnValue(readyResult({
      ...emptyReadyPage,
      items: [
        { ...purchaseRow, ingredientId: 'ingredient-quote', warnings: ['Chưa có báo giá NCC đang hiệu lực.'] },
        { ...purchaseRow, ingredientId: 'ingredient-pending', ingredientName: 'Thịt gà', warnings: ['Có lượng đang chờ nhập kho, cần đối chiếu trước khi đặt mua thêm.'] },
        { ...purchaseRow, ingredientId: 'ingredient-shortage', ingredientName: 'Cà rốt', warnings: ['Còn thiếu so với demand sau khi trừ pending receipt.'] },
        { ...purchaseRow, ingredientId: 'ingredient-ready', ingredientName: 'Bí đỏ', warnings: [] },
      ],
      totalCount: 4,
      totalShortageQty: 20,
      totalEstimatedAmount: 400000,
    }));

    renderReportsPage('thumua', '/reports?view=purchase');

    expect(screen.getByText('Thiếu báo giá')).toBeInTheDocument();
    expect(screen.getByText('Chờ nhập kho')).toBeInTheDocument();
    expect(screen.getByText('Còn thiếu')).toBeInTheDocument();
    expect(screen.getByTitle('Chưa có báo giá NCC đang hiệu lực.')).toBeInTheDocument();
    expect(screen.getByTitle('Có lượng đang chờ nhập kho, cần đối chiếu trước khi đặt mua thêm.')).toBeInTheDocument();
    expect(screen.getByTitle('Còn thiếu so với demand sau khi trừ pending receipt.')).toBeInTheDocument();
    expect(screen.queryByText('Sẵn sàng')).not.toBeInTheDocument();
    expect(screen.getByText('Bí đỏ').closest('tr')?.querySelector('td:last-child')).toBeEmptyDOMElement();
    expect(screen.getAllByText('Nhà cung cấp A')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Theo ngày' })).toBeInTheDocument();
  });
});

describe('ReportsPage server-side stock search', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(readyWhenActive));
    mocks.supplyLineReconciliation.mockImplementation((_args: unknown, options?: { skip?: boolean }) => options?.skip
      ? uninitializedResult()
      : readyResult([]));
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
