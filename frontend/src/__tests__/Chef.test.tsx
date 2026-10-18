import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { AuthProvider } from '../store/authContext';
import { chefApi } from '../api/chefApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_CHEF_DATA } from '../test/fixtures';

function renderChef(initialEntry = '/chef?view=plans') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/chef" element={<ChefDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Chef Feature (FR-CHEF — Bếp trưởng & bàn giao)', () => {
  beforeEach(() => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue(MOCK_CHEF_DATA);
  });

  it('renders authoritative production-plan facts without fake chef, progress, or completion actions', async () => {
    renderChef('/chef?view=plans');

    expect(await screen.findByRole('heading', { name: 'Bếp trưởng & Bàn giao ca' })).toBeInTheDocument();
    expect(screen.getByText(/Đang xem: Kế hoạch sản xuất/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/Phụ trách:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tiến độ:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hoàn tất ca nấu/i })).not.toBeInTheDocument();

    expect(await screen.findByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
  });

  it('renders persisted DEFAULT inventory issues without a fabricated quality checklist', async () => {
    renderChef('/chef?view=issues');

    expect(await screen.findByText(/Đang xem: Phiếu xuất bàn giao/i)).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Mã phiếu xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kho xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bếp xác nhận' })).toBeInTheDocument();
    expect(screen.getByText('ISS-20260921-01')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Giá đỗ sạch')).not.toBeInTheDocument();
  });

  it('pages persisted inventory issues through the backend contract', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue({
      ...MOCK_CHEF_DATA,
      issuePage: { totalCount: 26, pageNumber: 1, pageSize: 25, totalPages: 2, hasPrev: false, hasNext: true },
    });
    renderChef('/chef?view=issues');

    await userEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));

    expect(chefApi.getChefDashboardData).toHaveBeenLastCalledWith(expect.any(String), 'MORNING', 'customer-1', 2, 25);
  });

  it('handles API errors and retries the current customer/date/shift scope', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockRejectedValueOnce(new Error('Lỗi đồng bộ dữ liệu bếp'));
    renderChef();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi đồng bộ dữ liệu bếp')).toBeInTheDocument();
  });

  it('renders clean empty state when no production plans exist for the selected scope', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue({
      ...MOCK_CHEF_DATA,
      plans: [],
      issues: [],
      totalPlans: 0,
      sentPlans: 0,
      totalServings: 0,
      issuePage: { totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false },
    });

    renderChef('/chef?view=plans');

    expect(await screen.findByText('Chưa có kế hoạch sản xuất')).toBeInTheDocument();
    expect(screen.getByText('Chưa có KHSX được duyệt cho ngày, ca và khách hàng đã chọn.')).toBeInTheDocument();
  });
});
