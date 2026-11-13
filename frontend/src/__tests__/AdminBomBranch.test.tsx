import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AuthProvider } from '../store/authContext';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: AuthProvider });
import { MemoryRouter } from 'react-router-dom';
import { AdminBomBranch } from '../features/admin/branches/AdminBomBranch';
import type { BomCoverageReport } from '../api/bomApi';
import * as apiTransport from '../api/client';
import { serverStateCache } from '../store/serverStateCache';

describe('AdminBomBranch Sub-tree Branch Tests (Rule TA-2 & TA-4)', () => {
  const mockCoverageReport: BomCoverageReport = {
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

  let coverage = mockCoverageReport;
  let coverageError: Error | null = null;
  beforeEach(() => {
    vi.restoreAllMocks();
    coverage = mockCoverageReport;
    coverageError = null;
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      const url = new URL(endpoint, 'http://localhost');
      if (url.pathname === '/system-operation-mode') return { mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (url.pathname === '/Dishes/bom-price-tiers') return [25000, 30000, 34000];
      if (url.pathname === '/Dishes/bom-coverage') {
        if (coverageError) throw coverageError;
        if (url.searchParams.get('priceTier') === '30000') return {
          priceTier: 30000, generatedAt: '2026-11-07T00:00:00Z', totalDishes: 3, completeDishes: 1, missingBomDishes: 2, totalBomLines: 1,
          dishes: [
            { ...mockCoverageReport.dishes[0], bomLineCount: 0, hasBom: false, status: 'missing', statusLabel: 'Thiếu định lượng' },
            { ...mockCoverageReport.dishes[1], bomLineCount: 1 }, mockCoverageReport.dishes[2],
          ],
        };
        return coverage;
      }
      if (/^\/Dishes\/d-\d\/bom$/.test(url.pathname)) return [];
      if (url.pathname === '/ingredients') return { items: [], totalCount: 0, pageNumber: 1, pageSize: Number(url.searchParams.get('pageSize') ?? 25), totalPages: 0, hasPrev: false, hasNext: false };
      throw new Error(`Unexpected BOM test request ${endpoint}`);
    });
  });

  it('renders 4 KPI telemetry items and full dish list', async () => {
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);

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

  it('hydrates a warm remount and keeps its rows when revalidation fails', async () => {
    const first = render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    await screen.findByText('Cơm sườn nướng');
    first.unmount();
    coverageError = new Error('BOM tạm ngừng');
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    expect(screen.getByText('Cơm sườn nướng')).toBeVisible();
    expect(await screen.findByText(/BOM tạm ngừng/)).toBeVisible();
    expect(screen.getByText('Cơm sườn nướng')).toBeVisible();
  });

  it('filters by missing BOM when clicking filter button', async () => {
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Cơm sườn nướng')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm món ăn' }), { target: { value: ' COM  SUON ' } });
    expect(screen.getByText('Cơm sườn nướng')).toBeInTheDocument();
    expect(screen.queryByText('Canh bí đao')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm BOM' }));
    expect(screen.getByText('Canh bí đao')).toBeInTheDocument();
    const missingFilterBtn = screen.getByRole('button', { name: /Món thiếu BOM/i });
    fireEvent.click(missingFilterBtn);

    expect(screen.getByText('Gà hấp lá chanh')).toBeInTheDocument();
    expect(screen.queryByText('Cơm sườn nướng')).not.toBeInTheDocument();
    expect(screen.queryByText('Canh bí đao')).not.toBeInTheDocument();
    coverageError = new Error('Không tải được mốc giá 30k');
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc mốc giá BOM' }), { target: { value: '30000' } });
    expect(await screen.findByText('Không tải được mốc giá 30k')).toBeVisible();
    expect(screen.queryByText('Gà hấp lá chanh')).not.toBeInTheDocument();
    coverageError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Cơm sườn nướng')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Món thiếu BOM (2)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đã đủ định mức (1)' })).toBeVisible();
    expect(screen.getByRole('row', { name: /Cơm sườn nướng/ })).toHaveTextContent('0 nguyên liệu');
    fireEvent.click(screen.getAllByRole('button', { name: 'Chỉnh sửa BOM' })[0]);
    await waitFor(() => expect(screen.getByRole('radio', { name: '30.000 ₫' })).toHaveAttribute('aria-checked', 'true'));
    expect(apiTransport.apiClient).toHaveBeenCalledWith('/Dishes/bom-coverage?priceTier=30000', expect.anything());
  });

  it('pages the complete BOM report and searches all dishes before resetting to page one', async () => {
    const dishes = Array.from({ length: 61 }, (_, index) => ({
      ...mockCoverageReport.dishes[0], dishId: `dish-${index}`, dishCode: `MON-${index}`,
      dishName: `Món kiểm tra ${index}`, bomLineCount: 1,
    }));
    coverage = { ...mockCoverageReport,
      totalDishes: 61, completeDishes: 61, missingBomDishes: 0, totalBomLines: 61, dishes };
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    expect(await screen.findByText('Món kiểm tra 0')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(26);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Món kiểm tra 25')).toBeVisible();
    expect(screen.queryByText('Món kiểm tra 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Món kiểm tra 60')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(12);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm món ăn' }), { target: { value: 'MON-0' } });
    expect(screen.getByText('Món kiểm tra 0')).toBeVisible();
    expect(screen.queryByText('Món kiểm tra 60')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang định mức BOM' })).toHaveTextContent('Trang 1/1');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm BOM' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), { target: { value: '100' } });
    expect(screen.getByText('Món kiểm tra 60')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(62);
    expect(screen.getByRole('navigation', { name: 'Phân trang định mức BOM' })).toHaveTextContent('61 kết quả');
  });

  it('opens dish-name inspection without edit controls or auxiliary mutation catalogs and returns focus', async () => {
    vi.mocked(apiTransport.apiClient).mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (endpoint === '/Dishes/bom-coverage') return mockCoverageReport;
      if (endpoint === '/Dishes/bom-price-tiers') return [25000, 30000, 34000];
      if (endpoint === '/Dishes/d-1/bom') return [{
        bomId: 'bom-1', dishId: 'd-1', dishCode: 'MON-01', dishName: 'Cơm sườn nướng',
        ingredientId: 'ingredient-1', ingredientCode: 'NL-SUON', ingredientName: 'Sườn heo',
        unitId: 'unit-kg', unitCode: 'kg', unitName: 'kg', priceTierAmount: 25000,
        bomScope: 'global', grossQtyPerServing: 0.123456, wasteRatePercent: 0,
        bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành', effectiveFrom: '2026-01-01', referencePrice: 100000,
      }, {
        bomId: 'bom-30', dishId: 'd-1', dishCode: 'MON-01', dishName: 'Cơm sườn nướng',
        ingredientId: 'ingredient-1', ingredientCode: 'NL-SUON', ingredientName: 'Sườn heo',
        unitId: 'unit-kg', unitCode: 'kg', unitName: 'kg', priceTierAmount: 30000,
        bomScope: 'global', grossQtyPerServing: 0.25, wasteRatePercent: 0,
        bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành', effectiveFrom: '2026-01-01', referencePrice: 100000,
      }];
      throw new Error(`Unexpected dish inspection request ${endpoint}`);
    });
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    const name = await screen.findByRole('button', { name: 'Cơm sườn nướng' });
    name.focus();
    fireEvent.click(name);
    expect(await screen.findByText('Sườn heo')).toBeVisible();
    expect(screen.getByRole('cell', { name: '0,123456' })).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /30\.000/ }));
    expect(screen.getByRole('cell', { name: '0,250000' })).toBeVisible();
    expect(screen.queryByRole('cell', { name: '0,123456' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /34\.000/ }));
    expect(screen.queryByText('Sườn heo')).not.toBeInTheDocument();
    expect(screen.getByText('Món ăn chưa có BOM ở mốc giá 34.000 ₫')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /25\.000/ }));
    expect(screen.getByRole('cell', { name: '0,123456' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Thêm vào BOM' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa .* khỏi BOM/ })).not.toBeInTheDocument();
    expect(apiTransport.apiClient).not.toHaveBeenCalledWith(expect.stringMatching(/ingredients|coordination\/customers/), expect.anything());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(name).toHaveFocus());
  });

  it('keeps Catalog-read actors in inspection without BOM write controls', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ ...user, roleCode: 'CHEF', roleName: 'Chef', isAdminFullAccess: false, permissions: ['catalog.read'] }));
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cơm sườn nướng' }));
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa BOM' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập BOM Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm vào BOM' })).not.toBeInTheDocument();
    expect(screen.getByText('Chi tiết nguyên liệu theo mốc giá · Chỉ xem.')).toBeVisible();
  });

  it('opens DishBomEditorModal when clicking Chỉnh sửa BOM', async () => {
    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Gà hấp lá chanh')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole('button', { name: 'Chỉnh sửa BOM' });
    fireEvent.click(editBtns[2]); // click on 3rd dish (Gà hấp lá chanh)

    await waitFor(() => {
      expect(screen.getByText(/Định mức BOM: Gà hấp lá chanh/)).toBeInTheDocument();
    });
  });

  it('K3: keeps DataGrid table and sticky thead mounted when filter or search returns 0 dishes', async () => {
    const { container } = render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    await screen.findByText('Cơm sườn nướng');
    expect(container.querySelectorAll('table').length).toBe(1);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm món ăn' }), { target: { value: 'KHONG_TON_TAI_XYZ' } });
    expect(screen.getByText('Không tìm thấy món ăn')).toBeInTheDocument();
    expect(container.querySelectorAll('table').length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /Xóa bộ lọc/i }));
    expect(screen.getByText('Cơm sườn nướng')).toBeInTheDocument();
  });

  it('M9: invalidates mrx_preview_ and mrx_source_ cache entries when BOM is saved', async () => {
    serverStateCache.set('mrx_preview_c1_2026-10-19', { items: [] });
    serverStateCache.set('mrx_source_c1_2026-10-19', { items: [] });

    vi.mocked(apiTransport.apiClient).mockImplementation(async (endpoint, options) => {
      const url = new URL(endpoint, 'http://localhost');
      if (url.pathname === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'MRX', version: 1, updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (url.pathname === '/Dishes/bom-price-tiers') return [25000, 30000, 34000];
      if (url.pathname === '/Dishes/bom-coverage') return mockCoverageReport;
      if (url.pathname === '/Dishes/d-3/bom' && (!options || !options.method || options.method === 'GET')) return [];
      if (url.pathname === '/Dishes/d-3/bom' && options?.method === 'POST') return {
        bomId: 'bom-new', dishId: 'd-3', dishCode: 'MON-03', dishName: 'Gà hấp lá chanh',
        ingredientId: 'ing-1', ingredientCode: 'NL-GA', ingredientName: 'Thịt gà',
        unitId: 'u-kg', unitCode: 'kg', unitName: 'kg', priceTierAmount: 25000,
        bomScope: 'global', grossQtyPerServing: 0.2, wasteRatePercent: 0,
        bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành', effectiveFrom: '2026-01-01',
      };
      if (url.pathname === '/ingredients') return {
        items: [{ ingredientId: 'ing-1', ingredientCode: 'NL-GA', ingredientName: 'Thịt gà', unitId: 'u-kg', unitName: 'kg', isActive: true }],
        totalCount: 1, pageNumber: 1, pageSize: 200, totalPages: 1, hasPrev: false, hasNext: false,
      };
      if (url.pathname === '/coordination/customers') return [];
      throw new Error(`Unexpected request ${endpoint}`);
    });

    render(<MemoryRouter><AdminBomBranch /></MemoryRouter>);
    await screen.findByText('Gà hấp lá chanh');

    const editBtns = screen.getAllByRole('button', { name: 'Chỉnh sửa BOM' });
    fireEvent.click(editBtns[2]);

    const qtyInput = await screen.findByLabelText('Định mức / suất');
    fireEvent.change(qtyInput, { target: { value: '0.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào BOM' }));

    await waitFor(() => {
      expect(serverStateCache.get('mrx_preview_c1_2026-10-19')).toBeNull();
      expect(serverStateCache.get('mrx_source_c1_2026-10-19')).toBeNull();
    });
  });
});
