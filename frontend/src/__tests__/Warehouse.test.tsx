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
});
