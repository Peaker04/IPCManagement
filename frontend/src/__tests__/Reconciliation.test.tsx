import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';
import { reconciliationApi } from '../api/reconciliationApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_RECONCILIATION } from '../test/fixtures';
import { ApiError } from '../api/client';
import { systemApi } from '../api/systemApi';

function renderReconciliation(initialEntry = '/reconciliation') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reconciliation" element={<ReconciliationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Reconciliation Feature (FR-RECON — Đối soát nguyên liệu)', () => {
  beforeEach(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(reconciliationApi, 'getReconciliationSummary').mockResolvedValue(MOCK_RECONCILIATION);
    vi.spyOn(reconciliationApi, 'completeReconciliation').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      status: 'COMPLETED',
      version: 8,
    });
  });
  it('renders Zone 1 WorkspaceHeader (56px) with customer select, date, and single primary button (Rule D7)', async () => {
    renderReconciliation();

    expect(await screen.findByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();

    // Customer select and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-date-locale', 'vi-VN');
    expect(await screen.findByText('Đang đối chiếu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất biên bản đối soát' })).not.toBeInTheDocument();
    const completeBtn = screen.getByRole('button', { name: 'Chốt đối soát ca' });
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn).toHaveClass('bg-slate-900');
  });

  it('uses one MRX review surface without fabricated history tabs or financial telemetry', async () => {
    renderReconciliation();

    expect(await screen.findByText(/Phiên bản lô:/i)).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái tuần:/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/Suất chốt:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hao hụt chung:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chênh lệch tiền:/i)).not.toBeInTheDocument();
  });

  it('renders backend MRX daily-line fields without fabricated kitchen-use or waste columns', async () => {
    const { container } = renderReconciliation();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhu cầu đã khóa' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất theo sổ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Chênh lệch xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái dòng' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Bếp sử dụng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Hao hụt (%)' })).not.toBeInTheDocument();

    // Row item check
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('blocks completion outside MATERIAL_RECONCILIATION without issuing a mutation', async () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    vi.mocked(systemApi.getOperationalMode).mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát ca' });
    expect(completeBtn).toBeDisabled();
    await userEvent.click(completeBtn);
    expect(reconciliationApi.completeReconciliation).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Chỉ khả dụng trong chế độ đối soát nguyên liệu.' })).toBeInTheDocument();
  });

  it('opens complete modal and submits reconciliation lock', async () => {
    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát ca' });
    await userEvent.click(completeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xác nhận hoàn tất lô đối soát' })).toBeInTheDocument();

    const confirmModalBtn = screen.getByRole('button', { name: 'Xác nhận hoàn tất lô' });
    await userEvent.click(confirmModalBtn);

    expect(reconciliationApi.completeReconciliation).toHaveBeenCalledWith(
      'recon-batch-20260921-01',
      7
    );
  });

  it('keeps the loaded batch visible when completion conflicts with a newer version', async () => {
    vi.spyOn(reconciliationApi, 'completeReconciliation').mockRejectedValueOnce(new ApiError(409, 'Phiên bản lô đã thay đổi'));
    renderReconciliation();

    await userEvent.click(await screen.findByRole('button', { name: 'Chốt đối soát ca' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tất lô' }));

    expect(await screen.findByText('Xung đột dữ liệu đồng thời')).toBeInTheDocument();
    expect(screen.getByText('Phiên bản lô đã thay đổi')).toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(reconciliationApi, 'getReconciliationSummary').mockRejectedValueOnce(
      new Error('Lỗi máy chủ đối soát')
    );

    renderReconciliation();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ đối soát')).toBeInTheDocument();

    // Click retry
    vi.spyOn(reconciliationApi, 'getReconciliationSummary').mockResolvedValueOnce(MOCK_RECONCILIATION);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Đối soát nguyên liệu')).toBeInTheDocument();
  });
});
