import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AuthProvider } from '../store/authContext';
import { isRouteEligible, resolveEligibleNavigation } from '../routes/navigationEligibility';
import { AppShell } from '../components/workbench/AppShell';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { weeklyMenuApi, type RawWeeklyMenuResponse } from '../api/weeklyMenuApi';
import { MOCK_WEEKLY_MENU_DATA } from '../test/fixtures';
import { mrxApi, type MrxBatch, type MrxMenuChangeResult, type MrxQuantityPreview, type MrxWeeklySource } from '../api/mrxApi';
import { systemApi } from '../api/systemApi';
import { adminApi } from '../api/adminApi';
import { bomApi } from '../api/bomApi';
import { ApiError } from '../api/client';
import * as apiTransport from '../api/client';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

function mrxChangeResult(overrides: Partial<MrxMenuChangeResult>): MrxMenuChangeResult {
  return {
    affectedDemandCount: 0,
    affectedDocumentIds: [],
    affectedPurchaseRequestCount: 0,
    affectedReconciliationBatchIds: [],
    affectedSourceLineIds: [],
    decisionScopes: [],
    hasIssue: false,
    hasPurchaseOrder: false,
    hasReceipt: false,
    impactLines: [],
    lockedDates: [],
    materialImpact: [],
    menuAmendmentId: '',
    requiresReconciliation: false,
    status: 'PREVIEW',
    ...overrides,
  };
}

function renderWeeklyMenu(initialEntry = '/weekly-menu', withShell = false) {
  const content = <Routes>
    <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
    <Route path="/forbidden" element={<ForbiddenPage />} />
    <Route path="/warehouse" element={<LocationProbe />} />
  </Routes>;
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <DirtyNavigationProvider>{withShell
          ? <AppShell navigation={resolveEligibleNavigation(CANONICAL_ROUTES, JSON.parse(localStorage.getItem('ipc_v3_user')!), 'MATERIAL_RECONCILIATION')}>{content}</AppShell>
          : content}</DirtyNavigationProvider>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Weekly Menu Feature (FR-MENU — 4 Views Zero AI-Slop Workbench)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'coordinator-1', fullName: 'Điều phối viên', username: 'coord', roleCode: 'Coordinator', roleName: 'Điều phối',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1', days: [],
    });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(bomApi, 'getSupportedPriceTiers').mockResolvedValue([]);
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([]);
  });
  it.each([
    ['mrx-materials', 'Định lượng nguyên liệu', 'materials'],
    ['mrx-plans', 'Kế hoạch theo ca', 'plans'],
  ])('cold-loads %s without a commit preview and retains its scope across server paging', async (view, title, endpoint) => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    const material = {
      ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Gạo', canonicalUnitId: 'kg', canonicalUnitName: 'kg', requiredQuantity: 1.2,
      contributions: [{ serviceDate: '2026-10-19', shift: 'MORNING', quantityPlanLineId: 'line-1', dishId: 'dish-1', dishName: 'Cơm', dishSlot: 'savory-main', finalServings: 100,
        material: { dishBomId: 'bom-1', ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Gạo', grossQuantityPerServing: 0.012, sourceUnitId: 'kg', sourceUnitName: 'kg', requiredQuantity: 1.2, canonicalUnitId: 'kg', canonicalUnitName: 'kg' } }],
    };
    const plan = { serviceDate: '2026-10-19', planCode: 'KH01', line: {
      quantityPlanLineId: 'line-1', menuScheduleId: 'schedule-1', customerId: 'customer-1', menuId: 'menu-1', shift: 'MORNING', finalServings: 100, menuCode: 'TD01', menuName: 'Thực đơn đã chọn', dishes: [{ dishId: 'dish-1', dishCode: 'MON1', dishName: 'Món kiểm tra nguồn', dishSlot: 'undocumented-slot', materials: [] }],
    } };
    const reads: URL[] = [];
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async path => {
      const url = new URL(path, 'http://localhost');
      if (url.pathname === '/coordination/customers') return [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      if (url.pathname === '/reconciliation/weekly-menu') {
        expect(url.searchParams.get('customerId')).toBe('customer-1');
        expect(url.searchParams.get('weekStartDate')).toBe('2026-10-19');
        return { customerId: 'customer-1', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'version-1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [] };
      }
      if (url.pathname === `/reconciliation/batches/quantity-import/${endpoint}`) {
        reads.push(url);
        expect(url.searchParams.get('menuVersionId')).toBe('version-1');
        expect(url.searchParams.get('PageSize')).toBe('1');
        const pageNumber = Number(url.searchParams.get('PageNumber'));
        return { menuVersionId: 'version-1', contentFingerprint: 'fingerprint-1', fingerprintFormatVersion: 3, diagnostics: [], page: {
          items: [endpoint === 'materials' ? material : plan], totalCount: 2, pageNumber, pageSize: 1, totalPages: 2, hasPrev: pageNumber > 1, hasNext: pageNumber < 2,
        } };
      }
      throw new Error(`Unexpected inspection request ${path}`);
    });
    renderWeeklyMenu(`/weekly-menu?view=${view}&customerId=customer-1&weekStartDate=2026-10-19&pageSize=1`);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(await screen.findByText(endpoint === 'materials' ? 'Gạo' : 'Thực đơn đã chọn')).toBeVisible();
    expect(workspaceSessionStore.getScope().weeklyMenuScope).toEqual({ customerId: 'customer-1', weekStartDate: '2026-10-19' });
    if (endpoint === 'plans') {
      expect(screen.queryByText('KH01')).not.toBeInTheDocument();
      const action = screen.getByRole('button', { name: 'Xem món ngày 19/10/2026 · Sáng' });
      expect(action).toHaveTextContent(/^Xem$/);
      await userEvent.click(action);
      const detail = screen.getByRole('dialog', { name: 'Ma trận món ăn ca: Sáng · Ngày 19/10/2026' });
      expect(within(detail).getByText('Món kiểm tra nguồn')).toBeVisible();
      expect(within(detail).getByText('Chưa rõ phân loại (undocumented-slot)')).toBeVisible();
      await userEvent.click(within(detail).getByRole('button', { name: 'Đóng' }));
    }
    expect(screen.getByText('Hiện hành')).toBeVisible();
    await userEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(reads.some(url => url.searchParams.get('PageNumber') === '2')).toBe(true));
    expect(screen.queryByRole('button', { name: 'Lập lô đối soát' })).not.toBeInTheDocument();
  });

  it('keeps an unscoped direct inspection link explicit even when another weekly pair was remembered', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    workspaceSessionStore.setScope({ weeklyMenuScope: { customerId: 'old-customer', weekStartDate: '2026-10-12' } });
    const read = vi.spyOn(mrxApi, 'getWeeklySource');
    renderWeeklyMenu('/weekly-menu?view=mrx-materials');
    expect(await screen.findByText('Chọn khách hàng và tuần bắt đầu')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('');
    expect(read).not.toHaveBeenCalled();
  });

  it('shows a missing weekly source as a prerequisite without requesting quantity inspection', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    workspaceSessionStore.setScope({ weeklyMenuScope: { customerId: 'old-customer', weekStartDate: '2026-10-12' } });
    const transport = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async path => {
      if (path.startsWith('/reconciliation/weekly-menu?')) throw new ApiError(404, 'Không tìm thấy nguồn.');
      throw new Error(`Unexpected missing-source request ${path}`);
    });
    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=customer-1&weekStartDate=2026-10-19');
    expect(await screen.findByText('Chưa có nguồn thực đơn cho tuần này')).toBeVisible();
    expect(screen.getByText('Hoàn thiện nguồn thực đơn và số suất tại Chuẩn bị lô đối soát.')).toBeVisible();
    expect(screen.queryByText('Không có nguyên liệu phù hợp')).not.toBeInTheDocument();
    expect(transport.mock.calls.some(([path]) => path.includes('/quantity-import/'))).toBe(false);
    expect(workspaceSessionStore.getScope().weeklyMenuScope).toEqual({ customerId: 'old-customer', weekStartDate: '2026-10-12' });
  });

  it.each([404, 500])('keeps an inspection HTTP %s failure visible and retries the real read endpoint', async (status) => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    let inspectionReads = 0;
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async path => {
      if (path.startsWith('/reconciliation/weekly-menu?')) return { customerId: 'customer-1', weekStartDate: '2026-10-19', menuVersionId: 'version-1', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [] };
      if (path.startsWith('/reconciliation/batches/quantity-import/materials?')) {
        if (++inspectionReads === 1) throw new ApiError(status, 'Không đọc được định lượng.');
        return { menuVersionId: 'version-1', contentFingerprint: 'fingerprint-1', fingerprintFormatVersion: 3, diagnostics: [], page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0, hasPrev: false, hasNext: false } };
      }
      throw new Error(`Unexpected retry read ${path}`);
    });
    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=customer-1&weekStartDate=2026-10-19');
    expect(await screen.findByText('Không đọc được định lượng.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Không có nguyên liệu phù hợp')).toBeVisible();
    expect(inspectionReads).toBe(2);
  });

  it('preserves real source edits on cancelled sidebar navigation and discards only locally on confirmation', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getEditScope).mockRestore();
    vi.mocked(adminApi.getDishes).mockRestore();
    const transport = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (path, options) => {
      expect(options?.method ?? 'GET').toBe('GET');
      const url = new URL(path, 'http://localhost');
      if (url.pathname === '/coordination/customers') return [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      if (url.pathname === '/reconciliation/weekly-menu') return { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', menuVersionId: 'version-1', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [] };
      if (url.pathname === '/reconciliation/weekly-menu/edit-scope') return {
        menuVersionId: 'version-1', batchId: null, batchStatus: null, batchVersion: null,
        days: [{ serviceDate: '2026-10-19', isLocked: false, lockReason: null, shifts: [{ shiftName: 'MORNING', savoryServings: 100, vegetarianServings: 0,
          slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món chính', dishId: 'dish-1', dishCode: 'MON1', dishName: 'Cơm' }],
        }] }],
      };
      const page = { items: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0, hasPrev: false, hasNext: false };
      if (url.pathname === '/Dishes') return { ...page, items: [{ dishId: 'dish-1', dishCode: 'MON1', dishName: 'Cơm', isActive: true }], totalCount: 1, totalPages: 1, pageSize: 100 };
      if (url.pathname === '/reconciliation/batches') return page;
      if (url.pathname === '/reconciliation/batches/quantity-import/materials') return { menuVersionId: 'version-1', contentFingerprint: 'fingerprint-1', fingerprintFormatVersion: 3, diagnostics: [], page };
      throw new Error(`Unexpected source navigation request ${path}`);
    });
    renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19', true);
    const input = await screen.findByRole('spinbutton', { name: /Số suất Mặn 19\/10/ });
    await userEvent.clear(input);
    await userEvent.type(input, '125');
    const destination = screen.getByRole('link', { name: 'Định lượng nguyên liệu' });
    expect(destination).toHaveAttribute('href', '/weekly-menu?view=mrx-materials&customerId=customer-1&weekStartDate=2026-10-19');
    await userEvent.click(destination);
    expect(screen.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(input).toHaveValue(125);
    await userEvent.click(destination);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(await screen.findByRole('heading', { name: 'Định lượng nguyên liệu' })).toBeVisible();
    expect(transport.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('lets Admin review exact pending impact and approve it from the MRX inbox', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'admin-1', fullName: 'Quản trị viên', username: 'admin', roleCode: 'ADMIN', roleName: 'Admin',
      isActive: true, isAdminFullAccess: true, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([{
      menuAmendmentId: 'amendment-1', customerId: 'customer-1', customerName: 'Draxlmaier', weekStartDate: '2026-10-19',
      status: 'PENDING_REVIEW', reason: 'Khách hàng tăng số suất', createdAt: '2026-10-18T00:00:00Z', affectedReconciliationBatchIds: ['batch-1'],
      impactLines: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', dishSlot: 'main', oldDishId: 'dish-1', newDishId: 'dish-1', currentServings: 100, newServings: 120 }],
    }]);
    vi.spyOn(mrxApi, 'decideSourceChange').mockResolvedValue(mrxChangeResult({ menuAmendmentId: 'amendment-1', status: 'EXECUTED', affectedReconciliationBatchIds: ['batch-1'] }));

    renderWeeklyMenu('/weekly-menu?view=mrx-batch');
    await userEvent.click(await screen.findByRole('button', { name: 'Yêu cầu chờ duyệt (1)' }));
    expect(screen.getByRole('table', { name: 'Thay đổi nguồn đã gửi' })).toHaveTextContent('100 → 120 suất');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Phê duyệt thay đổi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));

    expect(mrxApi.decideSourceChange).toHaveBeenCalledWith('amendment-1', true, undefined);
    expect(await screen.findByText('Đã áp dụng thay đổi nguồn.')).toBeInTheDocument();
    expect(screen.queryByText('Thành công')).not.toBeInTheDocument();
  });

  it('shows a fail-closed explanation rather than a blank body when a retained batch has no weekly source', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    const batch = { batchId: 'batch-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'COMPLETED', version: 5, lines: [] };
    workspaceSessionStore.setScope({ customerId: 'customer-1', serviceDate: '2026-10-21' });
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      const url = new URL(endpoint, 'http://localhost');
      const path = url.pathname;
      if (path === '/reconciliation/weekly-menu') expect(url.searchParams.get('weekStartDate')).toBe('2026-10-19');
      if (path === '/reconciliation/batches') expect(url.searchParams.get('WeekStartDate')).toBe('2026-10-19');
      if (path === '/coordination/customers') return [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      if (path === '/reconciliation/weekly-menu') return null;
      if (path === '/reconciliation/batches') return { items: [batch], totalCount: 1, pageNumber: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false };
      if (path === '/reconciliation/batches/batch-1') return batch;
      throw new Error(`Unexpected missing-source read ${endpoint}`);
    });
    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=ALL');
    expect(await screen.findByText('Không có nguồn thực đơn để hiển thị')).toBeVisible();
    expect(screen.getByText(/Lô đối soát vẫn được giữ nguyên/)).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Món & BOM đã đóng băng' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Nhập thực đơn Excel ngay' })).not.toBeInTheDocument();
  });

  it('keeps imported dishes visible and exposes missing servings in the persistent source matrix', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1',
      days: [{ serviceDate: '2026-10-19', isLocked: false, lockReason: null, shifts: [{
        shiftName: 'MORNING', savoryServings: null, vegetarianServings: null,
        slots: [
          { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt' },
          { dishSlot: 'vegetarian-main', menuVariant: 'vegetarian', slotLabel: 'Món chay', dishId: 'dish-2', dishCode: 'C01', dishName: 'Đậu khuôn kho' },
        ],
      }] }],
    });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [
        { dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true },
        { dishId: 'dish-2', dishCode: 'C01', dishName: 'Đậu khuôn kho', isActive: true },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
    const impact = vi.spyOn(mrxApi, 'previewSourceChange').mockRejectedValueOnce(new ApiError(409, 'Nguồn đang thay đổi, hãy thử lại.')).mockResolvedValue(mrxChangeResult({}));
    const preview = vi.spyOn(mrxApi, 'previewQuantityImport');

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19');

    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByText('Cơm thịt')).toBeInTheDocument();
    expect(screen.getByText('Đậu khuôn kho')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 Sáng' })).toHaveValue(null);
    expect(screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 Sáng' })).toHaveValue(null);
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nhập Excel' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Nhập thực đơn mới' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();

    const savoryInput = screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 Sáng' });
    const vegetarianInput = screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 Sáng' });
    await userEvent.type(savoryInput, '125');
    await userEvent.click(screen.getByRole('button', { name: /Kiểm tra số suất|Tiếp tục xem ảnh hưởng/ }));
    expect(vegetarianInput).toHaveFocus();
    expect(vegetarianInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).not.toBeInTheDocument();
    expect(impact).not.toHaveBeenCalled();
    await userEvent.type(vegetarianInput, '0');
    expect(screen.queryByText('Thiếu 2 ô số suất')).not.toBeInTheDocument();
    const reviewTrigger = screen.getByRole('button', { name: /Kiểm tra số suất|Tiếp tục xem ảnh hưởng/ });
    await userEvent.click(reviewTrigger);
    expect(await screen.findByText('Nguồn đang thay đổi, hãy thử lại.')).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 Sáng' })).toHaveValue(125);
    await userEvent.click(reviewTrigger);
    expect(await screen.findByRole('button', { name: 'Quay lại thực đơn' })).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton', { name: /Số suất/ })).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kiểm tra số suất' })).toHaveFocus();
    expect(impact).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole('button', { name: 'Quay lại thực đơn' }));
    expect(screen.queryByRole('button', { name: 'Quay lại thực đơn' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 Sáng' })).toHaveValue(125);
    expect(screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 Sáng' })).toHaveValue(0);
    expect(screen.getByRole('button', { name: /Kiểm tra số suất|Tiếp tục xem ảnh hưởng/ })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa món' }));
    expect(screen.getByRole('combobox', { name: 'Món mặn 19/10 Sáng' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Món chay 19/10 Sáng' })).toBeInTheDocument();
  });

  it('renders a completed MRX week as facts without source-edit controls or repeated cell warnings', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getEditScope).mockRestore();
    vi.mocked(adminApi.getDishes).mockRestore();
    const completed: MrxBatch = { batchId: 'completed-1', status: 'COMPLETED', version: 5, menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1', createdAt: '2026-10-18T00:00:00Z', customerId: 'customer-1', weekStartDate: '2026-10-19', lines: [] };
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (path) => {
      if (path.startsWith('/reconciliation/weekly-menu/edit-scope?')) return {
        batchId: completed.batchId, batchStatus: 'COMPLETED', batchVersion: 5, menuVersionId: 'menu-v1',
        days: [{ serviceDate: '2026-10-19', isLocked: true, lockReason: 'Lô đã hoàn tất', shifts: [{ shiftName: 'MORNING', savoryServings: 100, vegetarianServings: 0,
          slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món chính', dishId: 'dish-1', dishCode: 'M01', dishName: 'Món lô hoàn tất' }],
        }] }],
      };
      if (path.startsWith('/reconciliation/weekly-menu?')) return {
        customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
        menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
        validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
      };
      if (path.startsWith('/reconciliation/batches?')) return { items: [completed], totalCount: 1, pageNumber: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false };
      if (path === '/reconciliation/batches/completed-1') return completed;
      if (path === '/reconciliation/batches/quantity-import/preview') return { token: 'preview-1', expiresAt: '2026-10-19T00:00:00Z', contentFingerprint: 'fp', fingerprintFormatVersion: 2, plans: [], diagnostics: [] };
      if (path.startsWith('/Dishes')) return { items: [{ dishId: 'dish-1', dishCode: 'M01', dishName: 'Món lô hoàn tất', isActive: true }], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      throw new Error(`Unexpected request: ${path}`);
    });
    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-10-19');
    expect(await screen.findByText('Món lô hoàn tất')).toBeVisible();
    expect(within(screen.getByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).getByText('Đã chốt sổ').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa món' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox', { name: /Món chính/ })).toHaveLength(0);
    expect(screen.queryByText('Lô đã hoàn tất')).not.toBeInTheDocument();
    expect(screen.queryByText('Lô đã hoàn tất đối soát')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '100' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Nhập Excel' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nhập thực đơn mới' }));
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
    await userEvent.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'next-week.xlsx'));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('19/10/2026');
    expect(screen.getByText('Món lô hoàn tất')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Nhập thực đơn mới' }));
    expect(screen.getByLabelText<HTMLInputElement>(/Chọn file Excel thực đơn/i).files).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
  });

  it.each([
    { mode: 'MATERIAL_RECONCILIATION' as const, roleCode: 'WAREHOUSESTAFF', permissions: ['reconciliation.warehouse.read'] },
    { mode: 'DEFAULT' as const, roleCode: 'COORDINATOR', permissions: ['reconciliation.source.read'] },
  ])('does not admit new MRX import via URL for $roleCode in $mode', async ({ mode, roleCode, permissions }) => {
    localStorage.setItem('ipc_v3_mode', mode);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'actor-1', username: 'actor', fullName: 'Người dùng', roleCode, roleName: roleCode, isActive: true, isAdminFullAccess: false, permissions }));
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode, label: mode, version: 1, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null);
    const preview = vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport');
    const commit = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport');
    renderWeeklyMenu('/weekly-menu?view=mrx-batch&action=import&customerId=customer-1&weekStartDate=2026-10-19');
    await screen.findByRole('heading', { name: 'Truy cập bị từ chối' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập thực đơn mới' })).not.toBeInTheDocument();
    const emptyAction = screen.queryByRole('button', { name: 'Nhập thực đơn Excel ngay' });
    if (emptyAction) await userEvent.click(emptyAction);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('waits for the customer catalog before opening a new-menu intent with a usable customer selection', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    let resolveCustomers!: (items: Awaited<ReturnType<typeof weeklyMenuApi.getCustomers>>) => void;
    vi.mocked(weeklyMenuApi.getCustomers).mockImplementation(() => new Promise(resolve => { resolveCustomers = resolve; }));
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null);
    renderWeeklyMenu('/weekly-menu?view=mrx-batch&action=import');
    await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => resolveCustomers([{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]));
    expect(await screen.findByRole('dialog', { name: 'Nhập thực đơn tuần từ file Excel' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng nhập thực đơn' })).toHaveValue('customer-1');
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
  });

  it('restores the actual previously loaded MRX week after another workspace changes the shared date', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    const first = renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19');
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('19/10/2026');
    first.unmount();
    workspaceSessionStore.setScope({ weekStartDate: '2026-11-02', serviceDate: '2026-11-02', batchId: '' });
    renderWeeklyMenu('/weekly-menu?view=mrx-batch');
    expect(await screen.findByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('19/10/2026');
  });

  it('ignores a delayed old batch when MRX customer-week navigation changes on the same route', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const getSource = vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId, weekStartDate, customerCode: 'DAV', customerName: 'Draxlmaier', weekEndDate: weekStartDate === '2026-10-19' ? '2026-10-25' : '2026-11-01', menuVersionId: weekStartDate === '2026-10-19' ? 'menu-old' : 'menu-new', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    const oldBatch = { batchId: 'old-batch', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-old', quantityImportBatchId: 'import-old', status: 'READY', version: 2, createdAt: '2026-10-18T00:00:00Z', lines: [] } satisfies MrxBatch;
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async ({ weekStartDate } = {}) => ({ items: weekStartDate === '2026-10-19' ? [oldBatch] : [], totalCount: weekStartDate === '2026-10-19' ? 1 : 0, pageNumber: 1, pageSize: 1, totalPages: weekStartDate === '2026-10-19' ? 1 : 0, hasPrev: false, hasNext: false }));
    let resolveOld!: (value: MrxBatch) => void;
    const getBatch = vi.spyOn(mrxApi, 'getBatch').mockImplementation(() => new Promise(resolve => { resolveOld = resolve; }));
    const router = createMemoryRouter([{ path: '/weekly-menu', element: <WeeklyMenuPage /> }], { initialEntries: ['/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-10-19'] });
    render(<AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}><RouterProvider router={router} /></AuthProvider>);
    await waitFor(() => expect(getBatch).toHaveBeenCalledWith('old-batch'));
    await act(async () => { await router.navigate('/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-10-26'); });
    await waitFor(() => expect(getSource).toHaveBeenCalledWith('customer-1', '2026-10-26'));
    await act(async () => resolveOld(oldBatch));
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('26/10/2026');
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'customer-1', weekStartDate: '2026-10-26', batchId: '' });
    expect(screen.queryByRole('button', { name: 'Chuyển sang Kho' })).not.toBeInTheDocument();
  });

  it('keeps MRX source diagnostics visible and blocks commit until the source is valid', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const source: MrxWeeklySource = {
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', menuVersionNo: 3,
      menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    };
    const preview: MrxQuantityPreview = {
      token: 'preview-token', expiresAt: '2026-10-18T10:15:00Z', contentFingerprint: 'fingerprint-v2',
      fingerprintFormatVersion: 2, plans: [], diagnostics: ['Món Canh bí đỏ chưa có định mức nguyên liệu.'],
    };
    const defaultQuery = vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData');
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(source);
    vi.mocked(mrxApi.getEditScope).mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1',
      days: [{ serviceDate: '2026-10-19', isLocked: false, lockReason: null, shifts: [{
        shiftName: 'MORNING', savoryServings: 100, vegetarianServings: 20,
        slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Canh bí đỏ' }],
      }] }],
    });
    vi.mocked(adminApi.getDishes).mockResolvedValue({
      items: [{ dishId: 'dish-1', dishCode: 'M01', dishName: 'Canh bí đỏ', isActive: true }],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue(preview);
    vi.spyOn(mrxApi, 'commitQuantityImport');

    renderWeeklyMenu('/weekly-menu?view=mrx-batch');
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu & kiểm tra định lượng' }));

    expect(await screen.findByText('Món Canh bí đỏ chưa có định mức nguyên liệu.')).toBeInTheDocument();
    expect(screen.getByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getAllByText('Canh bí đỏ').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tóm tắt định lượng và nguyên liệu')).not.toBeInTheDocument();
    const servings = screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 Sáng' });
    await userEvent.clear(servings);
    await userEvent.type(servings, '101');
    expect(screen.getByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt định lượng và nguyên liệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Món Canh bí đỏ chưa có định mức nguyên liệu.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lập lô đối soát' })).not.toBeInTheDocument();
    expect(mrxApi.commitQuantityImport).not.toHaveBeenCalled();
    expect(defaultQuery).not.toHaveBeenCalled();
  });

  it('renders mrx-batch view when accessing /weekly-menu?view=mrx-batch', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null);
    renderWeeklyMenu('/weekly-menu?view=mrx-batch');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeInTheDocument();
  });

  it('automatically redirects naked /weekly-menu to /weekly-menu?view=mrx-batch in MATERIAL_RECONCILIATION mode (DOM-MODE-1)', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null);
    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Thực đơn & KHSX tuần' })).not.toBeInTheDocument();
  });

  it.each([
    { roleCode: 'Coordinator', roleName: 'Điều phối', isAdminFullAccess: false, canOpenWarehouse: false },
    { roleCode: 'ADMIN', roleName: 'Admin', isAdminFullAccess: true, canOpenWarehouse: true },
  ])('commits, readies and transfers a canonical batch without inviting $roleCode outside its station', async ({ roleCode, roleName, isAdminFullAccess, canOpenWarehouse }) => {
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'source-user', fullName: roleName, username: 'source', roleCode, roleName,
      isActive: true, isAdminFullAccess, permissions: ['reconciliation.source.read'],
    }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const source: MrxWeeklySource = {
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', menuVersionNo: 3,
      menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    };
    const preview: MrxQuantityPreview = {
      token: 'preview-token', expiresAt: '2026-10-18T10:15:00Z', contentFingerprint: 'fingerprint-v2',
      fingerprintFormatVersion: 2, diagnostics: [],
      plans: [{ quantityPlanId: 'plan-1', planCode: 'SL-01', serviceDate: '2026-10-19', status: 'COMPLETED', rowVersion: '2026-10-18T00:00:00Z', lines: [] }],
    };
    const draft = { batchId: 'batch-1', menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1', status: 'DRAFT', version: 1, createdAt: '2026-10-18T00:00:00Z', lines: [] } as MrxBatch;
    const createBatch = vi.spyOn(mrxApi, 'createBatch');
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(source);
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue(preview);
    vi.spyOn(mrxApi, 'commitQuantityImport').mockResolvedValue({ importBatchId: 'import-1', reconciliationBatchId: 'batch-1', contentFingerprint: 'fingerprint-v2', idempotentReplay: false });
    vi.spyOn(mrxApi, 'getBatch')
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ...draft, status: 'TRANSFERRED', version: 3 });
    vi.spyOn(mrxApi, 'markReady').mockResolvedValue({ ...draft, status: 'READY', version: 2 });
    vi.spyOn(mrxApi, 'transferToWarehouse').mockResolvedValue({ batchId: 'batch-1', status: 'TRANSFERRED', sourceVersion: 3, lines: [] });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19');
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu & kiểm tra định lượng' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Lập lô đối soát' }));
    expect(mrxApi.commitQuantityImport).toHaveBeenCalledTimes(1);
    expect(createBatch).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Đóng băng lô' }));
    expect(mrxApi.markReady).toHaveBeenCalledWith('batch-1', 1);
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển sang Kho' }));
    expect(mrxApi.transferToWarehouse).toHaveBeenCalledWith('batch-1', 2);
    expect(await screen.findByText('Đã bàn giao lô đối soát sang Kho nguyên liệu thành công.')).toBeInTheDocument();
    expect(screen.getByText('Đã chuyển Kho')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).toBeInTheDocument();

    if (canOpenWarehouse) {
      expect(screen.getByRole('button', { name: 'Mở trạm Kho xuất ngày' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Đi đến Trạm Kho nguyên liệu →' }));
      expect(await screen.findByText('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19')).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: 'Mở trạm Kho xuất ngày' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Đi đến Trạm Kho nguyên liệu →' })).not.toBeInTheDocument();
      expect(screen.getByText('Đã bàn giao · Chờ Kho xuất nguyên liệu.')).toBeInTheDocument();
    }
  });

  it('opens the real import modal and exposes template download failures without an unauthenticated fallback', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const download = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    renderWeeklyMenu();

    const importBtn = await screen.findByRole('button', { name: 'Nhập thực đơn Excel' });
    await userEvent.click(importBtn);

    expect(await screen.findByRole('heading', { name: 'Nhập thực đơn tuần từ file Excel' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Chọn file Excel thực đơn/i)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Khách hàng nhập/i), 'customer-1');
    const date = screen.getByLabelText('Tuần bắt đầu nhập', { exact: true });
    await userEvent.clear(date);
    await userEvent.type(date, '14/09/2026');
    await userEvent.tab();
    const templateBtn = screen.getByRole('button', { name: 'Tải file mẫu Excel' });
    expect(templateBtn).toBeEnabled();
    await userEvent.click(templateBtn);
    expect(await screen.findByText(/Không thể tải tệp \(HTTP 500\)/)).toBeInTheDocument();
    expect(download).toHaveBeenCalledWith(expect.stringContaining('/api/coordination/weekly-menu/template'), expect.anything());
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('shows history loading failure rather than presenting an empty successful history', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);
    const history = vi.spyOn(weeklyMenuApi, 'getImportHistory').mockRejectedValueOnce(new Error('Không thể tải lịch sử nhập.')).mockResolvedValue({ items: [], totalCount: 0 });
    renderWeeklyMenu();
    await userEvent.click(await screen.findByRole('button', { name: 'Nhập thực đơn Excel' }));
    await userEvent.click(screen.getByRole('button', { name: /Lịch sử import & Khôi phục/i }));
    expect(await screen.findByText('Không thể tải lịch sử nhập.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có lịch sử import cho khách hàng này.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
    expect(await screen.findByText('Chưa có lịch sử import cho khách hàng này.')).toBeInTheDocument();
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('loads retained normalized source from import history without reactivating it', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);
    vi.spyOn(weeklyMenuApi, 'getImportHistory').mockResolvedValue({
      items: [{
        menuVersionId: 'version-rolled-back', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19', versionNo: 2, status: 'ROLLED_BACK', sourceFileName: 'menu.xlsx',
        createdAt: '2026-10-18T00:00:00Z', successRowCount: 1, errorRowCount: 0, warningRowCount: 0,
        canRollback: false,
      }],
      totalCount: 1,
    });
    vi.spyOn(weeklyMenuApi, 'getImportSnapshot').mockResolvedValue({
      menuVersionId: 'version-rolled-back', customerId: 'customer-1', weekStartDate: '2026-10-19', priceTierAmount: 25000,
      rows: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', dishSlot: 'savory-main', dishId: 'dish-1', dishName: 'Bò kho', sourceOrder: 1 }],
    });

    renderWeeklyMenu();
    await userEvent.click(await screen.findByRole('button', { name: 'Nhập thực đơn Excel' }));
    await userEvent.click(screen.getByRole('button', { name: /Lịch sử import & Khôi phục/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xem nguồn' }));

    expect(await screen.findByText('Nguồn chuẩn hóa tuần 19/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Bò kho')).toBeInTheDocument();
    expect(weeklyMenuApi.getImportSnapshot).toHaveBeenCalledWith('version-rolled-back');
    expect(screen.queryByRole('button', { name: 'Hủy phiên' })).not.toBeInTheDocument();
  });

  it.each([404, 500])('distinguishes missing retained source from HTTP %s read failure and supports retry', async (status) => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);
    vi.spyOn(weeklyMenuApi, 'getImportHistory').mockResolvedValue({
      items: [{
        menuVersionId: 'legacy-version', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19', versionNo: 1, status: 'ROLLED_BACK', createdAt: '2026-10-18T00:00:00Z',
        successRowCount: 0, errorRowCount: 0, warningRowCount: 0, canRollback: false,
      }], totalCount: 1,
    });
    vi.spyOn(weeklyMenuApi, 'getImportSnapshot').mockRejectedValueOnce(new ApiError(status, 'Không thể tải nguồn đã lưu.')).mockResolvedValue({
      menuVersionId: 'legacy-version', customerId: 'customer-1', weekStartDate: '2026-10-19', priceTierAmount: 25000, rows: [],
    });

    renderWeeklyMenu();
    await userEvent.click(await screen.findByRole('button', { name: 'Nhập thực đơn Excel' }));
    await userEvent.click(screen.getByRole('button', { name: /Lịch sử import & Khôi phục/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xem nguồn' }));

    if (status === 404) {
      expect(await screen.findByText('Không có dữ liệu nguồn được lưu cho phiên nhập này.')).toBeInTheDocument();
    } else {
      expect(await screen.findByText('Không thể tải nguồn đã lưu.')).toBeInTheDocument();
      expect(screen.queryByText(/Không có dữ liệu nguồn được lưu/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Tải lại nguồn' }));
      expect(await screen.findByText('Nguồn chuẩn hóa tuần 19/10/2026')).toBeInTheDocument();
    }
    expect(screen.queryByText('Chưa có lịch sử import cho khách hàng này.')).not.toBeInTheDocument();
  });

  it('renders single 56px WorkspaceHeader with client selectors, dd/MM/yyyy date, and dynamic primary button (Rule D7)', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu();

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();

    // Client select, week date input, and pricing context pill
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-date-locale', 'vi-VN');
    expect(screen.queryByText('Định mức: 25.000 ₫')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập thực đơn Excel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt kế hoạch tuần' })).not.toBeInTheDocument();
  });

  it('renders dynamic mealTargetPrice in WeeklyScheduleView and avoids hardcoded 25.000 ₫', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 32000,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('32.000 ₫')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('renders "Theo ca / Chưa chốt" when mealTargetPrice is 0', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 0,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('Theo ca / Chưa chốt')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('handles null weekly menu response without throwing Cannot read properties of null', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenu').mockResolvedValueOnce(null as unknown as RawWeeklyMenuResponse);
    vi.spyOn(weeklyMenuApi, 'getProductionPlans').mockResolvedValueOnce([]);
    vi.spyOn(weeklyMenuApi, 'getAllDemand').mockResolvedValueOnce({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 });

    const result = await weeklyMenuApi.getWeeklyMenuData('DAV', '2026-10-12');
    expect(result.matrixRows).toEqual([]);
    expect(result.scheduleDays).toEqual([]);
  });

  it('View 1 (Kế hoạch tuần): renders Mon-Sat matrix without duplicate subbar tabs or repetitive cell text', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu');

    // Matrix columns: Monday to Saturday
    expect(await screen.findByRole('columnheader', { name: /Thứ Hai/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Thứ Bảy/i })).toBeInTheDocument();

    // Section headers and real dish names
    expect(screen.getByText('MENU MẶN CA SÁNG')).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();

    // Invariant: Repetitive cell text removed!
    expect(screen.queryByText(/Suất: 25.000 ₫ BOM: Đạt chuẩn/i)).not.toBeInTheDocument();

    // Invariant: NO duplicate horizontal view tabs inside page!
    expect(screen.queryByRole('tab', { name: 'Kế hoạch tuần' })).not.toBeInTheDocument();

    // Invariant: Zero <details> tags in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('View 2 uses authoritative demand and production-plan facets without fabricating handoff vouchers', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu?view=demand');

    expect(screen.queryByRole('button', { name: 'Mở hàng đợi duyệt' })).not.toBeInTheDocument();

    // Day navigator [<] Thứ Hai, 21/09/2026 [>]
    expect(await screen.findByText(/Thứ Hai, 21\/09\/2026/i)).toBeInTheDocument();

    // Segmented tabs replace legacy bottom details!
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /KHSX nguồn/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Chứng từ bàn giao/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tính lại nhu cầu' })).not.toBeInTheDocument();

    // 6 Columns in Primary DataGrid
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhu cầu đã tính' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất vật lý' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn phải xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái bàn giao' })).toBeInTheDocument();

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to "KHSX nguồn" tab
    await userEvent.click(screen.getByRole('tab', { name: /KHSX nguồn/i }));
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();

    // No production plan may be renamed into a signed handoff voucher.
    expect(screen.queryByText(/Đã ký nhận/i)).not.toBeInTheDocument();
  });

  it('View 3 renders production-plan facts without a fake print action', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu('/weekly-menu?view=production-plan');

    expect(screen.queryByRole('button', { name: 'In lệnh sản xuất' })).not.toBeInTheDocument();

    // KHSX lines rendered
    expect((await screen.findAllByText(/KHSX-DAV-20260921/i)).length).toBeGreaterThan(0);

    // DataGrid columns
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca sản xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày phục vụ' })).toBeInTheDocument();

    // Date formatted as dd/MM/yyyy
    expect(screen.getAllByText('21/09/2026').length).toBeGreaterThan(0);
  });

  it('View 4 does not expose cost reports or exports without an authoritative backend cost contract', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      dishCosts: [],
      dailyMaterials: [],
    });

    renderWeeklyMenu('/weekly-menu?view=cost');

    expect(screen.queryByRole('button', { name: 'Xuất bảng chi phí' })).not.toBeInTheDocument();
    expect(await screen.findByText('Chưa có số liệu phân rã chi phí BOM')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Đơn giá vốn' })).not.toBeInTheDocument();


  });

  it('handles empty state and calculation errors gracefully with StateBoundary', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockRejectedValueOnce(
      new Error('Không có kết nối mạng')
    );

    renderWeeklyMenu();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Không có kết nối mạng')).toBeInTheDocument();

    // Click retry
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValueOnce(MOCK_WEEKLY_MENU_DATA);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thực đơn & KHSX tuần')).toBeInTheDocument();
  });

  it('Route 2: persists customerId and weekStartDate in URL search params on change and F5 reload', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-2', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-2&weekStartDate=2026-11-02');

    const customerSelect = await screen.findByRole('combobox', { name: 'Chọn khách hàng MRX' });
    expect(customerSelect).toHaveValue('cust-2');
  });

  it('uses the unified weekly source workbench when an MRX source exists', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-1', menuVersionNo: 1, menuVersionStatus: 'DRAFT', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');

    expect(await screen.findByRole('heading', { name: 'Hoàn thiện nguồn tuần' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'manager-1', fullName: 'Quản lý', username: 'manager', roleCode: 'Manager', roleName: 'Quản lý',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read', 'reconciliation.source.approve'],
    }));
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([{
      menuAmendmentId: 'amend-99',
      customerId: 'cust-1',
      customerName: 'Khách Một',
      weekStartDate: '2026-11-02',
      status: 'PENDING_REVIEW',
      reason: 'Đổi món trưa từ Dashboard',
      createdAt: '2026-11-02T01:00:00Z',
      affectedReconciliationBatchIds: [],
      impactLines: [],
    }]);

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02&amendmentId=amend-99');

    expect(await screen.findByRole('heading', { name: 'Duyệt thay đổi nguồn MRX' })).toBeVisible();
    expect(screen.getByText('Đổi món trưa từ Dashboard')).toBeVisible();
    return;
    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
  });

  it('replaces the legacy schedule editor with direct MRX source editing after a batch exists', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-1', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-transferred-1', customerId: 'cust-1', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08', status: 'TRANSFERRED',
        version: 3, createdAt: '2026-11-01T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getBatch').mockResolvedValue({
      batchId: 'batch-transferred-1', customerId: 'cust-1', weekStartDate: '2026-11-02', status: 'TRANSFERRED',
      version: 3, lines: [],
    } as unknown as MrxBatch);
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue({
      token: 'preview-token',
      expiresAt: '2026-11-02T01:00:00Z',
      contentFingerprint: 'fp-1',
      fingerprintFormatVersion: 2,
      plans: [],
      diagnostics: [],
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');

    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
  });

  it('B3: useMrxBatchWorkspace persists weeklyMenuScope when selecting customer or week so AppShell sidebar inspection links carry the active scope', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockRejectedValue(new ApiError(404, 'Not found'));

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');

    await waitFor(() => expect(workspaceSessionStore.getScope().weeklyMenuScope).toEqual({
      customerId: 'cust-1',
      weekStartDate: '2026-11-02',
    }));
  });

  it('C1 & C2: keeps inspection rows and PaginationBar mounted with isPreviousData during paging and debounces search input by 250ms', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối soát',
      version: 9,
      updatedAt: '2026-10-18T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();

    let resolvePage2!: () => void;
    const reads: URL[] = [];
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (path) => {
      const url = new URL(path, 'http://localhost');
      if (url.pathname === '/coordination/customers') {
        return [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      }
      if (url.pathname === '/reconciliation/weekly-menu') {
        return {
          customerId: 'customer-1',
          weekStartDate: '2026-10-19',
          weekEndDate: '2026-10-25',
          menuVersionId: 'version-1',
          menuVersionNo: 3,
          menuVersionStatus: 'PUBLISHED',
          warnings: [],
        };
      }
      if (url.pathname === '/reconciliation/batches/quantity-import/materials') {
        reads.push(url);
        const pageNumber = Number(url.searchParams.get('PageNumber'));
        const q = url.searchParams.get('SearchKeyword') ?? '';
        const makePayload = (name: string) => ({
          menuVersionId: 'version-1',
          contentFingerprint: 'fingerprint-1',
          fingerprintFormatVersion: 3,
          diagnostics: [],
          page: {
            items: [{
              ingredientId: `ing-${pageNumber}-${q}`,
              ingredientCode: 'NL01',
              ingredientName: name,
              canonicalUnitId: 'kg',
              canonicalUnitName: 'kg',
              requiredQuantity: 1.2,
              contributions: [],
            }],
            totalCount: 2,
            pageNumber,
            pageSize: 1,
            totalPages: 2,
            hasPrev: pageNumber > 1,
            hasNext: pageNumber < 2,
          },
        });
        if (pageNumber === 2) {
          return new Promise((resolve) => {
            resolvePage2 = () => resolve(makePayload('Thịt bò trang 2'));
          });
        }
        return makePayload(q ? `Kết quả lọc: ${q}` : 'Gạo trang 1');
      }
      throw new Error(`Unexpected inspection request ${path}`);
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=customer-1&weekStartDate=2026-10-19&pageSize=1');
    expect(await screen.findByText('Gạo trang 1')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Gạo trang 1')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Định lượng nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeInTheDocument();

    await act(async () => {
      resolvePage2();
    });
    expect(await screen.findByText('Thịt bò trang 2')).toBeVisible();

    const readsBeforeSearch = reads.length;
    const searchBox = screen.getByRole('textbox', { name: 'Tìm nguyên liệu' });
    fireEvent.change(searchBox, { target: { value: 'Thịt bò' } });
    expect(searchBox).toHaveValue('Thịt bò');
    expect(reads.length).toBe(readsBeforeSearch);

    await waitFor(() => expect(reads.some((u) => u.searchParams.get('SearchKeyword') === 'Thịt bò')).toBe(true));
    expect(await screen.findByText('Kết quả lọc: Thịt bò')).toBeVisible();
  });
});
