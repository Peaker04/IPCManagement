import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { AdvancedSettingsPage } from '../features/admin/AdvancedSettingsPage';
import { systemApi } from '../api/systemApi';
import { ApiError } from '../api/client';

function renderPage(entry = '/settings/advanced?view=mode') { return render(<AuthProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/settings/advanced" element={<AdvancedSettingsPage />} /></Routes></MemoryRouter></AuthProvider>); }
describe('Advanced Settings', () => {
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
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Lý do chuyển chế độ'), 'Hoàn tất công việc đang mở');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' }));

    expect(change).toHaveBeenCalledWith('MATERIAL_RECONCILIATION', 7, 'Hoàn tất công việc đang mở');
    expect(await screen.findByRole('alert')).toHaveTextContent('Chế độ vận hành đã thay đổi.');
    expect(screen.getByText(/Chế độ hiện tại: Mặc định/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
  });

  it('uses URL-owned cache view and confirms cache cleanup', async () => {
    renderPage('/settings/advanced?view=cache');
    expect(screen.getByText(/Đang xem: Bộ nhớ phiên/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dọn cache ngay' }));
    expect(screen.getByRole('dialog', { name: 'Xác nhận dọn bộ nhớ phiên' })).toBeInTheDocument();
  });
  it('uses URL-owned diagnostics view', () => {
    renderPage('/settings/advanced?view=diagnostics');
    expect(screen.getByText(/Đang xem: Chẩn đoán kết nối/)).toBeInTheDocument();
    expect(screen.getByText('Chẩn đoán Kết nối C# Backend API')).toBeInTheDocument();
  });
});
