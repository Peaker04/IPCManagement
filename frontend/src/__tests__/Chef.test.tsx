import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { AuthProvider } from '../store/authContext';
import { chefApi } from '../api/chefApi';
import { mrxApi } from '../api/mrxApi';
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

  it('MRX cooking workbench renders sanitized cooking projection with allowed frozen fields and no warehouse/price columns', async () => {
    vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({
      batchId: 'batch-1',
      sourceVersion: 2,
      rows: [{
        serviceDate: '2026-06-15',
        weekday: 'Thứ Hai',
        shiftName: 'Ca sáng',
        dishCode: 'MON-01',
        dishName: 'Cơm sườn nướng',
        servings: 100,
        ingredientCode: 'SUON-01',
        ingredientName: 'Sườn heo',
        unitName: 'kg',
        bomQuantityPerServing: 0.15,
        wasteRatePercent: 5,
        totalRequiredQuantity: 15,
      }],
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderChef('/chef?view=mrx-cooking&batchId=batch-1');

    expect(await screen.findByRole('heading', { name: 'Phiếu nấu theo lô' })).toBeInTheDocument();
    expect(await screen.findByText('Cơm sườn nướng')).toBeInTheDocument();
    expect(screen.getByText('Sườn heo')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    // Forbidden fields & mutations MUST NOT exist
    expect(screen.queryByText(/Đơn giá/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Giá vốn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thực xuất/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tồn kho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chênh lệch/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận nhận hàng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chốt đối soát/i })).not.toBeInTheDocument();

    // Export buttons
    const csvBtn = screen.getByRole('button', { name: 'Tải CSV' });
    await userEvent.click(csvBtn);
    expect(openSpy).toHaveBeenCalledWith('/api/reconciliation/batches/batch-1/kitchen-cooking/csv', '_blank');

    const xlsxBtn = screen.getByRole('button', { name: 'Tải Excel' });
    await userEvent.click(xlsxBtn);
    expect(openSpy).toHaveBeenCalledWith('/api/reconciliation/batches/batch-1/kitchen-cooking/xlsx', '_blank');

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const printBtn = screen.getByRole('button', { name: 'In phiếu nấu' });
    await userEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  it('MRX cooking workbench surfaces compatibility error neutrally when lineage is missing', async () => {
    vi.spyOn(mrxApi, 'getKitchenCooking').mockRejectedValueOnce(
      new Error('KITCHEN_FROZEN_LINEAGE_MISSING: Lô chưa có định lượng đóng băng theo ngày')
    );

    renderChef('/chef?view=mrx-cooking&batchId=batch-legacy');

    expect(await screen.findByText(/KITCHEN_FROZEN_LINEAGE_MISSING/)).toBeInTheDocument();
  });

  it('Route 6: respects batchId from URL on F5 reload without falling back to preferred batch', async () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [
        { batchId: 'batch-first', customerId: 'c-1', customerName: 'Khách A', customerCode: 'KA', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' },
        { batchId: 'batch-target', customerId: 'c-2', customerName: 'Khách B', customerCode: 'KB', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 1, createdAt: '2026-10-19T00:00:00Z' },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getKitchenCooking').mockResolvedValue({
      batchId: 'batch-target', sourceVersion: 1, rows: [],
    });

    renderChef('/chef?view=mrx-cooking&batchId=batch-target');

    const select = await screen.findByRole('combobox', { name: 'Chọn lô đối soát nấu' });
    expect(select).toHaveValue('batch-target');
  });
});
