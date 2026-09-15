import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  dataQuality: vi.fn(),
  demand: vi.fn(),
  purchase: vi.fn(),
  stock: vi.fn(),
  stockMovement: vi.fn(),
  kitchen: vi.fn(),
  usage: vi.fn(),
  price: vi.fn(),
  priceBySupplier: vi.fn(),
  priceByPeriod: vi.fn(),
  priceByDishGroup: vi.fn(),
  serviceRun: vi.fn(),
  supplyLineReconciliation: vi.fn(),
}));

vi.mock('@/api/reportsApi', () => ({
  useGetAuditChangePageQuery: mocks.audit,
  useGetCurrentStockPageQuery: mocks.stock,
  useGetDataQualityPageQuery: mocks.dataQuality,
  useGetIngredientDemandPageQuery: mocks.demand,
  useGetIngredientDemandAggregatePageQuery: mocks.demand,
  useGetIssueVsReturnUsagePageQuery: mocks.usage,
  useGetKitchenIssuesPageQuery: mocks.kitchen,
  useGetPriceVariancePageQuery: mocks.price,
  useGetPriceVarianceBySupplierPageQuery: mocks.priceBySupplier,
  useGetPriceVarianceByPeriodPageQuery: mocks.priceByPeriod,
  useGetPriceVarianceByDishGroupPageQuery: mocks.priceByDishGroup,
  useGetPurchasePlanPageQuery: mocks.purchase,
  useGetStockMovementPageQuery: mocks.stockMovement,
  useGetServiceRunPageQuery: mocks.serviceRun,
  useGetSupplyLineReconciliationQuery: mocks.supplyLineReconciliation,
}));

import { useReportsAuditQualityViewModel } from './useReportsAuditQualityViewModel';
import { useReportsPriceViewModel } from './useReportsPriceViewModel';
import { useReportsPageModel } from './useReportsPageModel';

const readyQuery = (data: unknown) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

const defaultPermissions = {
  canReadAuditChanges: true,
  canReadPurchaseReports: true,
  canReadWarehouseReports: true,
};

const createWrapper = (initialEntries = ['/reports']) => ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={initialEntries}>
    {children}
  </MemoryRouter>
);

describe('Reports server-search ownership', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.audit.mockReturnValue(readyQuery({ items: [], hasNext: false }));
    mocks.dataQuality.mockReturnValue(readyQuery({ page: { items: [], totalCount: 0 } }));
    mocks.demand.mockReturnValue(readyQuery({ items: [], totalCount: 0, remainingToIssueCount: 0 }));
    mocks.purchase.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.stock.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.stockMovement.mockReturnValue(readyQuery({ items: [], hasNext: false }));
    mocks.kitchen.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.usage.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.price.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceBySupplier.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByPeriod.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByDishGroup.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.serviceRun.mockReturnValue(readyQuery({ items: [] }));
    mocks.supplyLineReconciliation.mockReturnValue(readyQuery([]));
  });

  it('sends the trimmed data-quality search on the owned first page', async () => {
    const { result } = renderHook(() => useReportsAuditQualityViewModel({
      activeView: 'data-quality',
      initialPage: 3,
      operationalPageSize: 8,
      reportPageSize: 8,
      reportQuery: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      sortDirection: 'desc',
    }));

    act(() => result.current.setDataQualitySearch('  sai lệch  '));

    await waitFor(() => expect(mocks.dataQuality).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 1,
      searchKeyword: 'sai lệch',
    }), { skip: false }));
  });

  it('sends the trimmed price search on the owned first page', async () => {
    const { result } = renderHook(() => useReportsPriceViewModel({
      activeView: 'price',
      initialPage: 4,
      priceSubView: 'lines',
      reportQuery: { dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      searchParams: new URLSearchParams(),
    }));

    act(() => result.current.setPriceSearch('  Bún  '));

    await waitFor(() => expect(mocks.price).toHaveBeenLastCalledWith(expect.objectContaining({
      pageNumber: 1,
      searchKeyword: 'Bún',
    }), { skip: false }));
  });
});

describe('Reports filter changes reset pagination (IA-17B)', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.audit.mockReturnValue(readyQuery({ items: [], hasNext: false }));
    mocks.dataQuality.mockReturnValue(readyQuery({ page: { items: [], totalCount: 0 } }));
    mocks.demand.mockReturnValue(readyQuery({ items: [], totalCount: 0, remainingToIssueCount: 0 }));
    mocks.purchase.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.stock.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.stockMovement.mockReturnValue(readyQuery({ items: [], hasNext: false }));
    mocks.kitchen.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.usage.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.price.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceBySupplier.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByPeriod.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.priceByDishGroup.mockReturnValue(readyQuery({ items: [], totalCount: 0 }));
    mocks.serviceRun.mockReturnValue(readyQuery({ items: [] }));
    mocks.supplyLineReconciliation.mockReturnValue(readyQuery([]));
  });

  it('resets numbered pages and URL page when dateFrom changes', async () => {
    const { result } = renderHook(
      () => useReportsPageModel(defaultPermissions),
      { wrapper: createWrapper(['/reports?view=demand&page=5&pageSize=8']) },
    );

    expect(result.current.activeView).toBe('demand');
    expect(result.current.demandPage).toBe(5);
    expect(result.current.searchParams.get('page')).toBe('5');
    expect(result.current.searchParams.get('pageSize')).toBe('8');

    // User changes dateFrom
    act(() => {
      result.current.setDateFrom('2026-08-01');
    });

    expect(result.current.dateFrom).toBe('2026-08-01');
    expect(result.current.demandPage).toBe(1);
    expect(result.current.searchParams.get('page')).not.toBe('5');
    expect(result.current.searchParams.get('pageSize')).toBe('8');
    expect(result.current.activeView).toBe('demand');

    // Query must be invoked with new date and pageNumber 1
    await waitFor(() => expect(mocks.demand).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFrom: '2026-08-01',
      pageNumber: 1,
    }), { skip: false }));
  });

  it('resets all aggregate price pages while preserving active price subview when dateTo changes', async () => {
    const { result } = renderHook(
      () => useReportsPageModel(defaultPermissions),
      { wrapper: createWrapper(['/reports?view=price&subview=supplier&page=3&pageSize=8']) },
    );

    expect(result.current.activeView).toBe('price');
    expect(result.current.priceSubView).toBe('supplier');

    // Advance inactive price pages as well
    act(() => {
      result.current.setSupplierPage(3);
      result.current.setPricePage(2);
      result.current.setPeriodPage(4);
      result.current.setDishGroupPage(2);
    });

    expect(result.current.supplierPage).toBe(3);
    expect(result.current.pricePage).toBe(2);
    expect(result.current.periodPage).toBe(4);
    expect(result.current.dishGroupPage).toBe(2);

    // User changes dateTo
    act(() => {
      result.current.setDateTo('2026-08-31');
    });

    expect(result.current.dateTo).toBe('2026-08-31');
    expect(result.current.activeView).toBe('price');
    expect(result.current.priceSubView).toBe('supplier');
    expect(result.current.supplierPage).toBe(1);
    expect(result.current.pricePage).toBe(1);
    expect(result.current.periodPage).toBe(1);
    expect(result.current.dishGroupPage).toBe(1);
    expect(result.current.searchParams.get('page')).not.toBe('3');

    // Query must be invoked with new dateTo and pageNumber 1
    await waitFor(() => expect(mocks.priceBySupplier).toHaveBeenLastCalledWith(expect.objectContaining({
      dateTo: '2026-08-31',
      pageNumber: 1,
    }), { skip: false }));
  });

  it('resets cursor pagination when shift changes', async () => {
    const { result } = renderHook(
      () => useReportsPageModel(defaultPermissions),
      { wrapper: createWrapper(['/reports?view=movement']) },
    );

    expect(result.current.activeView).toBe('movement');

    // Advance cursor stack
    act(() => {
      result.current.setMovementCursors([
        { cursorDate: '2026-08-15', cursorId: 'mov-1', cursorOffset: 20 },
      ]);
    });

    expect(result.current.movementCursors).toHaveLength(1);

    // User changes shift
    act(() => {
      result.current.setShiftName('Ca sáng');
    });

    expect(result.current.shiftName).toBe('Ca sáng');
    expect(result.current.movementCursors).toHaveLength(0);
    expect(result.current.activeView).toBe('movement');

    // Query must be invoked with shift and without cursor
    await waitFor(() => expect(mocks.stockMovement).toHaveBeenLastCalledWith(expect.objectContaining({
      shiftName: 'Ca sáng',
      cursorDate: undefined,
      cursorId: undefined,
      cursorOffset: undefined,
    }), { skip: false }));
  });

  it('does not reset pagination when filter value is unchanged', () => {
    const { result } = renderHook(
      () => useReportsPageModel(defaultPermissions),
      { wrapper: createWrapper(['/reports?view=demand&page=1&pageSize=8']) },
    );

    // Initial filter set
    act(() => {
      result.current.setDateFrom('2026-08-01');
    });

    // Advance page to 3
    act(() => {
      result.current.setDemandPage(3);
    });
    expect(result.current.demandPage).toBe(3);

    // Set same dateFrom again
    act(() => {
      result.current.setDateFrom('2026-08-01');
    });

    // Page must remain 3
    expect(result.current.demandPage).toBe(3);
  });

  it('tab change behavior remains unchanged and resets report pages', () => {
    const { result } = renderHook(
      () => useReportsPageModel(defaultPermissions),
      { wrapper: createWrapper(['/reports?view=demand&page=4&pageSize=8']) },
    );

    act(() => {
      result.current.resetReportPages();
    });

    expect(result.current.demandPage).toBe(1);
    expect(result.current.purchasePage).toBe(1);
    expect(result.current.pricePage).toBe(1);
    expect(result.current.supplierPage).toBe(1);
    expect(result.current.stockPage).toBe(1);
    expect(result.current.kitchenPage).toBe(1);
    expect(result.current.usagePage).toBe(1);
    expect(result.current.dataQualityPage).toBe(1);
    expect(result.current.movementCursors).toHaveLength(0);
    expect(result.current.auditCursors).toHaveLength(0);
  });
});
