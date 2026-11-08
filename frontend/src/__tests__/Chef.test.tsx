import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { AuthProvider } from '../store/authContext';
import { chefApi } from '../api/chefApi';
import * as apiTransport from '../api/client';
import { ApiError } from '../api/client';
import { mrxApi, type MrxKitchenCooking } from '../api/mrxApi';
import { serverStateCache } from '../store/serverStateCache';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';
import { MOCK_CHEF_DATA } from '../test/fixtures';

function renderChef(initialEntry = '/chef?view=plans') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/chef" element={<ChefDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Chef Feature (FR-CHEF — Bếp trưởng & bàn giao)', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-06-15T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-1',
        customerId: 'customer-1',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-06-15',
        weekEndDate: '2026-06-21',
        status: 'IN_PROGRESS',
        version: 2,
        createdAt: '2026-06-14T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue(MOCK_CHEF_DATA);
  });

  it('renders authoritative production-plan facts without fake chef, progress, or completion actions', async () => {
    renderChef('/chef?view=plans');

    expect(await screen.findByRole('heading', { name: 'Bếp trưởng & Bàn giao ca' })).toBeInTheDocument();
    expect(screen.getByText(/Đang xem: Kế hoạch sản xuất/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/Phụ trách:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tiến độ:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hoàn tất ca nấu/i })).not.toBeInTheDocument();

    expect(await screen.findByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
  });

  it('renders persisted DEFAULT inventory issues without a fabricated quality checklist', async () => {
    renderChef('/chef?view=issues');

    expect(await screen.findByText(/Đang xem: Phiếu xuất bàn giao/i)).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Mã phiếu xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kho xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bếp xác nhận' })).toBeInTheDocument();
    expect(screen.getByText('ISS-20260921-01')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Giá đỗ sạch')).not.toBeInTheDocument();
  });

  it('pages persisted inventory issues through the backend contract', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue({
      ...MOCK_CHEF_DATA,
      issuePage: { totalCount: 26, pageNumber: 1, pageSize: 25, totalPages: 2, hasPrev: false, hasNext: true },
    });
    renderChef('/chef?view=issues');

    await userEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));

    expect(chefApi.getChefDashboardData).toHaveBeenLastCalledWith(expect.any(String), 'MORNING', 'customer-1', 2, 25);
  });

  it('handles API errors and retries the current customer/date/shift scope', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockRejectedValueOnce(new Error('Lỗi đồng bộ dữ liệu bếp'));
    renderChef();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi đồng bộ dữ liệu bếp')).toBeInTheDocument();
  });

  it('renders clean empty state when no production plans exist for the selected scope', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue({
      ...MOCK_CHEF_DATA,
      plans: [],
      issues: [],
      totalPlans: 0,
      sentPlans: 0,
      totalServings: 0,
      issuePage: { totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false },
    });

    renderChef('/chef?view=plans');

    expect(await screen.findByText('Chưa có kế hoạch sản xuất')).toBeInTheDocument();
    expect(screen.getByText('Chưa có KHSX được duyệt cho ngày, ca và khách hàng đã chọn.')).toBeInTheDocument();
  });

  it('MRX cooking workbench renders sanitized cooking projection with allowed frozen fields and no warehouse/price columns', async () => {
    vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({
      batchId: 'batch-1',
      sourceVersion: 2,
      rows: [{
        serviceDate: '2026-06-15',
        weekday: 'Thứ Hai',
        shiftName: 'Ca sáng',
        menuVariant: 'Mặn',
        dishCode: 'MON-01',
        dishName: 'Cơm sườn nướng',
        servings: 1000,
        ingredientCode: 'SUON-01',
        ingredientName: 'Sườn heo',
        unitName: 'kg',
        bomQuantityPerServing: 0.0000004,
        wasteRatePercent: 5,
        totalRequiredQuantity: 0.0004,
      }],
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderChef('/chef?view=mrx-cooking&batchId=batch-1');

    expect(await screen.findByRole('heading', { name: 'Phiếu nấu theo lô' })).toBeInTheDocument();
    expect(await screen.findByText('Cơm sườn nướng')).toBeInTheDocument();
    expect(screen.getByText('Sườn heo')).toBeInTheDocument();
    expect(screen.getByText('1.000')).toBeInTheDocument();
    const ingredient = screen.getByRole('row', { name: /Sườn heo/ });
    const cells = within(ingredient).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent(/^0,0000004$/);
    expect(cells[4]).toHaveTextContent(/^0,0004$/);

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'In phiếu nấu' })).toBeEnabled();
    expect(within(header).getByRole('button', { name: 'Tải CSV cả lô' })).toBeEnabled();
    expect(within(header).getByRole('button', { name: 'Tải Excel cả lô' })).toBeEnabled();

    // Forbidden fields & mutations MUST NOT exist
    expect(screen.queryByText(/Đơn giá/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Giá vốn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thực xuất/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tồn kho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chênh lệch/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận nhận hàng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chốt đối soát/i })).not.toBeInTheDocument();

    // An authenticated export failure must remain on the cooking sheet, not open an unauthenticated fallback.
    vi.spyOn(mrxApi, 'downloadKitchenCookingBlob').mockRejectedValueOnce(new Error('Tải file thất bại (HTTP 403)'));
    await userEvent.click(screen.getByRole('button', { name: 'Tải CSV cả lô' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tải file thất bại (HTTP 403)');
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tải CSV cả lô' })).toBeEnabled();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const printBtn = screen.getByRole('button', { name: 'In phiếu nấu' });
    await userEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  it('groups cooking by menu variant and recovers a shift with no dishes without changing whole-batch exports', async () => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    const catalog = { items: [{ batchId: 'batch-1', customerId: 'customer-1',
      customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-06-15', weekEndDate: '2026-06-21',
      status: 'TRANSFERRED', version: 3, createdAt: '2026-06-14T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false };
    const cooking: MrxKitchenCooking = {
      batchId: 'batch-1', sourceVersion: 3,
      rows: [{
        serviceDate: '2026-06-15', weekday: 'Thứ Hai', shiftName: 'Ca sáng', menuVariant: 'Mặn',
        dishCode: 'MON-01', dishName: 'Cơm sườn nướng', servings: 100,
        ingredientCode: 'SUON-01', ingredientName: 'Sườn heo', unitName: 'kg', bomQuantityPerServing: 0.15, wasteRatePercent: 5, totalRequiredQuantity: 15,
      }, {
        serviceDate: '2026-06-15', weekday: 'Thứ Hai', shiftName: 'Ca sáng', menuVariant: 'Chay',
        dishCode: 'MON-01', dishName: 'Cơm sườn nướng', servings: 20,
        ingredientCode: 'RAU-01', ingredientName: 'Rau củ', unitName: 'kg', bomQuantityPerServing: 0.1, wasteRatePercent: 2, totalRequiredQuantity: 2,
      }],
    };
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-06-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      const url = new URL(endpoint, 'http://localhost');
      if (url.pathname === '/reconciliation/batches') return catalog;
      if (url.pathname === '/reconciliation/batches/batch-1/kitchen-cooking') return cooking;
      throw new Error(`Unexpected cooking find request ${endpoint}`);
    });

    renderChef('/chef?view=mrx-cooking&batchId=batch-1');

    expect(await screen.findByRole('region', { name: 'Món Cơm sườn nướng · Mặn' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Món Cơm sườn nướng · Chay' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Món Cơm sườn nướng · Mặn' })).getByText('Mặn')).toBeInTheDocument();
    expect(screen.getByText('Chay')).toBeInTheDocument();
    expect(screen.getByText('Sườn heo')).toBeVisible();
    expect(screen.queryByText('Rau củ')).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('region', { name: 'Món Cơm sườn nướng · Chay' })).getByRole('button'));
    expect(screen.getByText('Rau củ')).toBeVisible();
    expect(screen.queryByText('Sườn heo')).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new Event('beforeprint')));
    expect(screen.getByText('Sườn heo')).toBeInTheDocument();
    expect(screen.getByText('Rau củ')).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event('afterprint')));
    expect(screen.queryByText('Sườn heo')).not.toBeInTheDocument();
    expect(screen.getByText('Rau củ')).toBeVisible();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' }), 'MORNING');
    const reads = vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path.endsWith('/kitchen-cooking')).length;
    const find = screen.getByRole('searchbox', { name: 'Tìm món, nguyên liệu trong phiếu nấu' });
    await userEvent.type(find, '  SUON  HEO  ');
    expect(screen.getByRole('region', { name: 'Món Cơm sườn nướng · Mặn' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Món Cơm sườn nướng · Chay' })).not.toBeInTheDocument();
    expect(screen.getByText('120 suất')).toBeInTheDocument();
    const download = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
    await userEvent.click(screen.getByRole('button', { name: 'Tải CSV cả lô' }));
    expect(download).toHaveBeenCalledWith('/api/reconciliation/batches/batch-1/kitchen-cooking/csv', expect.anything());
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getAllByRole('region', { name: /Món Cơm sườn nướng/ })).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' })).toHaveValue('MORNING');
    expect(vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path.endsWith('/kitchen-cooking'))).toHaveLength(reads);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' }), 'AFTERNOON');
    expect(screen.getByRole('heading', { name: 'Không có món cho ca đã chọn' })).toBeVisible();
    expect(screen.queryByRole('region', { name: /Món Cơm sườn nướng/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải CSV cả lô' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tải Excel cả lô' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'In phiếu nấu' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả ca' }));
    expect(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' })).toHaveValue('ALL');
    expect(screen.getAllByRole('region', { name: /Món Cơm sườn nướng/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'In phiếu nấu' })).toBeEnabled();
  });

  it.each([
    { secondServings: 100, expectedTotal: '140 suất' },
    { secondServings: 130, expectedTotal: 'Chưa xác định' },
  ])('counts meal grain, not dishes, and reports inconsistent servings ($secondServings)', async ({ secondServings, expectedTotal }) => {
    const row = {
      serviceDate: '2026-06-15', weekday: 'Thứ Hai', shiftName: 'Ca sáng', menuVariant: 'Mặn',
      dishCode: 'MON-01', dishName: 'Cơm sườn nướng', servings: 100,
      ingredientCode: 'SUON-01', ingredientName: 'Sườn heo', unitName: 'kg',
      bomQuantityPerServing: 0.15, wasteRatePercent: 5, totalRequiredQuantity: 15,
    };
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'batch-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
        weekStartDate: '2026-06-15', weekEndDate: '2026-06-21', status: 'IN_PROGRESS', version: 3, createdAt: '2026-06-14T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({ batchId: 'batch-1', sourceVersion: 3,
      rows: [row, { ...row, dishCode: 'MON-02', dishName: 'Canh rau', servings: secondServings },
        { ...row, serviceDate: '2026-06-16', weekday: 'Thứ Ba', servings: 20 },
        { ...row, menuVariant: 'Chay', servings: 20 }],
    });
    renderChef('/chef?view=mrx-cooking&batchId=batch-1');
    expect(await screen.findByText(expectedTotal)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' }), 'MORNING');
    expect(screen.getByText(expectedTotal)).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /^Món/ })).toHaveLength(4);
  });

  it('treats a generic cooking 409 as a retryable conflict, not legacy missing lineage', async () => {
    const cooking = vi.spyOn(mrxApi, 'getKitchenCooking').mockRejectedValueOnce(new ApiError(409, 'Phiên bản phiếu nấu đã thay đổi.'))
      .mockResolvedValue({ batchId: 'batch-1', sourceVersion: 4, rows: [] });
    renderChef('/chef?view=mrx-cooking&batchId=batch-1');
    expect(await screen.findByText('Phiên bản phiếu nấu đã thay đổi.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa đủ dữ liệu phiếu nấu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
    expect(cooking).toHaveBeenCalledTimes(2);
  });

  it('exposes batch-list errors and lets Chef retry the real read', async () => {
    const batches = vi.spyOn(mrxApi, 'getBatchPage').mockRejectedValueOnce(new ApiError(500, 'Không tải được danh sách lô nấu.'))
      .mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0, hasPrev: false, hasNext: false });
    renderChef('/chef?view=mrx-cooking');
    expect(await screen.findByText('Không tải được danh sách lô nấu.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách lô' }));
    expect(batches).toHaveBeenCalledTimes(2);
  });

  it('keeps blocked cooking exports unavailable and offers recovery without inventing batch age or cooking rows', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'batch-incomplete', customerId: 'c-1', customerName: 'Khách A', customerCode: 'KA',
        weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'COMPLETED', version: 4, createdAt: '2026-10-19T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    const cached: MrxKitchenCooking = { batchId: 'batch-incomplete', sourceVersion: 3, rows: [{
      serviceDate: '2026-10-19', weekday: 'Thứ 2', shiftName: 'Ca sáng', menuVariant: 'Mặn', dishCode: 'MON-A',
      dishName: 'Món trong bản lưu trước', servings: 100, ingredientCode: 'ING-A', ingredientName: 'Gạo', unitName: 'kg',
      bomQuantityPerServing: 0.1, wasteRatePercent: 0, totalRequiredQuantity: 10,
    }] };
    serverStateCache.set('snapshot:mrx_cooking', { data: cached });
    vi.spyOn(mrxApi, 'getKitchenCooking').mockRejectedValueOnce(
      new Error('KITCHEN_FROZEN_LINEAGE_MISSING: Lô chưa có định lượng đóng băng theo ngày')
    );
    const router = createMemoryRouter([
      { path: '/chef', element: <ChefDashboardPage /> },
      { path: '/', element: null },
    ], { initialEntries: ['/chef?view=mrx-cooking&batchId=batch-incomplete'] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);

    expect(await screen.findByText('Chưa đủ dữ liệu phiếu nấu')).toBeVisible();
    expect(screen.queryByText(/được tạo từ phiên bản trước/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát nấu' })).toHaveValue('batch-incomplete');
    expect(screen.queryByRole('button', { name: 'Tải CSV cả lô' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải Excel cả lô' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In phiếu nấu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Món/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Về Bàn điều hành' }));
    expect(router.state.location.pathname).toBe('/');
  });

  it('never shows or prints a foreign cached cooking sheet while the selected batch is loading', async () => {
    const foreign: MrxKitchenCooking = { batchId: 'batch-foreign', sourceVersion: 2, rows: [{
      serviceDate: '2026-10-19', weekday: 'Thứ 2', shiftName: 'Ca sáng', menuVariant: 'Mặn', dishCode: 'MON-A',
      dishName: 'Món lô cũ', servings: 100, ingredientCode: 'ING-A', ingredientName: 'Gạo lô cũ', unitName: 'kg',
      bomQuantityPerServing: 0.1, wasteRatePercent: 0, totalRequiredQuantity: 10,
    }] };
    serverStateCache.set('snapshot:mrx_cooking', { data: foreign });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({ items: [{ batchId: 'batch-target', customerId: 'c-2',
      customerName: 'Khách B', customerCode: 'KB', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      status: 'TRANSFERRED', version: 3, createdAt: '2026-10-19T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false });
    let resolveCooking!: (value: MrxKitchenCooking) => void;
    vi.spyOn(mrxApi, 'getKitchenCooking').mockReturnValue(new Promise((resolve) => { resolveCooking = resolve; }));
    const download = vi.spyOn(mrxApi, 'downloadKitchenCookingBlob').mockRejectedValueOnce(new ApiError(403, 'Không có quyền tải phiếu.'));
    renderChef('/chef?view=mrx-cooking&batchId=batch-target');
    expect(screen.queryByText('Món lô cũ')).not.toBeInTheDocument();
    expect(screen.queryByText('Gạo lô cũ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In phiếu nấu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải CSV cả lô' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải Excel cả lô' })).not.toBeInTheDocument();
    await act(async () => { resolveCooking({ ...foreign, batchId: 'batch-target', sourceVersion: 3,
      rows: [{ ...foreign.rows[0], dishCode: 'MON-B', dishName: 'Món lô đang chọn', ingredientName: 'Gạo lô đang chọn' }] }); });
    expect(await screen.findByText('Món lô đang chọn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'In phiếu nấu' })).toBeEnabled();
    expect(screen.queryByText('Món lô cũ')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải CSV cả lô' }));
    expect(download).toHaveBeenCalledWith('batch-target', 'csv');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có quyền tải phiếu.');
  });

  it('keeps cooking URL scope through navigation and catalogue paging beyond the first fifty batches', async () => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    const first = { batchId: 'batch-first', customerId: 'c-1', customerName: 'Khách A', customerCode: 'KA', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' };
    const target = { ...first, batchId: 'batch-target', customerId: 'c-2', customerName: 'Khách B', customerCode: 'KB' };
    const older = { ...first, batchId: 'batch-older', customerCode: 'KC', weekStartDate: '2026-10-12' };
    const reads: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input), 'http://localhost');
      reads.push(url.pathname + url.search);
      let data: unknown;
      if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      else if (url.pathname.endsWith('/batches')) {
        const second = url.searchParams.get('PageNumber') === '2';
        data = { items: second ? [older] : [first, target], totalCount: 51, pageNumber: second ? 2 : 1, pageSize: 50, totalPages: 2, hasPrev: second, hasNext: !second };
      } else if (url.pathname.endsWith('/kitchen-cooking')) data = { batchId: url.pathname.split('/').at(-2), sourceVersion: 1, rows: [] };
      else throw new Error(`Unexpected cooking request ${url.pathname}`);
      return Response.json({ success: true, data });
    });
    const router = createMemoryRouter([{ path: '/chef', element: <ChefDashboardPage /> }], {
      initialEntries: ['/chef?view=mrx-cooking&batchId=batch-target'],
    });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    const select = await screen.findByRole('combobox', { name: 'Chọn lô đối soát nấu' });
    await waitFor(() => expect(select).toHaveValue('batch-target'));
    await act(async () => { await router.navigate('/chef?view=mrx-cooking&batchId=batch-first'); });
    expect(select).toHaveValue('batch-first');
    await act(async () => { await router.navigate(-1); });
    expect(select).toHaveValue('batch-target');
    const pager = screen.getByRole('navigation', { name: 'Phân trang danh sách lô nấu' });
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByRole('option', { name: 'KC · 12/10/2026' })).toHaveValue('batch-older');
    expect(select).toHaveValue('batch-target');
    expect(router.state.location.search).toContain('batchId=batch-target');
    expect(reads.filter(path => path.endsWith('/batch-older/kitchen-cooking'))).toHaveLength(0);
    await userEvent.selectOptions(select, 'batch-older');
    await waitFor(() => expect(reads).toContain('/api/reconciliation/batches/batch-older/kitchen-cooking'));
    expect(select).toHaveValue('batch-older');
    expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });
});
