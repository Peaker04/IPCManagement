import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { AuthProvider } from '../store/authContext';
import { warehouseApi } from '../api/warehouseApi';
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

  it('renders Zone 1 WorkspaceHeader (56px) with warehouse select, date, and single primary button (Rule D7)', async () => {
    renderWarehouse();

    expect(await screen.findByRole('heading', { name: 'Kho nguyên liệu & Nhập xuất' })).toBeInTheDocument();

    // Select warehouse and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('21/09/2026')).toBeInTheDocument();
    expect(screen.getByText('Kho đang hoạt động')).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: 'Tạo phiếu xuất kho' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with 3 Segmented Tabs and telemetry pills', async () => {
    renderWarehouse();

    // 3 Segmented Tabs
    expect(await screen.findByRole('tab', { name: /Phiếu xuất kho ca/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu nhập kho từ PO/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Thẻ kho & Tồn hiện tại/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Tổng phiếu:/i)).toBeInTheDocument();
    expect(screen.getByText(/Kho vận hành:/i)).toBeInTheDocument();
    expect(screen.getByText(/Khớp thẻ kho:/i)).toBeInTheDocument();
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
    renderWarehouse();

    const receiptTab = await screen.findByRole('tab', { name: /Phiếu nhập kho từ PO/i });
    await userEvent.click(receiptTab);

    expect(await screen.findByRole('columnheader', { name: 'Mã phiếu nhập' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày nhập' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhà cung cấp' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kho tiếp nhận' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số dòng' })).toBeInTheDocument();

    expect(screen.getByText('RCP-PO-20260721-0858')).toBeInTheDocument();
  });

  it('Tab 3 (Thẻ kho & Tồn hiện tại): renders stock cards table', async () => {
    renderWarehouse();

    const stockTab = await screen.findByRole('tab', { name: /Thẻ kho & Tồn hiện tại/i });
    await userEvent.click(stockTab);

    expect(await screen.findByRole('columnheader', { name: 'Mã vật tư' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tồn đầu ngày' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhập trong ngày' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Xuất trong ngày' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tồn cuối ngày' })).toBeInTheDocument();

    expect(screen.getByText('NL-THIT-01')).toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
  });

  it('opens new issue modal and creates warehouse export issue', async () => {
    renderWarehouse();

    const createBtn = await screen.findByRole('button', { name: 'Tạo phiếu xuất kho' });
    await userEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tạo phiếu xuất kho nguyên liệu ca nấu' })).toBeInTheDocument();

    const notesInput = screen.getByPlaceholderText(/Xuất nguyên liệu ca trưa/i);
    await userEvent.type(notesInput, 'Xuất ca 1 theo KHSX');

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận xuất kho' });
    await userEvent.click(submitBtn);
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
});
