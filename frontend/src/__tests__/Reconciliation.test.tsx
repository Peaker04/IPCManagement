import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ReconciliationCompletionModal } from '../features/reconciliation/ReconciliationCompletionModal';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';
import { isRouteEligible } from '../routes/navigationEligibility';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { mrxApi, type MrxBatchDishSummary } from '../api/mrxApi';
import { MrxBatchDishesModal } from '../components/workbench/MrxBatchDishesModal';
import * as apiTransport from '../api/client';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_RECONCILIATION, MOCK_RECONCILIATION_BATCH_DTO } from '../test/fixtures';
import { ApiError } from '../api/client';
import { systemApi } from '../api/systemApi';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

const defaultSummary = { ...MOCK_RECONCILIATION, weekStartDate: '2026-10-19', weekEndDate: '2026-10-24' };
const completionReadySummary = {
  ...defaultSummary,
  lines: MOCK_RECONCILIATION.lines.map((line) => ({ ...line, issuedQuantity: 72, issuedRequiredDifference: 0, status: 'MATCHED', triggers: [] })),
};

function WeeklyLocationProbe() {
  const location = useLocation();
  return <div data-testid="weekly-target">{location.search}</div>;
}

async function selectReviewBatch(batchId: string) {
  const select = await screen.findByRole('combobox', { name: 'Chọn lô đối soát' });
  await waitFor(() => expect(select).toBeEnabled());
  await userEvent.selectOptions(select, batchId);
}

function renderReconciliation(initialEntry = '/reconciliation') {
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
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
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue(defaultSummary);
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

  it('keeps an explicit other-customer batch link instead of replacing it with the remembered customer batch', async () => {
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    serverStateCache.clearAll();
    workspaceSessionStore.setScope({ customerCode: 'DAV', customerId: 'customer-1', batchId: 'dav-batch', serviceDate: '2026-09-21' });
    const anv = { ...MOCK_RECONCILIATION_BATCH_DTO, batchId: 'anv-batch', customerId: 'customer-2', customerCode: 'ANV', customerName: 'AMANN' };
    const dav = { ...MOCK_RECONCILIATION_BATCH_DTO, batchId: 'dav-batch' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      const data = url.pathname.endsWith('/coordination/customers')
        ? [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }, { customerId: 'customer-2', customerCode: 'ANV', customerName: 'AMANN' }]
        : url.pathname.endsWith('/batches')
          ? { items: [url.searchParams.get('CustomerId') === 'customer-2' ? anv : dav], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false }
          : url.pathname.endsWith('/anv-batch') ? anv
            : url.pathname.endsWith('/dav-batch') ? dav
              : url.pathname.endsWith('/operational-summary') ? { totalBatches: 0 } : null;
      if (data === null) throw new Error(`Unexpected reconciliation read ${url.pathname}`);
      return Response.json({ success: true, data });
    });
    renderReconciliation('/reconciliation?batchId=anv-batch');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('ANV'));
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('9');
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue('anv-batch');
  });

  it('renders Zone 1 WorkspaceHeader (56px) with customer select, date, and single primary button (Rule D7)', async () => {
    renderReconciliation();

    expect(await screen.findByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();

    // Customer select and date input
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');
    await waitFor(() => expect(mrxApi.getBatchSummary).toHaveBeenCalledWith(MOCK_RECONCILIATION.batchId, '2026-10-19', true));
    expect(screen.getByRole('button', { name: 'T2 · 19/10/2026' })).toHaveAttribute('aria-pressed', 'true');
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
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({ ...MOCK_RECONCILIATION, lines: [{ ...MOCK_RECONCILIATION.lines[0],
      requiredQuantity: 79.773, issuedQuantity: 79.773001, issuedRequiredDifference: 0.000001 }] });
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

    const row = screen.getByRole('row', { name: /Thịt đùi heo tươi/ });
    expect(within(row).getByText('79,773', { exact: true })).toBeVisible();
    expect(within(row).getByText('79,773001', { exact: true })).toBeVisible();
    expect(within(row).getByText('+0,000001', { exact: true })).toBeVisible();

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

  it('never invents completion readiness when weekly status is absent and blocks unresolved rows', () => {
    const props = { isOpen: true, onClose: vi.fn(), customerCode: 'DAV', isSubmitting: false, onConfirm: vi.fn(), statusLabels: { WEEK_COMPLETE: 'Đã xuất đủ' } };
    const { rerender } = render(<ReconciliationCompletionModal {...props} data={{ ...MOCK_RECONCILIATION, weeklyStatus: undefined }} />);
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận khóa chốt tuần' })).toBeDisabled();
    rerender(<ReconciliationCompletionModal {...props} data={{ ...MOCK_RECONCILIATION, status: 'IN_PROGRESS', weeklyStatus: 'WEEK_COMPLETE' }} needsReviewCount={2} />);
    expect(screen.getByRole('button', { name: 'Xác nhận khóa chốt tuần' })).toBeDisabled();
  });

  it('opens complete modal and submits reconciliation lock', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue(completionReadySummary);
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
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue(completionReadySummary);
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

  it('preserves the decision reason through a category read failure and retries authoritative options before saving', async () => {
    vi.spyOn(mrxApi, 'getDispositionCategories').mockRejectedValueOnce(new ApiError(500, 'Không tải được danh mục xử lý.')).mockResolvedValue([
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
      { value: 'KITCHEN_FAULT', label: 'Lỗi bộ phận Bếp' },
    ]);
    const setDisposition = vi.spyOn(mrxApi, 'setDailyDisposition').mockResolvedValue();

    renderReconciliation();

    const handleBtn = await screen.findByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' });
    await userEvent.click(handleBtn);

    expect(await screen.findByRole('heading', { name: 'Xử lý chênh lệch theo ngày' })).toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi (NL-THIT-01)')).toBeInTheDocument();

    const reasonInput = screen.getByRole('textbox', { name: 'Lý do xử lý chênh lệch' });
    await userEvent.type(reasonInput, 'Bao bì thực tế giao vượt định lượng');
    expect(await screen.findByText('Không tải được danh mục xử lý.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu hướng xử lý' })).toBeDisabled();
    expect(setDisposition).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    const categorySelect = screen.getByRole('combobox', { name: 'Danh mục xử lý chênh lệch' });
    await userEvent.selectOptions(categorySelect, 'ACCEPTED_VARIANCE');
    expect(reasonInput).toHaveValue('Bao bì thực tế giao vượt định lượng');

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

  it('retains committed bulk decisions and retries only the remaining line', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({ ...MOCK_RECONCILIATION, lines: [
      MOCK_RECONCILIATION.lines[0],
      { ...MOCK_RECONCILIATION.lines[0], id: 'line-2', dailyLineId: 'daily-2', materialCode: 'NL-02', materialName: 'Gạo' },
    ] });
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([{ value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' }]);
    const save = vi.spyOn(mrxApi, 'setDailyDisposition').mockResolvedValueOnce().mockRejectedValueOnce(new ApiError(500, 'Dòng thứ hai chưa lưu.')).mockResolvedValue();
    renderReconciliation();
    await userEvent.click(await screen.findByRole('button', { name: 'Giải trình hàng loạt (2)' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xử lý chênh lệch' }), 'Bao bì giao vượt');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận 2 dòng' }));
    expect(await screen.findByText('Dòng thứ hai chưa lưu.')).toBeInTheDocument();
    expect(screen.getByText('Đã lưu 1/2 dòng · Còn 1 dòng.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận 2 dòng' }));
    expect(save.mock.calls.map(([id]) => id)).toEqual(['daily-1', 'daily-2', 'daily-2']);
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
    expect(screen.getByRole('cell', { name: 'Đã giải trình' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Cần giải trình' })).not.toBeInTheDocument();
    await userEvent.click(viewBtn);

    expect(await screen.findByRole('heading', { name: 'Chi tiết hướng xử lý' })).toBeInTheDocument();
    expect(screen.getByText('Đã được Quản lý duyệt trước đó')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Chấp nhận chênh lệch', { exact: true })).toBeVisible();
    expect(within(screen.getByRole('dialog')).queryByText('ACCEPTED_VARIANCE')).not.toBeInTheDocument();
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

  it('shows under-issued lines as Warehouse work, never a Manager waiver', async () => {
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

    expect(await screen.findByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' })).not.toBeInTheDocument();
    expect(screen.getByText('Chờ Kho xuất bổ sung')).toBeInTheDocument();
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
      items: [{
        transactionType: 'INITIAL_ISSUE', documentCode: 'PX-001', date: '2026-10-19',
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier',
        ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unitName: 'kg',
        quantity: 72.5, actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null
      }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
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
    const { unmount: unmount2 } = renderReconciliation('/reconciliation?view=variances&date=2026-10-24');
    await vi.waitFor(() => {
      expect(mrxApi.getVarianceRegister).toHaveBeenLastCalledWith(MOCK_RECONCILIATION.batchId);
    });
    expect(await screen.findByText('Sổ theo dõi chênh lệch & quyết định xử lý tuần')).toBeInTheDocument();
    expect(await screen.findByText(/Bao bì lẻ/)).toBeInTheDocument();
    const varianceSearch = screen.getByRole('searchbox', { name: 'Tìm trong sổ chênh lệch' });
    await userEvent.type(varianceSearch, 'chap nhan chenh lech');
    expect(screen.getByText(/Bao bì lẻ/)).toBeVisible();
    await userEvent.clear(varianceSearch);
    await userEvent.type(varianceSearch, 'khong khop');
    expect(screen.getByText('Không có dòng chênh lệch khớp tìm kiếm.')).toBeVisible();
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

  it('keeps operational queues on the Dashboard without fetching an unused summary on the Manager workspace', async () => {
    vi.spyOn(mrxApi, 'getOperationalSummary').mockRejectedValue(new Error('Trang Quản lý không tải hàng đợi Dashboard'));
    vi.spyOn(mrxApi, 'getVarianceRegister').mockResolvedValue({
      rows: [],
      totalCount: 0,
    });

    renderReconciliation();

    expect(mrxApi.getOperationalSummary).not.toHaveBeenCalled();
    // Invariant: 5 operational queue cards strip is permanently removed from /reconciliation
    expect(screen.queryByRole('button', { name: /Đổi nguồn chờ duyệt/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lô chờ xuất kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hàng đợi bù\/trả/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sai lệch chưa giải trình/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lô sẵn sàng chốt/i })).not.toBeInTheDocument();

    // Directly renders clean TelemetrySubbar and table
    expect(screen.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();
  });

  it('pages completed history and opens the correct read-only week without exposing UUIDs or adding page navigation', async () => {
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    vi.spyOn(mrxApi, 'getCompletedRegister').mockRestore();
    const disposition = { category: 'ACCEPTED_VARIANCE', reason: 'Đã được Quản lý duyệt trước đó', version: 1, disposedAt: '2026-09-21T07:00:00Z' };
    const oldBatch = {
      ...MOCK_RECONCILIATION_BATCH_DTO, batchId: 'old-completed-batch', status: 'COMPLETED', completedAt: '2026-09-21T07:00:00Z',
      weekStartDate: '2026-09-14', weekEndDate: '2026-09-20',
      lines: MOCK_RECONCILIATION_BATCH_DTO.lines.map((line) => ({ ...line, serviceDate: '2026-09-14', disposition })),
      dailyReview: { weeklyStatus: 'WEEK_COMPLETE', lines: MOCK_RECONCILIATION_BATCH_DTO.dailyReview!.lines.map((line) => ({ ...line, serviceDate: '2026-09-14', disposition })) },
    };
    let resolveOld!: (value: typeof oldBatch) => void;
    let pendingOld = true;
    const transport = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (path) => {
      const url = new URL(String(path), 'http://localhost');
      if (url.pathname === '/coordination/customers') return [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      if (url.pathname === '/reconciliation/batches') return { items: [MOCK_RECONCILIATION_BATCH_DTO], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      if (url.pathname.endsWith(`/${MOCK_RECONCILIATION_BATCH_DTO.batchId}`)) return MOCK_RECONCILIATION_BATCH_DTO;
      if (url.pathname.endsWith('/old-completed-batch')) {
        if (pendingOld) return new Promise<typeof oldBatch>((resolve) => { resolveOld = resolve; });
        return oldBatch;
      }
      if (url.pathname.endsWith('/completed-register')) return { rows: [{
        batchId: url.searchParams.get('pageNumber') === '2' ? oldBatch.batchId : 'recent-completed-batch',
        customerName: 'Draxlmaier',
        weekStartDate: url.searchParams.get('pageNumber') === '2' ? oldBatch.weekStartDate : '2026-09-21',
        weekEndDate: url.searchParams.get('pageNumber') === '2' ? oldBatch.weekEndDate : '2026-09-27',
        completedBy: 'Quản lý', completedAt: '2026-09-21T07:00:00Z', version: 8, totalIngredientsCount: 1,
        totalRequired: 72, totalIssued: null, totalVariance: null, quantityUnitName: null,
      }], totalCount: 51 };
      throw new Error(`Unexpected history request ${path}`);
    });
    renderReconciliation('/reconciliation?view=completed');
    expect(await screen.findByRole('button', { name: 'Đối chiếu lô tuần 21/09/2026 · Draxlmaier' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Mã lô' })).not.toBeInTheDocument();
    expect(screen.getByText('51 lô')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Đối chiếu lô tuần 14/09/2026 · Draxlmaier' }));
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát tuần' })).not.toBeInTheDocument();
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    pendingOld = false;
    await act(async () => resolveOld(oldBatch));
    expect(await screen.findByText('Thịt đùi heo tươi')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('9');
    expect(screen.getByRole('button', { name: 'T2 · 14/09/2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('navigation', { name: 'Tra cứu hồ sơ lô' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'T3 · 15/09/2026' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'T3 · 15/09/2026' })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue('old-completed-batch');
    expect(transport.mock.calls.some(([path]) => String(path).includes('completed-register?pageNumber=2&pageSize=50'))).toBe(true);
    expect(transport.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('revalidates an expired completed report but does not renew a fresh cache hit', async () => {
    const key = 'mrx_report_10000000-0000-0000-0000-000000000001_MATERIAL_RECONCILIATION_completed_all_1';
    serverStateCache.set(key, { completedReport: { rows: [], totalCount: 0 } }, -1);
    const getReport = vi.spyOn(mrxApi, 'getCompletedRegister').mockResolvedValue({ rows: [], totalCount: 0 });
    const page = renderReconciliation('/reconciliation?view=completed');
    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(1));
    await screen.findByText('Chưa có lô đối soát nào hoàn tất.');
    page.unmount();
    const timestamp = serverStateCache.get(key)!.timestamp;
    vi.setSystemTime(new Date(Date.now() + 1000));
    renderReconciliation('/reconciliation?view=completed');
    await screen.findByText('Chưa có lô đối soát nào hoàn tất.');
    expect(getReport).toHaveBeenCalledTimes(1);
    expect(serverStateCache.get(key)!.timestamp).toBe(timestamp);
  });

  it.each([
    { query: '', scope: undefined, exportQuery: '' },
    { query: '&completedCustomerId=customer-1&completedperiod=YEAR&completedyear=2024', scope: { customerId: 'customer-1', weekFrom: '2024-01-01', weekTo: '2024-12-31' }, exportQuery: '?customerId=customer-1&weekFrom=2024-01-01&weekTo=2024-12-31' },
    { query: '&completedperiod=RANGE&completedfrom=2023-01-01&completedto=2025-12-31', scope: { weekFrom: '2023-01-01', weekTo: '2025-12-31' }, exportQuery: '?weekFrom=2023-01-01&weekTo=2025-12-31' },
  ])('uses the same completed register and export scope for $query', async ({ query, scope, exportQuery }) => {
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
        quantityUnitName: null,
      }],
      totalCount: 1,
    });

    renderReconciliation(`/reconciliation?view=completed${query}`);

    if (scope) await waitFor(() => expect(getCompleted).toHaveBeenCalledWith(1, 50, scope));
    else expect(getCompleted).toHaveBeenCalledWith(1, 50);
    expect(await screen.findByText(/Danh bạ lô đối soát đã hoàn tất/i)).toBeInTheDocument();
    expect(screen.queryByText('b2d7e7be-6be0-40bd-8409-d4cc1bd5471d')).not.toBeInTheDocument();
    expect(screen.queryByText('4c90da94-81eb-4cbc-8121-f5d573c4c1b8')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đối chiếu lô tuần 21/09/2026 · Draxlmaier' })).toBeVisible();
    expect(screen.getByText('Draxlmaier')).toBeInTheDocument();
    expect(screen.getAllByText('Theo từng đơn vị')).toHaveLength(3);
    expect(screen.queryByText(/36.892,86/)).not.toBeInTheDocument();
    const download = screen.getByRole('button', { name: 'Tải Excel Danh bạ hoàn tất' });
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    await userEvent.click(download);
    expect(await screen.findByText(/Không thể tải tệp \(HTTP 403\)/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`${window.location.origin}/api/reconciliation/reports/completed-register/xlsx${exportQuery}`, expect.anything());
  });

  it('renders unavailable daily totals for a legacy completed batch without fabricating zero', async () => {
    vi.spyOn(mrxApi, 'getCompletedRegister').mockResolvedValue({
      rows: [{
        batchId: 'legacy-completed-batch',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-09-21',
        weekEndDate: '2026-09-27',
        completedBy: 'Người chốt',
        completedAt: '2026-10-22T13:31:41Z',
        version: 3,
        totalIngredientsCount: 2,
        totalRequired: 10,
        totalIssued: null,
        totalVariance: null,
        quantityUnitName: 'Lít',
      }],
      totalCount: 1,
    });

    renderReconciliation('/reconciliation?view=completed');

    expect(await screen.findByText('Chưa đủ dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0 kg')).not.toBeInTheDocument();
  });

  it('renders Lifecycle Progress Strip and filters lines by status and search keyword', async () => {
    vi.restoreAllMocks();
    const meat = { ...MOCK_RECONCILIATION_BATCH_DTO.lines[0], disposition: undefined };
    const rice = { ...meat, batchLineId: 'line-2', dailyLineId: 'daily-2', ingredientId: 'ingredient-2',
      ingredientCode: 'NL-GAO-01', ingredientName: 'Gạo tẻ thơm', issuedQuantity: meat.requiredQuantity,
      issuedRequiredDifference: 0, status: 'MATCHED', triggers: [], issueNotes: [] };
    const batch = { ...MOCK_RECONCILIATION_BATCH_DTO, lines: [meat, rice], dailyReview: { weeklyStatus: 'IN_PROGRESS', lines: [meat, rice] } };
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-09-21T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      const url = new URL(endpoint, 'http://localhost');
      if (url.pathname === '/coordination/customers') return [{ customerId: batch.customerId, customerCode: batch.customerCode, customerName: batch.customerName }];
      if (url.pathname === '/reconciliation/batches') return { items: [batch], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      if (url.pathname === `/reconciliation/batches/${batch.batchId}`) return batch;
      throw new Error(`Unexpected review find request ${endpoint}`);
    });
    renderReconciliation(`/reconciliation?batchId=${batch.batchId}&date=2026-09-21`);

    // Lifecycle strip is visible
    expect(await screen.findByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).toBeInTheDocument();
    expect(screen.getByText('Đang xuất ca')).toBeInTheDocument();

    // 2 lines originally
    expect(await screen.findByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ thơm')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Tất cả (2)' })).toHaveAttribute('aria-pressed', 'true');
    const zeroDisposed = screen.getByRole('button', { name: 'Đã giải trình (0)' });
    expect(zeroDisposed).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(zeroDisposed);
    expect(zeroDisposed).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Không có dòng đối soát nào phù hợp với bộ lọc.')).toBeInTheDocument();

    // Filter "Khớp định mức (1)"
    const matchedFilterBtn = screen.getByRole('button', { name: 'Khớp định mức (1)' });
    await userEvent.click(matchedFilterBtn);
    expect(matchedFilterBtn).toHaveAttribute('aria-pressed', 'true');
    expect(zeroDisposed).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ thơm')).toBeInTheDocument();

    // Filter "Cần xử lý (1)"
    const needsReviewFilterBtn = screen.getByRole('button', { name: 'Cần xử lý (1)' });
    await userEvent.click(needsReviewFilterBtn);
    expect(needsReviewFilterBtn).toHaveAttribute('aria-pressed', 'true');
    expect(matchedFilterBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.queryByText('Gạo tẻ thơm')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tất cả (2)' }));
    const reads = vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path === `/reconciliation/batches/${batch.batchId}`).length;
    expect(screen.queryByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).not.toBeInTheDocument();
    const activeDay = within(screen.getByRole('group', { name: 'Ngày đối soát' })).getByRole('button', { pressed: true }).getAttribute('aria-label');
    await userEvent.click(screen.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' }));
    const searchInput = screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' });
    expect(searchInput).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Ngày đối soát' })).not.toBeInTheDocument();
    await userEvent.type(searchInput, '  GAO  TE  ');
    expect(screen.getByText('Gạo tẻ thơm')).toBeInTheDocument();
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Kết quả tìm nguyên liệu đối soát' })).toHaveTextContent('Hiển thị 1/2 dòng ngày');
    expect(screen.getByRole('button', { name: 'Cần xử lý (1)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm nguyên liệu' }));
    expect(screen.queryByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tìm kiếm nguyên liệu đang lọc' })).toHaveFocus();
    expect(within(screen.getByRole('group', { name: 'Ngày đối soát' })).getByRole('button', { pressed: true })).toHaveAttribute('aria-label', activeDay);
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tìm kiếm nguyên liệu đang lọc' }));
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).toHaveValue('  GAO  TE  ');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc đối soát' }));
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).toHaveValue('');
    expect(vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path === `/reconciliation/batches/${batch.batchId}`)).toHaveLength(reads);
  });

  it('keeps Manager review in its own station while waiting for Warehouse', async () => {
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'manager-1', username: 'manager', fullName: 'Quản lý', roleCode: 'Manager', roleName: 'Quản lý',
      isActive: true, isAdminFullAccess: false,
      permissions: ['reconciliation.read', 'reconciliation.source.read', 'reconciliation.disposition', 'reconciliation.complete'],
    }));
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION, weeklyStatus: 'PARTIAL',
      lines: MOCK_RECONCILIATION.lines.map((line) => ({ ...line, issuedRequiredDifference: 0 })),
    });
    vi.spyOn(apiTransport, 'apiClient').mockResolvedValue([{ dishId: 'dish-1', dishCode: 'MON-1', dishName: 'Canh rau',
      scopes: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', frozenServings: 100, currentServings: 100, additionalServings: 0 }, { serviceDate: '2026-10-20', shiftName: 'AFTERNOON', frozenServings: 80, currentServings: 80, additionalServings: 0 }],
      materials: [{ batchLineId: 'line-1', dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'i-1',
        ingredientName: 'Rau', ingredientCode: 'RAU', canonicalUnitId: 'unit-1', canonicalUnitName: null, grossQtyPerServing: 0.0004, canonicalQtyPerServing: 0.0000004 },
        { batchLineId: 'line-1', dailyLineId: 'daily-2', serviceDate: '2026-10-20', ingredientId: 'i-1',
          ingredientName: 'Rau', ingredientCode: 'RAU', canonicalUnitId: 'unit-1', canonicalUnitName: null, grossQtyPerServing: 0.003, canonicalQtyPerServing: 0.003 }] }]);
    renderReconciliation();
    expect(await screen.findByText('Chưa thể chốt đối soát:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phiếu nấu Bếp →' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở trạm Kho xuất ngày →' })).not.toBeInTheDocument();
    expect(screen.getByText(/Chờ Kho hoàn tất xuất nguyên liệu/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Món & BOM đã đóng băng' }));
    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('0,0000004', { exact: true })).toBeVisible();
    expect(within(modal).getByText('Công ty TNHH Draxlmaier Automotive', { exact: false }))
      .not.toHaveTextContent(MOCK_RECONCILIATION_BATCH_DTO.batchId.slice(0, 8));
    expect(within(modal).getAllByText('Chưa rõ đơn vị', { exact: true })).toHaveLength(2);
    const firstDay = within(modal).getByRole('table', { name: 'Định mức ngày 19/10/2026' });
    const secondDay = within(modal).getByRole('table', { name: 'Định mức ngày 20/10/2026' });
    expect(within(firstDay).getByText('0,0000004')).toBeVisible();
    expect(within(secondDay).getByText('0,003')).toBeVisible();
    expect(within(modal).getByText(/Sáng.*100 suất/)).toBeVisible();
    expect(within(modal).getByText(/Chiều.*80 suất/)).toBeVisible();
    expect(within(modal).getByRole('heading', { name: 'Định mức theo ngày' })).toBeVisible();
    expect(within(modal).getByRole('region', { name: 'Định mức theo ngày' })).toHaveTextContent('1 loại nguyên liệu');
    expect(within(modal).queryByRole('button', { name: 'Chỉnh sửa BOM' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('scopes frozen facts to each modal opening and ignores late responses from a previous batch', async () => {
    const dishA: MrxBatchDishSummary = { dishId: 'dish-a', dishCode: 'A', dishName: 'Món đông cứng A', scopes: [], materials: [] };
    const dishB: MrxBatchDishSummary = { dishId: 'dish-b', dishCode: 'B', dishName: 'Món đông cứng B', scopes: [], materials: [] };
    let resolveOldA!: (items: MrxBatchDishSummary[]) => void;
    let resolveNewB!: (items: MrxBatchDishSummary[]) => void;
    const transport = vi.spyOn(apiTransport, 'apiClient')
      .mockResolvedValueOnce([dishA])
      .mockImplementationOnce(() => new Promise<MrxBatchDishSummary[]>((resolve) => { resolveOldA = resolve; }))
      .mockResolvedValueOnce([dishB])
      .mockImplementationOnce(() => new Promise<MrxBatchDishSummary[]>((resolve) => { resolveNewB = resolve; }));
    const props = { isOpen: true, onClose: vi.fn(), batchId: 'batch-a' };
    const { rerender } = render(<MrxBatchDishesModal {...props} />);
    expect(await screen.findByRole('heading', { name: dishA.dishName })).toBeVisible();
    const selection = screen.getByRole('button', { name: new RegExp(dishA.dishName) });
    expect(selection.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sao chép A' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa BOM' })).not.toBeInTheDocument();
    rerender(<MrxBatchDishesModal {...props} isOpen={false} />);
    serverStateCache.delete('mrx_batch_dishes_batch-a');
    rerender(<MrxBatchDishesModal {...props} />);
    expect(screen.queryByRole('heading', { name: dishA.dishName })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('aria-busy', 'true');
    rerender(<MrxBatchDishesModal {...props} batchId="batch-b" />);
    expect(await screen.findByRole('heading', { name: dishB.dishName })).toBeVisible();
    await act(async () => resolveOldA([dishA]));
    expect(screen.queryByRole('heading', { name: dishA.dishName })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: dishB.dishName })).toBeVisible();
    rerender(<MrxBatchDishesModal {...props} batchId="batch-b" isOpen={false} />);
    serverStateCache.delete('mrx_batch_dishes_batch-b');
    rerender(<MrxBatchDishesModal {...props} batchId="batch-b" />);
    expect(screen.queryByRole('heading', { name: dishB.dishName })).not.toBeInTheDocument();
    await act(async () => resolveNewB([dishB]));
    expect(screen.getByRole('heading', { name: dishB.dishName })).toBeVisible();
    expect(transport.mock.calls.map(([path]) => path)).toEqual([
      '/reconciliation/batches/batch-a/dishes', '/reconciliation/batches/batch-a/dishes',
      '/reconciliation/batches/batch-b/dishes', '/reconciliation/batches/batch-b/dishes',
    ]);
  });

  it.each([
    { status: 409, message: 'KITCHEN_FROZEN_LINEAGE_MISSING', title: 'Chưa đủ dữ liệu món & BOM đã đóng băng' },
    { status: 403, message: 'Không được xem lô này.', title: 'Không có quyền xem món & BOM của lô' },
    { status: 500, message: 'Không thể đọc dữ liệu.', title: 'Không thể tải món & BOM đã đóng băng' },
  ])('distinguishes frozen lookup HTTP$status from a successful empty response', async ({ status, message, title }) => {
    const transport = vi.spyOn(apiTransport, 'apiClient').mockRejectedValueOnce(new ApiError(status, message)).mockResolvedValue([]);
    render(<MrxBatchDishesModal isOpen onClose={vi.fn()} batchId="batch-state" />);
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument());
    expect(screen.queryByText(/· 0 món ăn$/)).not.toBeInTheDocument();
    expect(screen.getByText(title)).toBeVisible();
    expect(screen.queryByText('Lô chưa có món ăn đã đóng băng.')).not.toBeInTheDocument();
    if (status === 500) {
      await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Lô chưa có món ăn đã đóng băng.')).toBeVisible();
      expect(screen.queryByText(title)).not.toBeInTheDocument();
      expect(transport).toHaveBeenCalledTimes(2);
    } else {
      expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    }
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

    expect(await screen.findByRole('heading', { name: /Chưa có lô đối soát cho tháng/ })).toBeInTheDocument();
  });

  // Rule TA-4 Scenario 4: RBAC 403 authorization failure with alert banner
  it('Scenario 4 (RBAC 403): surfaces permission denied alert banner when batch completion is rejected with 403', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue(completionReadySummary);
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

  it('pages the review batch catalogue without changing scope and resets it for another customer', async () => {
    vi.restoreAllMocks();
    const first = { ...MOCK_RECONCILIATION_BATCH_DTO, batchId: 'review-first', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25' };
    const older = { ...first, batchId: 'review-older', version: 6 };
    const other = { ...first, batchId: 'review-other', customerId: 'customer-other', customerCode: 'KH2', customerName: 'Khách thứ hai' };
    const reads: URL[] = [];
    let failOlderPage = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input), 'http://localhost');
      reads.push(url);
      let data: unknown;
      if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      else if (url.pathname.endsWith('/coordination/customers')) data = [first, other].map(batch => ({ customerId: batch.customerId, customerCode: batch.customerCode, customerName: batch.customerName }));
      else if (url.pathname.endsWith('/batches')) {
        const secondPage = url.searchParams.get('PageNumber') === '2';
        if (secondPage && failOlderPage) { failOlderPage = false; return Response.json({ success: false, message: 'Danh sách lô tạm ngừng' }, { status: 503 }); }
        const otherCustomer = url.searchParams.get('CustomerId') === other.customerId;
        data = { items: [otherCustomer ? other : secondPage ? older : first], totalCount: otherCustomer ? 1 : 101, pageNumber: secondPage ? 2 : 1, pageSize: 100, totalPages: otherCustomer ? 1 : 2, hasPrev: secondPage, hasNext: !otherCustomer && !secondPage };
      } else {
        const batch = [first, older, other].find(batch => url.pathname.endsWith('/' + batch.batchId));
        if (!batch) throw new Error(`Unexpected review catalogue request ${url.pathname}`);
        data = batch;
      }
      return Response.json({ success: true, data });
    });
    renderReconciliation('/reconciliation?batchId=review-first&date=2026-10-19');
    const catalogue = await screen.findByRole('combobox', { name: 'Chọn lô đối soát' });
    await within(catalogue).findByRole('option', { name: 'Xem tất cả 101 lô…' });
    await userEvent.selectOptions(catalogue, '__all__');
    const dialog = screen.getByRole('dialog', { name: 'Danh sách lô trong tháng' });
    const pager = within(dialog).getByRole('navigation', { name: 'Phân trang lô trong tháng' });
    await waitFor(() => expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeEnabled());
    const firstReads = reads.filter(url => url.pathname.endsWith('/review-first')).length;
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    const retry = await within(dialog).findByRole('button', { name: 'Tải lại danh sách lô' });
    await userEvent.click(retry);
    expect(await within(dialog).findByText(older.batchId)).toBeVisible();
    expect(reads.filter(url => url.pathname.endsWith('/review-first'))).toHaveLength(firstReads);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), other.customerCode);
    await waitFor(() => expect(reads.some(url => url.pathname.endsWith('/review-other'))).toBe(true));
    expect(reads.some(url => url.searchParams.get('CustomerId') === other.customerId && url.searchParams.get('PageNumber') === '2')).toBe(false);
  });

  it('pages the full audit trail and resets page when selecting another batch', async () => {
    vi.spyOn(apiTransport, 'apiClient').mockRestore();
    vi.spyOn(mrxApi, 'getAuditTrail').mockRestore();
    vi.spyOn(mrxApi, 'getSourceChanges').mockRestore();
    vi.mocked(systemApi.getOperationalMode).mockRestore();
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    const first = { ...MOCK_RECONCILIATION_BATCH_DTO, batchId: 'audit-batch-a', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25' };
    const second = { ...first, batchId: 'audit-batch-b' };
    const reads: string[] = [];
    let releaseSecondPage!: () => void;
    const secondPageReady = new Promise<void>(resolve => { releaseSecondPage = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      reads.push(url.pathname + url.search);
      let data: unknown;
      if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      else if (url.pathname.endsWith('/coordination/customers')) data = [{ customerId: first.customerId, customerCode: first.customerCode, customerName: first.customerName }];
      else if (url.pathname.endsWith('/batches')) data = { items: [first, second], totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      else if (url.pathname.endsWith('/audit-trail')) {
        if (url.searchParams.get('pageNumber') === '2') await secondPageReady;
        const reason = url.searchParams.get('batchId') === second.batchId ? 'Nhật ký lô thứ hai' : url.searchParams.get('pageNumber') === '2' ? 'Ghi nhận cũ hơn' : 'Ghi nhận trang đầu';
        data = { rows: [{ auditId: reason, changedAt: '2026-10-19T07:00:00Z', changedBy: 'Thủ kho', businessArea: 'Inventory', entityName: 'InventoryIssue', entityId: 'issue-1', fieldName: 'IssuedQuantity', oldValue: '1', newValue: '2', reason }], totalCount: 51 };
      } else if (url.pathname.endsWith('/source-changes')) data = [];
      else if (url.pathname.endsWith('/audit-batch-a')) data = first;
      else if (url.pathname.endsWith('/audit-batch-b')) data = second;
      else throw new Error(`Unexpected audit request ${url.pathname}`);
      return Response.json({ success: true, data });
    });
    renderReconciliation('/reconciliation?view=audit&batchId=audit-batch-a&date=2026-10-19');
    expect(await screen.findByText('Ghi nhận trang đầu')).toBeVisible();
    expect(screen.getByText('Sự kiện kiểm toán:')).toHaveTextContent(/Sự kiện kiểm toán:\s*51/);
    const pager = screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' });
    expect(pager).toHaveTextContent('51 kết quả');
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Ghi nhận trang đầu')).toBeVisible();
    expect(pager).toHaveTextContent('Trang 1/2');
    expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await act(async () => { releaseSecondPage(); });
    expect(await screen.findByText('Ghi nhận cũ hơn')).toBeVisible();
    expect(reads).toContain('/api/reconciliation/reports/audit-trail?pageNumber=2&pageSize=50&batchId=audit-batch-a');
    expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await selectReviewBatch(second.batchId);
    expect(await screen.findByText('Nhật ký lô thứ hai')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' })).toHaveTextContent('Trang 1/2');
    expect(reads.some(path => path.includes('pageNumber=2') && path.includes(second.batchId))).toBe(false);
  });

  it('pages transaction history on the server and retains report metadata', async () => {
    const row = (documentCode: string) => ({
      transactionType: 'INITIAL_ISSUE', documentCode, date: '2026-10-19', batchId: MOCK_RECONCILIATION.batchId,
      customerName: 'Draxlmaier', ingredientCode: 'NL-01', ingredientName: 'Gạo', unitName: 'kg', quantity: 1,
      actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null,
    });
    vi.mocked(systemApi.getOperationalMode).mockRestore();
    vi.mocked(weeklyMenuApi.getCustomers).mockRestore();
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    vi.spyOn(apiTransport, 'apiClient').mockRestore();
    const reads: URL[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input), 'http://localhost');
      reads.push(url);
      let data: unknown;
      if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      else if (url.pathname.endsWith('/coordination/customers')) data = [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }];
      else if (url.pathname.endsWith('/batches')) data = { items: [MOCK_RECONCILIATION_BATCH_DTO], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      else if (url.pathname.endsWith('/transactions-history')) data = url.searchParams.get('pageNumber') === '2'
        ? { items: [row('PX-PAGE-2')], totalCount: 26, pageNumber: 2, pageSize: 25, totalPages: 2, hasPrev: true, hasNext: false }
        : { items: [row('PX-PAGE-1')], totalCount: 26, pageNumber: 1, pageSize: 25, totalPages: 2, hasPrev: false, hasNext: true };
      else if (url.pathname.endsWith('/' + MOCK_RECONCILIATION.batchId)) data = MOCK_RECONCILIATION;
      else throw new Error(`Unexpected transaction request ${url.pathname}`);
      return Response.json({ success: true, data });
    });

    renderReconciliation('/reconciliation?view=transactions&date=2026-09-21');

    expect(await screen.findByText('PX-PAGE-1')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Gạo')).toBeVisible();
    expect(within(screen.getByRole('table')).getByText(/1 kg/)).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Phân trang giao dịch kho' })).toHaveTextContent('Phân trang giao dịch kho');
    expect(screen.queryByRole('navigation', { name: 'Phân trang danh sách lô giám sát' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang giao dịch kho' })).toHaveTextContent('Trang 1/2 · 26 kết quả');
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang giao dịch kho' })).getByRole('button', { name: 'Trang sau' }));

    expect(await screen.findByText('PX-PAGE-2')).toBeInTheDocument();
    expect(reads.some(url => url.pathname.endsWith('/transactions-history') && url.searchParams.get('batchId') === MOCK_RECONCILIATION.batchId && url.searchParams.get('pageNumber') === '2' && url.searchParams.get('pageSize') === '25')).toBe(true);
    const historyPager = screen.getByRole('navigation', { name: 'Phân trang giao dịch kho' });
    expect(within(historyPager).getByRole('button', { name: 'Trang trước' })).toBeEnabled();
    expect(within(historyPager).getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await userEvent.click(within(historyPager).getByRole('button', { name: 'Trang trước' }));
    expect(await screen.findByText('PX-PAGE-1')).toBeInTheDocument();
    expect(screen.queryByText('PX-PAGE-2')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang giao dịch kho' })).toHaveTextContent('Trang 1/2 · 26 kết quả');
    expect(reads.filter(url => url.pathname.endsWith('/transactions-history'))).toHaveLength(2);
  });

  it('isolates cached batch reports and ignores a delayed refresh after switching scope', async () => {
    const batchA = MOCK_RECONCILIATION.batchId;
    const batchB = 'report-batch-b';
    const summary = { batchId: batchA, customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 7, createdAt: '2026-10-18T00:00:00Z' };
    vi.mocked(mrxApi.getBatchPage).mockResolvedValue({
      items: [summary, { ...summary, batchId: batchB }],
      totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.mocked(mrxApi.getBatchSummary).mockImplementation(async (batchId) => ({ ...MOCK_RECONCILIATION, batchId }));
    const report = (batchId: string, documentCode: string) => ({
      items: [{ transactionType: 'INITIAL_ISSUE', documentCode, date: '2026-10-19', batchId,
        customerName: 'Draxlmaier', ingredientCode: 'NL-01', ingredientName: 'Gạo', unitName: 'kg', quantity: 1,
        actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
    });
    const history = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async path => {
      const url = new URL(path, 'http://localhost');
      if (!url.pathname.endsWith('/transactions-history')) throw new Error(`Unexpected report read ${path}`);
      const batchId = url.searchParams.get('batchId')!;
      return report(batchId, batchId === batchB ? 'PX-B' : 'PX-A');
    });
    renderReconciliation(`/reconciliation?view=transactions&batchId=${batchA}`);
    expect(await screen.findByText('PX-A')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');
    let resolveBatchB!: (value: ReturnType<typeof report>) => void;
    history.mockImplementationOnce(() => new Promise(resolve => { resolveBatchB = resolve; }));
    await selectReviewBatch(batchB);
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(screen.getByText('PX-A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải Excel Lịch sử kho' })).toBeDisabled();
    await act(async () => { resolveBatchB(report(batchB, 'PX-B')); });
    expect(await screen.findByText('PX-B')).toBeInTheDocument();
    expect(screen.queryByText('PX-A')).not.toBeInTheDocument();
    await selectReviewBatch(batchA);
    expect(await screen.findByText('PX-A')).toBeInTheDocument();
    expect(screen.queryByText('PX-B')).not.toBeInTheDocument();
    expect(history).toHaveBeenCalledTimes(2);

    let resolveRefresh!: (value: ReturnType<typeof report>) => void;
    history.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(3));
    expect(screen.getByText('PX-A')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Tải Excel Lịch sử kho' })).toBeDisabled();
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    await selectReviewBatch(batchB);
    expect(await screen.findByText('PX-B')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải Excel Lịch sử kho' })).toBeEnabled());
    await act(async () => { resolveRefresh(report(batchA, 'PX-A-DELAYED')); });
    expect(screen.queryByText('PX-A-DELAYED')).not.toBeInTheDocument();
    expect(screen.getByText('PX-B')).toBeInTheDocument();

    const retainedTable = screen.getByRole('table');
    const scroller = retainedTable.parentElement!;
    scroller.scrollTop = 40;
    let failRefresh!: (error: Error) => void;
    history.mockImplementationOnce(() => new Promise((_, reject) => { failRefresh = reject; }));
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    expect(retainedTable.closest('.opacity-70')).toBeNull();
    await act(async () => failRefresh(new ApiError(500, 'Lỗi làm mới cùng phạm vi')));
    expect(await screen.findByText('Lỗi làm mới cùng phạm vi')).toBeVisible();
    expect(screen.getByRole('table')).toBe(retainedTable);
    expect(scroller.scrollTop).toBe(40);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.queryByText('Lỗi làm mới cùng phạm vi')).not.toBeInTheDocument());
    expect(screen.getByRole('table')).toBe(retainedTable);

    history.mockRejectedValueOnce(new ApiError(403, 'Không còn quyền đọc báo cáo'));
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    expect(await screen.findByText('Không còn quyền đọc báo cáo')).toBeVisible();
    expect(screen.queryByText('PX-B')).not.toBeInTheDocument();
    let finishRetry!: (value: ReturnType<typeof report>) => void;
    history.mockImplementationOnce(() => new Promise(resolve => { finishRetry = resolve; }));
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(finishRetry).toBeTypeOf('function'));
    expect(screen.queryByText('PX-B')).not.toBeInTheDocument();
    await act(async () => finishRetry(report(batchB, 'PX-B-REAUTHORIZED')));
    expect(await screen.findByText('PX-B-REAUTHORIZED')).toBeVisible();
  });

  it('shows report failures with retry instead of old rows or a successful empty table', async () => {
    const history = vi.spyOn(mrxApi, 'getTransactionsHistory').mockRejectedValueOnce(new ApiError(500, 'Không tải được giao dịch của lô đã chọn.'))
      .mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    renderReconciliation('/reconciliation?view=transactions');
    expect(await screen.findByText('Không tải được giao dịch của lô đã chọn.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Không tải được giao dịch của lô đã chọn.')).not.toBeInTheDocument());
  });

  it('clicking document code in transaction history opens the issue detail modal', async () => {
    vi.spyOn(mrxApi, 'getTransactionsHistory').mockResolvedValue({
      items: [{
        transactionType: 'INITIAL_ISSUE', documentCode: 'ISS-20260912-160015-C97F', date: '2026-09-12',
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier',
        ingredientCode: 'NL-01', ingredientName: 'Ớt xanh huế', unitName: 'Kilogram',
        quantity: 5.13, actorName: 'Thủ kho', createdAt: '2026-09-12T05:00:00Z', reason: null
      }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getIssueById').mockResolvedValue({
      issueId: 'iss-1',
      issueCode: 'ISS-20260912-160015-C97F',
      issueDate: '2026-09-12',
      createdAt: '2026-09-12T05:00:00Z',
      issuedBy: 'warehouse-user-1',
      issuedByName: 'Thủ kho',
      sourceFamily: 'MATERIAL_RECONCILIATION',
      warehouseId: 'warehouse-1',
      warehouseName: 'Kho mẫu IPC',
      provisions: [],
      lines: [
        { issueLineId: 'issue-line-1', ingredientId: 'ing-1', ingredientName: 'Xà lách', unitId: 'unit-1', unitName: 'Kilogram', requestedQty: 140.242, issuedQty: 140.242 }
      ],
    });

    renderReconciliation('/reconciliation?view=transactions');

    const docBtn = await screen.findByTitle('Bấm để xem chi tiết phiếu xuất kho');
    expect(docBtn).toBeInTheDocument();

    await userEvent.click(docBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).toHaveTextContent('ISS-20260912-160015-C97F');
    expect(screen.getByText('Xà lách')).toBeInTheDocument();
  });

  it('resolves customerId UUID on /reconciliation, passes UUID to /weekly-menu?view=mrx-batch, snaps Sunday to batch weekStartDate, renders transaction reason column, and formats disposition modal numbers with Num', async () => {
    vi.setSystemTime(new Date('2026-10-25T08:00:00Z')); // Sunday
    serverStateCache.clearAll();
    workspaceSessionStore.clearScope();
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'ANV', customerName: 'AMANN' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockResolvedValueOnce({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false,
    });

    const { unmount } = render(
      <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
        <MemoryRouter initialEntries={['/reconciliation?customerId=customer-2']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/weekly-menu" element={<WeeklyLocationProbe />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('ANV'));
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');
    expect(screen.queryByRole('group', { name: 'Ngày đối soát' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển đến Chuẩn bị lô đối soát' }));
    expect(await screen.findByTestId('weekly-target')).toHaveTextContent('?view=mrx-batch&customerId=customer-2');
    unmount();

    // Verify mapBatchDtoToSummary falls back from Sunday to weekStartDate and disposition modal formats numbers with Vietnamese commas + 4 presets only
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
    ]);
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION,
      weekStartDate: '2026-10-19',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        requiredQuantity: 10.125,
        issuedQuantity: 10.5,
        issuedRequiredDifference: 0.375,
        status: 'NEEDS_REVIEW',
        triggers: ['ISSUED_REQUIRED'],
        disposition: undefined,
      }],
    });
    vi.spyOn(mrxApi, 'getTransactionsHistory').mockResolvedValue({
      items: [{
        transactionType: 'SUPPLEMENTAL_ISSUE', documentCode: 'ISS-SUPP-01', date: '2026-10-19',
        batchId: MOCK_RECONCILIATION.batchId, customerName: 'Draxlmaier',
        ingredientCode: 'NL-01', ingredientName: 'Thịt đùi heo tươi', unitName: 'Kilogram',
        quantity: 0.375, actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: 'Xuất bù hao hụt sơ chế',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
    });

    const linesView = renderReconciliation('/reconciliation');
    const handleBtn = await screen.findByRole('button', { name: 'Xử lý chênh lệch Thịt đùi heo tươi' });
    await userEvent.click(handleBtn);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('10,125', { exact: true })).toBeVisible();
    expect(within(dialog).getByText('10,5', { exact: true })).toBeVisible();
    expect(within(dialog).getByText('0,375', { exact: true })).toBeVisible();
    expect(within(dialog).queryByText('Tiết kiệm định lượng tại bếp')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }));

    linesView.unmount();
    renderReconciliation('/reconciliation?view=transactions');
    expect(await screen.findByText('Xuất bù hao hụt sơ chế')).toBeVisible();
  });

  it('B2: ReconciliationLineDetailModal renders 6-decimal quantities, Vietnamese status, and opens disposition modal', async () => {
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([
      { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
    ]);
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION,
      weekStartDate: '2026-10-19',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        requiredQuantity: 0.0004,
        issuedQuantity: 0.0009,
        issuedRequiredDifference: 0.0005,
        status: 'NEEDS_REVIEW',
        triggers: ['ISSUED_REQUIRED'],
        disposition: undefined,
      }],
    });

    renderReconciliation('/reconciliation');
    const detailBtn = await screen.findByRole('button', { name: 'Thịt đùi heo tươi' });
    await userEvent.click(detailBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('0,0004', { exact: true })).toBeVisible();
    expect(within(dialog).getByText('0,0009', { exact: true })).toBeVisible();
    expect(within(dialog).getByText('0,0005', { exact: true })).toBeVisible();
    expect(within(dialog).getByText('Cần giải trình')).toBeVisible();

    const disposeBtn = within(dialog).getByRole('button', { name: 'Xử lý chênh lệch' });
    await userEvent.click(disposeBtn);

    const dispositionDialog = await screen.findByRole('dialog');
    expect(within(dispositionDialog).getByText(/Nhu cầu đã khóa:/i)).toBeVisible();
  });

});
