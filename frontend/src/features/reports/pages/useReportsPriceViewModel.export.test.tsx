import { render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/common';
import authReducer from '@/lib/auth/authSlice';
import type { User } from '@/lib/auth/authTypes';
import type {
  PriceVarianceByDishGroupDto,
  PriceVarianceByPeriodDto,
  PriceVarianceBySupplierDto,
  PriceVarianceRow,
} from '@/api/workflowApiTypes';
import { buildCsv } from './reportCsv';

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

import { useReportsPriceViewModel } from './useReportsPriceViewModel';
import ReportsPage from './ReportsPage';

const readyQueryResult = <T,>(data: T, isFetching = false) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
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
  issues: [],
  errorCount: 0,
  warningCount: 0,
  resolvedIssueCount: 0,
  reopenedIssueCount: 0,
  urgentIssueCount: 0,
  missingBomCount: 0,
  invalidUnitCount: 0,
  missingConversionCount: 0,
  negativeStockCount: 0,
  orphanDocumentCount: 0,
  generatedAt: '2026-08-01T00:00:00Z',
  totalIssues: 0,
  isTruncated: false,
};

const emptyQueryResult = () => ({
  data: emptyReadyPage,
  currentData: emptyReadyPage,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

const buildUser = (): User => ({
  id: 'user-thumua',
  username: 'thumua',
  fullName: 'Nhân viên thu mua',
  role: 'thumua',
  isAdminFullAccess: false,
  permissions: ['auth.profile.read', 'dashboard.read', 'inventory.read', 'purchase.read', 'purchase.generate', 'report.read'],
});

const renderReportsPage = (initialPath = '/reports?view=price') => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user: buildUser(), token: 'token', isAuthenticated: true, isLoading: false },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ToastProvider>
          <ReportsPage />
        </ToastProvider>
      </MemoryRouter>
    </Provider>,
  );
};

const mockLineRow: PriceVarianceRow = {
  id: 'line-1',
  name: 'Thịt bò phi lê',
  supplier: 'NCC Thịt Tươi',
  receiptCode: 'PN-20260815-01',
  receiptDate: '2026-08-15',
  quantity: 50,
  unit: 'kg',
  pricePrev: 250000,
  priceCurrent: 280000,
  change: 12,
  warning: true,
};

const mockSupplierRow: PriceVarianceBySupplierDto = {
  ingredientId: 'ing-1',
  ingredientName: 'Thịt heo nạc',
  supplierId: 'sup-1',
  supplierName: 'NCC Thịt Miền Nam',
  receiptCount: 14,
  avgUnitPrice: 115000,
  minUnitPrice: 110000,
  maxUnitPrice: 120000,
  referencePrice: 100000,
  variancePercent: 15,
  isWarning: true,
  unitId: 'kg',
  unitName: 'kg',
};

const mockPeriodRow: PriceVarianceByPeriodDto = {
  ingredientId: 'ing-2',
  ingredientName: 'Gạo ST25',
  periodLabel: '08/2026',
  periodStart: '2026-08-01',
  avgUnitPrice: 32000,
  referencePrice: 30000,
  variancePercentVsReference: 6.67,
  variancePercentVsPreviousPeriod: 3.23,
  isWarning: false,
  unitId: 'kg',
  unitName: 'kg',
};

const mockDishGroupRow: PriceVarianceByDishGroupDto = {
  dishGroup: 'Món xào',
  ingredientCount: 12,
  warningIngredientCount: 2,
  weightedAvgVariancePercent: 8.45,
  topIngredients: [
    { ingredientName: 'Hành tây', variancePercent: 18.5, weight: 0.3 },
    { ingredientName: 'Ớt chuông', variancePercent: 12.0, weight: 0.2 },
  ],
};

describe('useReportsPriceViewModel export configs (Test Group 1)', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(emptyQueryResult));
    mocks.supplyLineReconciliation.mockReturnValue({ data: [] });
  });

  it('exports lines grain when priceSubView is lines', () => {
    mocks.priceVariancePage.mockReturnValue(readyQueryResult({ items: [mockLineRow], totalCount: 1 }));

    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 1,
      priceSubView: 'lines',
      reportQuery: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
      searchParams: new URLSearchParams(),
    }));

    const config = result.current.exportConfig;
    expect(config.filename).toBe('bien-dong-gia');
    expect(config.rows).toEqual([mockLineRow]);

    const headerLabels = config.columns.map(([label]) => label);
    expect(headerLabels).toEqual([
      'Tên nguyên liệu',
      'Nhà cung cấp',
      'Mã phiếu nhập',
      'Ngày nhập',
      'Số lượng',
      'ĐVT',
      'Giá tham chiếu',
      'Giá nhập',
      'Thay đổi (%)',
      'Vượt ngưỡng',
    ]);

    const csv = buildCsv(config.rows, config.columns);
    expect(csv).toContain('Thịt bò phi lê');
    expect(csv).toContain('PN-20260815-01');
    expect(csv).toContain('280000');
    expect(csv).toContain('Có');
  });

  it('exports supplier aggregate grain with unit identity when priceSubView is supplier', () => {
    const boxRow = { ...mockSupplierRow, unitId: 'box', unitName: 'thùng' };
    mocks.priceVarianceBySupplierPage.mockReturnValue(readyQueryResult({ items: [mockSupplierRow, boxRow], totalCount: 2 }));

    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 1,
      priceSubView: 'supplier',
      reportQuery: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
      searchParams: new URLSearchParams(),
    }));

    const config = result.current.exportConfig;
    expect(config.filename).toBe('bien-dong-gia-theo-ncc');
    expect(config.rows).toEqual([mockSupplierRow, boxRow]);

    const headerLabels = config.columns.map(([label]) => label);
    expect(headerLabels).toEqual([
      'Nguyên liệu',
      'Nhà cung cấp',
      'ĐVT',
      'Số lần nhập',
      'Giá TB',
      'Giá thấp nhất',
      'Giá cao nhất',
      'Giá tham chiếu',
      'Biến động (%)',
      'Vượt ngưỡng',
    ]);
    expect(headerLabels).not.toContain('Mã phiếu nhập');
    expect(headerLabels).not.toContain('Ngày nhập');
    expect(headerLabels).not.toContain('Giá nhập');

    const csv = buildCsv(config.rows, config.columns);
    expect(csv).toContain('Thịt heo nạc');
    expect(csv).toContain('NCC Thịt Miền Nam');
    expect(csv).toContain('kg');
    expect(csv).toContain('thùng');
    expect(csv).toContain('115000');
    expect(csv).toContain('110000');
    expect(csv).toContain('120000');
    expect(csv).toContain('100000');
    expect(csv).toContain('Có');
  });

  it('exports period aggregate grain with unit identity when priceSubView is period', () => {
    const boxRow = { ...mockPeriodRow, unitId: 'box', unitName: 'thùng' };
    mocks.priceVarianceByPeriodPage.mockReturnValue(readyQueryResult({ items: [mockPeriodRow, boxRow], totalCount: 2 }));

    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 1,
      priceSubView: 'period',
      reportQuery: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
      searchParams: new URLSearchParams(),
    }));

    const config = result.current.exportConfig;
    expect(config.filename).toBe('bien-dong-gia-theo-thoi-gian');
    expect(config.rows).toEqual([mockPeriodRow, boxRow]);

    const headerLabels = config.columns.map(([label]) => label);
    expect(headerLabels).toEqual([
      'Nguyên liệu',
      'ĐVT',
      'Tháng',
      'Giá TB',
      '% so với tham chiếu',
      '% so với tháng trước',
      'Vượt ngưỡng',
    ]);
    expect(headerLabels).not.toContain('Mã phiếu nhập');

    const csv = buildCsv(config.rows, config.columns);
    expect(csv).toContain('Gạo ST25');
    expect(csv).toContain('kg');
    expect(csv).toContain('thùng');
    expect(csv).toContain('08/2026');
    expect(csv).toContain('32000');
    expect(csv).toContain('6.67');
    expect(csv).toContain('3.23');
    expect(csv).toContain('Không');
  });

  it('exports dishGroup aggregate grain when priceSubView is dishGroup', () => {
    mocks.priceVarianceByDishGroupPage.mockReturnValue(readyQueryResult({ items: [mockDishGroupRow], totalCount: 1 }));

    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 1,
      priceSubView: 'dishGroup',
      reportQuery: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
      searchParams: new URLSearchParams(),
    }));

    const config = result.current.exportConfig;
    expect(config.filename).toBe('bien-dong-gia-theo-nhom-mon');
    expect(config.rows).toEqual([mockDishGroupRow]);

    const headerLabels = config.columns.map(([label]) => label);
    expect(headerLabels).toEqual([
      'Nhóm món',
      'Số nguyên liệu',
      'Số NL vượt ngưỡng',
      '% biến động (có trọng số)',
      'Nguyên liệu ảnh hưởng nhiều nhất',
    ]);
    expect(headerLabels).not.toContain('Mã phiếu nhập');

    const csv = buildCsv(config.rows, config.columns);
    expect(csv).toContain('Món xào');
    expect(csv).toContain('12');
    expect(csv).toContain('2');
    expect(csv).toContain('8.45');
    expect(csv).toContain('Hành tây (18.5%); Ớt chuông (12%)');
  });
});

describe('ReportsPage export button eligibility (Test Group 2)', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset().mockImplementation(emptyQueryResult));
    mocks.supplyLineReconciliation.mockReturnValue({ data: [] });
  });

  it('disables export button when price report is uninitialized', () => {
    mocks.priceVariancePage.mockReturnValue({
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

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeDisabled();
  });

  it('disables export button when price report is loading', () => {
    mocks.priceVariancePage.mockReturnValue({
      data: undefined,
      currentData: undefined,
      isUninitialized: false,
      isLoading: true,
      isFetching: true,
      isSuccess: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeDisabled();
  });

  it('disables export button when price report is forbidden', () => {
    mocks.priceVariancePage.mockReturnValue({
      data: undefined,
      currentData: undefined,
      isUninitialized: false,
      isLoading: false,
      isFetching: false,
      isSuccess: false,
      isError: true,
      error: { status: 403 },
      refetch: vi.fn(),
    });

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeDisabled();
  });

  it('disables export button when price report is in error state', () => {
    mocks.priceVariancePage.mockReturnValue({
      data: undefined,
      currentData: undefined,
      isUninitialized: false,
      isLoading: false,
      isFetching: false,
      isSuccess: false,
      isError: true,
      error: { status: 500 },
      refetch: vi.fn(),
    });

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeDisabled();
  });

  it('disables export button when price report is ready-empty', () => {
    mocks.priceVariancePage.mockReturnValue(readyQueryResult({ items: [], totalCount: 0 }));

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeDisabled();
  });

  it('enables export button when price report is ready with one or more rows', () => {
    mocks.priceVariancePage.mockReturnValue(readyQueryResult({ items: [mockLineRow], totalCount: 1 }));

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeEnabled();
  });

  it('enables export button when price report is refreshing with retained rows', () => {
    mocks.priceVariancePage.mockReturnValue(readyQueryResult({ items: [mockLineRow], totalCount: 1 }, true));

    renderReportsPage('/reports?view=price');
    const exportButton = screen.getByRole('button', { name: /Xuất dữ liệu trang hiện tại/i });
    expect(exportButton).toBeEnabled();
  });
});
