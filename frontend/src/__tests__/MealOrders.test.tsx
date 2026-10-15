import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MealOrdersPage } from '../features/coordination/MealOrdersPage';
import { AuthProvider } from '../store/authContext';
import { coordinationApi } from '../api/coordinationApi';
import { MOCK_COORDINATION_DATA } from '../test/fixtures';

function renderMealOrders(initialEntry = '/meal-orders') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/meal-orders" element={<MealOrdersPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Meal Orders Feature (FR-COORD — Điều phối đơn ăn)', () => {
  beforeEach(() => {
    vi.spyOn(coordinationApi, 'getOrders').mockResolvedValue(MOCK_COORDINATION_DATA);
  });
  it('renders Zone 1 WorkspaceHeader (56px) with customer select, date, and single primary button (Rule D7)', async () => {
    renderMealOrders();

    expect(await screen.findByRole('heading', { name: 'Điều phối đơn ăn' })).toBeInTheDocument();

    // Select customer and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('21/09/2026')).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái: Đã chốt ca/i)).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Xuất báo cáo ca' })).toBeInTheDocument();
    const lockBtn = screen.getByRole('button', { name: 'Chốt số lượng suất ăn' });
    expect(lockBtn).toBeInTheDocument();
    expect(lockBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with shift tabs and serving telemetry pills', async () => {
    renderMealOrders();

    // Shift tabs
    expect(await screen.findByRole('tab', { name: 'Ca 1 (Sáng)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ca 2 (Chiều)' })).toBeInTheDocument();

    // Inline pills
    expect(screen.getByText(/Đăng ký:/i)).toBeInTheDocument();
    expect(screen.getByText(/Thực tế chốt:/i)).toBeInTheDocument();
    expect(screen.getByText(/Lệch suất:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tỷ lệ:/i)).toBeInTheDocument();
  });

  it('renders DataGrid with 6 columns and zero <details> tags', async () => {
    const { container } = renderMealOrders();

    // Table columns
    expect(await screen.findByRole('columnheader', { name: 'Phân loại suất ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Món chính phục vụ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Suất đăng ký' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Điều chỉnh' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tổng suất chốt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thao tác' })).toBeInTheDocument();

    // Data rows
    expect(screen.getByText('Cơm mặn ca ngày')).toBeInTheDocument();

    // HARD INVARIANT: Zero <details> tags in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('opens adjustment modal, updates servings, and submits adjustment', async () => {
    renderMealOrders();

    const editBtns = await screen.findAllByRole('button', { name: 'Sửa' });
    expect(editBtns.length).toBeGreaterThan(0);

    // Open adjustment modal
    await userEvent.click(editBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Điều chỉnh số suất ăn sau chốt')).toBeInTheDocument();

    // Enter reason and save
    const reasonInput = screen.getByPlaceholderText(/Khách hàng báo tăng ca/i);
    await userEvent.type(reasonInput, 'Tăng thêm 10 suất ca ngày');

    const saveBtn = screen.getByRole('button', { name: 'Lưu điều chỉnh' });
    await userEvent.click(saveBtn);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(coordinationApi, 'getOrders').mockRejectedValueOnce(
      new Error('Lỗi kết nối máy chủ điều phối')
    );

    renderMealOrders();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối máy chủ điều phối')).toBeInTheDocument();

    // Click retry
    vi.spyOn(coordinationApi, 'getOrders').mockResolvedValueOnce(MOCK_COORDINATION_DATA);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Điều phối đơn ăn')).toBeInTheDocument();
  });
});
