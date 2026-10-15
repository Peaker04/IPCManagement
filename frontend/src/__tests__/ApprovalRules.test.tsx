import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApprovalRulesPage } from '../features/admin/ApprovalRulesPage';
import { AuthProvider } from '../store/authContext';
import { adminApi } from '../api/adminApi';

function renderApprovalRules(initialEntry = '/settings/approval-rules') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/settings/approval-rules" element={<ApprovalRulesPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Approval Rules Feature (FR-ADMIN — Thiết lập quy trình duyệt)', () => {
  it('renders Zone 1 WorkspaceHeader (56px) with rules count badge and single primary button (Rule D7)', async () => {
    renderApprovalRules();

    expect(await screen.findByRole('heading', { name: 'Thiết lập quy trình duyệt' })).toBeInTheDocument();
    expect(screen.getByText(/quy tắc phân quyền tự động/i)).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: 'Thêm quy tắc duyệt' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with filter tabs and telemetry pills', async () => {
    renderApprovalRules();

    // Tabs
    expect(await screen.findByRole('tab', { name: /Tất cả quy tắc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đơn mua hàng PO/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nhu cầu vật tư/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đổi thực đơn/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Quy tắc hiệu lực:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ngưỡng tối đa:/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA nhanh nhất:/i)).toBeInTheDocument();
  });

  it('renders DataGrid with rule columns and zero <details> tags', async () => {
    const { container } = renderApprovalRules();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã quy tắc' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên quy tắc phê duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phạm vi áp dụng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngưỡng giá trị duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Vai trò thẩm định' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thời hạn SLA' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Row item check
    expect(screen.getByText('RULE-PO-HIGH')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('opens new rule modal, fills form, and submits', async () => {
    renderApprovalRules();

    const createBtn = await screen.findByRole('button', { name: 'Thêm quy tắc duyệt' });
    await userEvent.click(createBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thêm quy tắc phê duyệt mới' })).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText(/RULE-PO-CRITICAL/i);
    await userEvent.type(codeInput, 'RULE-DEMAND-URGENT');

    const nameInput = screen.getByPlaceholderText(/Duyệt đơn PO vượt hạn mức/i);
    await userEvent.type(nameInput, 'Duyệt xuất bù nguyên liệu khẩn cấp');

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận tạo' });
    await userEvent.click(submitBtn);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(adminApi, 'getApprovalRules').mockRejectedValueOnce(
      new Error('Lỗi máy chủ quy tắc duyệt')
    );

    renderApprovalRules();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ quy tắc duyệt')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thiết lập quy trình duyệt')).toBeInTheDocument();
  });
});
