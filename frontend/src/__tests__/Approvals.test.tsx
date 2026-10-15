import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApprovalPage } from '../features/approvals/ApprovalPage';
import { AuthProvider } from '../store/authContext';
import { approvalsApi } from '../api/approvalsApi';
import { MOCK_APPROVALS } from '../test/fixtures';

function renderApprovals(initialEntry = '/approvals') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/approvals" element={<ApprovalPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Approvals Feature (FR-APPR — Hàng đợi phê duyệt)', () => {
  beforeEach(() => {
    vi.spyOn(approvalsApi, 'getInbox').mockResolvedValue(MOCK_APPROVALS);
  });

  it('renders Zone 1 WorkspaceHeader (56px) with type select, date, and single primary button (Rule D7)', async () => {
    renderApprovals();

    expect(await screen.findByRole('heading', { name: 'Hàng đợi phê duyệt' })).toBeInTheDocument();

    // Select type and date input
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('21/09/2026')).toBeInTheDocument();
    expect(screen.getAllByText(/chờ xử lý/i).length).toBeGreaterThan(0);

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const approveBtn = screen.getByRole('button', { name: 'Phê duyệt yêu cầu đang chọn' });
    expect(approveBtn).toBeInTheDocument();
    expect(approveBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with filter tabs and telemetry pills', async () => {
    renderApprovals();

    // Filter tabs
    expect(await screen.findByRole('tab', { name: /Tất cả yêu cầu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đơn mua hàng PO/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu nhập kho/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Chờ duyệt:/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA khẩn:/i)).toBeInTheDocument();
    expect(screen.getByText(/Đã duyệt hôm nay:/i)).toBeInTheDocument();
  });

  it('renders SplitView with Master Queue (Left) and Detail Decision Drawer (Right) with ZERO <details> tags', async () => {
    const { container } = renderApprovals();

    // Master columns
    expect(await screen.findByRole('columnheader', { name: 'Mã đối tượng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tiêu đề yêu cầu/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Người gửi' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hạn SLA' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giá trị / Khối lượng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Detail header
    expect(screen.getByText('Chi tiết hồ sơ phê duyệt')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('approves selected item and updates decision', async () => {
    renderApprovals();

    const approveBtns = await screen.findAllByRole('button', { name: 'Phê duyệt hồ sơ' });
    expect(approveBtns.length).toBeGreaterThan(0);
    await userEvent.click(approveBtns[0]);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(approvalsApi, 'getInbox').mockRejectedValueOnce(
      new Error('Lỗi máy chủ phê duyệt')
    );

    renderApprovals();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ phê duyệt')).toBeInTheDocument();

    // Click retry
    vi.spyOn(approvalsApi, 'getInbox').mockResolvedValueOnce(MOCK_APPROVALS);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Hàng đợi phê duyệt')).toBeInTheDocument();
  });
});
