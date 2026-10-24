import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { AuthProvider } from '../store/authContext';
import { warehouseApi } from '../api/warehouseApi';
import { mrxApi } from '../api/mrxApi';
import { MOCK_WAREHOUSES, MOCK_ISSUES, MOCK_RECEIPTS } from '../test/fixtures';

function renderWarehouse(initialEntry = '/warehouse') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/warehouse" element={<WarehousePage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Warehouse Feature (FR-WH — Kho nguyên liệu & Nhập xuất)', () => {
  beforeEach(() => {
    vi.spyOn(warehouseApi, 'getWarehouses').mockResolvedValue(MOCK_WAREHOUSES);
    vi.spyOn(warehouseApi, 'getIssues').mockResolvedValue(MOCK_ISSUES);
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue(MOCK_RECEIPTS);
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

  it('MRX daily workbench confirms one exact-date initial issue through the canonical issue command', async () => {
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 3, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true, reasonCode: 'DAILY_LINEAGE_READY' },
      dates: [{
        serviceDate: '2026-10-19', status: 'PENDING', isApplicable: true,
        requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2,
        lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }]
      }]
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    const createIssue = vi.spyOn(mrxApi, 'createIssue').mockResolvedValue({ issueId: 'issue-1', issueCode: 'PX-001', concurrencyVersion: 4 });
    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');

    expect(screen.getByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeInTheDocument();
    expect(await screen.findByText('Gạo')).toBeInTheDocument();
    const quantity = screen.getByRole('spinbutton', { name: 'Số lượng thực xuất Gạo' });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '1.5');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất kho' }));

    expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationBatchId: 'batch-1', issueDate: '2026-10-19', expectedVersion: 3,
      lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'daily-1', requestedQty: 2, issuedQty: 1.5 })]
    }));
    await waitFor(() => {
      expect(mrxApi.getWarehouseDaily).toHaveBeenCalledTimes(2);
      expect(mrxApi.getIssues).toHaveBeenCalledTimes(2);
    });
  });

  it('MRX source-delta workbench resolves an exact positive delta through supplemental issue', async () => {
    vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({
      items: [{ sourceDeltaId: 'delta-1', sourceRevisionId: 'revision-1', batchId: 'batch-1', dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', previousRequiredQuantity: 2, newRequiredQuantity: 2.5, deltaQuantity: 0.5, workKind: 'SUPPLEMENTAL_ISSUE', status: 'PENDING', version: 1, createdAt: '2026-10-20T06:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'IN_PROGRESS', sourceVersion: 4, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true },
      dates: [{ serviceDate: '2026-10-19', status: 'UNDER_ISSUED', isApplicable: true, requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0, lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0, quantityStatus: 'EXACT', hasValidDisposition: false }] }]
    });
    const createIssue = vi.spyOn(mrxApi, 'createIssue').mockResolvedValue({ issueId: 'issue-2', issueCode: 'PX-002', concurrencyVersion: 5 });
    renderWarehouse('/warehouse?view=mrx-issues');

    expect(await screen.findByText('Gạo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xử lý xuất bổ sung Gạo' }));

    expect(await screen.findByRole('heading', { name: 'Xác nhận xử lý thay đổi nguồn' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý' }));

    expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationSourceDeltaId: 'delta-1', expectedSourceDeltaVersion: 1, isSupplemental: true,
      reconciliationBatchId: 'batch-1', expectedVersion: 4,
      lines: [expect.objectContaining({ reconciliationBatchDailyLineId: 'daily-1', issuedQty: 0.5 })]
    }));
  });

  it('MRX source-delta workbench resolves an exact negative delta through physical return and receipt confirmation', async () => {
    vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({
      items: [{ sourceDeltaId: 'delta-2', sourceRevisionId: 'revision-2', batchId: 'batch-1', dailyLineId: 'daily-2', serviceDate: '2026-10-19', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', previousRequiredQuantity: 2, newRequiredQuantity: 1.25, deltaQuantity: -0.75, workKind: 'RETURN_REQUIRED', status: 'PENDING', version: 1, createdAt: '2026-10-20T06:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [{
        issueId: 'issue-1', issueCode: 'PX-001', issueDate: '2026-10-19', issuedBy: 'user-1', sourceFamily: 'MATERIAL_RECONCILIATION', warehouseId: 'wh-1', createdAt: '2026-10-19T05:00:00Z',
        lines: [{ issueLineId: 'issue-line-1', ingredientId: 'ingredient-1', unitId: 'unit-1', requestedQty: 2, issuedQty: 2, reconciliationBatchDailyLineId: 'daily-2' }]
      }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false
    });
    const createReturn = vi.spyOn(mrxApi, 'createReturn').mockResolvedValue({ returnId: 'return-1', returnCode: 'RET-001' });
    const confirmReturn = vi.spyOn(mrxApi, 'confirmReturn').mockResolvedValue();
    renderWarehouse('/warehouse?view=mrx-issues');

    expect(await screen.findByText('Gạo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xử lý hoàn trả Gạo' }));

    expect(await screen.findByRole('heading', { name: 'Xác nhận xử lý thay đổi nguồn' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý' }));

    expect(createReturn).toHaveBeenCalledWith(expect.objectContaining({
      issueId: 'issue-1', reconciliationSourceDeltaId: 'delta-2', expectedSourceDeltaVersion: 1,
      lines: [expect.objectContaining({ sourceIssueLineId: 'issue-line-1', quantity: 0.75 })]
    }));
    expect(confirmReturn).toHaveBeenCalledWith('return-1', expect.objectContaining({ expectedVersion: 0 }));
  });

  it('MRX source-delta workbench mandates discrepancy reason when physical quantity differs from delta', async () => {
    vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({
      items: [{ sourceDeltaId: 'delta-1', sourceRevisionId: 'revision-1', batchId: 'batch-1', dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', previousRequiredQuantity: 2, newRequiredQuantity: 2.5, deltaQuantity: 0.5, workKind: 'SUPPLEMENTAL_ISSUE', status: 'PENDING', version: 1, createdAt: '2026-10-20T06:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'IN_PROGRESS', sourceVersion: 4, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true },
      dates: [{ serviceDate: '2026-10-19', status: 'UNDER_ISSUED', isApplicable: true, requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0, lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0, quantityStatus: 'EXACT', hasValidDisposition: false }] }]
    });
    const createIssue = vi.spyOn(mrxApi, 'createIssue').mockResolvedValue({ issueId: 'issue-2', issueCode: 'PX-002', concurrencyVersion: 5 });
    renderWarehouse('/warehouse?view=mrx-issues');

    await userEvent.click(await screen.findByRole('button', { name: 'Xử lý xuất bổ sung Gạo' }));

    const qtyInput = screen.getByRole('spinbutton', { name: 'Số lượng thực tế' });
    fireEvent.change(qtyInput, { target: { value: '0.4' } });

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận xử lý' });
    expect(submitBtn).toBeDisabled();

    const reasonInput = screen.getByRole('textbox', { name: 'Lý do chênh lệch thực tế' });
    fireEvent.change(reasonInput, { target: { value: 'Thực xuất thực tế thiếu hụt bao bì lẻ' } });
    expect(screen.getByRole('button', { name: 'Xác nhận xử lý' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý' }));

    expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
      lines: [expect.objectContaining({ issuedQty: 0.4, varianceReason: 'Thực xuất thực tế thiếu hụt bao bì lẻ' })]
    }));
  });

  it('MRX multi-customer preparation workbench aggregates ingredients across customers and submits coordinated issue', async () => {
    vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-06-15',
      batches: [
        { batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 },
        { batchId: 'b-2', customerId: 'c-2', customerName: 'Khách B', batchStatus: 'TRANSFERRED', batchVersion: 3, isApplicable: true, hasExistingIssue: false, requiredQuantity: 3, issuedQuantity: 0, remainingQuantity: 3 }
      ],
      aggregatedLines: [
        {
          ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 8, totalIssuedQuantity: 0, totalRemainingQuantity: 8,
          allocations: [
            { batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, remainingQuantity: 5, status: 'UNTOUCHED' },
            { batchId: 'b-2', batchLineId: 'bl-2', dailyLineId: 'dl-2', customerId: 'c-2', customerName: 'Khách B', requiredQuantity: 3, remainingQuantity: 3, status: 'UNTOUCHED' }
          ]
        }
      ]
    });
    const issueCoordinated = vi.spyOn(mrxApi, 'issueCoordinated').mockResolvedValue({
      preparationGroupId: 'prep-group-1', serviceDate: '2026-06-15', commandId: 'cmd-1',
      issues: [
        { reconciliationBatchId: 'b-1', issueId: 'iss-1', issueCode: 'PX-001', batchVersion: 3 },
        { reconciliationBatchId: 'b-2', issueId: 'iss-2', issueCode: 'PX-002', batchVersion: 4 }
      ],
      idempotentReplay: false
    });

    renderWarehouse('/warehouse?view=mrx-daily&date=2026-06-15');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị nguyên liệu phối hợp đa khách hàng' })).toBeInTheDocument();
    expect(await screen.findByText('Khách A')).toBeInTheDocument();
    expect(screen.getByText('Khách B')).toBeInTheDocument();
    expect(screen.getByText('Gạo')).toBeInTheDocument();
    expect(screen.getByText('8 kg')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận xuất phối hợp (2 lô)' });
    await userEvent.click(submitBtn);

    expect(issueCoordinated).toHaveBeenCalledWith(expect.objectContaining({
      serviceDate: '2026-06-15',
      batches: expect.arrayContaining([
        expect.objectContaining({ reconciliationBatchId: 'b-1', expectedVersion: 2 }),
        expect.objectContaining({ reconciliationBatchId: 'b-2', expectedVersion: 3 })
      ])
    }));
    expect(await screen.findByText(/prep-group-1/)).toBeInTheDocument();
  });

  it('MRX multi-customer preparation workbench triggers Excel workbook export with selected filters', async () => {
    vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-06-15',
      batches: [{ batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 }],
      aggregatedLines: [{ ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 5, totalIssuedQuantity: 0, totalRemainingQuantity: 5, allocations: [{ batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, remainingQuantity: 5, status: 'UNTOUCHED' }] }]
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWarehouse('/warehouse?view=mrx-daily&date=2026-06-15');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị nguyên liệu phối hợp đa khách hàng' })).toBeInTheDocument();
    const supplierInput = await screen.findByRole('textbox', { name: 'Lọc theo tên nhà cung cấp' });
    await userEvent.type(supplierInput, 'Rau Sạch');

    const exportBtn = screen.getByRole('button', { name: 'Xuất Excel chuẩn bị' });
    await userEvent.click(exportBtn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/reconciliation\/preparation\/export-workbook\?.*serviceDate=2026-06-15.*batchIds=b-1/),
      '_blank'
    );
  });

  it('renders clean empty state when no receipts exist', async () => {
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue([]);

    renderWarehouse('/warehouse?view=receipts');

    expect(await screen.findByText('Chưa có phiếu nhập kho')).toBeInTheDocument();
    expect(screen.getByText('Không có phiếu nhập kho nào phù hợp với bộ lọc.')).toBeInTheDocument();
  });

  it('MRX multi-customer preparation renders on /warehouse?view=mrx-preparation with in-screen date picker and updates on date change', async () => {
    const getPrep = vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-10-22',
      batches: [{ batchId: 'b-1', customerId: 'c-1', customerName: 'Khách A', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 }],
      aggregatedLines: [{ ingredientId: 'i-1', ingredientName: 'Gạo', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', totalRequiredQuantity: 5, totalIssuedQuantity: 0, totalRemainingQuantity: 5, allocations: [{ batchId: 'b-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'c-1', customerName: 'Khách A', requiredQuantity: 5, remainingQuantity: 5, status: 'UNTOUCHED' }] }]
    });

    renderWarehouse('/warehouse?view=mrx-preparation');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị nguyên liệu phối hợp đa khách hàng' })).toBeInTheDocument();
    const dateInput = screen.getByRole('textbox', { name: 'Ngày chuẩn bị' });
    expect(dateInput).toBeInTheDocument();

    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '25/10/2026');
    await userEvent.keyboard('{Enter}');

    expect(getPrep).toHaveBeenCalledWith('2026-10-25');
  });

  it('MRX source delta workbench displays preset chips for discrepancy reasons in modal', async () => {
    vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({
      items: [{
        sourceDeltaId: 'delta-1', sourceRevisionId: 'revision-1', batchId: 'batch-1',
        dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'ingredient-1',
        ingredientCode: 'GAO', ingredientName: 'Gạo', canonicalUnitId: 'unit-1',
        canonicalUnitName: 'kg', previousRequiredQuantity: 2, newRequiredQuantity: 2.5,
        deltaQuantity: 0.5, workKind: 'SUPPLEMENTAL_ISSUE', status: 'PENDING',
        version: 1, createdAt: '2026-10-20T06:00:00Z'
      }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false
    });

    renderWarehouse('/warehouse?view=mrx-issues');

    expect(await screen.findByText('Hàng đợi thay đổi nguồn cần kho xử lý')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Xử lý xuất bổ sung Gạo' }));

    const qtyInput = screen.getByRole('spinbutton', { name: 'Số lượng thực tế' });
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '0.4'); // triggers discrepancy

    const presetChip = await screen.findByRole('button', { name: 'Hao hụt rã đông/rơi vãi' });
    expect(presetChip).toBeInTheDocument();
    await userEvent.click(presetChip);

    const reasonInput = screen.getByRole('textbox', { name: 'Lý do chênh lệch thực tế' });
    expect(reasonInput).toHaveValue('Hao hụt rã đông/rơi vãi');
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
      batchStatus: 'TRANSFERRED',
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
    expect(screen.queryByText('Thiếu định danh lô hoặc ngày phục vụ')).not.toBeInTheDocument();
  });

  it('allows warehouse staff to trigger supplemental issue when initial issue is completed (RULE-MRX-03)', async () => {
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
    vi.spyOn(mrxApi, 'createIssue').mockResolvedValue({
      issueId: 'iss-supp-1',
      issueCode: 'PX-SUPP-001',
      concurrencyVersion: 1,
    });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-in-progress-1&date=2026-10-19');

    const suppBtn = await screen.findByRole('button', { name: 'Xuất bổ sung ca' });
    expect(suppBtn).toBeInTheDocument();
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
        requiredQuantity: 15, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 15,
        lines: [{ dailyLineId: 'dl-2', batchLineId: 'bl-2', ingredientId: 'i-2', ingredientName: 'Thịt gà', canonicalUnitId: 'u-1', canonicalUnitName: 'kg', requiredQuantity: 15, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 15, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-target-2');

    const batchSelect = await screen.findByRole('combobox', { name: 'Chọn lô đối soát xuất kho' });
    expect(batchSelect).toHaveValue('batch-target-2');
  });

  it('Route 4 & 5: preparation workbench respects date from URL search parameters on F5 reload', async () => {
    vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-11-05',
      batches: [],
      aggregatedLines: [],
    });

    renderWarehouse('/warehouse?view=mrx-preparation&date=2026-11-05');

    const dateInput = await screen.findByRole('textbox', { name: 'Ngày chuẩn bị' });
    expect(dateInput).toHaveValue('05/11/2026');
    expect(mrxApi.getPreparation).toHaveBeenCalledWith('2026-11-05');
  });
});
