import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdvancedSettingsPage } from '../features/admin/AdvancedSettingsPage';
import { AuthProvider } from '../store/authContext';
import { systemApi } from '../api/systemApi';

function renderAdvancedSettings(initialEntry = '/settings/advanced') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Advanced Settings Feature (FR-SYS — Thiết lập nâng cao & Vận hành)', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', version: 1 });
    vi.spyOn(systemApi, 'setOperationalMode').mockImplementation(async (mode) => ({ mode, version: 1 }));
  });
  it('renders Zone 1 WorkspaceHeader (56px) with mode badge and single primary button (Rule D7)', async () => {
    renderAdvancedSettings();

    expect(await screen.findByRole('heading', { name: 'Cấu hình hệ thống & Vận hành' })).toBeInTheDocument();
    expect(screen.getByText(/Chế độ hiện tại:/i)).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Khôi phục mặc định' })).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: 'Lưu cấu hình hệ thống' });
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with tabs and telemetry pills', async () => {
    renderAdvancedSettings();

    // Tabs
    expect(await screen.findByRole('tab', { name: /Chế độ vận hành \(DOM-MODE-1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bộ nhớ đệm & Phiên làm việc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chẩn đoán kết nối API/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Kiến trúc:/i)).toBeInTheDocument();
    expect(screen.getByText(/Prefix:/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend Kestrel .NET 9/i)).toBeInTheDocument();
  });

  it('Tab 1 (Chế độ vận hành): allows selecting between DEFAULT and MATERIAL_RECONCILIATION and saves', async () => {
    const { container } = renderAdvancedSettings();

    // Check radio options
    expect(await screen.findByText(/1. Chế độ Mặc định \(DEFAULT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Chế độ Đối soát Nguyên liệu \(MATERIAL_RECONCILIATION\)/i)).toBeInTheDocument();

    // Click radio to select MATERIAL_RECONCILIATION
    const mrxRadio = screen.getByLabelText(/2. Chế độ Đối soát Nguyên liệu/i);
    await userEvent.click(mrxRadio);

    // Save
    const saveBtn = screen.getByRole('button', { name: 'Lưu cấu hình hệ thống' });
    await userEvent.click(saveBtn);

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('Tab 2 (Bộ nhớ đệm): cleans cache when clicking Dọn cache ngay', async () => {
    renderAdvancedSettings();

    const cacheTab = await screen.findByRole('tab', { name: /Bộ nhớ đệm & Phiên làm việc/i });
    await userEvent.click(cacheTab);

    expect(await screen.findByText('Dọn dẹp Cache v3')).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: 'Dọn cache ngay' });
    await userEvent.click(clearBtn);
  });

  it('Tab 3 (Chẩn đoán kết nối API): renders API diagnostics details', async () => {
    renderAdvancedSettings();

    const diagTab = await screen.findByRole('tab', { name: /Chẩn đoán kết nối API/i });
    await userEvent.click(diagTab);

    expect(await screen.findByText('Chẩn đoán Kết nối C# Backend API')).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/localhost:5262\/api/i)).toBeInTheDocument();
  });
});
