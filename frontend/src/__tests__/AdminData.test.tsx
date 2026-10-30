import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AuthProvider } from '../store/authContext';
import { adminApi, type PagedResult, type IngredientItem, type DishItem } from '../api/adminApi';

function renderPage(initialEntry = '/admin-data') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin-data" element={<AdminDataPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AdminDataPage — Conformance & Behavioral Audit', () => {
  const mockIngredientsPage1: PagedResult<IngredientItem> = {
    items: [
      {
        ingredientId: '00000000-0000-0000-0000-000000000001',
        ingredientCode: 'NL-GAO',
        ingredientName: 'Gạo tẻ ST25',
        unitId: '00000000-0000-0000-0000-000000000010',
        unitName: 'kg',
        warehouseId: '00000000-0000-0000-0000-000000000100',
        warehouseName: 'Kho Lương Thực',
        referencePrice: 28000,
        isFreshDaily: false,
        isActive: true,
      },
    ],
    totalCount: 30,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 2,
    hasPrev: false,
    hasNext: true,
  };

  const mockIngredientsPage2: PagedResult<IngredientItem> = {
    items: [
      {
        ingredientId: '00000000-0000-0000-0000-000000000002',
        ingredientCode: 'NL-THIT',
        ingredientName: 'Thịt heo nạc dăm',
        unitId: '00000000-0000-0000-0000-000000000010',
        unitName: 'kg',
        warehouseId: '00000000-0000-0000-0000-000000000100',
        warehouseName: 'Kho Lạnh',
        referencePrice: 110000,
        isFreshDaily: true,
        isActive: true,
      },
    ],
    totalCount: 30,
    pageNumber: 2,
    pageSize: 25,
    totalPages: 2,
    hasPrev: true,
    hasNext: false,
  };

  const mockDishesPage: PagedResult<DishItem> = {
    items: [
      {
        dishId: '00000000-0000-0000-0000-000000000003',
        dishCode: 'M-THIT-KHO',
        dishName: 'Thịt kho tàu nước dừa',
        dishType: 'Món chính',
        dishGroup: 'Món mặn',
        isActive: true,
      },
    ],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Kịch bản 1: Success & View-Isolation & DTO Truth
  it('loads ONLY ingredients when viewing ingredients tab and renders authoritative columns without categoryName', async () => {
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients').mockResolvedValue(mockIngredientsPage1);
    const getDshsSpy = vi.spyOn(adminApi, 'getDishes').mockResolvedValue(mockDishesPage);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.getByText('Kho Lương Thực')).toBeInTheDocument();
    expect(screen.getByText('Tiêu chuẩn')).toBeInTheDocument();
    expect(screen.queryByText(/Nhóm thực phẩm/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm nguyên liệu/i })).not.toBeInTheDocument();

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 });
    expect(getDshsSpy).not.toHaveBeenCalled();
  });

  it('loads ONLY dishes when viewing dishes tab', async () => {
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients').mockResolvedValue(mockIngredientsPage1);
    const getDshsSpy = vi.spyOn(adminApi, 'getDishes').mockResolvedValue(mockDishesPage);

    renderPage('/admin-data?view=dishes');

    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByText('Thịt kho tàu nước dừa')).toBeInTheDocument();
    expect(screen.getByText('Món chính')).toBeInTheDocument();

    expect(getDshsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 });
    expect(getIngsSpy).not.toHaveBeenCalled();
  });

  // Kịch bản 2: Server Pagination Navigation
  it('navigates server pages with correct disabled boundaries', async () => {
    const user = userEvent.setup();
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients')
      .mockResolvedValueOnce(mockIngredientsPage1)
      .mockResolvedValueOnce(mockIngredientsPage2);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.getByText(/Trang 1\/2/)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Trang trước' });
    const nextBtn = screen.getByRole('button', { name: 'Trang sau' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 25 });
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeInTheDocument();
    expect(screen.getByText(/Trang 2\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled();
  });

  // Kịch bản 3: Empty State (totalCount = 0)
  it('renders clean empty state when totalCount is 0 without pagination errors', async () => {
    vi.spyOn(adminApi, 'getIngredients').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Chưa có danh mục nguyên liệu')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Phân trang danh mục' })).not.toBeInTheDocument();
  });

  // Kịch bản 4: Error Handling & Retry
  it('displays API error and retries upon clicking retry button', async () => {
    const user = userEvent.setup();
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients')
      .mockRejectedValueOnce(new Error('Lỗi kết nối cơ sở dữ liệu danh mục'))
      .mockResolvedValueOnce(mockIngredientsPage1);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối cơ sở dữ liệu danh mục')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);

    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(getIngsSpy).toHaveBeenCalledTimes(2);
  });

  // Kịch bản 5: Search Filter Input
  it('searches ingredients by keyword using server-side search parameter', async () => {
    const user = userEvent.setup();
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients').mockResolvedValue(mockIngredientsPage1);

    renderPage('/admin-data?view=ingredients');

    const searchInput = await screen.findByRole('searchbox', { name: 'Tìm kiếm danh mục' });
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, 'Gạo');

    expect(getIngsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ searchKeyword: 'Gạo' }));
  });

  // Kịch bản 6: Tab view=bom renders BOM coverage workbench
  it('renders AdminBomBranch when navigating to /admin-data?view=bom', async () => {
    renderPage('/admin-data?view=bom');
    expect(await screen.findByText('Hệ thống · Quản trị dữ liệu · Định mức BOM')).toBeInTheDocument();
  });
});
