import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addBomLine: vi.fn(),
  updateBomLine: vi.fn(),
}));

const readyQuery = <T,>(data: T) => ({
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

vi.mock('@/api/dishCatalogApi', () => ({
  useAddDishBomLineMutation: () => [mocks.addBomLine, { isLoading: false }],
  useCloseDishBomLineMutation: () => [vi.fn(), { isLoading: false }],
  useCommitBomImportMutation: () => [vi.fn(), { isLoading: false }],
  useDownloadBomTemplateMutation: () => [vi.fn(), { isLoading: false }],
  useGetAdminDishCatalogQuery: () => readyQuery([{ id: 'dish-1', code: 'MON-01', name: 'Món 1', isActive: true, ingredients: [] }]),
  useGetIngredientsQuery: () => readyQuery([{ ingredientId: 'ingredient-1', ingredientCode: 'NL-01', ingredientName: 'Gạo', unitId: 'unit-1', unitName: 'kg' }]),
  usePreviewBomImportMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateDishBomLineMutation: () => [mocks.updateBomLine, { isLoading: false }],
}));

import { AdminBomPanel } from './AdminBomPanel';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { useAdminBomPanelModel } from './useAdminBomPanelModel';

const submitEvent = { preventDefault: vi.fn() } as never;

describe('Admin BOM form feedback', () => {
  it('preserves first-failure validation while exposing affected fields', async () => {
    const { result } = renderHook(() => useAdminBomPanelModel('bom-import', undefined));

    act(() => result.current.setBomForm((current) => ({ ...current, dishId: '', ingredientId: '' })));
    await act(() => result.current.handleSaveBomLine(submitEvent));
    expect(result.current.bomFormErrors).toEqual({
      dishId: 'Vui lòng chọn món và nguyên liệu.',
      ingredientId: 'Vui lòng chọn món và nguyên liệu.',
    });

    act(() => result.current.setBomForm((current) => ({
      ...current,
      dishId: 'dish-1',
      ingredientId: 'ingredient-1',
      grossQtyPerServing: '0',
      wasteRatePercent: '101',
    })));
    await act(() => result.current.handleSaveBomLine(submitEvent));
    expect(result.current.bomFormErrors).toEqual({
      grossQtyPerServing: 'Qty/suất phải lớn hơn 0 và hao hụt phải trong khoảng 0-100%.',
      wasteRatePercent: 'Qty/suất phải lớn hơn 0 và hao hụt phải trong khoảng 0-100%.',
    });

    act(() => result.current.setBomForm((current) => ({
      ...current,
      grossQtyPerServing: '1',
      wasteRatePercent: '0',
      effectiveFrom: '2026-07-30',
      effectiveTo: '2026-07-29',
    })));
    await act(() => result.current.handleSaveBomLine(submitEvent));
    expect(result.current.bomFormErrors).toEqual({ effectiveTo: 'Ngày hết hiệu lực phải sau ngày bắt đầu.' });

    act(() => result.current.openEditBomDialog('dish-1', {
      bomId: 'bom-1',
      ingredientId: 'ingredient-1',
      grossQtyPerServing: 1,
      wasteRatePercent: 0,
      bomStatus: 'DRAFT',
      effectiveFrom: '2026-07-30',
      effectiveTo: null,
    } as never));
    await act(() => result.current.handleSaveBomLine(submitEvent));
    expect(result.current.bomFormErrors).toEqual({ reason: 'Cần nhập lý do khi điều chỉnh dòng BOM.' });
    expect(result.current.bomImportFeedback).toBeNull();
  });

  it('associates every BOM validation message with its field', () => {
    const readyView = { phase: 'ready', data: [], isRefreshing: false, truncation: null } as const;
    const model = {
      effectiveActiveView: 'contracts',
      isBomDialogOpen: true,
      editingBom: { dishId: 'dish-1', line: { bomId: 'bom-1' } },
      bomForm: {
        dishId: '', ingredientId: '', grossQtyPerServing: '', wasteRatePercent: '101',
        bomStatus: 'PUBLISHED', effectiveFrom: '2026-07-30', effectiveTo: '2026-07-29', reason: '',
      },
      bomFormErrors: {
        dishId: 'Vui lòng chọn món và nguyên liệu.',
        ingredientId: 'Vui lòng chọn món và nguyên liệu.',
        grossQtyPerServing: 'Qty/suất phải lớn hơn 0 và hao hụt phải trong khoảng 0-100%.',
        wasteRatePercent: 'Qty/suất phải lớn hơn 0 và hao hụt phải trong khoảng 0-100%.',
        effectiveTo: 'Ngày hết hiệu lực phải sau ngày bắt đầu.',
        reason: 'Cần nhập lý do khi điều chỉnh dòng BOM.',
      },
      bomImportCustomerId: '',
      bomImportFeedback: null,
      bomImportTier: 25000,
      closeDishBomLineState: { isLoading: false },
      closingBom: null,
      dishCatalog: [],
      handleSaveBomLine: vi.fn(),
      ingredientCatalog: [],
      isDishCatalogLoading: false,
      isIngredientCatalogLoading: false,
      isSavingBom: false,
      queryViews: { dishCatalog: readyView, ingredientCatalog: readyView },
      setBomForm: vi.fn(),
      setIsBomDialogOpen: vi.fn(),
    } as unknown as AdminDataPageModel;

    render(<AdminBomPanel model={model} />);

    for (const id of ['manual-bom-dish', 'manual-bom-ingredient', 'manual-bom-qty', 'manual-bom-waste', 'manual-bom-to', 'manual-bom-reason']) {
      expect(document.getElementById(id)).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(id)).toHaveAccessibleDescription();
    }
  });
});
