import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AuthProvider } from '../store/authContext';
import { adminApi, type PagedQueryParams, type PagedResult, type IngredientItem, type DishItem } from '../api/adminApi';
import * as transport from '../api/client';

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

  const ingredientResponse = vi.fn<(params?: PagedQueryParams, signal?: AbortSignal) => Promise<PagedResult<IngredientItem>>>();
  const dishResponse = vi.fn<(params?: PagedQueryParams, signal?: AbortSignal) => Promise<PagedResult<DishItem>>>();
  let unexpected: string[];
  beforeEach(() => {
    vi.restoreAllMocks();
    ingredientResponse.mockReset().mockResolvedValue(mockIngredientsPage1);
    dishResponse.mockReset().mockResolvedValue(mockDishesPage);
    unexpected = [];
    vi.spyOn(transport, 'apiClient').mockImplementation(async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
      if (endpoint === '/system-operation-mode') return {
        mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-05T00:00:00Z', reasonRequired: false,
        capabilities: { navigation: [], pageTabs: {} },
      } as T;
      if (endpoint === '/Dishes/bom-price-tiers') return [25000, 30000, 34000] as T;
      if (endpoint === '/Dishes/bom-coverage') return {
        generatedAt: '2026-11-05T00:00:00Z', totalDishes: 0, completeDishes: 0, missingBomDishes: 0, totalBomLines: 0, dishes: [],
      } as T;
      const url = new URL(endpoint, 'http://unit.test');
      const params: PagedQueryParams = {
        pageNumber: url.searchParams.has('pageNumber') ? Number(url.searchParams.get('pageNumber')) : undefined,
        pageSize: url.searchParams.has('pageSize') ? Number(url.searchParams.get('pageSize')) : undefined,
        searchKeyword: url.searchParams.get('searchKeyword') ?? undefined,
      };
      if (url.pathname === '/ingredients') return await ingredientResponse(params, options?.signal ?? undefined) as T;
      if (url.pathname === '/Dishes') return await dishResponse(params, options?.signal ?? undefined) as T;
      unexpected.push(endpoint);
      throw new Error(`Unexpected API in catalogue test: ${endpoint}`);
    });
  });
  afterEach(() => { expect(unexpected).toEqual([]); });

  it('creates an ingredient from the catalog and refreshes the list', async () => {
    const created = { ...mockIngredientsPage1.items[0], ingredientId: '00000000-0000-0000-0000-000000000004', ingredientCode: 'NL-RAU-RAM', ingredientName: 'Rau răm', referencePrice: 0, isFreshDaily: true };
    ingredientResponse.mockImplementation(async params => params?.searchKeyword === 'NL-RAU-RAM'
      ? { ...mockIngredientsPage1, items: [created], totalCount: 1, totalPages: 1, hasNext: false }
      : mockIngredientsPage1);
    const originalApi = vi.mocked(transport.apiClient).getMockImplementation()!;
    vi.mocked(transport.apiClient).mockImplementation(async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
      if (endpoint === '/Units') return [{ unitId: '00000000-0000-0000-0000-000000000010', unitCode: 'KG', unitName: 'Kilôgam', baseUnitCode: null, convertRateToBase: 1 }] as T;
      if (endpoint === '/ingredients' && options?.method === 'POST') return { ingredientId: '00000000-0000-0000-0000-000000000004', ingredientCode: 'NL-RAU-RAM', ingredientName: 'Rau răm', unitId: '00000000-0000-0000-0000-000000000010', unitName: 'Kilôgam', warehouseId: '00000000-0000-0000-0000-000000000100', referencePrice: 0, isFreshDaily: true, isActive: true } as T;
      return originalApi(endpoint, options) as Promise<T>;
    });
    renderPage('/admin-data?view=ingredients&q=Gạo');
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm nguyên liệu' }));
    await screen.findByRole('option', { name: 'Kilôgam (KG)' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Mã nguyên liệu' }), { target: { value: 'NL-RAU-RAM' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên nguyên liệu' }), { target: { value: 'Rau răm' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Đơn vị tính nguyên liệu' }), { target: { value: '00000000-0000-0000-0000-000000000010' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nguyên liệu' }));
    await waitFor(() => expect(vi.mocked(transport.apiClient).mock.calls.some(([url, options]) => url === '/ingredients' && options?.method === 'POST')).toBe(true));
    const body = vi.mocked(transport.apiClient).mock.calls.find(([url, options]) => url === '/ingredients' && options?.method === 'POST')?.[1]?.body;
    expect(JSON.parse(String(body))).toMatchObject({ ingredientCode: 'NL-RAU-RAM', ingredientName: 'Rau răm', unitId: '00000000-0000-0000-0000-000000000010', referencePrice: 0 });
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' })).toHaveValue('NL-RAU-RAM'));
    expect(await screen.findByText('Rau răm')).toBeVisible();
  });

  it('does not offer catalog creation to a read-only role', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ ...user, roleCode: 'CHEF', roleName: 'Chef', isAdminFullAccess: false, permissions: ['catalog.read'] }));
    renderPage('/admin-data?view=ingredients');
    expect(await screen.findByText('Gạo tẻ ST25')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Thêm nguyên liệu' })).not.toBeInTheDocument();
  });

  it('debounces server search, resets page atomically and keeps actual rows while applying criteria', async () => {
    const get = ingredientResponse.mockResolvedValue(mockIngredientsPage2);
    renderPage('/admin-data?view=ingredients&page=2');
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeVisible();
    get.mockClear();
    get.mockResolvedValue({ ...mockIngredientsPage1, totalCount: 1, totalPages: 1, hasNext: false });
    vi.useFakeTimers();
    try {
      const input = screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' });
      fireEvent.change(input, { target: { value: 'G' } });
      fireEvent.change(input, { target: { value: 'Gạ' } });
      fireEvent.change(input, { target: { value: 'Gạo' } });
      expect(get).not.toHaveBeenCalled();
      expect(screen.getByText('Thịt heo nạc dăm')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(299); });
      expect(get).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, searchKeyword: 'Gạo' }, expect.any(AbortSignal));
      get.mockClear();
      get.mockResolvedValue({ ...mockIngredientsPage2, pageNumber: 1, totalCount: 1, totalPages: 1, hasPrev: false });
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: 'Thịt' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(get).not.toHaveBeenCalled();
      fireEvent.compositionEnd(input);
      await act(async () => { await Promise.resolve(); });
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, searchKeyword: 'Thịt' }, expect.any(AbortSignal));
    } finally { vi.useRealTimers(); }
  });

  it('does not present old filter rows as results after a failed new search, and retries current criteria', async () => {
    ingredientResponse.mockResolvedValueOnce(mockIngredientsPage1).mockRejectedValueOnce(new Error('Tìm kiếm tạm thời thất bại'));
    renderPage('/admin-data?view=ingredients');
    await screen.findByText('Gạo tẻ ST25');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' }), { target: { value: 'Thịt' } });
    await screen.findByText('Tìm kiếm tạm thời thất bại');
    expect(screen.queryByText('Gạo tẻ ST25')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang danh mục' })).toHaveTextContent('— kết quả');
    ingredientResponse.mockResolvedValue({ ...mockIngredientsPage2, pageNumber: 1, totalCount: 1, totalPages: 1, hasPrev: false });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeVisible();
  });

  it('takes search text from URL navigation rather than a stale local copy', async () => {
    ingredientResponse.mockResolvedValue(mockIngredientsPage1);
    const router = createMemoryRouter([{ path: '/admin-data', element: <AdminDataPage /> }], { initialEntries: ['/admin-data?view=ingredients&q=Gạo'] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    expect(await screen.findByText('Gạo tẻ ST25')).toBeVisible();
    await act(async () => { await router.navigate('/admin-data?view=ingredients&q=Thịt'); });
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' })).toHaveValue('Thịt');
    await act(async () => { await router.navigate(-1); });
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' })).toHaveValue('Gạo');
  });

  it('changes server page size and clears only search while retaining view context', async () => {
    const get = ingredientResponse.mockImplementation(async params => ({
      ...(params?.searchKeyword ? mockIngredientsPage2 : mockIngredientsPage1),
      pageNumber: params?.pageNumber ?? 1, pageSize: params?.pageSize ?? 25,
      totalPages: Math.ceil(30 / (params?.pageSize ?? 25)),
      hasPrev: (params?.pageNumber ?? 1) > 1,
      hasNext: (params?.pageNumber ?? 1) < Math.ceil(30 / (params?.pageSize ?? 25)),
    }));
    renderPage('/admin-data?view=ingredients&page=2&q=Thịt');
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '50' } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 50, searchKeyword: 'Thịt' }, expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm danh mục' }));
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm danh mục' })).toHaveValue('');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 50, searchKeyword: undefined }, expect.any(AbortSignal)));
  });

  // Kịch bản 1: Success & View-Isolation & DTO Truth
  it('loads ONLY ingredients when viewing ingredients tab and renders authoritative columns without categoryName', async () => {
    const getIngsSpy = ingredientResponse;
    const getDshsSpy = dishResponse;

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.getByText('Kho Lương Thực')).toBeInTheDocument();
    expect(screen.getByText('Tiêu chuẩn')).toBeInTheDocument();
    expect(screen.queryByText(/Nhóm thực phẩm/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm nguyên liệu/i })).toBeVisible();

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 }, expect.any(AbortSignal));
    expect(getDshsSpy).not.toHaveBeenCalled();
  });

  it('loads ONLY dishes when viewing dishes tab', async () => {
    const getIngsSpy = ingredientResponse;
    const getDshsSpy = dishResponse;

    renderPage('/admin-data?view=dishes');

    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByText('Thịt kho tàu nước dừa')).toBeInTheDocument();
    expect(screen.getByText('Món chính')).toBeInTheDocument();

    expect(getDshsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 }, expect.any(AbortSignal));
    expect(getIngsSpy).not.toHaveBeenCalled();
  });

  it('recovers an out-of-range URL page using the actual server total', async () => {
    const get = ingredientResponse.mockImplementation(async params => params?.pageNumber === 9
      ? { ...mockIngredientsPage2, items: [], pageNumber: 9, hasNext: false }
      : mockIngredientsPage2);
    renderPage('/admin-data?view=ingredients&page=9');
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeVisible();
    expect(get).toHaveBeenLastCalledWith({ pageNumber: 2, pageSize: 25, searchKeyword: undefined }, expect.any(AbortSignal));
    expect(screen.queryByText('Chưa có danh mục nguyên liệu')).not.toBeInTheDocument();
  });

  // Kịch bản 2: Server Pagination Navigation
  it('navigates server pages with correct disabled boundaries', async () => {
    const user = userEvent.setup();
    const getIngsSpy = ingredientResponse
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

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 25 }, expect.any(AbortSignal));
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeInTheDocument();
    expect(screen.getByText(/Trang 2\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled();
  });

  // Kịch bản 3: Empty State (totalCount = 0)
  it('renders clean empty state when totalCount is 0 without pagination errors', async () => {
    ingredientResponse.mockResolvedValue({
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
    expect(screen.getByRole('navigation', { name: 'Phân trang danh mục' })).toHaveTextContent('0 kết quả');
    expect(screen.queryByRole('button', { name: 'Trang trước' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' })).toBeEnabled();
  });

  // Kịch bản 4: Error Handling & Retry
  it('displays API error and retries upon clicking retry button', async () => {
    const user = userEvent.setup();
    let resolveRetry!: (value: PagedResult<IngredientItem>) => void;
    const pendingRetry = new Promise<PagedResult<IngredientItem>>(resolve => { resolveRetry = resolve; });
    const getIngsSpy = ingredientResponse
      .mockRejectedValueOnce(new Error('Lỗi kết nối cơ sở dữ liệu danh mục'))
      .mockReturnValueOnce(pendingRetry);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối cơ sở dữ liệu danh mục')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);
    try {
      expect(await screen.findByRole('status', { name: 'Đang tải nội dung' })).toBeVisible();
      await act(async () => { resolveRetry(mockIngredientsPage1); });
      expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
      expect(getIngsSpy).toHaveBeenCalledTimes(2);
    } finally { resolveRetry(mockIngredientsPage1); }
  });

  // Kịch bản 6: Tab view=bom renders BOM coverage workbench
  it('renders AdminBomBranch when navigating to /admin-data?view=bom', async () => {
    renderPage('/admin-data?view=bom');
    expect(await screen.findByText('Hệ thống · Quản trị dữ liệu · Định mức BOM')).toBeInTheDocument();
  });

  it('H5: switching /admin-data?view=ingredients to /admin-data?view=dishes retains previous catalog table rows via isPreviousData instead of unmounting into WorkbenchSkeleton', async () => {
    ingredientResponse.mockResolvedValue(mockIngredientsPage1);
    let resolveDishes!: (value: PagedResult<DishItem>) => void;
    dishResponse.mockImplementation(() => new Promise((resolve) => { resolveDishes = resolve; }));

    const router = createMemoryRouter([{ path: '/admin-data', element: <AdminDataPage /> }], {
      initialEntries: ['/admin-data?view=ingredients'],
    });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();

    await act(async () => {
      await router.navigate('/admin-data?view=dishes');
    });

    // Previous table rows stay mounted while dishes query is in flight!
    expect(screen.getByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();

    await act(async () => {
      resolveDishes(mockDishesPage);
    });
    expect(await screen.findByText('Thịt kho tàu nước dừa')).toBeInTheDocument();
  });

  it('L2 & L3: keeps DataGrid table and sticky thead mounted when catalog search returns 0 items or when switching to an empty approval-rules tab', async () => {
    ingredientResponse.mockImplementation(async (params) =>
      params?.searchKeyword
        ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false }
        : mockIngredientsPage1
    );
    const { unmount } = renderPage('/admin-data?view=ingredients&q=KhongCo');
    expect(await screen.findByText('Không tìm thấy danh mục phù hợp')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa từ khóa tìm kiếm' }));
    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
    unmount();

    vi.spyOn(adminApi, 'getApprovalRules').mockResolvedValue([
      { ruleId: 'R-01', ruleName: 'Duyệt PO', documentType: 'purchase-order', minAmount: 0, maxAmount: 1000000, slaHours: 24, isActive: true },
    ]);
    const { ApprovalRulesPage } = await import('../features/admin/ApprovalRulesPage');
    render(<AuthProvider><ApprovalRulesPage /></AuthProvider>);
    expect(await screen.findByText('Duyệt PO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Điều chỉnh thực đơn/i }));
    expect(await screen.findByText('Chưa có quy tắc phê duyệt')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mã quy tắc' })).toBeInTheDocument();
  });
});
