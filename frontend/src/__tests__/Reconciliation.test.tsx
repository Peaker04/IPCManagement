import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';
import { reconciliationApi, getBaselineReconciliationData } from '../api/reconciliationApi';

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
  it('renders Zone 1 WorkspaceHeader (56px) with customer select, date, and single primary button (Rule D7)', async () => {
    renderReconciliation();

    expect(await screen.findByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();

    // Customer select and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-09-21')).toBeInTheDocument();
    expect(screen.getByText('Ca 1 đã hoàn tất')).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Xuất biên bản đối soát' })).toBeInTheDocument();
    const completeBtn = screen.getByRole('button', { name: 'Chốt đối soát ca' });
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with segmented tabs and telemetry pills', async () => {
    renderReconciliation();

    // Segmented tabs
    expect(await screen.findByRole('tab', { name: /Bảng sai lệch ca/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch sử chốt sổ/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Mã lô đối soát:/i)).toBeInTheDocument();
    expect(screen.getByText(/Suất chốt:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hao hụt chung:/i)).toBeInTheDocument();
    expect(screen.getByText(/Chênh lệch tiền:/i)).toBeInTheDocument();
  });

  it('renders DataGrid with 9 columns and ZERO <details> tags', async () => {
    const { container } = renderReconciliation();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Định mức BOM' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Xuất kho thực tế' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bếp sử dụng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sai lệch (+/-)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hao hụt (%)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đánh giá' })).toBeInTheDocument();

    // Row item check
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('opens complete modal and submits reconciliation lock', async () => {
    renderReconciliation();

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát ca' });
    await userEvent.click(completeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xác nhận chốt sổ đối soát ca' })).toBeInTheDocument();

    const confirmModalBtn = screen.getByRole('button', { name: 'Xác nhận chốt sổ & Khóa ca' });
    await userEvent.click(confirmModalBtn);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(reconciliationApi, 'getReconciliationSummary').mockRejectedValueOnce(
      new Error('Lỗi máy chủ đối soát')
    );

    renderReconciliation();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ đối soát')).toBeInTheDocument();

    // Click retry
    vi.spyOn(reconciliationApi, 'getReconciliationSummary').mockResolvedValueOnce(getBaselineReconciliationData());
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Đối soát nguyên liệu')).toBeInTheDocument();
  });
});
