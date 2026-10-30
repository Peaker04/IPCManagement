import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from '../store/authContext';
import { MrxBatchWorkbench } from '../features/weekly-menu/MrxBatchWorkbench';
import { ReconciliationReportTables } from '../features/reconciliation/ReconciliationReportTables';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { clearAllServerCache } from '../store/serverStateCache';
import { mrxApi } from '../api/mrxApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';

describe('Full MRX Modernization & Anti-Slop Suite (Zero-Skeleton, Truthful Stepper, Actionable Empty Canvas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAllServerCache();

    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem(
      'ipc_v3_user',
      JSON.stringify({
        userId: 'u-coordinator',
        username: 'coord',
        fullName: 'Điều phối viên',
        roleCode: 'COORDINATOR',
        roleName: 'Điều phối',
        isActive: true,
        isAdminFullAccess: false,
        permissions: ['*'],
      })
    );

    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-25T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });

    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'c-anv', customerCode: 'ANV', customerName: 'AMANN' },
      { customerId: 'c-dav', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);

    vi.spyOn(mrxApi, 'getDraftSources').mockResolvedValue([
      {
        menuVersionId: 'mv-w42',
        menuLabel: 'Thực đơn tuần 42 (19/10/2026)',
        importBatchLabel: 'Lô nhập 01',
        quantityImportBatchId: 'qib-1',
      },
    ]);
  });

  // 1. Kiểm tra SWR Cache: Lần 1 tải về, Lần 2 (khi quay lại từ trang khác) nạp 0ms từ RAM, không chớp Skeleton
  it('Task 1: SWR memory cache serves data in 0ms on revisit without re-rendering skeleton', async () => {
    let apiCalls = 0;
    vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async () => {
      apiCalls++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        customerId: 'c-dav',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        menuVersionId: 'mv-w42',
        menuVersionNo: 3,
        menuVersionStatus: 'PUBLISHED',
        warnings: [],
        validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
      };
    });

    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 1,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    // First visit: loads from network
    const { unmount } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch&customerId=c-dav&weekStartDate=2026-10-19']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Phiên bản nguồn:')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(apiCalls).toBe(1);

    // Unmount (user navigates away to another route)
    unmount();

    // Revisit same route: Cache hit -> 0ms instant display, no initial skeleton!
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch&customerId=c-dav&weekStartDate=2026-10-19']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Instant cache hit: already rendered immediately in DOM!
    expect(screen.getByText('Phiên bản nguồn:')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
  });

  // 2. Tiêu diệt AI Slop: Khi chưa có menu, Nút Primary là "Nhập thực đơn Excel", KHÔNG CÓ dead-click "Kiểm tra định lượng"
  it('Task 2: Sets "Nhập thực đơn Excel" as Primary CTA when menu is absent, eliminating dead clicks', async () => {
    vi.spyOn(mrxApi, 'getWeeklySource').mockRejectedValue({
      status: 404,
      message: 'Not found',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch&customerId=c-anv&weekStartDate=2026-10-26']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Must show empty state cleanly without red crash alert
    expect(await screen.findByText('Chưa có nguồn thực đơn đã phát hành')).toBeInTheDocument();

    // The primary action button (black bg-slate-900) MUST be "Nhập thực đơn Excel", NOT "Kiểm tra định lượng"
    const primaryBtn = screen.getByRole('button', { name: 'Nhập thực đơn Excel' });
    expect(primaryBtn).toBeInTheDocument();
    expect(primaryBtn.className).toContain('bg-slate-900');

    // "Kiểm tra định lượng" is NOT rendered as primary dead-click
    expect(screen.queryByRole('button', { name: 'Kiểm tra định lượng' })).not.toBeInTheDocument();
  });

  // 3. Khóa cứng quy tắc: Empty Canvas tinh gọn, XÓA BỎ hoàn toàn các khối ngày cũ gây nhiễu thông tin
  it('Task 3: Clean Empty Canvas does NOT render noisy historical weeks and shows clean CTA', async () => {
    vi.spyOn(mrxApi, 'getWeeklySource').mockRejectedValue({
      status: 404,
      message: 'Not found',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch&customerId=c-anv&weekStartDate=2026-10-26']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Empty state is rendered cleanly
    expect(await screen.findByText('Chưa có nguồn thực đơn đã phát hành')).toBeInTheDocument();

    // NO noisy historical draftSources box
    expect(screen.queryByText(/Các tuần thực đơn đã sẵn sàng để lập lô/)).not.toBeInTheDocument();
  });

  // 4. Stepper Vòng đời Thật: Khi chưa có lô, Stepper hiển thị "Chưa khởi tạo lô đối soát"
  it('Task 4: Renders truthful neutral state "Chưa khởi tạo lô đối soát" when no batch exists', async () => {
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(null as any);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/weekly-menu?view=mrx-batch']}>
          <Routes>
            <Route path="/weekly-menu" element={<MrxBatchWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Truthful lifecycle state
    expect(await screen.findByText('Chưa khởi tạo lô đối soát')).toBeInTheDocument();
  });

  // 5. Triệt tiêu vòng lặp tải vô tận: Khi chưa có batchId, ReconciliationReportTables lập tức hiển thị Empty State
  it('Task 5: Report tables with empty batchId display actionable empty state immediately without infinite loading loop', () => {
    const { rerender } = render(
      <ReconciliationReportTables
        activeTab="variances"
        batchId=""
        isReportLoading={false}
        variancesReport={null}
        transactionsReport={null}
        auditReport={null}
      />
    );

    expect(screen.getByText('Chưa chọn lô đối soát')).toBeInTheDocument();
    expect(screen.getByText(/sổ theo dõi chênh lệch/)).toBeInTheDocument();
    expect(screen.queryByText(/Đang tải số liệu báo cáo đối soát/)).not.toBeInTheDocument();

    // Transactions view
    rerender(
      <ReconciliationReportTables
        activeTab="transactions"
        batchId=""
        isReportLoading={false}
        variancesReport={null}
        transactionsReport={null}
        auditReport={null}
      />
    );
    expect(screen.getByText(/lịch sử giao dịch kho/)).toBeInTheDocument();
    expect(screen.queryByText(/Đang tải số liệu báo cáo đối soát/)).not.toBeInTheDocument();

    // Audit view
    rerender(
      <ReconciliationReportTables
        activeTab="audit"
        batchId=""
        isReportLoading={false}
        variancesReport={null}
        transactionsReport={null}
        auditReport={null}
      />
    );
    expect(screen.getByText(/nhật ký kiểm toán/)).toBeInTheDocument();
    expect(screen.queryByText(/Đang tải số liệu báo cáo đối soát/)).not.toBeInTheDocument();
  });

  // 6. ReconciliationPage Header: Khi không có lô, dropdown hiển thị (Chưa có lô đối soát) và không rớt dòng
  it('Task 6: ReconciliationPage renders "(Chưa có lô đối soát)" placeholder when batch list is empty', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 20,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({
      awaitingWarehouseBatchesCount: 0,
      completionReadyBatchesCount: 0,
      items: [],
      pendingDeltasCount: 0,
      pendingSourceChangesCount: 0,
      unresolvedVariancesCount: 0,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation?customerId=c-anv']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByRole('combobox', { name: 'Chọn lô đối soát' })).toBeInTheDocument();
    const batchSelect = screen.getByRole('combobox', { name: 'Chọn lô đối soát' });
    expect(batchSelect).toBeDisabled();
    expect(batchSelect).toHaveTextContent('(Chưa có lô đối soát)');
  });

  // 7. Tab view=completed: Tự động ẩn Stepper tiến trình và thanh đếm số râu ria của lô đang chạy
  it('Task 7: view=completed hides lifecycle stepper and active batch queue cards', async () => {
    vi.spyOn(mrxApi, 'getCompletedRegister').mockResolvedValue({
      rows: [],
      totalCount: 0,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation?view=completed']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Shows completed register subtitle
    expect(await screen.findByText('Lưu trữ hồ sơ các lô đối soát đã quyết toán vĩnh viễn')).toBeInTheDocument();

    // Hides active batch lifecycle stepper
    expect(screen.queryByText('Đang xuất ca')).not.toBeInTheDocument();
    expect(screen.queryByText('Đóng băng')).not.toBeInTheDocument();
  });
});
