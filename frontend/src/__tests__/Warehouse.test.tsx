import { renderWarehouse } from '../test/renderWarehouse';
import { useState } from 'react';
import { MrxDailyLinesBranch } from '../features/warehouse/branches/MrxDailyLinesBranch';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MrxSupplementalIssueModal } from '../features/warehouse/MrxSupplementalIssueModal';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { AuthProvider } from '../store/authContext';
import { isRouteEligible } from '../routes/navigationEligibility';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { warehouseApi } from '../api/warehouseApi';
import { systemApi } from '../api/systemApi';
import { ApiError } from '../api/client';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import * as apiTransport from '../api/client';
import { ReconciliationIssueDetailModal } from '../components/workbench/ReconciliationIssueDetailModal';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import type { MrxInventoryIssueDetail } from '../api/mrxApi';
import { mrxApi, type MrxWarehouseDaily } from '../api/mrxApi';
import { MOCK_WAREHOUSES, MOCK_ISSUES, MOCK_RECEIPTS } from '../test/fixtures';

describe('Warehouse Feature (FR-WH — Kho nguyên liệu & Nhập xuất)', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-1',
        customerId: 'c-1',
        customerName: 'Khách A',
        customerCode: 'KA',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
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
    vi.spyOn(warehouseApi, 'getWarehouses').mockResolvedValue(MOCK_WAREHOUSES);
    vi.spyOn(warehouseApi, 'getIssues').mockResolvedValue(MOCK_ISSUES);
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue(MOCK_RECEIPTS);
  });

  it('finds unaccented names within a document without dropping hidden quantity and note drafts', async () => {
    const line = {
      batchLineId: '10000000-0000-0000-0000-000000000011', dailyLineId: '10000000-0000-0000-0000-000000000012',
      ingredientId: '10000000-0000-0000-0000-000000000013', canonicalUnitId: '10000000-0000-0000-0000-000000000014',
      ingredientCode: 'NL-GAO', ingredientName: 'Gạo tẻ', canonicalUnitName: 'kg', requiredQuantity: 2,
      quantityStatus: 'UNTOUCHED', issuedQuantity: 0, remainingQuantity: 2,
    };
    function Finder() {
      const [quantities, setQuantities] = useState<Record<string, string>>({ [line.dailyLineId]: '2' });
      const [reasons, setReasons] = useState<Record<string, string>>({});
      return <MrxDailyLinesBranch isWeeklyAll={false} weeklyAggregateLines={[]} lines={[line]} quantities={quantities} setQuantities={setQuantities} reasons={reasons} setReasons={setReasons} hasInitialIssue={false} />;
    }
    render(<Finder />);
    const quantity = screen.getByRole('textbox', { name: 'Số lượng thực xuất Gạo tẻ' });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '1,5');
    await userEvent.type(screen.getByRole('textbox', { name: 'Lý do chênh lệch Gạo tẻ' }), 'Theo phiếu ngày');
    const find = screen.getByRole('searchbox', { name: 'Tìm kiếm nguyên liệu xuất kho' });
    await userEvent.type(find, 'gao te');
    expect(screen.getByText('Gạo tẻ')).toBeVisible();
    await userEvent.clear(find);
    await userEvent.type(find, 'không khớp');
    expect(screen.queryByRole('textbox', { name: 'Số lượng thực xuất Gạo tẻ' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm trong phiếu' }));
    expect(screen.getByRole('textbox', { name: 'Số lượng thực xuất Gạo tẻ' })).toHaveValue('1,5');
    expect(screen.getByRole('textbox', { name: 'Lý do chênh lệch Gạo tẻ' })).toHaveValue('Theo phiếu ngày');
  });

  it('renders Zone 1 WorkspaceHeader without exposing a source-less inventory issue command', async () => {
    renderWarehouse();

    expect(await screen.findByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('dd/MM/yyyy')).not.toBeInTheDocument();
    expect(screen.getByText('Kho đang hoạt động')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo phiếu xuất kho' })).not.toBeInTheDocument();
    expect(screen.getByText(/Phiếu xuất phải bắt đầu từ yêu cầu vật tư đã duyệt/i)).toBeInTheDocument();
  });

  it('does not duplicate route work views as an in-page tablist', async () => {
    renderWarehouse('/warehouse?view=issues');

    await screen.findByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText(/Đang xem: Phiếu xuất kho/i)).toBeInTheDocument();
  });

  it('Tab 1 (Phiếu xuất kho): renders issues table and zero <details> tags', async () => {
    const { container } = renderWarehouse();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã phiếu xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca áp dụng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kho xuất hàng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số mặt hàng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Row item check
    expect(screen.getByText('ISS-20260921-0730')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('Tab 2 (Phiếu nhập kho từ PO): renders receipts table', async () => {
    renderWarehouse('/warehouse?view=receipts');

    expect(await screen.findByRole('columnheader', { name: 'Mã phiếu nhập' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày nhập' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhà cung cấp' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kho tiếp nhận' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số dòng' })).toBeInTheDocument();

    expect(screen.getByText('RCP-PO-20260721-0858')).toBeInTheDocument();
  });

  it('Tab 3 refuses to fabricate current stock from receipt and issue history', async () => {
    renderWarehouse('/warehouse?view=stock');

    expect(await screen.findByText('Chưa có nguồn tồn kho hiện tại')).toBeInTheDocument();
    expect(screen.getByText(/không thể suy ra từ phiếu nhập và phiếu xuất với tồn đầu kỳ bằng 0/i)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Tồn cuối ngày' })).not.toBeInTheDocument();
  });

  it('does not expose the unsupported source-less issue modal', async () => {
    renderWarehouse();

    await screen.findByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận xuất kho' })).not.toBeInTheDocument();
  });

  it('handles error state and provides retry mechanism', async () => {
    vi.spyOn(warehouseApi, 'getIssues').mockRejectedValueOnce(
      new Error('Lỗi máy chủ kho')
    );

    renderWarehouse();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ kho')).toBeInTheDocument();

    // Click retry
    vi.spyOn(warehouseApi, 'getIssues').mockResolvedValueOnce(MOCK_ISSUES);
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValueOnce(MOCK_RECEIPTS);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Kho nguyên liệu & Nhập xuất')).toBeInTheDocument();
  });

  it('renders clean empty state when no issues exist', async () => {
    vi.spyOn(warehouseApi, 'getIssues').mockResolvedValue([]);

    renderWarehouse('/warehouse?view=issues');

    expect(await screen.findByText('Chưa có phiếu xuất kho')).toBeInTheDocument();
    expect(screen.getByText('Không có phiếu xuất kho nào phù hợp với bộ lọc.')).toBeInTheDocument();
  });

  it('shows the latest source revision actor for the selected MRX day', async () => {
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 4, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: 'DAILY_LINEAGE_READY' },
      dates: [{
        serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true,
        requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2,
        lastRevisionAt: '2026-10-31T01:30:00Z', lastRevisionByName: 'Nguyễn Quản Lý', lastRevisionByRole: 'MANAGER',
        lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');

    expect(await screen.findByText('Định lượng đã được điều chỉnh')).toBeInTheDocument();
    expect(screen.getByText('Lúc 08:30 31/10/2026 bởi Nguyễn Quản Lý (MANAGER).')).toBeInTheDocument();
  });

  it.each([
    { kind: 'initial', failure: 'network' }, { kind: 'supplemental', failure: 'network' },
    { kind: 'supplemental', failure: '502' }, { kind: 'supplemental', failure: '503' },
    { kind: 'initial', failure: '502' }, { kind: 'initial', failure: 'missing-receipt' },
    { kind: 'supplemental', failure: 'missing-receipt' },
  ] as const)('never offers stale lô A lines and fences $kind/$failure across a newer daily read', async ({ kind, failure }) => {
    const line = { dailyLineId: 'dl-a', batchLineId: 'bl-a', ingredientId: 'i-a', ingredientName: 'Gạo A', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false };
    const dailyA: MrxWarehouseDaily = { batchId: 'batch-a', batchStatus: 'TRANSFERRED', sourceVersion: 3, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true }, dates: [{ serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true, requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, lines: [line] }] };
    const dailyB: MrxWarehouseDaily = { ...dailyA, batchId: 'batch-b', sourceVersion: 7, dates: [{ ...dailyA.dates[0], lines: [{ ...line, dailyLineId: 'dl-b', batchLineId: 'bl-b', ingredientName: 'Gạo B', issuedQuantity: kind === 'supplemental' ? 1 : 0 }] }] };
    serverStateCache.set('snapshot:mrx_daily', { data: { daily: dailyA, history: null } });
    let resolveB!: (value: MrxWarehouseDaily) => void;
    const firstRead = new Promise<MrxWarehouseDaily>(resolve => { resolveB = resolve; });
    let refreshedDaily: MrxWarehouseDaily | null = null;
    let rejectWrite!: (error: Error) => void;
    let resolveWrite!: (receipt: Awaited<ReturnType<typeof mrxApi.createIssue>>) => void;
    const write = new Promise<Awaited<ReturnType<typeof mrxApi.createIssue>>>((resolve, reject) => { rejectWrite = reject; resolveWrite = resolve; });
    const transport = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (endpoint === '/reconciliation/batches/batch-b/warehouse-daily') return refreshedDaily ?? firstRead;
      if (endpoint.startsWith('/reconciliation/batches?')) return { items: ['a', 'b'].map(id => ({ batchId: `batch-${id}`, customerId: `c-${id}`, customerCode: id, customerName: id, weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'TRANSFERRED', version: 1, createdAt: '2026-10-19T00:00:00Z' })), totalCount: 2, totalPages: 1, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 50 };
      if (endpoint.startsWith('/inventory-issues?')) return { items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 25 };
      if (endpoint === '/reconciliation/batches/batch-b/dishes') return [];
      if (endpoint === '/inventory-issues') return write;
      throw new Error(`Unexpected daily issue request ${endpoint}`);
    });
    const writes = () => transport.mock.calls.filter(([path]) => path === '/inventory-issues');
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-b&date=2026-10-19');
    expect(screen.queryByRole('textbox', { name: 'Số lượng thực xuất Gạo A' })).not.toBeInTheDocument();
    await act(async () => resolveB(dailyB));
    await screen.findByText('Gạo B');
    if (kind === 'initial') {
      await userEvent.click(screen.getByRole('button', { name: 'Điền đủ toàn bộ' }));
      await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));
    } else {
      await userEvent.click(screen.getByRole('button', { name: 'Xuất bổ sung ca' }));
      const extra = screen.getByRole('spinbutton', { name: 'Số lượng xuất thêm' });
      await userEvent.type(extra, '0.0000004');
      await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' }), 'Bổ sung suất ăn');
      expect(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' })).toBeDisabled();
      await userEvent.clear(extra);
      await userEvent.type(extra, '1.0000005');
      await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' }));
      expect(screen.getByRole('combobox', { name: 'Chọn nguyên liệu bổ sung' })).toBeDisabled();
      expect(screen.getByRole('spinbutton', { name: 'Số lượng xuất thêm' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Phát sinh suất ăn đột xuất' })).toBeDisabled();
    }
    expect(writes()).toHaveLength(1);
    expect(writes()[0][1]?.method).toBe('POST');
    expect(JSON.parse(writes()[0][1]?.body as string)).toEqual(expect.objectContaining({ reconciliationBatchId: 'batch-b', expectedVersion: 7, issueDate: '2026-10-19', isSupplemental: kind === 'supplemental', lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'dl-b', issuedQty: kind === 'supplemental' ? 1.000001 : 2 })] }));
    expect(screen.getByLabelText('Chọn lô đối soát xuất kho')).toBeDisabled();
    expect(screen.getByLabelText('Ngày xuất kho')).toBeDisabled();
    expect(screen.getByText(/Cả tuần/).closest('button')).toBeDisabled();
    await act(async () => {
      if (failure === 'missing-receipt') resolveWrite({ issueId: '', issueCode: '', concurrencyVersion: 1, provisions: [] });
      else rejectWrite(failure === 'network' ? new TypeError('Failed to fetch') : new ApiError(Number(failure), 'Response lost'));
    });
    await screen.findByText('Chưa xác nhận được kết quả xuất kho');
    refreshedDaily = { ...dailyB, sourceVersion: 8 };
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(transport.mock.calls.filter(([path]) => path.endsWith('/warehouse-daily'))).toHaveLength(2));
    expect(screen.getByLabelText('Chọn lô đối soát xuất kho')).toBeDisabled();
    const retry = screen.getByRole('button', { name: kind === 'initial' ? 'Xác nhận xuất kho' : 'Xác nhận xuất bổ sung' });
    expect(retry).toBeDisabled();
    if (kind === 'initial') {
      expect(screen.getByRole('textbox', { name: 'Số lượng thực xuất Gạo B' })).toHaveValue('2');
    } else {
      const suppSelect = screen.getByRole('combobox', { name: 'Chọn nguyên liệu bổ sung' });
      const suppQty = screen.getByRole('spinbutton', { name: 'Số lượng xuất thêm' });
      const suppReasonInput = screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' });
      const presetBtn = screen.getByRole('button', { name: 'Phát sinh suất ăn đột xuất' });
      expect(suppSelect).toBeDisabled();
      expect(suppQty).toBeDisabled();
      expect(suppReasonInput).toBeDisabled();
      expect(presetBtn).toBeDisabled();
      await userEvent.click(presetBtn);
      expect(suppQty).toHaveValue(1.0000005);
      expect(suppReasonInput).toHaveValue('Bổ sung suất ăn');
    }
    await userEvent.click(retry);
    expect(writes()).toHaveLength(1);
  });

  it('shows catalog failure with a real retry and keeps an explicitly selected batch outside the first list page', async () => {
    const recent = { batchId: 'recent', customerId: 'c-1', customerCode: 'NEW', customerName: 'Mới', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'TRANSFERRED', version: 1, createdAt: '2026-10-19T00:00:00Z' };
    const catalog = vi.spyOn(mrxApi, 'getBatchPage').mockRejectedValueOnce(new Error('Không tải được danh sách lô'))
      .mockResolvedValueOnce({ items: [recent], totalCount: 51, totalPages: 2, hasNext: true, hasPrev: false, pageNumber: 1, pageSize: 50 })
      .mockResolvedValue({ items: [{ ...recent, batchId: 'older', customerCode: 'OLD', customerName: 'Cũ' }], totalCount: 51, totalPages: 2, hasNext: false, hasPrev: true, pageNumber: 2, pageSize: 50 });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({ batchId: 'older', batchStatus: 'TRANSFERRED', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true }, dates: [] });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 25 });
    renderWarehouse('/warehouse?view=mrx-daily&batchId=older&date=2026-10-19');
    expect(await screen.findByText('Không tải được danh sách lô')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách lô' }));
    await waitFor(() => expect(catalog).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('older');
    expect(mrxApi.getWarehouseDaily).not.toHaveBeenCalledWith('recent');
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang danh sách lô xuất kho' })).getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByRole('option', { name: /OLD - Cũ/ })).toBeInTheDocument();
    expect(catalog).toHaveBeenLastCalledWith({ pageSize: 50, pageNumber: 2 });
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('older');
  });

  it('does not display another customer’s cached daily batch when the MRX customer has no batch', async () => {
    serverStateCache.clearAll();
    workspaceSessionStore.clearScope();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1,
      updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    workspaceSessionStore.setScope({ customerId: 'c-2', customerCode: 'ANV', weekStartDate: '2026-11-02', batchId: '' });
    serverStateCache.set('snapshot:mrx_daily', { activeBatchId: 'batch-1', activeDate: '2026-10-19' });
    const read = vi.spyOn(mrxApi, 'getWarehouseDaily');
    renderWarehouse('/warehouse?view=mrx-daily');
    await waitFor(() => expect(mrxApi.getBatchPage).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('');
    expect(read).not.toHaveBeenCalledWith('batch-1');
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'c-2', batchId: '' });
  });

  it('keeps a generic daily read conflict distinct from legacy and retries the actual read', async () => {
    const read = vi.spyOn(mrxApi, 'getWarehouseDaily').mockRejectedValueOnce(new ApiError(409, 'Nguồn đã đổi, hãy tải lại')).mockResolvedValue({ batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 2, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true }, dates: [] });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 25 });
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    expect(await screen.findByText('Nguồn đã đổi, hãy tải lại')).toBeInTheDocument();
    expect(screen.queryByText('Lô đối soát chưa có phân rã định lượng theo ngày')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  });

  it.each([true, false])('keeps explicit out-of-scope dates empty but resolves an unrelated remembered day to the selected batch (explicit=$0)', async (explicit) => {
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({ batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 2, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true }, dates: [{ serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true, requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, lines: [{ dailyLineId: 'dl-1', batchLineId: 'bl-1', ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }] }] });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, pageNumber: 1, pageSize: 25 });
    workspaceSessionStore.setScope({ batchId: 'other-batch', serviceDate: '2026-10-25' });
    renderWarehouse(`/warehouse?view=mrx-daily&batchId=batch-1${explicit ? '&date=2026-10-25' : ''}`);
    if (explicit) {
      await screen.findByText('Không có định lượng cần xuất cho ngày đã chọn');
      expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('25/10/2026');
      expect(screen.queryByRole('button', { name: 'Xác nhận xuất kho' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Xem cả tuần của lô' }));
      expect(await screen.findByText('Gạo')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Cả tuần (Tổng hợp)' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: 'Xác nhận xuất kho' })).not.toBeInTheDocument();
    } else {
      expect(await screen.findByText('Gạo')).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('19/10/2026');
      expect(screen.getByRole('button', { name: /^T2\s*\(19\/10\)$/ })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('pages the full daily issue history and uses the server total rather than the visible row count', async () => {
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({ batchId: 'batch-1', batchStatus: 'IN_PROGRESS', sourceVersion: 2, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true }, dates: [] });
    const issue = { issueId: 'issue-1', issueCode: 'PX-NEW', issueDate: '2026-10-19', issuedBy: 'user-1', issuedByName: 'Thủ kho', sourceFamily: 'MATERIAL_RECONCILIATION', warehouseId: 'warehouse-1', createdAt: '2026-10-19T05:00:00Z', provisions: [], lines: [] };
    const history = vi.spyOn(mrxApi, 'getIssues').mockImplementation(async (_batch, page = 1) => ({ items: [{ ...issue, issueId: `issue-${page}`, issueCode: page === 1 ? 'PX-NEW' : 'PX-OLD' }], totalCount: 26, totalPages: 2, hasNext: page === 1, hasPrev: page === 2, pageNumber: page, pageSize: 25 }));
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    await userEvent.click(await screen.findByRole('button', { name: 'Lịch sử phiếu (26)' }));
    expect(await screen.findByText('PX-NEW')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang phiếu xuất MRX' })).getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('PX-OLD')).toBeInTheDocument();
    expect(screen.queryByText('PX-NEW')).not.toBeInTheDocument();
    expect(history).toHaveBeenLastCalledWith('batch-1', 2, 25);
  });

  it('MRX daily workbench confirms one exact-date initial issue through the canonical issue command', async () => {
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 3, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: 'DAILY_LINEAGE_READY' },
      dates: [{
        serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true,
        requiredQuantity: 79.773, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 79.773,
        lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 79.773, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 79.773, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }]
      }]
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    const createIssue = vi.spyOn(mrxApi, 'createIssue').mockResolvedValue({
      issueId: 'issue-1', issueCode: 'PX-001', concurrencyVersion: 4,
      provisions: [],
    });
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');

    expect(screen.getByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeInTheDocument();
    expect(await screen.findByText('Gạo')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '79,773 kg' })).toBeVisible();
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('button', { name: 'Chuẩn bị phối hợp' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chuẩn bị phối hợp' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Xác nhận xuất kho' })).toBeInTheDocument();
    const quantity = screen.getByRole('textbox', { name: 'Số lượng thực xuất Gạo' });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '1,5');
    const issueDate = screen.getByRole('textbox', { name: 'Ngày xuất kho' });
    await userEvent.clear(issueDate);
    await userEvent.type(issueDate, '20/10/2026');
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày phải thuộc lô đối soát đang chọn');
    expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeDisabled();
    expect(createIssue).not.toHaveBeenCalled();
    expect(quantity).toHaveValue('1,5');
    await userEvent.clear(issueDate);
    await userEvent.type(issueDate, '19/10/2026');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));

    expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationBatchId: 'batch-1', issueDate: '2026-10-19', expectedVersion: 3,
      lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'daily-1', requestedQty: 79.773, issuedQty: 1.5 })]
    }));
    await waitFor(() => {
      expect(mrxApi.getWarehouseDaily).toHaveBeenCalledTimes(2);
      expect(mrxApi.getIssues).toHaveBeenCalledTimes(2);
    });
    const notice = screen.getAllByRole('status').find(element => element.textContent?.includes('Xuất kho thành công.'))!;
    expect(within(notice).queryByRole('list', { hidden: true })).not.toBeInTheDocument();
    expect(within(notice).getByText('Xuất kho thành công.')).toBeVisible();
  });

  it.each([
    { kind: 'concurrency conflict', failure: new ApiError(409, 'Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.'), uncertain: false },
    { kind: 'lost response', failure: new TypeError('Failed to fetch'), uncertain: true },
  ])('MRX daily workbench recovers safely after $kind', async ({ failure, uncertain }) => {
    const staleDaily = {
      batchId: 'batch-1', batchStatus: 'IN_PROGRESS', sourceVersion: 3, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: 'DAILY_LINEAGE_READY' },
      dates: [{
        serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true,
        requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2,
        lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
      }],
    };
    const getDaily = vi.spyOn(mrxApi, 'getWarehouseDaily')
      .mockResolvedValueOnce(staleDaily)
      .mockResolvedValue({ ...staleDaily, sourceVersion: 4 });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    vi.spyOn(mrxApi, 'createIssue').mockRejectedValue(failure);

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    await screen.findByText('Gạo');
    await userEvent.click(screen.getByRole('button', { name: 'Điền đủ toàn bộ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));

    const alert = await screen.findByRole('alert');
    if (uncertain) {
      expect(within(alert).getByText('Chưa xác nhận được kết quả xuất kho')).toBeVisible();
      expect(within(alert).getByRole('button', { name: 'Tải lại để kiểm tra kết quả' })).toBeEnabled();
      expect(within(alert).queryByRole('button', { name: 'Đóng thông báo' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Số lượng thực xuất Gạo' })).toHaveValue('2');
      expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
      return;
    }
    expect(within(alert).getByText('Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await userEvent.click(within(alert).getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
    await waitFor(() => expect(getDaily).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('v4')).toBeInTheDocument();
  });

  it('reads legacy source deltas without offering new stock commands and pages current applied history', async () => {
    const delta = { sourceDeltaId: 'delta-1', sourceRevisionId: 'revision-1', batchId: 'batch-1', dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', previousRequiredQuantity: 2, newRequiredQuantity: 2.5, deltaQuantity: 0.5, workKind: 'SUPPLEMENTAL_ISSUE', status: 'PENDING', version: 1, createdAt: '2026-10-20T06:00:00Z' };
    const read = vi.spyOn(mrxApi, 'getSourceDeltas').mockImplementation(async (page = 1) => ({
      items: page === 1 ? [delta, { ...delta, sourceDeltaId: 'delta-2', workKind: 'RETURN_REQUIRED', deltaQuantity: -0.75, newRequiredQuantity: 1.25 }]
        : [{ ...delta, sourceDeltaId: 'delta-3', workKind: 'SOURCE_CHANGE', status: 'APPLIED', ingredientName: 'Cá' }],
      totalCount: 26, pageNumber: page, pageSize: 25, totalPages: 2, hasPrev: page === 2, hasNext: page === 1,
    }));
    const issue = vi.spyOn(mrxApi, 'createIssue');
    const createReturn = vi.spyOn(mrxApi, 'createReturn');
    const confirm = vi.spyOn(mrxApi, 'confirmReturn');
    renderWarehouse('/warehouse?view=mrx-issues');
    expect(await screen.findByText('Yêu cầu xuất bổ sung cũ')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu hoàn trả cũ')).toBeInTheDocument();
    expect(screen.queryByText('SUPPLEMENTAL_ISSUE')).not.toBeInTheDocument();
    expect(screen.queryByText('RETURN_REQUIRED')).not.toBeInTheDocument();
    expect(screen.getByText(/Chỉ đọc/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xử lý|Xác nhận/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('Cá')).toBeInTheDocument();
    expect(screen.getByText('Đã áp dụng')).toBeInTheDocument();
    expect(screen.getByText('Thay đổi định lượng nguồn')).toBeInTheDocument();
    expect(screen.queryByText('SOURCE_CHANGE')).not.toBeInTheDocument();
    expect(read).toHaveBeenLastCalledWith(2, 25, 'ALL');
    expect(issue).not.toHaveBeenCalled();
    expect(createReturn).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('applies customer, service date and batch filters to source history before paging', async () => {
    const read = vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasNext: false, hasPrev: false });
    renderWarehouse('/warehouse?view=mrx-issues');
    await screen.findByText('Chưa có lịch sử thay đổi nguồn');
    expect(screen.queryByRole('columnheader', { name: 'Nhu cầu trước' })).not.toBeInTheDocument();
    expect(screen.queryByText(/dữ liệu tương thích cũ/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Mã khách hàng lịch sử nguồn' }), 'ANV');
    await userEvent.type(screen.getByRole('textbox', { name: 'Mã lô lịch sử nguồn' }), '3b8905a4-53c6-477a-8ec4-43ac10f9b5eb');
    await userEvent.type(screen.getByLabelText('Ngày phục vụ lịch sử nguồn'), '23/11/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Lọc lịch sử nguồn' }));
    await waitFor(() => expect(read).toHaveBeenLastCalledWith(1, 25, 'ALL', { customerCode: 'ANV', batchId: '3b8905a4-53c6-477a-8ec4-43ac10f9b5eb', serviceDate: '2026-11-23' }));
  });

  it('inherits shared source-history scope and gives explicit URL batch precedence', async () => {
    workspaceSessionStore.setScope({ customerId: 'c-1', customerCode: 'ANV', batchId: 'shared-batch', serviceDate: '2024-11-18' });
    const read = vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasNext: false, hasPrev: false });
    const view = renderWarehouse('/warehouse?view=mrx-issues');
    await waitFor(() => expect(read).toHaveBeenCalledWith(1, 25, 'ALL', { customerCode: 'ANV', batchId: 'shared-batch', serviceDate: '2024-11-18' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }));
    await waitFor(() => expect(read).toHaveBeenLastCalledWith(1, 25, 'ALL'));
    view.unmount();
    renderWarehouse('/warehouse?view=mrx-issues&batchId=url-batch&date=2023-11-20');
    await waitFor(() => expect(read).toHaveBeenLastCalledWith(1, 25, 'ALL', { customerCode: '', batchId: 'url-batch', serviceDate: '2023-11-20' }));
    expect(screen.getByRole('textbox', { name: 'Mã lô lịch sử nguồn' })).toHaveValue('url-batch');
  });

  it('retains a source-history read error and retries without showing an empty success', async () => {
    const read = vi.spyOn(mrxApi, 'getSourceDeltas').mockRejectedValueOnce(new Error('Không tải được lịch sử nguồn')).mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasNext: false, hasPrev: false });
    renderWarehouse('/warehouse?view=mrx-issues');
    expect(await screen.findByText('Không tải được lịch sử nguồn')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có lịch sử thay đổi nguồn')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có lịch sử thay đổi nguồn')).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('preparation is read/export only, including already-issued batches, and retains API error/retry', async () => {
    const preparation = {
      serviceDate: '2026-06-15',
      batches: [
        { batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'IN_PROGRESS', batchVersion: 4, isApplicable: true, hasExistingIssue: true, requiredQuantity: 5, issuedQuantity: 5, remainingQuantity: 0 },
        { batchId: 'b-2', customerId: 'c-2', customerName: 'Khách B', batchStatus: 'TRANSFERRED', batchVersion: 1, isApplicable: true, hasExistingIssue: false, requiredQuantity: 2, issuedQuantity: 0, remainingQuantity: 2 },
      ],
      aggregatedLines: [{ ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 7, totalIssuedQuantity: 5, totalRemainingQuantity: 2,
        allocations: [
          { batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, issuedQuantity: 5, remainingQuantity: 0, status: 'EXACT' },
          { batchId: 'b-2', batchLineId: 'bl-2', dailyLineId: 'dl-2', customerId: 'c-2', customerName: 'Khách B', requiredQuantity: 2, issuedQuantity: 0, remainingQuantity: 2, status: 'UNTOUCHED' },
        ] }],
    };
    const read = vi.spyOn(mrxApi, 'getPreparation').mockRejectedValueOnce(new ApiError(500, 'Không tải được chuẩn bị tuần')).mockResolvedValue(preparation);
    const issue = vi.spyOn(mrxApi, 'issueCoordinated');
    renderWarehouse('/warehouse?view=mrx-preparation&date=2026-06-17');
    expect(await screen.findByText('Không tải được chuẩn bị tuần')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Xác nhận xuất/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Gạo')).toBeVisible();
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Nguyên liệu', 'Cần chuẩn bị', 'Khách A', 'Khách B']);
    const row = screen.getByRole('row', { name: /Gạo/ });
    expect(within(row).getAllByRole('cell').map(cell => cell.textContent?.trim())).toEqual(['Gạo', '7 kg', '5 kg', '2 kg']);
    expect(screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /Khách hàng:/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Khách B/ }));
    expect(screen.getByRole('checkbox', { name: /Khách A/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Khách A/ })).toBeChecked();
    await userEvent.keyboard('{Escape}');
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Nguyên liệu', 'Cần chuẩn bị']);
    expect(within(screen.getByRole('row', { name: /Gạo/ })).getAllByRole('cell').map(cell => cell.textContent?.trim())).toEqual(['Gạo', '5 kg']);
    expect(screen.queryByRole('button', { name: /Xuất kho|Xác nhận xuất|Trạm xuất/ })).not.toBeInTheDocument();
    expect(read).toHaveBeenLastCalledWith('2026-06-15', undefined, true, expect.any(AbortSignal));
    expect(screen.queryByRole('button', { name: /^CN/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /T7.*20\/06/ }));
    await waitFor(() => expect(read).toHaveBeenLastCalledWith('2026-06-20', undefined, false, expect.any(AbortSignal)));
    expect(issue).not.toHaveBeenCalled();
  });

  it('MRX preparation retains selected export scope and reports download denial without an unauthenticated fallback', async () => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    const preparation = {
      serviceDate: '2026-06-15',
      batches: [{ batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 }],
      aggregatedLines: [{ ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 5, totalIssuedQuantity: 0, totalRemainingQuantity: 5, allocations: [{ batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, remainingQuantity: 5, status: 'UNTOUCHED' }] }]
    };
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-06-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (endpoint === '/reconciliation/preparation?weekStartDate=2026-06-15' || endpoint === '/reconciliation/preparation?serviceDate=2026-06-15') return preparation;
      throw new Error(`Unexpected preparation find request ${endpoint}`);
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));

    renderWarehouse('/warehouse?view=mrx-preparation&date=2026-06-15');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị nguyên liệu đa khách hàng' })).toBeInTheDocument();
    const customerTrigger = screen.getByRole('button', { name: /Khách hàng/ });
    await userEvent.click(customerTrigger);
    const customerSearch = screen.getByRole('searchbox', { name: 'Tìm khách hàng hoặc mã' });
    await userEvent.type(customerSearch, 'không khớp');
    expect(screen.queryByRole('checkbox', { name: /Khách A/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    await userEvent.clear(customerSearch);
    const selection = screen.getByRole('checkbox', { name: /Khách A/ });
    await userEvent.click(selection);
    await userEvent.keyboard('{Escape}');
    expect(customerTrigger).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeDisabled();
    expect(screen.getByRole('searchbox', { name: 'Tìm nguyên liệu chuẩn bị' })).toBeVisible();
    expect(screen.getByText('Chọn ít nhất một lô để xem nguyên liệu cần chuẩn bị.')).toBeVisible();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/preparation/export-workbook'))).toBe(false);
    await userEvent.click(customerTrigger);
    await userEvent.click(screen.getByRole('checkbox', { name: /Khách A/ }));
    await userEvent.keyboard('{Escape}');
    const exportBtn = screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' });
    const wholeWeek = screen.getByRole('button', { name: 'Cả tuần (Tổng hợp)' });
    expect(wholeWeek).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox', { name: 'Phạm vi xuất' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Nội dung Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Nhà cung cấp/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.getByText('Gạo')).toBeVisible();
    const find = screen.getByRole('searchbox', { name: 'Tìm nguyên liệu chuẩn bị' });
    const reads = vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path.startsWith('/reconciliation/preparation?')).length;
    await userEvent.type(find, 'không khớp');
    expect(screen.queryByText('Gạo')).not.toBeInTheDocument();
    expect(exportBtn).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Xác nhận xuất/ })).not.toBeInTheDocument();

    await userEvent.click(exportBtn);

    expect(await screen.findByText(/Không thể tải tệp \(HTTP 403\)/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/reconciliation\/preparation\/export-workbook\?.*weekStartDate=2026-06-15.*batchIds=b-1/),
      expect.anything()
    );
    const exportRequest = fetch.mock.calls.find(([url]) => String(url).includes('/preparation/export-workbook'))!;
    expect(new URL(String(exportRequest[0]), 'http://localhost').searchParams.get('includeMenus')).toBe('true');
    expect(new URL(String(exportRequest[0]), 'http://localhost').searchParams.get('isSupplemental')).toBe('false');
    expect(new URL(String(exportRequest[0]), 'http://localhost').searchParams.has('search')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getByText('Gạo')).toBeVisible();
    expect(vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path.startsWith('/reconciliation/preparation?'))).toHaveLength(reads);
    await userEvent.click(screen.getByRole('button', { name: /T2.*15\/06/ }));
    await waitFor(() => expect(exportBtn).toBeEnabled());
    await userEvent.click(exportBtn);
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('export-workbook?serviceDate=2026-06-15') && String(url).includes('includeMenus=true'))).toBe(true));
    expect(screen.getByRole('button', { name: /T2.*15\/06/ })).toHaveAttribute('aria-pressed', 'true');
    expect(apiTransport.apiClient).toHaveBeenCalledWith('/reconciliation/preparation?serviceDate=2026-06-15', { signal: expect.any(AbortSignal) });
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Xác nhận xuất/ })).not.toBeInTheDocument();
  });

  it('renders clean empty state when no receipts exist', async () => {
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue([]);

    renderWarehouse('/warehouse?view=receipts');

    expect(await screen.findByText('Chưa có phiếu nhập kho')).toBeInTheDocument();
    expect(screen.getByText('Không có phiếu nhập kho nào phù hợp với bộ lọc.')).toBeInTheDocument();
  });

  it('MRX preparation normalizes dates to Monday and only changes weekly scope when another week is selected', async () => {
    workspaceSessionStore.setScope({ serviceDate: '2026-10-22' });
    const getPrep = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      const url = new URL(endpoint, 'http://localhost');
      if (url.pathname !== '/reconciliation/preparation') throw new Error(`Unexpected preparation read: ${endpoint}`);
      const date = url.searchParams.get('weekStartDate');
      expect(['2026-10-19', '2026-10-26']).toContain(date);
      return {
      serviceDate: date,
      batches: [{ batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 }],
      aggregatedLines: [{ ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 5, totalIssuedQuantity: 0, totalRemainingQuantity: 5, allocations: [{ batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, remainingQuantity: 5, status: 'UNTOUCHED' }] }]
    }; });

    renderWarehouse('/warehouse?view=mrx-preparation&date=ALL');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị nguyên liệu đa khách hàng' })).toBeInTheDocument();
    const dateInput = screen.getByRole('textbox', { name: 'Tuần chuẩn bị' });
    expect(dateInput).toBeInTheDocument();

    await waitFor(() => expect(getPrep).toHaveBeenCalledWith('/reconciliation/preparation?weekStartDate=2026-10-19', { signal: expect.any(AbortSignal) }));
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '27/10/2026');
    await userEvent.keyboard('{Enter}');

    expect(getPrep).toHaveBeenCalledWith('/reconciliation/preparation?weekStartDate=2026-10-26', { signal: expect.any(AbortSignal) });
  });

  it('renders MrxDailyIssueWorkbench with batch selector and does not block on empty when accessed without URL params', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-transferred-1',
        customerId: 'c-1',
        customerName: 'Khách A',
        customerCode: 'KA',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'TRANSFERRED',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-transferred-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 1,
      weeklyStatus: 'WEEK_UNTOUCHED',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-10-19',
        status: 'UNTOUCHED',
        isApplicable: true,
        requiredQuantity: 10,
        issuedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 10,
        lines: [{
          dailyLineId: 'dl-1',
          batchLineId: 'bl-1',
          ingredientId: 'i-1',
          ingredientName: 'Thịt bò',
          canonicalUnitId: 'u-1',
          canonicalUnitName: 'kg',
          requiredQuantity: 10,
          issuedQuantity: 0,
          returnedQuantity: 0,
          remainingQuantity: 10,
          quantityStatus: 'UNTOUCHED',
          hasValidDisposition: false,
        }],
      }],
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

    renderWarehouse('/warehouse?view=mrx-daily');

    expect(await screen.findByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('banner')).getByText('Đang đối chiếu')).toBeInTheDocument());
    expect(screen.queryByText('Thiếu định danh lô hoặc ngày phục vụ')).not.toBeInTheDocument();
  });

  it('keeps Warehouse legacy recovery inside its permitted station', async () => {
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'warehouse-1', username: 'warehouse', fullName: 'Thủ kho', roleCode: 'WarehouseStaff', roleName: 'Thủ kho',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.warehouse.read'],
    }));
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'legacy-batch', customerId: 'c-1', customerName: 'Khách A', customerCode: 'KA',
        weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'TRANSFERRED', version: 1, createdAt: '2026-10-19T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockRejectedValue(new ApiError(409, 'LEGACY_DAILY_LINEAGE_MISSING'));
    renderWarehouse('/warehouse?view=mrx-daily&batchId=legacy-batch');
    expect(await screen.findByRole('heading', { name: 'Lô đối soát chưa có phân rã định lượng theo ngày' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem màn hình Điều phối lô' })).not.toBeInTheDocument();
    expect(screen.getByText(/Chọn lô khác để xuất kho/)).toBeInTheDocument();
  });

  it.each([
    { rate: 0.1, expected: 1, display: '1', unmapped: false, servings: '10' },
    { rate: 0.0000004, expected: 0.0004, display: '0,0004', unmapped: false, servings: '1000' },
    { rate: 0.000123, expected: 0.000123, display: '0,000123', unmapped: false, servings: '1' },
    { rate: 0.0000005, expected: 0.000001, display: '0,000001', unmapped: false, servings: '1' },
    { rate: null, expected: 0, display: '—', unmapped: false, servings: '1' },
    { rate: 0.000123, expected: 0.000123, display: '0,000123', unmapped: true, servings: '1' },
  ])('supplemental by-dish preserves six decimals and rejects incomplete packages ($rate/$unmapped)', async ({ rate, expected, display, unmapped, servings }) => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-in-progress-1',
        customerId: 'c-1',
        customerName: 'Khách A',
        customerCode: 'KA',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 2,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-in-progress-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 2,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-10-19',
        status: 'COMPLETE',
        isApplicable: true,
        requiredQuantity: 10,
        issuedQuantity: 10,
        returnedQuantity: 0,
        remainingQuantity: 0,
        lines: [{
          dailyLineId: 'dl-1',
          batchLineId: 'bl-1',
          ingredientId: 'i-1',
          ingredientName: 'Thịt bò',
          canonicalUnitId: 'u-1',
          canonicalUnitName: 'kg',
          requiredQuantity: 10,
          issuedQuantity: 10,
          returnedQuantity: 0,
          remainingQuantity: 0,
          quantityStatus: 'EXACT',
          hasValidDisposition: false,
        }],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [{
        issueId: 'iss-1',
        issueCode: 'PX-001',
        issueDate: '2026-10-19',
        warehouseId: 'wh-1',
        sourceFamily: 'MATERIAL_RECONCILIATION',
        issuedBy: 'user-1',
        createdAt: '2026-10-19T00:00:00Z',
        provisions: [],
        lines: [{
          issueLineId: 'il-1',
          ingredientId: 'i-1',
          unitId: 'u-1',
          reconciliationBatchDailyLineId: 'dl-1',
          requestedQty: 10,
          issuedQty: 10,
        }],
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    const createIssue = vi.spyOn(apiTransport, 'apiClient').mockImplementation(async endpoint => {
      if (endpoint === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (endpoint !== '/inventory-issues') throw new Error(`Unexpected dish issue request ${endpoint}`);
      return { issueId: 'iss-supp-1', issueCode: 'PX-SUPP-001', concurrencyVersion: 1, provisions: [] };
    });

    const material = { batchLineId: 'bl-1', dailyLineId: 'dl-1', serviceDate: '2026-10-19', ingredientId: 'i-1',
      ingredientName: 'Thịt bò', ingredientCode: 'BO', canonicalUnitId: 'u-1', canonicalUnitName: 'kg',
      grossQtyPerServing: (rate ?? 0.1) * 1000, canonicalQtyPerServing: rate,
      quantityUnavailableReasonCode: rate === null ? 'FROZEN_UNIT_CONVERSION_MISSING' : null };
    vi.spyOn(mrxApi, 'getBatchDishes').mockResolvedValue([
      { dishId: 'dish-other-day', dishCode: 'MON-T3', dishName: 'Chả lá lốt', materials: [{ ...material, serviceDate: '2026-10-20', dailyLineId: 'dl-tue' }] },
      { dishId: 'dish-1', dishCode: 'MON-1', dishName: 'Bò kho',
        materials: unmapped ? [material, { ...material, dailyLineId: 'missing-line', ingredientName: 'Gia vị' }] : [material] },
    ]);
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-in-progress-1&date=2026-10-19');
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất bổ sung ca' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tính theo món ăn & suất phát sinh' }));
    await screen.findByRole('option', { name: 'Bò kho (MON-1)' });
    expect(screen.queryByRole('option', { name: 'Chả lá lốt (MON-T3)' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Số suất phát sinh' }), servings);
    const packageButton = screen.getByRole('button', { name: /Xuất trọn gói cả món/ });
    if (!unmapped && rate !== null) expect(within(screen.getByRole('dialog')).getAllByText(display, { exact: true })[0]).toBeVisible();
    if (!unmapped && rate === 0.0000004) {
      expect(within(screen.getByRole('dialog')).getByText('0,0000004', { exact: true })).toBeVisible();
      expect(within(screen.getByRole('dialog')).queryByText(/4e-7/i)).not.toBeInTheDocument();
    }
    if (unmapped || rate === null) {
      expect(packageButton).toBeDisabled();
      expect(screen.getByText(/Không thể xuất trọn gói/)).toBeInTheDocument();
      expect(createIssue.mock.calls.filter(([path]) => path === '/inventory-issues')).toHaveLength(0);
    } else {
      await userEvent.click(packageButton);
      expect(createIssue).toHaveBeenCalledWith('/inventory-issues', { method: 'POST', body: expect.any(String) });
      const request = createIssue.mock.calls.find(([path]) => path === '/inventory-issues')!;
      expect(JSON.parse(request[1]?.body as string)).toEqual(expect.objectContaining({
        isSupplemental: true, issueDate: '2026-10-19', reconciliationBatchId: 'batch-in-progress-1',
        lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'dl-1', issuedQty: expected, requestedQty: expected })],
      }));
    }
  });

  it('never offers another batch or day\'s supplemental dishes and recovers a failed projection without blocking direct entry', async () => {
    const material = { batchLineId: 'bl-a', dailyLineId: 'dl-a', serviceDate: '2026-10-19', ingredientId: 'i-a', ingredientName: 'Gạo', ingredientCode: 'GAO', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', grossQtyPerServing: 0.123, canonicalQtyPerServing: 0.000123 };
    const dishA = { dishId: 'dish-a', dishCode: 'A', dishName: 'Món A', materials: [material] };
    const dishB = { dishId: 'dish-b', dishCode: 'B', dishName: 'Món B', materials: [{ ...material, dailyLineId: 'dl-b' }] };
    let rejectB!: (cause: Error) => void;
    vi.spyOn(mrxApi, 'getBatchDishes').mockResolvedValueOnce([dishA])
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectB = reject; })).mockResolvedValue([dishB]);
    const props = { isOpen: true, onClose: vi.fn(), activeBatchId: 'batch-a', activeDate: '2026-10-19',
      lines: [{ dailyLineId: 'dl-a', ingredientName: 'Gạo', issuedQuantity: 1, canonicalUnitName: 'kg' }],
      suppMaterialId: 'dl-a', onSuppMaterialIdChange: vi.fn(), suppQuantity: '1', onSuppQuantityChange: vi.fn(),
      suppReason: 'Bổ sung', onSuppReasonChange: vi.fn(), suppError: null, isSubmittingSupp: false, onSubmit: vi.fn(),
    };
    const { rerender } = render(<MrxSupplementalIssueModal {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tính theo món ăn & suất phát sinh' }));
    expect(await screen.findByRole('option', { name: 'Món A (A)' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Số suất phát sinh' }), '1');
    rerender(<MrxSupplementalIssueModal {...props} activeBatchId="batch-b" lines={[{ ...props.lines[0], dailyLineId: 'dl-b' }]} />);
    expect(screen.queryByRole('option', { name: 'Món A (A)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất trọn gói/ })).not.toBeInTheDocument();
    await act(async () => { rejectB(new ApiError(500, 'Định mức món chưa tải được.')); });
    expect(await screen.findByText('Định mức món chưa tải được.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nhập nguyên liệu trực tiếp' }));
    expect(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tính theo món ăn & suất phát sinh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại định mức món' }));
    expect(await screen.findByRole('option', { name: 'Món B (B)' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Số suất phát sinh' }), '1');
    await userEvent.click(screen.getByRole('button', { name: /Xuất trọn gói/ }));
    expect(props.onSubmit).toHaveBeenCalledWith([{ dailyLineId: 'dl-b', quantity: 0.000123, reason: 'Phát sinh 1 suất món Món B' }]);
    props.onSubmit.mockClear();
    rerender(<MrxSupplementalIssueModal {...props} activeBatchId="batch-b" activeDate="2026-10-20" lines={[{ ...props.lines[0], dailyLineId: 'dl-tue' }]} />);
    expect(screen.queryByRole('option', { name: 'Món B (B)' })).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa có định mức món cho ngày đang chọn/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Xuất trọn gói/ })).not.toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();

    // Direct entry remains editable after a definite 400/409 rejection (isOutcomeUnknown=false, isSubmittingSupp=false)
    await userEvent.click(screen.getByRole('button', { name: 'Nhập nguyên liệu trực tiếp' }));
    rerender(
      <MrxSupplementalIssueModal
        {...props}
        suppError="Dữ liệu không hợp lệ (400): Số lượng vượt định mức cho phép."
        isSubmittingSupp={false}
        isOutcomeUnknown={false}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Chọn nguyên liệu bổ sung' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Số lượng xuất thêm' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' })).toBeEnabled();
    const presetBtn = screen.getByRole('button', { name: 'Phát sinh suất ăn đột xuất' });
    expect(presetBtn).toBeEnabled();
    await userEvent.click(presetBtn);
    expect(props.onSuppReasonChange).toHaveBeenCalledWith('Phát sinh suất ăn đột xuất');
  });

  it('keeps weekly totals separated by unit, sums issued days and leaves entirely untouched totals unavailable', async () => {
    const line = { dailyLineId: 'dl-1', batchLineId: 'bl-1', ingredientId: 'i-1', ingredientCode: 'GAO', ingredientName: 'Gạo',
      canonicalUnitId: 'u-1', canonicalUnitName: null, requiredQuantity: 2, issuedQuantity: null,
      returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false };
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true }, dates: [
        { serviceDate: '2026-10-19', status: 'UNTOUCHED', isApplicable: true, requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, lines: [line] },
        { serviceDate: '2026-10-20', status: 'UNDER_ISSUED', isApplicable: true, requiredQuantity: 3, issuedQuantity: 1, returnedQuantity: 0, remainingQuantity: 2,
          lines: [{ ...line, dailyLineId: 'dl-2', canonicalUnitId: 'u-2', canonicalUnitName: 'lít', requiredQuantity: 3, issuedQuantity: 1 }] },
        { serviceDate: '2026-10-21', status: 'UNTOUCHED', isApplicable: true, requiredQuantity: 4, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 4,
          lines: [{ ...line, dailyLineId: 'dl-3', canonicalUnitId: 'u-2', canonicalUnitName: 'lít', requiredQuantity: 4, remainingQuantity: 4 }] },
      ],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    await userEvent.click(await screen.findByRole('button', { name: 'Cả tuần (Tổng hợp)' }));
    const rows = screen.getAllByRole('row').filter((row) => row.textContent?.includes('Gạo'));
    expect(rows).toHaveLength(2);
    const unknownUnit = rows.find((row) => row.textContent?.includes('Chưa rõ đơn vị'))!;
    expect(unknownUnit).toBeDefined();
    expect(within(unknownUnit).getByRole('cell', { name: '— Chưa rõ đơn vị' })).toBeInTheDocument();
    const issuedUnit = rows.find(row => row.textContent?.includes('lít'))!;
    expect(within(issuedUnit).getByRole('cell', { name: '7 lít' })).toBeInTheDocument();
    expect(within(issuedUnit).getByRole('cell', { name: '1 lít' })).toBeInTheDocument();
    expect(within(issuedUnit).getByRole('cell', { name: '6 lít' })).toBeInTheDocument();
    expect(rows.some((row) => row.textContent?.includes('kg'))).toBe(false);
  });

  it('Route 3: respects batchId and date from URL search parameters on F5 reload without falling back to first batch', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [
        { batchId: 'batch-default-1', customerId: 'c-1', customerName: 'Khách A', customerCode: 'KA', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' },
        { batchId: 'batch-target-2', customerId: 'c-2', customerName: 'Khách B', customerCode: 'KB', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-target-2', batchStatus: 'IN_PROGRESS', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-10-23', status: 'UNTOUCHED', isApplicable: true,
        requiredQuantity: 0.3, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 0.3,
        lines: [{ dailyLineId: 'dl-2', batchLineId: 'bl-2', ingredientId: 'i-2', ingredientName: 'Thịt gà', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 0.3, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 0.3, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-target-2&date=2026-10-23');

    const batchSelect = await screen.findByRole('combobox', { name: 'Chọn lô đối soát xuất kho' });
    expect(batchSelect).toHaveValue('batch-target-2');

    // Verify auto-fill button and 7 canonical labels
    const fillAllBtn = screen.getByRole('button', { name: 'Điền đủ toàn bộ' });
    expect(fillAllBtn).toBeInTheDocument();
    await userEvent.click(fillAllBtn);
    const quantity = screen.getByRole('textbox', { name: /Số lượng thực xuất Thịt gà/i });
    expect(quantity).toHaveValue('0,3');
    expect(screen.getByText('Dự kiến xuất đủ')).toBeInTheDocument();
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '0.30000000000000004');
    expect(screen.getByText('Dự kiến xuất đủ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Lý do chênh lệch Thịt gà' })).toHaveAttribute('placeholder', 'Ghi chú (nếu có)...');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '0.0000004');
    expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeDisabled();

    // Verify Cả tuần tab switcher
    const allWeekBtn = screen.getByRole('button', { name: /Cả tuần \(Tổng hợp\)/i });
    expect(allWeekBtn).toBeInTheDocument();
    await userEvent.click(allWeekBtn);
    expect(await screen.findByText('Chế độ xem tổng hợp tuần (Chỉ đọc)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận xuất kho' })).not.toBeInTheDocument();
  });

  it('Route 4 & 5: preparation scope follows URL date on reload, navigation and Back', async () => {
    vi.spyOn(mrxApi, 'getPreparation').mockImplementation(async (serviceDate) => ({
      serviceDate,
      batches: [],
      aggregatedLines: [],
    }));

    const router = createMemoryRouter([{ path: '/warehouse', element: <WarehousePage /> }], {
      initialEntries: ['/warehouse?view=mrx-preparation&date=2026-11-05'],
    });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);

    const dateInput = await screen.findByRole('textbox', { name: 'Tuần chuẩn bị' });
    expect(dateInput).toHaveValue('02/11/2026');
    expect(mrxApi.getPreparation).toHaveBeenCalledWith('2026-11-02', undefined, true, expect.any(AbortSignal));

    await act(async () => { await router.navigate('/warehouse?view=mrx-preparation&date=2026-11-13'); });
    expect(screen.getByRole('textbox', { name: 'Tuần chuẩn bị' })).toHaveValue('09/11/2026');
    await waitFor(() => expect(mrxApi.getPreparation).toHaveBeenCalledWith('2026-11-09', undefined, true, expect.any(AbortSignal)));

    await act(async () => { await router.navigate(-1); });
    expect(screen.getByRole('textbox', { name: 'Tuần chuẩn bị' })).toHaveValue('02/11/2026');
    expect(screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeDisabled();
  });

  it('same_mounted_history_targets_the_visible_batch', async () => {
    vi.mocked(mrxApi.getBatchPage).mockRestore();
    vi.mocked(mrxApi.getIssues).mockRestore();
    const batchA = {
      batchId: 'batch-a', customerId: 'c-a', customerName: 'Khách A', customerCode: 'KA',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'TRANSFERRED' as const, version: 1, createdAt: '2026-10-19T00:00:00Z',
    };
    const batchB = {
      batchId: 'batch-b', customerId: 'c-b', customerName: 'Khách B', customerCode: 'KB',
      weekStartDate: '2026-10-26', weekEndDate: '2026-11-01', status: 'TRANSFERRED' as const, version: 2, createdAt: '2026-10-26T00:00:00Z',
    };
    const dailyA: MrxWarehouseDaily = {
      batchId: 'batch-a', batchStatus: 'TRANSFERRED', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-10-19', status: 'UNTOUCHED', isApplicable: true,
        requiredQuantity: 10, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 10,
        lines: [{
          dailyLineId: 'dl-a-1', batchLineId: 'bl-a-1', ingredientId: 'ing-a', ingredientCode: 'GAO-A', ingredientName: 'Gạo lô A',
          canonicalUnitId: 'u-kg', canonicalUnitName: 'kg', requiredQuantity: 10, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 10,
          quantityStatus: 'UNTOUCHED', hasValidDisposition: false,
        }],
      }],
    };
    const dailyB: MrxWarehouseDaily = {
      batchId: 'batch-b', batchStatus: 'TRANSFERRED', sourceVersion: 2, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-10-26', status: 'UNTOUCHED', isApplicable: true,
        requiredQuantity: 25, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 25,
        lines: [{
          dailyLineId: 'dl-b-1', batchLineId: 'bl-b-1', ingredientId: 'ing-b', ingredientCode: 'THIT-B', ingredientName: 'Thịt lô B',
          canonicalUnitId: 'u-kg', canonicalUnitName: 'kg', requiredQuantity: 25, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 25,
          quantityStatus: 'UNTOUCHED', hasValidDisposition: false,
        }],
      }],
    };
    const dailyUnlisted: MrxWarehouseDaily = {
      batchId: 'batch-unlisted', batchStatus: 'TRANSFERRED', sourceVersion: 5, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [{
        serviceDate: '2026-11-02', status: 'UNTOUCHED', isApplicable: true,
        requiredQuantity: 12, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 12,
        lines: [{
          dailyLineId: 'dl-u-1', batchLineId: 'bl-u-1', ingredientId: 'ing-u', ingredientCode: 'CA-U', ingredientName: 'Cá lô ngoài trang 1',
          canonicalUnitId: 'u-kg', canonicalUnitName: 'kg', requiredQuantity: 12, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 12,
          quantityStatus: 'UNTOUCHED', hasValidDisposition: false,
        }],
      }],
    };

    const postedBodies: Array<Record<string, unknown>> = [];
    let resolveDeferredB!: (val: MrxWarehouseDaily) => void;
    let deferNextB = true;
    let resolveDelayedA!: (val: MrxWarehouseDaily) => void;
    let delayNextA = false;
    let failNextPostNetwork = false;

    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (endpoint, options) => {
      const url = new URL(endpoint, 'http://localhost');
      const method = (options?.method || 'GET').toUpperCase();
      if (method === 'POST' && url.pathname === '/inventory-issues') {
        const parsed = JSON.parse(String(options?.body ?? '{}')) as Record<string, unknown>;
        postedBodies.push(parsed);
        if (failNextPostNetwork) {
          failNextPostNetwork = false;
          throw new TypeError('Failed to fetch');
        }
        return { issueId: `iss-${postedBodies.length}`, issueCode: `PX-${postedBodies.length}`, concurrencyVersion: 9, provisions: [] };
      }
      if (url.pathname === '/reconciliation/batches') {
        return { items: [batchA, batchB], totalCount: 2, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false };
      }
      if (url.pathname === '/reconciliation/batches/batch-a/warehouse-daily') {
        if (delayNextA) {
          delayNextA = false;
          return new Promise<MrxWarehouseDaily>((resolve) => { resolveDelayedA = resolve; });
        }
        return dailyA;
      }
      if (url.pathname === '/reconciliation/batches/batch-b/warehouse-daily') {
        if (deferNextB) {
          deferNextB = false;
          return new Promise<MrxWarehouseDaily>((resolve) => { resolveDeferredB = resolve; });
        }
        return dailyB;
      }
      if (url.pathname === '/reconciliation/batches/batch-unlisted/warehouse-daily') {
        return dailyUnlisted;
      }
      if (url.pathname === '/inventory-issues' && method === 'GET') {
        return { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false };
      }
      throw new Error(`Unexpected request: ${method} ${endpoint}`);
    });

    const router = createMemoryRouter([{ path: '/warehouse', element: <DirtyNavigationProvider><WarehousePage /></DirtyNavigationProvider> }], {
      initialEntries: ['/warehouse?view=mrx-daily&batchId=batch-a&date=2026-10-19'],
    });
    render(
      <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    expect(await screen.findByText('Gạo lô A')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('batch-a');
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('19/10/2026');

    // Dirty navigation confirmation: cancel preserves scope & draft, confirm discards and switches
    const qtyA = screen.getByRole('textbox', { name: /Số lượng thực xuất Gạo lô A/i });
    await userEvent.clear(qtyA);
    await userEvent.type(qtyA, '7');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' }), 'batch-b');
    expect(await screen.findByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('batch-a');
    expect(screen.getByRole('textbox', { name: /Số lượng thực xuất Gạo lô A/i })).toHaveValue('7');

    // Confirm discard via DirtyNavigation modal
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' }), 'batch-b');
    expect(await screen.findByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));

    // While destination read is deferred, submit must not be possible and old batch-a lines must not be submitted
    const submitDuringLoad = screen.queryByRole('button', { name: 'Xác nhận xuất kho' });
    if (submitDuringLoad) {
      expect(submitDuringLoad).toBeDisabled();
      await userEvent.click(submitDuringLoad);
    }
    expect(postedBodies).toHaveLength(0);

    // Resolve batch-b read
    await act(async () => { resolveDeferredB(dailyB); });
    expect(await screen.findByText('Thịt lô B')).toBeInTheDocument();
    expect(screen.queryByText('Gạo lô A')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('batch-b');
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('26/10/2026');

    // Submit on batch-b and verify POST body targets batch-b
    await userEvent.click(screen.getByRole('button', { name: 'Điền đủ toàn bộ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));
    await waitFor(() => expect(postedBodies).toHaveLength(1));
    expect(postedBodies[0]).toMatchObject({
      reconciliationBatchId: 'batch-b',
      issueDate: '2026-10-26',
      lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'dl-b-1', reconciliationBatchLineId: 'bl-b-1', issuedQty: 25 })],
    });

    // Browser Back to batch-a (same-mounted)
    serverStateCache.delete('mrx_daily_batch-a');
    delayNextA = true;
    await act(async () => { await router.navigate(-1); });
    await act(async () => { resolveDelayedA(dailyA); });
    expect(await screen.findByText('Gạo lô A')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('batch-a');
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('19/10/2026');

    // Submit on batch-a after Back and verify POST body targets batch-a
    await userEvent.click(screen.getByRole('button', { name: 'Điền đủ toàn bộ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));
    await waitFor(() => expect(postedBodies).toHaveLength(2));
    expect(postedBodies[1]).toMatchObject({
      reconciliationBatchId: 'batch-a',
      issueDate: '2026-10-19',
      lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'dl-a-1', reconciliationBatchLineId: 'bl-a-1', issuedQty: 10 })],
    });

    // Browser Forward to batch-b (same-mounted)
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByText('Thịt lô B')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' })).toHaveValue('batch-b');
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('26/10/2026');

    // Explicit URL target missing from current catalog page (and without ?date=) does not get overwritten by first catalog item or retain batch-b's date
    await act(async () => {
      await router.navigate('/warehouse?view=mrx-daily&batchId=batch-unlisted');
    });
    expect(await screen.findByText('Cá lô ngoài trang 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('02/11/2026');

    // Trigger outcome-unknown on batch-unlisted and verify Back/programmatic URL change cannot clear fence or change active scope
    await userEvent.click(screen.getByRole('button', { name: 'Điền đủ toàn bộ' }));
    failNextPostNetwork = true;
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));
    expect(await screen.findByText('Chưa xác nhận được kết quả xuất kho')).toBeVisible();

    await act(async () => { await router.navigate(-1); });
    expect(screen.getByText('Chưa xác nhận được kết quả xuất kho')).toBeVisible();
    expect(screen.getByText('Cá lô ngoài trang 1')).toBeInTheDocument();
    expect(router.state.location.search).toContain('batchId=batch-unlisted');
    expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeDisabled();
  });

  it('resets quantities cleanly when switching service dates in daily issue workbench (State Isolation)', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [
        { batchId: 'batch-target-2', customerId: 'c-2', customerName: 'Khách B', customerCode: 'KB', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' },
      ],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-target-2', batchStatus: 'IN_PROGRESS', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: null },
      dates: [
        {
          serviceDate: '2026-10-19', status: 'UNTOUCHED', isApplicable: true,
          requiredQuantity: 20, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 20,
          lines: [{ dailyLineId: 'dl-mon', batchLineId: 'bl-mon', ingredientId: 'i-1', ingredientName: 'Thịt heo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 20, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 20, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
        },
        {
          serviceDate: '2026-10-20', status: 'UNTOUCHED', isApplicable: true,
          requiredQuantity: 35, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 35,
          lines: [{ dailyLineId: 'dl-tue', batchLineId: 'bl-tue', ingredientId: 'i-2', ingredientName: 'Cá hồi', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 35, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 35, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
        },
        { serviceDate: '2026-10-21', status: 'NO_DEMAND', isApplicable: false, requiredQuantity: 0, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 0, lines: [] },
      ],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-target-2&date=2026-10-19');

    // Monday line has 0 initially
    expect(await screen.findByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeInTheDocument();
    expect(await screen.findByText('Thịt heo')).toBeInTheDocument();
    const monInput = screen.getByRole('textbox', { name: /Số lượng thực xuất Thịt heo/i });
    expect(monInput).toHaveValue('0');

    // Empty applicable dates keep the same search owner and query.
    const search = screen.getByRole('searchbox', { name: 'Tìm kiếm nguyên liệu xuất kho' });
    await userEvent.type(search, 'Thịt');
    await userEvent.click(screen.getByRole('button', { name: /T4/i }));
    expect(await screen.findByText('Không tìm thấy nguyên liệu nào khớp với từ khóa.')).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm nguyên liệu xuất kho' })).toBe(search);
    expect(search).toHaveValue('Thịt');
    await userEvent.click(screen.getByRole('button', { name: /T2/i }));
    expect(await screen.findByText('Thịt heo')).toBeVisible();
    await waitFor(() => expect(search.closest('[inert]')).toBeNull());
    await userEvent.clear(search);

    // Type 18 for Monday after its row returns (only the search shell is persistent).
    const returnedMonInput = screen.getByRole('textbox', { name: /Số lượng thực xuất Thịt heo/i });
    await userEvent.clear(returnedMonInput);
    await userEvent.type(returnedMonInput, '18');
    expect(returnedMonInput).toHaveValue('18');

    // Click Tuesday button (T3)
    const tueBtn = screen.getByRole('button', { name: /T3/i });
    await userEvent.click(tueBtn);

    // Tuesday line renders cleanly without Monday's input leaking
    expect(await screen.findByText('Cá hồi')).toBeInTheDocument();
    expect(screen.queryByText('Thịt heo')).not.toBeInTheDocument();
    const tueInput = screen.getByRole('textbox', { name: /Số lượng thực xuất Cá hồi/i });
    expect(tueInput).toHaveValue('0');
    await userEvent.clear(tueInput);
    await userEvent.type(tueInput, '30');
    const original = await vi.mocked(mrxApi.getWarehouseDaily).mock.results[0].value;
    vi.mocked(mrxApi.getWarehouseDaily).mockResolvedValue({ ...original, sourceVersion: 2 });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await screen.findByText('v2');
    expect(screen.getByRole('textbox', { name: /Số lượng thực xuất Cá hồi/i })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Xác nhận xuất kho' })).toBeDisabled();
  });

  it('loads each issue identity explicitly, ignores old responses and retries without losing modal close behavior', async () => {
    const issueA: MrxInventoryIssueDetail = { issueId: 'issue-a', issueCode: 'ISS-A', issueDate: '2026-10-19', createdAt: '2026-10-19T07:00:00Z', issuedBy: 'actor-1', warehouseId: 'warehouse-1', sourceFamily: 'MATERIAL_RECONCILIATION', lines: [], provisions: [] };
    const issueB: MrxInventoryIssueDetail = { ...issueA, issueId: 'issue-b', issueCode: 'ISS-B' };
    let resolveA!: (issue: MrxInventoryIssueDetail) => void;
    let resolveB!: (issue: MrxInventoryIssueDetail) => void;
    const transport = vi.spyOn(apiTransport, 'apiClient')
      .mockImplementationOnce(() => new Promise<MrxInventoryIssueDetail>((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise<MrxInventoryIssueDetail>((resolve) => { resolveB = resolve; }))
      .mockRejectedValueOnce(new ApiError(500, 'Không thể tải phiếu B.'))
      .mockResolvedValueOnce(issueB);
    const onClose = vi.fn();
    const view = (issueId: string, isOpen: boolean) => <><button type="button">Xem phiếu</button><ReconciliationIssueDetailModal isOpen={isOpen} issueId={issueId} onClose={onClose} /></>;
    const { rerender } = render(view('issue-a', false));
    const opener = screen.getByRole('button', { name: 'Xem phiếu' });
    await userEvent.click(opener);
    rerender(view('issue-a', true));
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeVisible();
    rerender(view('issue-b', true));
    await act(async () => resolveB(issueB));
    expect(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).toHaveTextContent('ISS-B');
    await act(async () => resolveA(issueA));
    expect(within(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).queryByText('ISS-A')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    rerender(view('issue-b', false));
    expect(opener).toHaveFocus();
    serverStateCache.delete('mrx_issue_detail_issue-b');
    rerender(view('issue-b', true));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(await screen.findByText('Không thể tải phiếu B.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await within(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).findByText('ISS-B')).toBeVisible();
    expect(screen.queryByText('Không thể tải phiếu B.')).not.toBeInTheDocument();
    expect(transport).toHaveBeenLastCalledWith('/inventory-issues/issue-b?sourceFamily=MATERIAL_RECONCILIATION');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(view('issue-b', false));
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders variance badges (Xuất vượt / Tiết kiệm) in ReconciliationIssueDetailModal', async () => {
    vi.spyOn(apiTransport, 'apiClient').mockResolvedValue({
      issueId: 'issue-test-1',
      issueCode: 'ISS-20261019-01',
      issueDate: '2026-10-19',
      warehouseId: 'wh-1',
      warehouseName: 'Kho chính',
      issuedByName: 'Thủ kho A',
      issuedBy: 'user-1',
      createdAt: '2026-10-19T07:30:00Z',
      sourceFamily: 'MATERIAL_RECONCILIATION',
      receivedAt: '2026-10-19T08:00:00Z',
      provisions: [
        { stockMovementId: 'movement-1', ingredientId: 'ing-1', unitId: 'u-1', unitName: 'kg', provisionedQuantity: 2.5 },
        { stockMovementId: 'movement-unrelated', ingredientId: 'ing-other', unitId: 'u-1', unitName: 'kg', provisionedQuantity: 99 },
      ],
      lines: [
        {
          issueLineId: 'line-1',
          ingredientId: 'ing-1',
          ingredientName: 'Thịt đùi heo',
          unitId: 'u-1',
          unitName: 'kg',
          requestedQty: 0.002586,
          issuedQty: 0.002587,
        },
        {
          issueLineId: 'line-2',
          ingredientId: 'ing-2',
          ingredientName: 'Rau cải ngọt',
          unitId: 'u-1',
          unitName: 'kg',
          requestedQty: 8,
          issuedQty: 6,
        },
      ],
    });

    render(
      <ReconciliationIssueDetailModal
        isOpen={true}
        onClose={vi.fn()}
        issueId="issue-test-1"
      />
    );

    expect(await within(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).findByText('ISS-20261019-01')).toBeVisible();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Mã NL', 'Tên nguyên liệu', 'ĐVT', 'Nhu cầu khóa', 'Thực xuất']);
    expect(screen.getByText('Thịt đùi heo')).toBeInTheDocument();
    expect(screen.getByText(/Xuất vượt/)).toHaveTextContent('Xuất vượt (+0,000001)');
    expect(screen.getByRole('cell', { name: '0,002586' })).toBeVisible();
    expect(screen.getByRole('cell', { name: '0,002587' })).toBeVisible();
    expect(screen.getByText('Rau cải ngọt')).toBeInTheDocument();
    expect(screen.getByText(/Tiết kiệm/)).toBeInTheDocument();
    expect(screen.getByLabelText('Đã tự động bù tồn kho: +2,5 kg')).toBeInTheDocument();
    expect(screen.queryByText(/\+99 kg/)).not.toBeInTheDocument();

    vi.setSystemTime(new Date('2026-11-08T08:00:00Z')); // Sunday
    workspaceSessionStore.clearScope();
    serverStateCache.clearAll();
    const getPrep = vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-11-02',
      batches: [{ batchId: 'b-1', customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier', batchStatus: 'IN_PROGRESS', batchVersion: 1, isApplicable: true, hasExistingIssue: false, requiredQuantity: 50, issuedQuantity: 0, remainingQuantity: 50 }],
      aggregatedLines: [{
        ingredientId: 'i-1', ingredientCode: 'GAO', ingredientName: 'Gạo ST25', canonicalUnitId: 'u-1', canonicalUnitName: 'kg',
        totalRequiredQuantity: 50, totalIssuedQuantity: 0, totalRemainingQuantity: 50,
        allocations: [{ batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier', requiredQuantity: 50, remainingQuantity: 50, status: 'UNTOUCHED' }],
      }],
    });

    renderWarehouse('/warehouse?view=mrx-preparation&range=day');

    expect(await screen.findByText('Gạo ST25')).toBeVisible();
    expect(getPrep).toHaveBeenCalledWith('2026-11-02', undefined, false, expect.anything());
    expect(screen.queryByText(/Tuần chuẩn bị chỉ từ Thứ Hai đến Thứ Bảy/)).not.toBeInTheDocument();
  });

});
