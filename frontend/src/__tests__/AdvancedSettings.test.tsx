import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { AdvancedSettingsPage } from '../features/admin/AdvancedSettingsPage';
import { systemApi } from '../api/systemApi';
import { ApiError } from '../api/client';

function renderPage(entry = '/settings/advanced?view=mode') { return render(<AuthProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/settings/advanced" element={<AdvancedSettingsPage />} /></Routes></MemoryRouter></AuthProvider>); }
describe('Advanced Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: '10000000-0000-0000-0000-000000000001',
      username: 'admin',
      fullName: 'Admin User',
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isActive: true,
      isAdminFullAccess: true,
      permissions: ['*'],
    }));
  });
  it('uses URL-owned mode view without duplicate tabs and confirms mode transition', async () => {
    renderPage();
    expect(screen.getByText(/Đang xem: Chế độ vận hành/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Đối soát Nguyên liệu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình hệ thống' }));
    expect(screen.getByRole('dialog', { name: 'Xác nhận chuyển chế độ vận hành' })).toBeInTheDocument();
  });
  it('requires Backend reason and preserves the current mode on a version conflict', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 7, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } });
    const change = vi.spyOn(systemApi, 'setOperationalMode').mockRejectedValue(new ApiError(409, 'Chế độ vận hành đã thay đổi.'));
    renderPage();

    await screen.findByText(/Chế độ hiện tại: Mặc định/);
    await userEvent.click(screen.getByRole('radio', { name: /Đối soát Nguyên liệu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình hệ thống' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận chuyển chế độ' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Lý do chuyển chế độ/i), { target: { value: 'Hoàn tất công việc đang mở' } });
    expect(confirmBtn).toBeEnabled();
    await userEvent.click(confirmBtn);

    expect(change).toHaveBeenCalledWith('MATERIAL_RECONCILIATION', 7, 'Hoàn tất công việc đang mở');
    expect(await screen.findByRole('alert')).toHaveTextContent('Chế độ vận hành đã thay đổi.');
    expect(screen.getByText(/Chế độ hiện tại: Mặc định/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
  });

  it.each(['cache', 'diagnostics'])('fails closed from unsupported %s support view to mode settings', async (view) => {
    renderPage(`/settings/advanced?view=${view}`);
    expect(await screen.findByText(/Đang xem: Chế độ vận hành/)).toBeInTheDocument();
    expect(screen.queryByText(/Dọn cache ngay|Chẩn đoán Kết nối|Database Engine|MySQL 8\.0/i)).not.toBeInTheDocument();
  });
});
