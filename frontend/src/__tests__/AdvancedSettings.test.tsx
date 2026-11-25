import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { AdvancedSettingsPage } from '../features/admin/AdvancedSettingsPage';
import { systemApi, type SystemOperationModeDto } from '../api/systemApi';
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
    expect(screen.getByRole('group', { name: 'Chọn chế độ vận hành' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Đối soát Nguyên liệu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Chuyển chế độ' }));
    expect(screen.getByRole('dialog', { name: 'Xác nhận chuyển chế độ vận hành' })).toBeInTheDocument();
  });
  it('requires Backend reason and preserves the current mode on a version conflict', async () => {
    localStorage.setItem('ipc_v3_token', 'admin-session');
    const base: SystemOperationModeDto = { mode: 'DEFAULT', label: 'Mặc định', version: 7, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } };
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValueOnce(base)
      .mockRejectedValueOnce(new ApiError(500, 'Không tải được phiên bản.')).mockResolvedValue({ ...base, version: 8 });
    const change = vi.spyOn(systemApi, 'setOperationalMode').mockRejectedValueOnce(new ApiError(409, 'Chế độ vận hành đã thay đổi.'))
      .mockResolvedValue({ ...base, mode: 'MATERIAL_RECONCILIATION', version: 9 });
    renderPage();

    await screen.findByText(/Chế độ hiện tại: Mặc định/);
    await userEvent.click(screen.getByRole('radio', { name: /Đối soát Nguyên liệu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Chuyển chế độ' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận chuyển chế độ' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Lý do chuyển chế độ/i), { target: { value: 'Hoàn tất công việc đang mở' } });
    expect(confirmBtn).toBeEnabled();
    await userEvent.click(confirmBtn);

    expect(change).toHaveBeenCalledWith('MATERIAL_RECONCILIATION', 7, 'Hoàn tất công việc đang mở');
    const dialog = within(screen.getByRole('dialog', { name: 'Xác nhận chuyển chế độ vận hành' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Chế độ vận hành đã thay đổi.');
    expect(screen.getByText(/Chế độ hiện tại: Mặc định/)).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();
    await userEvent.click(dialog.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Không tải được phiên bản.');
    expect(confirmBtn).toBeDisabled();
    await userEvent.click(dialog.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
    await waitFor(() => expect(confirmBtn).toBeEnabled());
    expect(change).toHaveBeenCalledTimes(1);
    expect(dialog.getByLabelText('Lý do chuyển chế độ')).toHaveValue('Hoàn tất công việc đang mở');
    await userEvent.click(confirmBtn);
    expect(change).toHaveBeenLastCalledWith('MATERIAL_RECONCILIATION', 8, 'Hoàn tất công việc đang mở');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each(['cache', 'diagnostics'])('fails closed from unsupported %s support view to mode settings', async (view) => {
    renderPage(`/settings/advanced?view=${view}`);
    expect(await screen.findByRole('group', { name: 'Chọn chế độ vận hành' })).toBeInTheDocument();
    expect(screen.queryByText(/Dọn cache ngay|Chẩn đoán Kết nối|Database Engine|MySQL 8\.0/i)).not.toBeInTheDocument();
  });

  it('places mode-change feedback between the stable header and mode choices', async () => {
    localStorage.setItem('ipc_v3_token', 'admin-session');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 7, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(systemApi, 'setOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'MRX', version: 8, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderPage();

    await screen.findByText(/Chế độ hiện tại: Mặc định/);
    await userEvent.click(screen.getByRole('radio', { name: /Đối soát Nguyên liệu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Chuyển chế độ' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận chuyển chế độ' }));

    const notice = await screen.findByText('Đã chuyển chế độ vận hành sang Đối soát nguyên liệu.');
    const header = screen.getByRole('heading', { name: 'Cấu hình hệ thống & Vận hành' });
    const options = screen.getByRole('group', { name: 'Chọn chế độ vận hành' });
    expect(header.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Khôi phục mặc định' })).not.toBeInTheDocument();
  });
});
