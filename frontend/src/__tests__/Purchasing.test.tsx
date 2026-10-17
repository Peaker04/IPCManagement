import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PurchasingPage } from '../features/purchasing/PurchasingPage';
import { AuthProvider } from '../store/authContext';
import { purchasingApi } from '../api/purchasingApi';
import { MOCK_PURCHASE_ORDERS, MOCK_SUPPLIERS } from '../test/fixtures';

function renderPurchasing(initialEntry = '/purchasing') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/purchasing" element={<PurchasingPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Purchasing Feature (FR-PUR — Thu mua & PO)', () => {
  beforeEach(() => {
    vi.spyOn(purchasingApi, 'getPurchaseOrders').mockResolvedValue(MOCK_PURCHASE_ORDERS);
    vi.spyOn(purchasingApi, 'getSuppliers').mockResolvedValue(MOCK_SUPPLIERS);
  });

  it('renders Zone 1 WorkspaceHeader without exposing an unsupported direct PO creation action', async () => {
    renderPurchasing();

    expect(await screen.findByRole('heading', { name: 'Thu mua & Đề xuất PO' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('dd/MM/yyyy')).not.toBeInTheDocument();
    expect(screen.getByText('PO đang xử lý')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đơn mua hàng PO' })).not.toBeInTheDocument();
    expect(screen.getByText(/PO chỉ được tạo từ đề xuất mua hàng đã duyệt/i)).toBeInTheDocument();
  });

  it('renders dynamic supplier partner count and avoids hardcoded 35 partners', async () => {
    vi.spyOn(purchasingApi, 'getSuppliers').mockResolvedValue([
      { supplierId: 's1', supplierCode: 'NCC-01', supplierName: 'Nhà cung cấp Thịt Sạch', isActive: true },
      { supplierId: 's2', supplierCode: 'NCC-02', supplierName: 'Nhà cung cấp Rau Củ', isActive: true },
    ]);

    renderPurchasing();

    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/Tất cả nhà cung cấp \(2 đối tác\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/35 đối tác/i)).not.toBeInTheDocument();
  });

  it('renders Zone 2 TelemetrySubbar (44px) with status tabs and telemetry pills', async () => {
    renderPurchasing();

    // Status tabs
    expect(await screen.findByRole('tab', { name: /Tất cả đơn PO/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dự thảo/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đã duyệt/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đã nhận hàng/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Tổng PO:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng giá trị:/i)).toBeInTheDocument();
    expect(screen.getByText(/Đối tác:/i)).toBeInTheDocument();
  });

  it('renders SplitView with Master PO list (Left) and Detail PO lines (Right) with ZERO <details> tags', async () => {
    const { container } = renderPurchasing();

    // Master columns
    expect(await screen.findByRole('columnheader', { name: 'Mã đơn PO' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhà cung cấp' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày đặt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mặt hàng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tổng tiền' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Detail breakdown columns
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thành tiền' })).toBeInTheDocument();

    // Row item check
    expect(screen.getAllByText(/Thịt đùi heo tươi/i).length).toBeGreaterThan(0);

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('does not expose the unsupported direct PO modal or fabricated ingredient submission path', async () => {
    renderPurchasing();

    await screen.findByRole('heading', { name: 'Thu mua & Đề xuất PO' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Thịt gà phi lê tươi/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận tạo đơn PO' })).not.toBeInTheDocument();
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(purchasingApi, 'getPurchaseOrders').mockRejectedValueOnce(
      new Error('Lỗi máy chủ thu mua')
    );

    renderPurchasing();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ thu mua')).toBeInTheDocument();

    // Click retry
    vi.spyOn(purchasingApi, 'getPurchaseOrders').mockResolvedValueOnce(MOCK_PURCHASE_ORDERS);
    vi.spyOn(purchasingApi, 'getSuppliers').mockResolvedValueOnce(MOCK_SUPPLIERS);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thu mua & Đề xuất PO')).toBeInTheDocument();
  });
});
