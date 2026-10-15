import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PurchasingPage } from '../features/purchasing/PurchasingPage';
import { AuthProvider } from '../store/authContext';
import { purchasingApi, getBaselinePurchaseOrders } from '../api/purchasingApi';

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
  it('renders Zone 1 WorkspaceHeader (56px) with supplier select, date, and single primary button (Rule D7)', async () => {
    renderPurchasing();

    expect(await screen.findByRole('heading', { name: 'Thu mua & Đề xuất PO' })).toBeInTheDocument();

    // Select supplier and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-07-21')).toBeInTheDocument();
    expect(screen.getByText('PO đang xử lý')).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: 'Tạo đơn mua hàng PO' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveClass('bg-slate-900');
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

  it('opens new PO modal, fills form, and submits order', async () => {
    renderPurchasing();

    const createBtn = await screen.findByRole('button', { name: 'Tạo đơn mua hàng PO' });
    await userEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tạo đơn mua hàng mới (PO)')).toBeInTheDocument();

    const itemInput = screen.getByPlaceholderText(/Thịt gà phi lê tươi/i);
    await userEvent.type(itemInput, 'Thịt bò tươi');

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận tạo đơn PO' });
    await userEvent.click(submitBtn);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(purchasingApi, 'getPurchaseOrders').mockRejectedValueOnce(
      new Error('Lỗi máy chủ thu mua')
    );

    renderPurchasing();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ thu mua')).toBeInTheDocument();

    // Click retry
    vi.spyOn(purchasingApi, 'getPurchaseOrders').mockResolvedValueOnce(getBaselinePurchaseOrders());
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thu mua & Đề xuất PO')).toBeInTheDocument();
  });
});
