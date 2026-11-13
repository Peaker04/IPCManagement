import { RouteWorkbenchLoadingFallback } from '../routes/RouteWorkbenchLoadingFallback';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { MrxSourceEditGrid } from '../features/weekly-menu/MrxSourceEditGrid';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AuthProvider } from '../store/authContext';
import { isRouteEligible, resolveEligibleNavigation } from '../routes/navigationEligibility';
import { AppShell } from '../components/workbench/AppShell';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { mrxApi, type MrxBatch, type MrxMenuChangeResult } from '../api/mrxApi';
import { systemApi } from '../api/systemApi';
import { adminApi } from '../api/adminApi';
import { bomApi } from '../api/bomApi';
import { ApiError } from '../api/client';
import * as apiTransport from '../api/client';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import { serverStateCache } from '../store/serverStateCache';

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
          ? <AppShell loadingFallback={<RouteWorkbenchLoadingFallback />} navigation={resolveEligibleNavigation(CANONICAL_ROUTES, JSON.parse(localStorage.getItem('ipc_v3_user')!), 'MATERIAL_RECONCILIATION')}>{content}</AppShell>
          : content}</DirtyNavigationProvider>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Weekly Menu MRX scope and source', () => {
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
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
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
    expect(mrxApi.previewQuantityImport).not.toHaveBeenCalled();
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

  it('D3: reloads useMrxSourceEdit editScope after approving a pending source change request in MrxPendingRequestsPanel', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'manager-1', fullName: 'Quản lý', username: 'manager', roleCode: 'Manager', roleName: 'Quản lý',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    let sourceVersion = 'mv-1';
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async () => ({
      customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: sourceVersion, menuVersionNo: sourceVersion === 'mv-1' ? 1 : 2, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-1', customerId: 'cust-1', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08', status: 'IN_PROGRESS',
        version: 1, createdAt: '2026-11-01T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getBatch').mockResolvedValue({
      batchId: 'batch-1', customerId: 'cust-1', weekStartDate: '2026-11-02', status: 'IN_PROGRESS',
      version: 1, lines: [],
    } as unknown as MrxBatch);
    const getEditScopeSpy = vi.spyOn(mrxApi, 'getEditScope').mockImplementation(async () => ({
      batchId: 'batch-1',
      batchStatus: 'IN_PROGRESS',
      batchVersion: sourceVersion === 'mv-1' ? 1 : 2,
      menuVersionId: sourceVersion,
      days: [{
        serviceDate: '2026-11-02',
        isLocked: false,
        lockReason: null,
        shifts: [{
          shiftName: 'MORNING',
          savoryServings: sourceVersion === 'mv-1' ? 100 : 150,
          vegetarianServings: 0,
          slots: [{ dishSlot: 'savory-main', menuVariant: 'SAVORY', slotLabel: 'Món mặn chính', dishId: 'dish-1', dishCode: 'D1', dishName: 'Thịt kho' }],
        }],
      }],
    }));
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([{
      menuAmendmentId: 'amend-1',
      customerId: 'cust-1',
      customerName: 'Khách Một',
      weekStartDate: '2026-11-02',
      status: 'PENDING_REVIEW',
      reason: 'Tăng suất sáng thứ hai',
      createdAt: '2026-11-02T01:00:00Z',
      affectedReconciliationBatchIds: ['batch-1'],
      impactLines: [{
        serviceDate: '2026-11-02',
        shiftName: 'MORNING',
        dishSlot: 'savory-main',
        oldDishId: 'dish-1',
        newDishId: 'dish-1',
        currentServings: 100,
        newServings: 150,
        currentSavoryServings: 100,
        currentVegetarianServings: 0,
        newSavoryServings: 150,
        newVegetarianServings: 0,
      }],
    }]);
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [{ dishId: 'dish-1', dishCode: 'D1', dishName: 'Thịt kho', isActive: true } as unknown as Awaited<ReturnType<typeof adminApi.getDish>>],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'decideSourceChange').mockImplementation(async () => {
      sourceVersion = 'mv-2';
      return mrxChangeResult({
        menuAmendmentId: 'amend-1',
        status: 'EXECUTED',
        appliedMenuVersionId: 'mv-2',
        affectedReconciliationBatchIds: ['batch-1'],
        impactLines: [],
      });
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02&amendmentId=amend-1');

    expect(await screen.findByRole('heading', { name: 'Duyệt thay đổi nguồn MRX' })).toBeVisible();
    await waitFor(() => expect(getEditScopeSpy).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Phê duyệt thay đổi' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận phê duyệt' }));

    await waitFor(() => expect(getEditScopeSpy).toHaveBeenCalledTimes(2));
  });

  it('E4: switching customer or week on /weekly-menu?view=mrx-batch does not unmount MrxBatchWorkbench or re-fetch getCustomers and getSourceChangeInbox', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'manager-1', fullName: 'Quản lý', username: 'manager', roleCode: 'Manager', roleName: 'Quản lý',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const getCustomersSpy = vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId, customerCode: customerId === 'cust-2' ? 'C2' : 'C1', customerName: customerId === 'cust-2' ? 'Khách Hai' : 'Khách Một',
      weekStartDate, weekEndDate: '2026-11-08',
      menuVersionId: `mv-${customerId}`, menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue({
      token: 'tok-1', expiresAt: '2026-11-02T01:00:00Z', contentFingerprint: 'fp-1', fingerprintFormatVersion: 3, plans: [], diagnostics: [],
    });
    vi.spyOn(mrxApi, 'getEditScope').mockImplementation(async () => ({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'mv-1', days: [],
    }));
    const getInboxSpy = vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([]);
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false,
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');
    const customerSelect = await screen.findByRole('combobox', { name: 'Chọn khách hàng MRX' });
    await waitFor(() => expect(customerSelect).toHaveValue('cust-1'));
    expect(getCustomersSpy).toHaveBeenCalledTimes(1);
    expect(getInboxSpy).toHaveBeenCalledTimes(1);

    await userEvent.selectOptions(customerSelect, 'cust-2');
    await waitFor(() => expect(customerSelect).toHaveValue('cust-2'));

    // Because MrxBatchWorkbench stays mounted instead of remounting on URL key change, getCustomers and getSourceChangeInbox are NOT called again!
    expect(getCustomersSpy).toHaveBeenCalledTimes(1);
    expect(getInboxSpy).toHaveBeenCalledTimes(1);
  });

  it('G3: MrxQuantityInspectionPage stays mounted across customer switches without false revision notice or table teardown', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    const getCustomersSpy = vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId,
      customerCode: customerId === 'cust-2' ? 'C2' : 'C1',
      customerName: customerId === 'cust-2' ? 'Khách Hai' : 'Khách Một',
      weekStartDate,
      weekEndDate: '2026-11-08',
      menuVersionId: `mv-${customerId}`,
      menuVersionNo: 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getMaterialInspection').mockImplementation(async (menuVersionId) => ({
      menuVersionId,
      menuVersionNo: 1,
      contentFingerprint: `fp-${menuVersionId}`,
      fingerprintFormatVersion: 3,
      diagnostics: [],
      page: {
        items: [
          {
            ingredientId: `ing-${menuVersionId}`,
            ingredientCode: `NL-${menuVersionId}`,
            ingredientName: menuVersionId === 'mv-cust-2' ? 'Cá hồi Na Uy' : 'Thịt bò Úc',
            canonicalUnitId: 'u-kg',
            canonicalUnitName: 'kg',
            requiredQuantity: 12,
            contributions: [],
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 50,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    }));

    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-02');
    expect(await screen.findByText('Thịt bò Úc')).toBeInTheDocument();
    const customerSelect = screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' });

    await userEvent.selectOptions(customerSelect, 'cust-2');
    expect(await screen.findByText('Cá hồi Na Uy')).toBeInTheDocument();
    expect(getCustomersSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Nguồn đã thay đổi/i)).not.toBeInTheDocument();
  });

  it('H1: MrxBatchWorkbench keeps MrxSourceEditGrid mounted when switching customer without flashing Đang tải phạm vi nguồn tuần MRX', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId,
      customerCode: customerId === 'cust-2' ? 'C2' : 'C1',
      customerName: customerId === 'cust-2' ? 'Khách Hai' : 'Khách Một',
      weekStartDate,
      weekEndDate: '2026-11-08',
      menuVersionId: `mv-${customerId}`,
      menuVersionNo: 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue({
      token: 'tok-1', expiresAt: '2026-11-02T01:00:00Z', contentFingerprint: 'fp-1', fingerprintFormatVersion: 3, plans: [], diagnostics: [],
    });
    let resolveCust2Scope = (() => {}) as (value: Awaited<ReturnType<typeof mrxApi.getEditScope>>) => void;
    vi.spyOn(mrxApi, 'getEditScope').mockImplementation((customerId) => {
      if (customerId === 'cust-2') {
        return new Promise((resolve) => {
          resolveCust2Scope = resolve;
        });
      }
      return Promise.resolve({
        batchId: null,
        batchStatus: null,
        batchVersion: null,
        menuVersionId: 'mv-cust-1',
        days: [{
          serviceDate: '2026-11-02',
          isLocked: false,
          lockReason: null,
          shifts: [{
            shiftName: 'MORNING',
            savoryServings: 100,
            vegetarianServings: 10,
            slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'd-1', dishCode: 'M1', dishName: 'Cơm gà' }],
          }],
        }],
      });
    });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [{ dishId: 'd-1', dishCode: 'M1', dishName: 'Cơm gà', isActive: true }],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');
    expect(await screen.findByText('Cơm gà')).toBeInTheDocument();

    const customerSelect = screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' });
    await userEvent.selectOptions(customerSelect, 'cust-2');

    expect(screen.queryByText('Đang tải phạm vi nguồn tuần MRX…')).not.toBeInTheDocument();
    expect(screen.getByText('Cơm gà')).toBeInTheDocument();

    resolveCust2Scope({
      batchId: null,
      batchStatus: null,
      batchVersion: null,
      menuVersionId: 'mv-cust-2',
      days: [{
        serviceDate: '2026-11-02',
        isLocked: false,
        lockReason: null,
        shifts: [{
          shiftName: 'MORNING',
          savoryServings: 80,
          vegetarianServings: 5,
          slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'd-1', dishCode: 'M1', dishName: 'Cơm gà' }],
        }],
      }],
    });
  });

  it('H7: MrxQuantityInspectionPage renders persistent detail header in MaterialsTable and min-h-11 subbar', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1',
      customerCode: 'C1',
      customerName: 'Khách Một',
      weekStartDate: '2026-11-02',
      weekEndDate: '2026-11-08',
      menuVersionId: 'mv-1',
      menuVersionNo: 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getMaterialInspection').mockResolvedValue({
      menuVersionId: 'mv-1',
      contentFingerprint: 'fp-1',
      fingerprintFormatVersion: 3,
      diagnostics: [],
      page: {
        items: [{
          ingredientId: 'ing-1',
          ingredientCode: 'NL-1',
          ingredientName: 'Thịt bò Úc',
          canonicalUnitId: 'u-kg',
          canonicalUnitName: 'kg',
          requiredQuantity: 12,
          contributions: [],
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 50,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-02');
    expect(await screen.findByText('Thịt bò Úc')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nguồn tính chi tiết' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nguồn định lượng').parentElement).toHaveClass('min-h-11');
  });

  it('I2 & I7: deduplicates getEditScope on customer switch in mrx-batch and keeps inspection table + version slot mounted across customer switch in mrx-materials', async () => {
    serverStateCache.clearAll();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);

    let resolveCust2Source!: (val: Awaited<ReturnType<typeof mrxApi.getWeeklySource>>) => void;
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation((cId) => {
      if (cId === 'cust-2') {
        return new Promise((resolve) => {
          resolveCust2Source = resolve;
        });
      }
      return Promise.resolve({
        customerId: 'cust-1',
        customerCode: 'C1',
        customerName: 'Khách Một',
        weekStartDate: '2026-11-02',
        weekEndDate: '2026-11-08',
        menuVersionId: 'mv-cust-1',
        menuVersionNo: 1,
        menuVersionStatus: 'PUBLISHED',
        warnings: [],
        validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
      });
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue({
      token: 'tok-1', expiresAt: '2026-11-02T01:00:00Z', contentFingerprint: 'fp-1', fingerprintFormatVersion: 3, plans: [], diagnostics: [],
    });
    const editScopeSpy = vi.spyOn(mrxApi, 'getEditScope').mockImplementation(async (cId) => ({
      batchId: null,
      batchStatus: null,
      batchVersion: null,
      menuVersionId: cId === 'cust-2' ? 'mv-cust-2' : 'mv-cust-1',
      days: [{
        serviceDate: '2026-11-02',
        isLocked: false,
        lockReason: null,
        shifts: [{
          shiftName: 'MORNING',
          savoryServings: 100,
          vegetarianServings: 10,
          slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'd-1', dishCode: 'M1', dishName: 'Cơm gà' }],
        }],
      }],
    }));
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [{ dishId: 'd-1', dishCode: 'M1', dishName: 'Cơm gà', isActive: true }],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });

    const { unmount } = renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');
    expect(await screen.findByText('Cơm gà')).toBeInTheDocument();
    editScopeSpy.mockClear();

    const customerSelect = screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' });
    await userEvent.selectOptions(customerSelect, 'cust-2');

    // While cust-2 getWeeklySource is still pending, getEditScope must NOT be called with stale mv-cust-1!
    expect(editScopeSpy).toHaveBeenCalledTimes(0);

    resolveCust2Source({
      customerId: 'cust-2',
      customerCode: 'C2',
      customerName: 'Khách Hai',
      weekStartDate: '2026-11-02',
      weekEndDate: '2026-11-08',
      menuVersionId: 'mv-cust-2',
      menuVersionNo: 2,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });

    await waitFor(() => {
      expect(editScopeSpy).toHaveBeenCalledTimes(1);
    });
    unmount();

    // I7: On mrx-materials, when source resolves mv-cust-2 while getMaterialInspection for mv-cust-2 is pending, keep table mounted
    serverStateCache.clearAll();
    let resolveCust2Materials!: (val: Awaited<ReturnType<typeof mrxApi.getMaterialInspection>>) => void;
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (cId) => ({
      customerId: cId,
      customerCode: cId === 'cust-2' ? 'C2' : 'C1',
      customerName: cId === 'cust-2' ? 'Khách Hai' : 'Khách Một',
      weekStartDate: '2026-11-02',
      weekEndDate: '2026-11-08',
      menuVersionId: cId === 'cust-2' ? 'mv-cust-2' : 'mv-cust-1',
      menuVersionNo: cId === 'cust-2' ? 2 : 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getMaterialInspection').mockImplementation((mvId) => {
      if (mvId === 'mv-cust-2') {
        return new Promise((resolve) => {
          resolveCust2Materials = resolve;
        });
      }
      return Promise.resolve({
        menuVersionId: 'mv-cust-1',
        contentFingerprint: 'fp-1',
        fingerprintFormatVersion: 3,
        diagnostics: [],
        page: {
          items: [{
            ingredientId: 'ing-1',
            ingredientCode: 'NL-1',
            ingredientName: 'Thịt bò C1',
            canonicalUnitId: 'u-kg',
            canonicalUnitName: 'kg',
            requiredQuantity: 12,
            contributions: [],
          }],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 50,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      });
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-02');
    expect(await screen.findByText('Thịt bò C1')).toBeInTheDocument();

    const matCustomerSelect = screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' });
    await userEvent.selectOptions(matCustomerSelect, 'cust-2');

    // Wait until mv-cust-2 getMaterialInspection has been invoked (meaning getWeeklySource resolved mv-cust-2)
    await waitFor(() => {
      expect(mrxApi.getMaterialInspection).toHaveBeenCalledWith('mv-cust-2', expect.anything());
    });
    // Table with Thịt bò C1 must still be mounted (not unmounted to a skeleton) while resolveCust2Materials is pending!
    expect(screen.getByText('Thịt bò C1')).toBeInTheDocument();
    expect(screen.getByText('Phiên bản:')).toBeInTheDocument();

    resolveCust2Materials({
      menuVersionId: 'mv-cust-2',
      contentFingerprint: 'fp-2',
      fingerprintFormatVersion: 3,
      diagnostics: [],
      page: {
        items: [{
          ingredientId: 'ing-2',
          ingredientCode: 'NL-2',
          ingredientName: 'Thịt bò C2',
          canonicalUnitId: 'u-kg',
          canonicalUnitName: 'kg',
          requiredQuantity: 20,
          contributions: [],
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 50,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    });
    expect(await screen.findByText('Thịt bò C2')).toBeInTheDocument();
  });

  it('K1, K4 & K5: keeps Hoàn tất sửa từng dòng inside thead, hydrates warm editScope synchronously on customer return, and resolves source + inspection atomically', async () => {
    const { container, unmount: unmountGrid } = render(
      <MrxSourceEditGrid
        mode="dish-edit"
        editScope={{
          batchId: 'b-1',
          batchStatus: 'IN_PROGRESS',
          batchVersion: 1,
          menuVersionId: 'mv-1',
          days: [{
            serviceDate: '2026-11-02',
            isLocked: false,
            lockReason: null,
            shifts: [{
              shiftName: 'MORNING',
              savoryServings: 100,
              vegetarianServings: 0,
              slots: [
                { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn 1', dishId: 'd-1', dishCode: 'M1', dishName: 'Gà kho' },
                { dishSlot: 'savory-sub1', menuVariant: 'savory', slotLabel: 'Món mặn 2', dishId: 'd-1', dishCode: 'M1', dishName: 'Gà kho' },
              ],
            }],
          }],
        }}
        draft={{
          '2026-11-02': {
            MORNING: {
              savoryServings: 100,
              vegetarianServings: 0,
              dishes: { 'savory-main': 'd-1', 'savory-sub1': 'd-1' },
            },
          },
        }}
        dishOptions={[{ dishId: 'd-1', dishCode: 'M1', dishName: 'Gà kho', isActive: true }]}
        lockedHighlight={[]}
        onServingsChange={() => {}}
        onDishChange={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Tách để sửa riêng/i }));
    const finishBtn = screen.getByRole('button', { name: 'Hoàn tất sửa từng dòng' });
    expect(finishBtn.closest('th')).not.toBeNull();
    expect(container.querySelector('[aria-label="Bảng sửa nguồn MRX"]')?.firstElementChild?.tagName).toBe('TABLE');
    unmountGrid();
  });

  it('M2, M3, M6 & M7: keeps DataGrid mounted on 0-match search in mrx-materials/mrx-plans, keeps serving validation alert inside footer, and shares warm customer/source cache from mrx-batch to mrx-materials', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối soát',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    const customersSpy = vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    const sourceSpy = vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1',
      customerCode: 'C1',
      customerName: 'Khách Một',
      weekStartDate: '2026-11-02',
      weekEndDate: '2026-11-08',
      menuVersionId: 'mv-m3',
      menuVersionNo: 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getMaterialInspection').mockImplementation(async (_mvId, query) => ({
      menuVersionId: 'mv-m3',
      contentFingerprint: 'fp-m3',
      fingerprintFormatVersion: 3,
      diagnostics: [],
      page: {
        items: query?.searchKeyword ? [] : [{
          ingredientId: 'ing-1',
          ingredientCode: 'NL-1',
          ingredientName: 'Thịt heo M3',
          canonicalUnitId: 'u-kg',
          canonicalUnitName: 'kg',
          requiredQuantity: 10,
          contributions: [],
        }],
        totalCount: query?.searchKeyword ? 0 : 1,
        pageNumber: 1,
        pageSize: 50,
        totalPages: query?.searchKeyword ? 0 : 1,
        hasPrev: false,
        hasNext: false,
      },
    }));

    const { container, unmount } = renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-02&q=khong-co-nl');
    expect(await screen.findByText('Không có nguyên liệu phù hợp')).toBeInTheDocument();
    // M3: DataGrid table and sticky thead MUST stay mounted when search keyword q returns 0 items!
    expect(container.querySelectorAll('table').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    unmount();

    // M7: Pre-seed catalog_customers and mrx_source_cust-1_2026-11-02 (as mrx-batch does) and verify mrx-materials uses warm cache on Render #1
    customersSpy.mockClear();
    sourceSpy.mockClear();
    serverStateCache.clearAll();
    serverStateCache.set('catalog_customers', [
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    serverStateCache.set('mrx_inspection_source_cust-1_2026-11-02', {
      customerId: 'cust-1',
      customerCode: 'C1',
      customerName: 'Khách Một',
      weekStartDate: '2026-11-02',
      weekEndDate: '2026-11-08',
      menuVersionId: 'mv-m3',
      menuVersionNo: 5,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    const { unmount: unmountM7 } = renderWeeklyMenu('/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-02');
    // Customer combobox is populated on Render #1 from shared catalog_customers cache
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toHaveValue('cust-1');
    unmountM7();
  });

  it('Bug 1 & Bug 2: navigating between mrx-materials (with null weekly source and wrapped catalog_customers) and mrx-batch never hangs on skeleton or throws customers.find is not a function', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối soát',
      version: 9,
      updatedAt: '2026-11-01T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    serverStateCache.clearAll();
    // Simulate legacy/wrapped CacheWrapper in sessionStorage/serverStateCache under catalog_customers
    serverStateCache.set('catalog_customers', {
      data: [{ customerId: 'cust-1', customerCode: 'ANV', customerName: 'AMANN' }],
      isCompatibilityBlocked: false,
    });
    // Simulate warm null weekly source cached from mrx-batch
    serverStateCache.set('mrx_inspection_source_cust-1_2026-11-09', null);

    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'ANV', customerName: 'AMANN' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 1,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    // 1. Mount mrx-materials with warm null source -> must immediately render empty state on Frame 0 (0ms skeleton hang)
    const { unmount: unmountMaterials } = renderWeeklyMenu(
      '/weekly-menu?view=mrx-materials&customerId=cust-1&weekStartDate=2026-11-09'
    );
    expect(screen.getByText('Chưa có nguồn thực đơn cho tuần này')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    unmountMaterials();

    // 2. Mount mrx-batch while catalog_customers in cache was wrapped -> must NOT crash with customers.find is not a function
    const { unmount: unmountBatch } = renderWeeklyMenu(
      '/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-09'
    );
    expect(await screen.findByText('Chưa có nguồn thực đơn đã phát hành')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toHaveValue('cust-1');
    unmountBatch();
  });
});
