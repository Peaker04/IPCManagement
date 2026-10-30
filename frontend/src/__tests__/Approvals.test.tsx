import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApprovalPage } from '../features/approvals/ApprovalPage';
import { AuthProvider } from '../store/authContext';
import { approvalsApi } from '../api/approvalsApi';
import { ApiError } from '../api/client';
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
    expect(screen.queryByPlaceholderText('dd/MM/yyyy')).not.toBeInTheDocument();
    expect(screen.getAllByText(/chờ xử lý/i).length).toBeGreaterThan(0);

    // Rule D7: Single primary button hierarchy - header keeps outline refresh, drawer owns primary decision
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phê duyệt yêu cầu đang chọn' })).not.toBeInTheDocument();
    const drawerApproveBtn = (await screen.findAllByRole('button', { name: 'Phê duyệt hồ sơ' }))[0];
    expect(drawerApproveBtn).toBeInTheDocument();
    expect(drawerApproveBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with filter tabs and telemetry pills', async () => {
    renderApprovals();

    // Filter tabs
    expect(await screen.findByRole('tab', { name: /Tất cả yêu cầu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đơn mua hàng PO/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Phiếu nhập kho/i })).toBeInTheDocument();

    // Only telemetry derivable from the authoritative inbox is shown.
    expect(screen.getByText(/Chờ duyệt:/i)).toBeInTheDocument();
    expect(screen.queryByText(/SLA khẩn:|Đã duyệt hôm nay:/i)).not.toBeInTheDocument();
  });

  it('renders SplitView with Master Queue (Left) and Detail Decision Drawer (Right) with ZERO <details> tags', async () => {
    const { container } = renderApprovals();

    // Master columns
    expect(await screen.findByRole('columnheader', { name: 'Mã đối tượng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tiêu đề yêu cầu/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Người gửi' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hạn SLA' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Quy mô' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Detail header
    expect(screen.getByText('Chi tiết hồ sơ phê duyệt')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('approves selected item and updates decision', async () => {
    const decideSpy = vi.spyOn(approvalsApi, 'decide').mockResolvedValue({ success: true });
    renderApprovals();

    const approveBtns = await screen.findAllByRole('button', { name: 'Phê duyệt hồ sơ' });
    expect(approveBtns.length).toBeGreaterThan(0);
    await userEvent.click(approveBtns[0]);

    // Confirm inside modal
    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận phê duyệt' });
    await userEvent.click(confirmBtn);

    expect(decideSpy).toHaveBeenCalledWith(
      MOCK_APPROVALS[0].targetType,
      MOCK_APPROVALS[0].targetId,
      'APPROVE',
      'Phê duyệt hồ sơ theo thẩm quyền'
    );
  });

  it('keeps loaded inbox data visible when a decision conflicts with a newer version', async () => {
    vi.spyOn(approvalsApi, 'decide').mockRejectedValueOnce(new ApiError(409, 'Hồ sơ đã được người khác xử lý'));
    renderApprovals();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Phê duyệt hồ sơ' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));

    expect(await screen.findByText('Xung đột dữ liệu đồng thời')).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ đã được người khác xử lý')).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_APPROVALS[0].targetCode).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
  });

  it('preserves HTTP 403 as a permission-denied state', async () => {
    vi.spyOn(approvalsApi, 'getInbox').mockRejectedValueOnce(new ApiError(403, 'Không có quyền duyệt'));

    renderApprovals();

    expect(await screen.findByText('Truy cập bị hạn chế')).toBeInTheDocument();
    expect(screen.queryByText('Không thể tải dữ liệu')).not.toBeInTheDocument();
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

  it('blocks rejection without a mandatory reason according to BR-GLOBAL-03', async () => {
    const user = userEvent.setup();
    renderApprovals();

    const rejectBtns = await screen.findAllByRole('button', { name: 'Từ chối hồ sơ' });
    expect(rejectBtns.length).toBeGreaterThan(0);
    await user.click(rejectBtns[0]);

    const confirmRejectBtn = screen.getByRole('button', { name: 'Xác nhận từ chối' });
    await user.click(confirmRejectBtn);

    expect(screen.getByText(/Vui lòng nhập lý do từ chối hồ sơ/i)).toBeInTheDocument();
  });

  it('preserves rejection reason inside modal when rejection API call fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(approvalsApi, 'decide').mockRejectedValueOnce(new Error('Lỗi máy chủ khi từ chối'));
    renderApprovals();

    const rejectBtns = await screen.findAllByRole('button', { name: 'Từ chối hồ sơ' });
    await user.click(rejectBtns[0]);

    const reasonInput = screen.getByPlaceholderText(/Nhập lý do từ chối/i);
    await user.type(reasonInput, 'Hồ sơ thiếu báo giá của bên thứ ba');

    const confirmRejectBtn = screen.getByRole('button', { name: 'Xác nhận từ chối' });
    await user.click(confirmRejectBtn);

    // Modal stays open, reason is preserved, and error banner is displayed
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Hồ sơ thiếu báo giá của bên thứ ba').length).toBeGreaterThan(0);
    expect(screen.getByText(/Lỗi máy chủ khi từ chối/i)).toBeInTheDocument();
  });
});
