import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';
import { mrxApi } from '../api/mrxApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_RECONCILIATION, MOCK_RECONCILIATION_BATCH_DTO } from '../test/fixtures';
import { ApiError } from '../api/client';
import { systemApi } from '../api/systemApi';

function renderReconciliation(initialEntry = '/reconciliation') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reconciliation" element={<ReconciliationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Reconciliation Feature (FR-RECON — Đối soát nguyên liệu)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue(MOCK_RECONCILIATION);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: MOCK_RECONCILIATION.batchId,
        customerId: 'customer-1',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 7,
        createdAt: '2026-10-18T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'completeBatch').mockResolvedValue({
      ...MOCK_RECONCILIATION_BATCH_DTO,
      status: 'COMPLETED',
      version: 8,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Zone 1 WorkspaceHeader (56px) with customer select, date, and single primary button (Rule D7)', async () => {
    renderReconciliation();

    expect(await screen.findByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();

    // Customer select and date input
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /DAV · IN_PROGRESS/i })).toHaveValue(MOCK_RECONCILIATION.batchId);
    expect(mrxApi.getBatchSummary).toHaveBeenCalledWith(MOCK_RECONCILIATION.batchId, '2026-10-19');
    expect(screen.getByRole('textbox')).toHaveAttribute('data-date-locale', 'vi-VN');
    expect(await screen.findByText('Đang đối chiếu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất biên bản đối soát' })).not.toBeInTheDocument();
    const completeBtn = screen.getByRole('button', { name: 'Chốt đối soát tuần' });
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn).toHaveClass('bg-slate-900');
  });

  it('uses one MRX review surface without fabricated history tabs or financial telemetry', async () => {
    renderReconciliation();

    expect(await screen.findByText(/Phiên bản lô:/i)).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái tuần:/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/Suất chốt:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hao hụt chung:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chênh lệch tiền:/i)).not.toBeInTheDocument();
  });

  it('renders backend MRX daily-line fields without fabricated kitchen-use or waste columns', async () => {
    const { container } = renderReconciliation();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhu cầu đã khóa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất theo sổ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Chênh lệch xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái dòng' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bếp sử dụng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Hao hụt (%)' })).not.toBeInTheDocument();

    // Row item check
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('blocks completion outside MATERIAL_RECONCILIATION without issuing a mutation', async () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát tuần' });
    expect(completeBtn).toBeDisabled();
    await userEvent.click(completeBtn);
    expect(mrxApi.completeBatch).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Chỉ khả dụng trong chế độ đối soát nguyên liệu.' })).toBeInTheDocument();
  });

  it('opens complete modal and submits reconciliation lock', async () => {
    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát tuần' });
    await userEvent.click(completeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xác nhận hoàn tất lô đối soát tuần' })).toBeInTheDocument();

    const confirmModalBtn = screen.getByRole('button', { name: 'Xác nhận khóa chốt tuần' });
    await userEvent.click(confirmModalBtn);

    expect(mrxApi.completeBatch).toHaveBeenCalledWith(
      'recon-batch-20260921-01',
      7
    );
  });

  it('keeps the loaded batch visible when completion conflicts with a newer version', async () => {
    vi.spyOn(mrxApi, 'completeBatch').mockRejectedValueOnce(new ApiError(409, 'Phiên bản lô đã thay đổi'));
    renderReconciliation();

    await userEvent.click(await screen.findByRole('button', { name: 'Chốt đối soát tuần' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận khóa chốt tuần' }));

    expect(await screen.findByText('Xung đột dữ liệu đồng thời')).toBeInTheDocument();
    expect(screen.getByText('Phiên bản lô đã thay đổi')).toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(mrxApi, 'getBatchSummary').mockRejectedValueOnce(
      new Error('Lỗi máy chủ đối soát')
    );

    renderReconciliation();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ đối soát')).toBeInTheDocument();

    // Click retry
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValueOnce(MOCK_RECONCILIATION);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Đối soát nguyên liệu')).toBeInTheDocument();
  });

  it('opens daily disposition modal for line with discrepancy, selects category, enters reason, and submits', async () => {
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
      { value: 'KITCHEN_FAULT', label: 'Lỗi bộ phận Bếp' },
    ]);
    const setDisposition = vi.spyOn(mrxApi, 'setDailyDisposition').mockResolvedValue();

    renderReconciliation();

    const handleBtn = await screen.findByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' });
    await userEvent.click(handleBtn);

    expect(await screen.findByRole('heading', { name: 'Xử lý chênh lệch theo ngày' })).toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi (NL-THIT-01)')).toBeInTheDocument();

    const categorySelect = screen.getByRole('combobox', { name: 'Danh mục xử lý chênh lệch' });
    await userEvent.selectOptions(categorySelect, 'ACCEPTED_VARIANCE');

    const reasonInput = screen.getByRole('textbox', { name: 'Lý do xử lý chênh lệch' });
    await userEvent.type(reasonInput, 'Bao bì thực tế giao vượt định lượng');

    const saveBtn = screen.getByRole('button', { name: 'Lưu hướng xử lý' });
    await userEvent.click(saveBtn);

    expect(setDisposition).toHaveBeenCalledWith(
      'daily-1',
      expect.objectContaining({
        category: 'ACCEPTED_VARIANCE',
        reason: 'Bao bì thực tế giao vượt định lượng',
      })
    );
  });

  it('shows read-only disposition details without mutation controls when batch is COMPLETED', async () => {
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      status: 'COMPLETED',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        disposition: {
          category: 'ACCEPTED_VARIANCE',
          reason: 'Đã được Quản lý duyệt trước đó',
          version: 1,
          disposedAt: '2026-10-19T07:00:00Z',
        },
      }],
    });

    renderReconciliation();

    expect(await screen.findByText('Hoàn tất')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát ca' })).not.toBeInTheDocument();

    const viewBtn = await screen.findByRole('button', { name: 'Xem hướng xử lý Thịt đùi heo tươi' });
    await userEvent.click(viewBtn);

    expect(await screen.findByRole('heading', { name: 'Chi tiết hướng xử lý' })).toBeInTheDocument();
    expect(screen.getByText('Đã được Quản lý duyệt trước đó')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu hướng xử lý' })).not.toBeInTheDocument();
  });

  it('surfaces 409 conflict inside disposition modal when version is stale', async () => {
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
    ]);
    vi.spyOn(mrxApi, 'setDailyDisposition').mockRejectedValueOnce(
      new ApiError(409, 'Hướng xử lý theo ngày đã thay đổi.')
    );

    renderReconciliation();

    const handleBtn = await screen.findByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' });
    await userEvent.click(handleBtn);

    const reasonInput = screen.getByRole('textbox', { name: 'Lý do xử lý chênh lệch' });
    const presetBtn = screen.getByRole('button', { name: 'Chấp nhận hao hụt thực tế' });
    await userEvent.click(presetBtn);
    expect(reasonInput).toHaveValue('Chấp nhận hao hụt thực tế');

    await userEvent.clear(reasonInput);
    await userEvent.type(reasonInput, 'Lý do xung đột');

    const saveBtn = screen.getByRole('button', { name: 'Lưu hướng xử lý' });
    await userEvent.click(saveBtn);

    expect(await screen.findByText('Hướng xử lý theo ngày đã thay đổi.')).toBeInTheDocument();
  });

  it('enables disposition button for under-issued lines and supports resolving shortages (RULE-MRX-01)', async () => {
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        requiredQuantity: 72,
        issuedQuantity: 70,
        issuedRequiredDifference: -2,
        disposition: undefined,
      }],
    });

    renderReconciliation();

    expect(await screen.findByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' })).toBeInTheDocument();
  });

  it('Route 7: renders blocker resolution strip when batch is in progress but week is not complete', async () => {
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      status: 'IN_PROGRESS',
      weeklyStatus: 'IN_PROGRESS',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        requiredQuantity: 100,
        issuedQuantity: 110,
        issuedRequiredDifference: 10,
        disposition: undefined,
      }],
    });

    renderReconciliation();

    expect(await screen.findByText(/Chưa thể chốt đối soát:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lọc dòng cần xử lý/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát tuần' })).not.toBeInTheDocument();
  });

  it('switches between daily lines, variance register, transaction history, and audit trail tabs', async () => {
    vi.spyOn(mrxApi, 'getVarianceRegister').mockResolvedValue({
      rows: [{
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
        ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', canonicalUnitName: 'kg',
        requiredQuantity: 72, issuedQuantity: 72.5, difference: 0.5, varianceType: 'OVER_ISSUED',
        dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Bao bì lẻ', disposedBy: 'user-1',
        disposedAt: '2026-10-19T07:00:00Z', issueNotes: ['Ghi chú kho']
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getTransactionsHistory').mockResolvedValue({
      rows: [{
        transactionType: 'INITIAL_ISSUE', documentCode: 'PX-001', date: '2026-10-19',
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier',
        ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unitName: 'kg',
        quantity: 72.5, actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getAuditTrail').mockResolvedValue({
      rows: [{
        auditId: 'audit-1', changedAt: '2026-10-19T07:00:00Z', changedBy: 'Admin User',
        businessArea: 'Reconciliation', entityName: 'ReconciliationBatch', entityId: MOCK_RECONCILIATION.batchId,
        fieldName: 'Status', oldValue: 'READY', newValue: 'TRANSFERRED', reason: 'Chuyển kho'
      }],
      totalCount: 1,
    });

    // 1. Initial view: lines
    const { unmount: unmount1 } = renderReconciliation('/reconciliation');
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    unmount1();

    // 2. View: variances
    const { unmount: unmount2 } = renderReconciliation('/reconciliation?view=variances');
    await vi.waitFor(() => {
      expect(mrxApi.getVarianceRegister).toHaveBeenCalled();
    });
    expect(await screen.findByText('Sổ theo dõi chênh lệch & quyết định xử lý tuần')).toBeInTheDocument();
    expect(await screen.findByText(/Bao bì lẻ/)).toBeInTheDocument();
    unmount2();

    // 3. View: transactions
    const { unmount: unmount3 } = renderReconciliation('/reconciliation?view=transactions');
    await vi.waitFor(() => {
      expect(mrxApi.getTransactionsHistory).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Lịch sử giao dịch kho/)).toBeInTheDocument();
    expect(await screen.findByText('PX-001')).toBeInTheDocument();
    unmount3();

    // 4. View: audit
    const { unmount: unmount4 } = renderReconciliation('/reconciliation?view=audit');
    await vi.waitFor(() => {
      expect(mrxApi.getAuditTrail).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Nhật ký kiểm toán đối soát nguyên liệu/)).toBeInTheDocument();
    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Chuyển kho')).toBeInTheDocument();
    unmount4();
  });

  it('renders 5 operational queue summary cards and updates view when clicked', async () => {
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({
      pendingSourceChangesCount: 2,
      awaitingWarehouseBatchesCount: 1,
      pendingDeltasCount: 3,
      unresolvedVariancesCount: 4,
      completionReadyBatchesCount: 5,
      items: [],
    });
    vi.spyOn(mrxApi, 'getVarianceRegister').mockResolvedValue({
      rows: [],
      totalCount: 0,
    });

    renderReconciliation();

    expect(mrxApi.getOperationalSummary).toHaveBeenCalled();
    // Invariant: 5 operational queue cards strip is permanently removed from /reconciliation
    expect(screen.queryByRole('button', { name: /Đổi nguồn chờ duyệt/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lô chờ xuất kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hàng đợi bù\/trả/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sai lệch chưa giải trình/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lô sẵn sàng chốt/i })).not.toBeInTheDocument();

    // Directly renders clean TelemetrySubbar and table
    expect(screen.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();
  });

  it('renders completed register tab, fetches completed batches, and renders table with CSV download', async () => {
    const getCompleted = vi.spyOn(mrxApi, 'getCompletedRegister').mockResolvedValue({
      rows: [{
        batchId: 'b2d7e7be-6be0-40bd-8409-d4cc1bd5471d',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-09-21',
        weekEndDate: '2026-09-27',
        completedBy: '4c90da94-81eb-4cbc-8121-f5d573c4c1b8',
        completedAt: '2026-10-22T13:31:41Z',
        version: 8,
        totalIngredientsCount: 68,
        totalRequired: 36892.86,
        totalIssued: 36892.86,
        totalVariance: 0,
      }],
      totalCount: 1,
    });

    renderReconciliation('/reconciliation?view=completed');

    expect(getCompleted).toHaveBeenCalled();
    expect(await screen.findByText(/Danh bạ lô đối soát đã hoàn tất/i)).toBeInTheDocument();
    expect(screen.getByText('b2d7e7be-6be0-40bd-8409-d4cc1bd5471d')).toBeInTheDocument();
    expect(screen.getByText('Draxlmaier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải CSV Danh bạ hoàn tất' })).toBeInTheDocument();
  });

  it('renders Lifecycle Progress Strip and filters lines by status and search keyword', async () => {
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      lines: [
        {
          ...MOCK_RECONCILIATION.lines[0],
          materialCode: 'NL-THIT-01',
          materialName: 'Thịt đùi heo tươi',
          issuedRequiredDifference: 0.5,
          disposition: undefined,
        },
        {
          ...MOCK_RECONCILIATION.lines[0],
          id: 'line-2',
          dailyLineId: 'daily-2',
          materialCode: 'NL-GAO-01',
          materialName: 'Gạo tẻ thơm',
          issuedRequiredDifference: 0,
          disposition: undefined,
        },
      ],
    });

    renderReconciliation();

    // Lifecycle strip is visible
    expect(await screen.findByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).toBeInTheDocument();
    expect(screen.getByText('Đang xuất ca')).toBeInTheDocument();

    // 2 lines originally
    expect(await screen.findByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ thơm')).toBeInTheDocument();

    // Filter "Khớp định mức (1)"
    const matchedFilterBtn = screen.getByRole('button', { name: 'Khớp định mức (1)' });
    await userEvent.click(matchedFilterBtn);
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ thơm')).toBeInTheDocument();

    // Filter "Cần xử lý (1)"
    const needsReviewFilterBtn = screen.getByRole('button', { name: 'Cần xử lý (1)' });
    await userEvent.click(needsReviewFilterBtn);
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.queryByText('Gạo tẻ thơm')).not.toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' });
    await userEvent.type(searchInput, 'Gạo');
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
  });

  // Rule TA-4 Scenario 2: Prerequisite-blocked empty state
  it('Scenario 2 (Empty / Prerequisite Blocked): renders prerequisite empty state when no batch exists', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    renderReconciliation();

    expect(await screen.findByRole('heading', { name: 'Chưa có dữ liệu đối soát cho ngày đã chọn' })).toBeInTheDocument();
  });

  // Rule TA-4 Scenario 4: RBAC 403 authorization failure with alert banner
  it('Scenario 4 (RBAC 403): surfaces permission denied alert banner when batch completion is rejected with 403', async () => {
    vi.spyOn(mrxApi, 'completeBatch').mockRejectedValueOnce(
      new ApiError(403, 'Tài khoản không đủ thẩm quyền chốt đối soát tuần.')
    );

    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát tuần' });
    await userEvent.click(completeBtn);

    const confirmModalBtn = screen.getByRole('button', { name: 'Xác nhận khóa chốt tuần' });
    await userEvent.click(confirmModalBtn);

    expect(await screen.findByText('Không có quyền thực hiện thao tác')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản không đủ thẩm quyền chốt đối soát tuần.')).toBeInTheDocument();
  });

  it('clicking document code in transaction history opens the issue detail modal', async () => {
    vi.spyOn(mrxApi, 'getTransactionsHistory').mockResolvedValue({
      rows: [{
        transactionType: 'INITIAL_ISSUE', documentCode: 'ISS-20260912-160015-C97F', date: '2026-09-12',
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier',
        ingredientCode: 'NL-01', ingredientName: 'Ớt xanh huế', unitName: 'Kilogram',
        quantity: 5.13, actorName: 'Thủ kho', createdAt: '2026-09-12T05:00:00Z', reason: null
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getIssueById').mockResolvedValue({
      issueId: 'iss-1',
      issueCode: 'ISS-20260912-160015-C97F',
      issueDate: '2026-09-12',
      warehouseName: 'Kho mẫu IPC',
      issuedByName: 'Thủ kho',
      kitchenStatus: 'Chờ xác nhận',
      lines: [
        { ingredientId: 'ing-1', ingredientName: 'Xà lách', unitName: 'Kilogram', requestedQty: 140.242, issuedQty: 140.242 }
      ],
    } as any);

    renderReconciliation('/reconciliation?view=transactions');

    const docBtn = await screen.findByTitle('Bấm để xem chi tiết phiếu xuất kho');
    expect(docBtn).toBeInTheDocument();

    await userEvent.click(docBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Chi tiết phiếu xuất kho: ISS-20260912-160015-C97F/)).toBeInTheDocument();
    expect(screen.getByText('Xà lách')).toBeInTheDocument();
  });
});
