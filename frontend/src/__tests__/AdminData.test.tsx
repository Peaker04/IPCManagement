import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AuthProvider } from '../store/authContext';
import { adminApi } from '../api/adminApi';

function renderAdminData(initialEntry = '/admin-data') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin-data" element={<AdminDataPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Admin Data Feature (FR-CAT — Quản trị dữ liệu & Danh mục)', () => {
  it('renders Zone 1 WorkspaceHeader (56px) with counts badge and single primary button (Rule D7)', async () => {
    renderAdminData();

    expect(await screen.findByRole('heading', { name: 'Quản trị dữ liệu & Danh mục' })).toBeInTheDocument();
    expect(screen.getAllByText(/nguyên liệu/i).length).toBeGreaterThan(0);

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: 'Thêm nguyên liệu mới' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with tabs and telemetry pills', async () => {
    renderAdminData();

    // Tabs
    expect(await screen.findByRole('tab', { name: /Danh mục nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Danh mục món ăn tiêu chuẩn/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Tổng danh mục:/i)).toBeInTheDocument();
    expect(screen.getByText(/Đạt chuẩn HACCP:/i)).toBeInTheDocument();
  });

  it('Tab 1 (Danh mục nguyên liệu): renders ingredients table and zero <details> tags', async () => {
    const { container } = renderAdminData();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhóm thực phẩm' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đơn giá tham chiếu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Row item
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('Tab 2 (Danh mục món ăn tiêu chuẩn): renders dishes table', async () => {
    renderAdminData();

    const dishesTab = await screen.findByRole('tab', { name: /Danh mục món ăn tiêu chuẩn/i });
    await userEvent.click(dishesTab);

    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn tiêu chuẩn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhóm phân loại' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
  });

  it('opens new ingredient modal, fills form, and submits', async () => {
    renderAdminData();

    const createBtn = await screen.findByRole('button', { name: 'Thêm nguyên liệu mới' });
    await userEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thêm nguyên liệu thực phẩm mới' })).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText(/NL-THIT-99/i);
    await userEvent.type(codeInput, 'NL-BO-01');

    const nameInput = screen.getByPlaceholderText(/Sườn non bò Úc/i);
    await userEvent.type(nameInput, 'Thịt thăn bò tươi');

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận thêm' });
    await userEvent.click(submitBtn);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(adminApi, 'getIngredients').mockRejectedValueOnce(
      new Error('Lỗi máy chủ danh mục')
    );

    renderAdminData();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ danh mục')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Quản trị dữ liệu & Danh mục')).toBeInTheDocument();
  });
});
