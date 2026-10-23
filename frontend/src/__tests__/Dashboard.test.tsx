import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AuthProvider } from '../store/authContext';
import { dashboardApi } from '../api/dashboardApi';
import { MOCK_DASHBOARD_DATA } from '../test/fixtures';

function renderDashboard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Dashboard Feature (FR-DASH — Bàn điều hành hôm nay)', () => {
  beforeEach(() => {
    vi.spyOn(dashboardApi, 'getDashboardData').mockResolvedValue(MOCK_DASHBOARD_DATA);
  });
  it('renders Zone 1 WorkspaceHeader (56px) with date, badges, and single primary button (Rule D7)', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Bàn điều hành hôm nay' })).toBeInTheDocument();
    expect(screen.getByText(/(?:Thứ (?:Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật),\s*\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
    expect(screen.getByText(/Ca 1 & Ca 2 đang vận hành/i)).toBeInTheDocument();

    // Actions: 1 primary + 1 outline (Rule D7)
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở bàn giao ca' })).toHaveClass('bg-slate-900');
  });

  it('renders 5 flat metric cards (56px strip) and allows metric filtering', async () => {
    renderDashboard();

    // Check 5 real metrics from backend / baseline
    expect(await screen.findByText('Suất ăn theo KHSX')).toBeInTheDocument();
    expect(screen.getByText('10.290')).toBeInTheDocument();
    expect(screen.getByText('Vật tư thiếu hụt')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu PO quá hạn')).toBeInTheDocument();
    expect(screen.getByText('Phiếu nhập trễ hạn')).toBeInTheDocument();
    expect(screen.getByText('Chất lượng dữ liệu')).toBeInTheDocument();

    // Click metric "Vật tư thiếu hụt" to filter tasks
    const shortageMetricBtn = screen.getByRole('button', { name: /Vật tư thiếu hụt/i });
    await userEvent.click(shortageMetricBtn);

    // Verify task filtering
    expect(screen.getByText(/Ký duyệt bàn giao nguyên liệu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lọc metric' })).toBeInTheDocument();

    // Clear filter
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc metric' }));
    expect(screen.getByText(/Xác nhận phiếu xuất kho rau củ/i)).toBeInTheDocument();
  });

  it('renders SplitView with 4-column Task Table (Left) and 4-Stage Vertical Stepper (Right)', async () => {
    renderDashboard();

    // Master Left: Tasks table
    expect(await screen.findByText('Việc cần xử lý trước')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhiệm vụ & Quy trình' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phụ trách' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thời hạn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thao tác' })).toBeInTheDocument();

    // Detail Right: 4-Stage Stepper
    expect(screen.getByText('Tiến độ 4 công đoạn')).toBeInTheDocument();
    expect(screen.getByText('1. Tiếp nhận & Chốt đơn ăn')).toBeInTheDocument();
    expect(screen.getByText('2. Lập KHSX & Tính nhu cầu BOM')).toBeInTheDocument();
    expect(screen.getByText('3. Xuất kho & Chế biến tại bếp')).toBeInTheDocument();
    expect(screen.getByText('4. Giao nhận suất & Đối soát')).toBeInTheDocument();
  });

  it('handles error state and provides retry mechanism', async () => {
    vi.spyOn(dashboardApi, 'getDashboardData').mockRejectedValueOnce(
      new Error('Mạng bị gián đoạn')
    );

    renderDashboard();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Mạng bị gián đoạn')).toBeInTheDocument();

    // Click retry
    vi.spyOn(dashboardApi, 'getDashboardData').mockResolvedValueOnce(MOCK_DASHBOARD_DATA);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Việc cần xử lý trước')).toBeInTheDocument();
  });
});
