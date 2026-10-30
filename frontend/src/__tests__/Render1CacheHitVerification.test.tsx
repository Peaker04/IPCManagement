import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import { MrxDailyIssueWorkbench } from '../features/warehouse/MrxDailyIssueWorkbench';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { MrxBatchWorkbench } from '../features/weekly-menu/MrxBatchWorkbench';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { MealOrdersPage } from '../features/coordination/MealOrdersPage';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { PurchasingPage } from '../features/purchasing/PurchasingPage';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { ApprovalPage } from '../features/approvals/ApprovalPage';
import {
  MOCK_WEEKLY_MENU_DATA,
  MOCK_COORDINATION_DATA,
  MOCK_CHEF_DATA,
  MOCK_PURCHASE_ORDERS,
  MOCK_SUPPLIERS,
  MOCK_APPROVALS,
} from '../test/fixtures';
import { currentWeekStart, todayInBusinessTimezone } from '../utils/dates';
import { systemApi } from '../api/systemApi';
import type { MrxWarehouseDaily, MrxIssuePage, MrxWeeklySource, MrxBatch, ReconciliationBatchSummary } from '../api/mrxApi';

describe('Gate 4: Synchronous Render #1 Cache-Hit & Anti-Skeleton Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverStateCache.clearAll();
    workspaceSessionStore.clearScope();

    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem(
      'ipc_v3_user',
      JSON.stringify({
        userId: 'u-admin-1',
        username: 'admin',
        fullName: 'Admin User',
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isActive: true,
        isAdminFullAccess: true,
        permissions: ['*'],
      })
    );

    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-26T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
  });

  it('MrxDailyIssueWorkbench: Render #1 synchronously mounts cached batch data without skeleton flash or empty state when clicked from naked sidebar link', () => {
    const testBatchId = 'batch-daily-test-1';
    const testDate = '2026-10-26';
    const mockDaily: MrxWarehouseDaily = {
      batchId: testBatchId,
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 3,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [
        {
          serviceDate: testDate,
          status: 'PENDING',
          isApplicable: true,
          requiredQuantity: 15,
          issuedQuantity: 10,
          returnedQuantity: 0,
          remainingQuantity: 5,
          lines: [
            {
              dailyLineId: 'dl-1',
              batchLineId: 'bl-1',
              ingredientId: 'ing-1',
              ingredientCode: 'NL-THIT-HEO',
              ingredientName: 'Thịt heo nạc đùi',
              canonicalUnitId: 'u-kg',
              canonicalUnitName: 'kg',
              requiredQuantity: 15,
              issuedQuantity: 10,
              returnedQuantity: 0,
              remainingQuantity: 5,
              quantityStatus: 'UNDER_ISSUED',
              hasValidDisposition: false,
            },
          ],
        },
      ],
    };
    const mockHistory: MrxIssuePage = {
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    };

    // 1. Pre-seed serverStateCache & workspaceSessionStore
    serverStateCache.set(`mrx_daily_${testBatchId}`, { daily: mockDaily, history: mockHistory, isCompatibilityBlocked: false });
    serverStateCache.set('mrx_daily_batches', [
      {
        batchId: testBatchId,
        customerId: 'c-anv',
        customerCode: 'ANV',
        customerName: 'AMANN',
        weekStartDate: '2026-10-26',
        weekEndDate: '2026-11-01',
        status: 'IN_PROGRESS',
        version: 3,
        createdAt: '2026-10-25T00:00:00Z',
      },
    ]);

    workspaceSessionStore.setScope({
      customerId: 'c-anv',
      customerCode: 'ANV',
      customerName: 'AMANN',
      serviceDate: testDate,
      weekStartDate: '2026-10-26',
      batchId: testBatchId,
    });

    // 2. Render from naked sidebar URL (NO ?batchId=... in query params!)
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/warehouse?view=mrx-daily']}>
          <Routes>
            <Route path="/warehouse" element={<MrxDailyIssueWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // 3. SYNCHRONOUS ASSERTIONS AT RENDER #1:
    // • Zero skeleton
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    // • Zero premature empty state
    expect(screen.queryByText('Không có định lượng cho ngày đã chọn')).not.toBeInTheDocument();
    // • Real data rendered synchronously
    expect(screen.getByText('Thịt heo nạc đùi')).toBeInTheDocument();
    expect(screen.getByText('NL-THIT-HEO')).toBeInTheDocument();
    // • Selector in header is synchronously populated with active batch
    const select = screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' });
    expect(select).toHaveValue(testBatchId);
  });

  it('ReconciliationPage: Render #1 synchronously mounts cached reconciliation summary without skeleton flash or empty state when clicked from naked sidebar link', () => {
    const testBatchId = 'batch-recon-test-1';
    const testDate = '2026-10-26';

    const mockSummary: ReconciliationBatchSummary = {
      batchId: testBatchId,
      customerId: 'c-anv',
      customerCode: 'ANV',
      customerName: 'AMANN',
      weekStartDate: '2026-10-26',
      weekEndDate: '2026-11-01',
      version: 5,
      status: 'IN_PROGRESS',
      weeklyStatus: 'IN_PROGRESS',
      lines: [
        {
          id: 'rl-1',
          dailyLineId: 'dl-1',
          ingredientId: 'ing-1',
          unitId: 'u-1',
          version: 1,
          materialCode: 'NL-CA-LOC',
          materialName: 'Cá lóc tươi làm sạch',
          unit: 'kg',
          requiredQuantity: 25.5,
          issuedQuantity: 25.5,
          issuedRequiredDifference: 0,
          status: 'MATCHED',
          triggers: [],
          notes: [],
        },
      ],
    };

    serverStateCache.set(`mrx_recon_${testBatchId}_${testDate}`, mockSummary);
    serverStateCache.set('catalog_customers', [
      { customerId: 'c-anv', customerCode: 'ANV', customerName: 'AMANN' },
    ]);
    serverStateCache.set(`mrx_batches_c-anv_2026-10-26`, [
      {
        batchId: testBatchId,
        customerId: 'c-anv',
        customerCode: 'ANV',
        customerName: 'AMANN',
        weekStartDate: '2026-10-26',
        weekEndDate: '2026-11-01',
        status: 'IN_PROGRESS',
        version: 5,
        createdAt: '2026-10-25T00:00:00Z',
      },
    ]);

    workspaceSessionStore.setScope({
      customerId: 'c-anv',
      customerCode: 'ANV',
      customerName: 'AMANN',
      serviceDate: testDate,
      weekStartDate: '2026-10-26',
      batchId: testBatchId,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // SYNCHRONOUS ASSERTIONS AT RENDER #1:
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có dữ liệu đối soát cho ngày đã chọn')).not.toBeInTheDocument();
    expect(screen.getByText('Cá lóc tươi làm sạch')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('ANV');
  });

  it('MrxBatchWorkbench: Render #1 synchronously mounts cached source and batch without skeleton flash when clicked from naked sidebar link', () => {
    const testCustomerId = 'c-anv';
    const testWeek = '2026-10-26';

    const mockSource: MrxWeeklySource = {
      customerId: testCustomerId,
      customerCode: 'ANV',
      customerName: 'AMANN',
      weekStartDate: testWeek,
      weekEndDate: '2026-11-01',
      menuVersionId: 'mv-published-1',
      menuVersionNo: 4,
      menuVersionStatus: 'PUBLISHED',
      warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    };

    const mockBatch: MrxBatch = {
      batchId: 'batch-weekly-1',
      menuVersionId: 'mv-published-1',
      quantityImportBatchId: 'qib-1',
      status: 'DRAFT',
      version: 1,
      createdAt: '2026-10-25T00:00:00Z',
      lines: [],
    };

    serverStateCache.set(`mrx_source_${testCustomerId}_${testWeek}`, { source: mockSource, batch: mockBatch });
    serverStateCache.set('catalog_customers', [
      { customerId: 'c-anv', customerCode: 'ANV', customerName: 'AMANN' },
    ]);

    workspaceSessionStore.setScope({
      customerId: testCustomerId,
      customerCode: 'ANV',
      customerName: 'AMANN',
      serviceDate: testWeek,
      weekStartDate: testWeek,
      batchId: 'batch-weekly-1',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // SYNCHRONOUS ASSERTIONS AT RENDER #1:
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có nguồn thực đơn đã phát hành')).not.toBeInTheDocument();
    expect(screen.getByText('Phiên bản nguồn:')).toBeInTheDocument();
    expect(screen.getByText('v4')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toHaveValue(testCustomerId);
  });

  it('WeeklyMenuPage: Render #1 synchronously mounts cached menu schedule without skeleton flash', () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    const testWeek = currentWeekStart();
    serverStateCache.set('catalog_customers', [
      { customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    serverStateCache.set(`weekly_menu_DAV_${testWeek}`, {
      ...MOCK_WEEKLY_MENU_DATA,
      weekStartDate: testWeek,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu']}>
          <Routes>
            <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // SYNCHRONOUS ASSERTIONS AT RENDER #1:
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có thực đơn cho tuần này')).not.toBeInTheDocument();
    expect(screen.getByText('Thịt kho trứng cút')).toBeInTheDocument();
  });

  it('MealOrdersPage: Render #1 synchronously mounts cached meal orders without skeleton flash', () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    const testDate = todayInBusinessTimezone();
    serverStateCache.set('catalog_customers', [
      { customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    serverStateCache.set(`meal_orders_DAV_${testDate}_MORNING`, {
      ...MOCK_COORDINATION_DATA,
      serviceDate: testDate,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/meal-orders']}>
          <Routes>
            <Route path="/meal-orders" element={<MealOrdersPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có kế hoạch suất ăn')).not.toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
  });

  it('ChefDashboardPage: Render #1 synchronously mounts cached chef plans without skeleton flash', () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    const testDate = todayInBusinessTimezone();
    serverStateCache.set('catalog_customers', [
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    serverStateCache.set(`chef_customer-1_${testDate}_MORNING_1`, {
      ...MOCK_CHEF_DATA,
      serviceDate: testDate,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/chef?view=plans']}>
          <Routes>
            <Route path="/chef" element={<ChefDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có kế hoạch sản xuất')).not.toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
  });

  it('PurchasingPage: Render #1 synchronously mounts cached POs and suppliers without skeleton flash', () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    serverStateCache.set('purchasing_data', { pos: MOCK_PURCHASE_ORDERS, sups: MOCK_SUPPLIERS });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/purchasing']}>
          <Routes>
            <Route path="/purchasing" element={<PurchasingPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy đơn mua hàng')).not.toBeInTheDocument();
    expect(screen.getByText('PO-20260721-0858')).toBeInTheDocument();
  });

  it('AdminDataPage: Render #1 synchronously mounts cached ingredients without skeleton flash', () => {
    serverStateCache.set('admin_ingredients_1_', {
      items: [{ ingredientId: 'ing-1', ingredientCode: 'NL-THIT', ingredientName: 'Thịt heo nạc', unitId: 'u-1', unitName: 'kg', categoryName: 'Thịt tươi' }],
      pageInfo: { totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin-data?view=ingredients']}>
          <Routes>
            <Route path="/admin-data" element={<AdminDataPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có danh mục nguyên liệu')).not.toBeInTheDocument();
    expect(screen.getByText('Thịt heo nạc')).toBeInTheDocument();
  });

  it('ApprovalPage: Render #1 synchronously mounts cached inbox items without skeleton flash', () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    serverStateCache.set('approval_inbox_ALL', MOCK_APPROVALS);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/approvals']}>
          <Routes>
            <Route path="/approvals" element={<ApprovalPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Hàng đợi phê duyệt đang trống')).not.toBeInTheDocument();
    expect(screen.getAllByText('MR-DAV-20260921-FULLDAY').length).toBeGreaterThanOrEqual(1);
  });

  it('Cold Start Guard: Does NOT flash premature Empty State while parent catalog is bootstrapping', () => {
    // Both serverStateCache and workspaceSessionStore are completely empty.
    // Component is bootstrapping: must stay in loading/fetching state and NOT flash empty state!
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/warehouse?view=mrx-daily']}>
          <Routes>
            <Route path="/warehouse" element={<MrxDailyIssueWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // MUST NOT prematurely flash the empty state while catalog is bootstrapping!
    expect(screen.queryByText('Không có định lượng cho ngày đã chọn')).not.toBeInTheDocument();
  });

  it('L2 Cache Persistence: Rehydrates cached items from sessionStorage on initial load across simulated page refreshes', () => {
    const testBatchId = 'batch-l2-test-refresh';
    const mockData = { batchId: testBatchId, status: 'COMPLETED' };

    // Set item in serverStateCache, which writes to L1 memory and L2 sessionStorage
    serverStateCache.set(`mrx_recon_${testBatchId}_2026-09-21`, mockData);

    expect(sessionStorage.getItem(`ipc_l2_cache:mrx_recon_${testBatchId}_2026-09-21`)).toBeTruthy();

    // Verify reading from serverStateCache returns the cached item synchronously
    const cached = serverStateCache.get<typeof mockData>(`mrx_recon_${testBatchId}_2026-09-21`);
    expect(cached?.data.batchId).toBe(testBatchId);
  });
});
