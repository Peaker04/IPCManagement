import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  createQuotation: vi.fn(),
  updateQuotation: vi.fn(),
  deactivateQuotation: vi.fn(),
  ingredients: vi.fn(),
}));

vi.mock('@/components/common', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/api/dishCatalogApi', () => ({
  useGetIngredientsQuery: mocks.ingredients,
}));

vi.mock('@/api/purchasingApi', () => ({
  useCreateSupplierQuotationMutation: () => [mocks.createQuotation, { isLoading: false }],
  useDeactivateSupplierQuotationMutation: () => [mocks.deactivateQuotation],
  useGetSupplierQuotationsByIngredientPageQuery: () => ({ data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8 }, isSuccess: true, isLoading: false, isFetching: false, isError: false, isUninitialized: false, refetch: vi.fn() }),
  useGetSuppliersQuery: () => ({ data: [], isSuccess: true, isLoading: false, isFetching: false, isError: false, isUninitialized: false, refetch: vi.fn() }),
  useUpdateSupplierQuotationMutation: () => [mocks.updateQuotation],
}));

import { useSupplierQuotations } from './useSupplierQuotations';
import supplierQuotationSource from './useSupplierQuotations.ts?raw';

const submitEvent = { preventDefault: vi.fn() } as never;

describe('useSupplierQuotations feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ingredients.mockReturnValue({ data: [], isSuccess: true, isLoading: false, isFetching: false, isError: false, isUninitialized: false, refetch: vi.fn() });
  });

  it('defers the trimmed ingredient server search and retains quotation page reset', async () => {
    expect(supplierQuotationSource).toContain('const deferredIngredientSearch = useDeferredValue(ingredientSearch.trim());');
    expect(supplierQuotationSource).toContain('deferredIngredientSearch ? { searchKeyword: deferredIngredientSearch } : undefined');

    const { result } = renderHook(() => useSupplierQuotations());
    act(() => result.current.setPage(3));
    act(() => result.current.setIngredientSearch('  Gạo  '));

    await waitFor(() => expect(mocks.ingredients).toHaveBeenLastCalledWith(
      { searchKeyword: 'Gạo' },
      { skip: false },
    ));

    act(() => result.current.selectIngredient('ingredient-1'));
    expect(result.current.page).toBe(1);
  });

  it('keeps validation field-local and preserves first-failure ordering', async () => {
    const { result } = renderHook(() => useSupplierQuotations());

    await act(() => result.current.submit(submitEvent));
    expect(result.current.validationErrors).toEqual({
      ingredientId: { title: 'Thiếu nguyên liệu', message: 'Vui lòng chọn nguyên liệu trước khi nhập báo giá.' },
    });

    act(() => result.current.selectIngredient('ingredient-1'));
    await act(() => result.current.submit(submitEvent));
    expect(result.current.validationErrors).toEqual({
      supplierId: { title: 'Thiếu nhà cung cấp', message: 'Vui lòng chọn nhà cung cấp cho báo giá.' },
    });

    act(() => result.current.setForm({ supplierId: 'supplier-1', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' }));
    await act(() => result.current.submit(submitEvent));
    expect(result.current.validationErrors).toEqual({
      unitPrice: { title: 'Đơn giá chưa hợp lệ', message: 'Vui lòng nhập đơn giá lớn hơn 0.' },
    });

    act(() => result.current.setForm({ supplierId: 'supplier-1', unitPrice: '20000', effectiveFrom: '', effectiveTo: '', note: '' }));
    await act(() => result.current.submit(submitEvent));
    expect(result.current.validationErrors).toEqual({
      effectiveFrom: { title: 'Thiếu ngày bắt đầu', message: 'Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.' },
    });
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('keeps save and deactivate failures in persistent workflow state', async () => {
    mocks.createQuotation.mockReturnValue({ unwrap: vi.fn().mockRejectedValue({ data: { message: 'Khoảng hiệu lực bị trùng.' } }) });
    mocks.deactivateQuotation.mockReturnValue({ unwrap: vi.fn().mockRejectedValue({ data: { message: 'Báo giá đang được sử dụng.' } }) });
    const { result } = renderHook(() => useSupplierQuotations());

    act(() => {
      result.current.selectIngredient('ingredient-1');
      result.current.setForm({ supplierId: 'supplier-1', unitPrice: '20000', effectiveFrom: '2026-07-30', effectiveTo: '', note: '' });
    });
    await act(() => result.current.submit(submitEvent));
    expect(result.current.saveError).toBe('Khoảng hiệu lực bị trùng.');

    act(() => result.current.setDeactivateTargetId('quotation-1'));
    await act(() => result.current.confirmDeactivate());
    expect(result.current.deactivateError).toBe('Báo giá đang được sử dụng.');
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('retains the short success toast after deactivation', async () => {
    mocks.deactivateQuotation.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    const { result } = renderHook(() => useSupplierQuotations());

    act(() => result.current.setDeactivateTargetId('quotation-1'));
    await act(() => result.current.confirmDeactivate());

    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Đã ngừng báo giá', variant: 'success' });
    expect(result.current.deactivateTargetId).toBeNull();
  });
});
