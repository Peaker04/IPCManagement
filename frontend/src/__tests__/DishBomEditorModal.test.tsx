import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DishBomEditorModal } from '../features/admin/DishBomEditorModal';
import { bomApi } from '../api/bomApi';
import { adminApi } from '../api/adminApi';

vi.mock('../api/bomApi', () => ({
  bomApi: {
    getDishBomLines: vi.fn(),
    addDishBomLine: vi.fn(),
    closeDishBomLine: vi.fn(),
  },
}));

vi.mock('../api/adminApi', () => ({
  adminApi: {
    getIngredients: vi.fn(),
  },
}));

vi.mock('../api/weeklyMenuApi', () => ({
  weeklyMenuApi: {
    getCustomers: vi.fn().mockResolvedValue([]),
  },
}));

describe('DishBomEditorModal Component Tests (Rule TA-2 & TA-4)', () => {
  const mockDish = {
    dishId: 'dish-1',
    dishCode: 'MON-BO-01',
    dishName: 'Bò lúc lắc',
  };

  const mockIngredients = [
    {
      ingredientId: 'ing-1',
      ingredientCode: 'NL-BO-01',
      ingredientName: 'Thịt bò phi lê',
      unitName: 'kg',
      referencePrice: 220000,
    },
    {
      ingredientId: 'ing-2',
      ingredientCode: 'NL-TOI-01',
      ingredientName: 'Tỏi ta',
      unitName: 'kg',
      referencePrice: 45000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(adminApi.getIngredients).mockResolvedValue({
      items: mockIngredients as any,
      totalCount: 2,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
  });

  it('renders dish title and empty BOM warning when dish has no BOM lines', async () => {
    vi.mocked(bomApi.getDishBomLines).mockResolvedValueOnce([]);

    render(
      <DishBomEditorModal
        isOpen={true}
        onClose={vi.fn()}
        dish={mockDish}
      />
    );

    expect(screen.getByText(/Định mức BOM: Bò lúc lắc/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Món ăn chưa có BOM/)).toBeInTheDocument();
    });
  });

  it('renders existing BOM lines and calculates total reference price', async () => {
    vi.mocked(bomApi.getDishBomLines).mockResolvedValueOnce([
      {
        bomId: 'b-1',
        dishId: 'dish-1',
        dishCode: 'MON-BO-01',
        dishName: 'Bò lúc lắc',
        ingredientId: 'ing-1',
        ingredientCode: 'NL-BO-01',
        ingredientName: 'Thịt bò phi lê',
        unitId: 'u-1',
        unitCode: 'KG',
        unitName: 'kg',
        grossQtyPerServing: 0.15,
        wasteRatePercent: 0,
        referencePrice: 220000,
        bomStatus: 'PUBLISHED',
        bomStatusLabel: 'Đang áp dụng',
        priceTierAmount: 25000,
        bomScope: 'global',
        effectiveFrom: '2026-01-01',
      },
    ]);

    render(
      <DishBomEditorModal
        isOpen={true}
        onClose={vi.fn()}
        dish={mockDish}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Thịt bò phi lê')).toBeInTheDocument();
      expect(screen.getByText('NL-BO-01')).toBeInTheDocument();
    });
  });

  it('submits new BOM line when form is filled and calls addDishBomLine', async () => {
    vi.mocked(bomApi.getDishBomLines).mockResolvedValueOnce([]);
    vi.mocked(bomApi.addDishBomLine).mockResolvedValueOnce({
      bomId: 'b-new',
    } as any);

    const onSaved = vi.fn();

    render(
      <DishBomEditorModal
        isOpen={true}
        onClose={vi.fn()}
        dish={mockDish}
        onSaved={onSaved}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Chọn nguyên liệu' })).toBeInTheDocument();
    });

    const qtyInput = screen.getByLabelText('Định mức / suất');
    fireEvent.change(qtyInput, { target: { value: '0.2' } });

    const addBtn = screen.getByRole('button', { name: 'Thêm vào BOM' });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(bomApi.addDishBomLine).toHaveBeenCalledWith('dish-1', expect.objectContaining({
        grossQtyPerServing: 0.2,
      }));
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
