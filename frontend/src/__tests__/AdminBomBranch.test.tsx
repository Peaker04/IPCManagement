import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBomBranch } from '../features/admin/branches/AdminBomBranch';
import { bomApi } from '../api/bomApi';

vi.mock('../api/bomApi', () => ({
  bomApi: {
    getBomCoverage: vi.fn(),
    getDishBomLines: vi.fn(),
    addDishBomLine: vi.fn(),
    closeDishBomLine: vi.fn(),
  },
}));

vi.mock('../api/adminApi', () => ({
  adminApi: {
    getIngredients: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

describe('AdminBomBranch Sub-tree Branch Tests (Rule TA-2 & TA-4)', () => {
  const mockCoverageReport = {
    generatedAt: '2026-10-28T12:00:00Z',
    totalDishes: 3,
    completeDishes: 2,
    missingBomDishes: 1,
    totalBomLines: 5,
    dishes: [
      {
        dishId: 'd-1',
        dishCode: 'MON-01',
        dishName: 'Cơm sườn nướng',
        dishType: 'Món mặn',
        dishGroup: 'Heo',
        bomLineCount: 3,
        hasBom: true,
        status: 'COMPLETE',
        statusLabel: 'Đã có BOM',
      },
      {
        dishId: 'd-2',
        dishCode: 'MON-02',
        dishName: 'Canh bí đao',
        dishType: 'Canh',
        dishGroup: 'Rau củ',
        bomLineCount: 2,
        hasBom: true,
        status: 'COMPLETE',
        statusLabel: 'Đã có BOM',
      },
      {
        dishId: 'd-3',
        dishCode: 'MON-03',
        dishName: 'Gà hấp lá chanh',
        dishType: 'Món mặn',
        dishGroup: 'Gà',
        bomLineCount: 0,
        hasBom: false,
        status: 'MISSING',
        statusLabel: 'Chưa có BOM',
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(bomApi.getBomCoverage).mockResolvedValue(mockCoverageReport as any);
  });

  it('renders 4 KPI telemetry items and full dish list', async () => {
    render(<AdminBomBranch />);

    await waitFor(() => {
      expect(screen.getByText('Cơm sườn nướng')).toBeInTheDocument();
      expect(screen.getByText('Canh bí đao')).toBeInTheDocument();
      expect(screen.getByText('Gà hấp lá chanh')).toBeInTheDocument();
    });

    // Check KPI counts
    expect(screen.getByText('món ăn')).toBeInTheDocument();
    expect(screen.getByText('món hoàn tất')).toBeInTheDocument();
    expect(screen.getByText('món thiếu BOM')).toBeInTheDocument();
  });

  it('filters by missing BOM when clicking filter button', async () => {
    render(<AdminBomBranch />);

    await waitFor(() => {
      expect(screen.getByText('Cơm sườn nướng')).toBeInTheDocument();
    });

    const missingFilterBtn = screen.getByRole('button', { name: /Món thiếu BOM/i });
    fireEvent.click(missingFilterBtn);

    expect(screen.getByText('Gà hấp lá chanh')).toBeInTheDocument();
    expect(screen.queryByText('Cơm sườn nướng')).not.toBeInTheDocument();
    expect(screen.queryByText('Canh bí đao')).not.toBeInTheDocument();
  });

  it('opens DishBomEditorModal when clicking Chỉnh sửa BOM', async () => {
    vi.mocked(bomApi.getDishBomLines).mockResolvedValue([]);

    render(<AdminBomBranch />);

    await waitFor(() => {
      expect(screen.getByText('Gà hấp lá chanh')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: 'Chỉnh sửa BOM' });
    fireEvent.click(editBtns[2]); // click on 3rd dish (Gà hấp lá chanh)

    await waitFor(() => {
      expect(screen.getByText(/Định mức BOM: Gà hấp lá chanh/)).toBeInTheDocument();
    });
  });
});
