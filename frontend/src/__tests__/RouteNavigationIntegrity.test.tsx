import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from '../store/authContext';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { AppShell } from '../components/workbench/AppShell';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { resolveEligibleNavigation } from '../routes/navigationEligibility';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { systemApi } from '../api/systemApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { mrxApi } from '../api/mrxApi';

function renderAppWithRoute(initialUrl: string, mode: 'DEFAULT' | 'MATERIAL_RECONCILIATION' = 'MATERIAL_RECONCILIATION') {
  localStorage.setItem('ipc_v3_mode', mode);
  localStorage.setItem(
    'ipc_v3_user',
    JSON.stringify({
      userId: 'u-admin',
      username: 'admin',
      fullName: 'Admin User',
      roleCode: 'ADMIN',
      roleName: 'Quản trị viên',
      isActive: true,
      isAdminFullAccess: true,
      permissions: ['*'],
    })
  );

  const eligible = resolveEligibleNavigation(
    CANONICAL_ROUTES,
    { roleCode: 'ADMIN', isAdminFullAccess: true, permissions: ['*'] },
    mode
  );

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialUrl]}>
        <DirtyNavigationProvider>
          <AppShell navigation={eligible} homePath={mode === 'MATERIAL_RECONCILIATION' ? '/weekly-menu?view=mrx-batch' : '/'}>
            <Routes>
              <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
              <Route path="/warehouse" element={<WarehousePage />} />
              <Route path="/chef" element={<ChefDashboardPage />} />
              <Route path="/reconciliation" element={<div data-testid="recon-page">Đối soát Page</div>} />
            </Routes>
          </AppShell>
        </DirtyNavigationProvider>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Route Navigation Integrity & Subview Synchronization (DOM-MODE-1 & Rule N6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'c-dav', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'c-dav',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      menuVersionId: 'mv-1',
      menuVersionNo: 1,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
  });

  // Kịch bản 1: Sửa triệt để lỗi Screenshot — Khi ở mode MRX, truy cập /weekly-menu tự động chuyển sang ?view=mrx-batch
  it('Kịch bản 1: Automatically normalizes naked /weekly-menu to ?view=mrx-batch in MRX mode and never renders Default page', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });

    renderAppWithRoute('/weekly-menu', 'MATERIAL_RECONCILIATION');

    // MUST render MRX Batch Header
    expect(await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeInTheDocument();
    // MUST NOT render Default mode header
    expect(screen.queryByRole('heading', { name: 'Thực đơn & KHSX tuần' })).not.toBeInTheDocument();
  });

  // Kịch bản 2: Khi URL có query params phụ, leaf trên Sidebar vẫn giữ nguyên màu Active
  it('Kịch bản 2: Keeps child leaf Active (bg-slate-900) even when operational query parameters exist in URL', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });

    renderAppWithRoute('/weekly-menu?view=mrx-batch&customerId=DAV&weekStartDate=2026-10-19', 'MATERIAL_RECONCILIATION');

    await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' });

    // Find the link in the sidebar
    const leafLink = screen.getByRole('link', { name: 'Chuẩn bị lô đối soát' });
    expect(leafLink).toBeInTheDocument();
    expect(leafLink.className).toContain('bg-slate-900');
    expect(leafLink.className).toContain('text-white');
  });

  // Kịch bản 3: Chế độ DEFAULT hoạt động bình thường
  it('Kịch bản 3: In DEFAULT mode, renders DefaultWeeklyMenuPage without forcing mrx-batch redirect', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      customerId: 'c-dav',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19',
      mealTargetPrice: 25000,
      matrixRows: [],
      scheduleDays: [],
      demandRows: [],
      productionPlans: [],
      dishCosts: [],
      dailyMaterials: [],
    });

    renderAppWithRoute('/weekly-menu', 'DEFAULT');

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Chuẩn bị lô đối soát' })).not.toBeInTheDocument();
  });

  // Kịch bản 4: Chuẩn hóa /warehouse trong chế độ MRX
  it('Kịch bản 4: In MRX mode, naked /warehouse automatically redirects to ?view=mrx-daily', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'b-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 1,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    renderAppWithRoute('/warehouse', 'MATERIAL_RECONCILIATION');

    expect(await screen.findByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeInTheDocument();

    const dailyLeaf = screen.getByRole('link', { name: /Xuất kho định lượng ngày|Định lượng xuất theo ngày/ });
    expect(dailyLeaf.className).toContain('bg-slate-900');
  });

  // Kịch bản 5: Chuẩn hóa /chef trong chế độ MRX
  it('Kịch bản 5: In MRX mode, naked /chef automatically redirects to ?view=mrx-cooking', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({
      batchId: 'b-1',
      sourceVersion: 1,
      rows: [],
    });

    renderAppWithRoute('/chef', 'MATERIAL_RECONCILIATION');

    expect(await screen.findByRole('heading', { name: 'Phiếu nấu theo lô' })).toBeInTheDocument();

    const cookingLeaf = screen.getByRole('link', { name: /Phiếu nấu theo lô/ });
    expect(cookingLeaf.className).toContain('bg-slate-900');
  });

  // Kịch bản 6: Chuẩn hóa Active Subviews tại /reconciliation
  it('Kịch bản 6: Correctly synchronizes active state for reconciliation leaves with or without view query', () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });

    const { unmount } = renderAppWithRoute('/reconciliation', 'MATERIAL_RECONCILIATION');

    // Default leaf 'Rà soát dòng ngày' must be active when at /reconciliation
    const linesLeaf = screen.getByRole('link', { name: 'Rà soát dòng ngày' });
    expect(linesLeaf.className).toContain('bg-slate-900');

    unmount();

    // Switch to variances tab: 'Sổ theo dõi chênh lệch' must become active
    renderAppWithRoute('/reconciliation?view=variances&batchId=b-99', 'MATERIAL_RECONCILIATION');
    const varianceLeaf = screen.getByRole('link', { name: 'Sổ theo dõi chênh lệch' });
    expect(varianceLeaf.className).toContain('bg-slate-900');
    expect(screen.getByRole('link', { name: 'Rà soát dòng ngày' }).className).not.toContain('bg-slate-900');
  });
});
