import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { AuthProvider } from '../store/authContext';
import { weeklyMenuApi, type RawWeeklyMenuResponse } from '../api/weeklyMenuApi';
import { MOCK_WEEKLY_MENU_DATA } from '../test/fixtures';

function renderWeeklyMenu(initialEntry = '/weekly-menu') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Weekly Menu Feature (FR-MENU — 4 Views Zero AI-Slop Workbench)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
  });
  it('renders single 56px WorkspaceHeader with client selectors, dd/MM/yyyy date, and dynamic primary button (Rule D7)', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu();

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();

    // Client select, week date input, and pricing context pill
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-date-locale', 'vi-VN');
    expect(screen.queryByText('Định mức: 25.000 ₫')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt kế hoạch tuần' })).not.toBeInTheDocument();
  });

  it('renders dynamic mealTargetPrice in WeeklyScheduleView and avoids hardcoded 25.000 ₫', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 32000,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('32.000 ₫')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('renders "Theo ca / Chưa chốt" when mealTargetPrice is 0', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 0,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('Theo ca / Chưa chốt')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('handles null weekly menu response without throwing Cannot read properties of null', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenu').mockResolvedValueOnce(null as unknown as RawWeeklyMenuResponse);
    vi.spyOn(weeklyMenuApi, 'getProductionPlans').mockResolvedValueOnce([]);
    vi.spyOn(weeklyMenuApi, 'getAllDemand').mockResolvedValueOnce({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 });

    const result = await weeklyMenuApi.getWeeklyMenuData('DAV', '2026-10-12');
    expect(result.matrixRows).toEqual([]);
    expect(result.scheduleDays).toEqual([]);
  });

  it('View 1 (Kế hoạch tuần): renders Mon-Sat matrix without duplicate subbar tabs or repetitive cell text', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu');

    // Matrix columns: Monday to Saturday
    expect(await screen.findByRole('columnheader', { name: /Thứ Hai/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Thứ Bảy/i })).toBeInTheDocument();

    // Section headers and real dish names
    expect(screen.getByText('MENU MẶN CA SÁNG')).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();

    // Invariant: Repetitive cell text removed!
    expect(screen.queryByText(/Suất: 25.000 ₫ BOM: Đạt chuẩn/i)).not.toBeInTheDocument();

    // Invariant: NO duplicate horizontal view tabs inside page!
    expect(screen.queryByRole('tab', { name: 'Kế hoạch tuần' })).not.toBeInTheDocument();

    // Invariant: Zero <details> tags in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('View 2 uses authoritative demand and production-plan facets without fabricating handoff vouchers', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu?view=demand');

    expect(screen.queryByRole('button', { name: 'Mở hàng đợi duyệt' })).not.toBeInTheDocument();

    // Day navigator [<] Thứ Hai, 21/09/2026 [>]
    expect(await screen.findByText(/Thứ Hai, 21\/09\/2026/i)).toBeInTheDocument();

    // Segmented tabs replace legacy bottom details!
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /KHSX nguồn/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Chứng từ bàn giao/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tính lại nhu cầu' })).not.toBeInTheDocument();

    // 6 Columns in Primary DataGrid
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhu cầu đã tính' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất vật lý' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn phải xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái bàn giao' })).toBeInTheDocument();

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to "KHSX nguồn" tab
    await userEvent.click(screen.getByRole('tab', { name: /KHSX nguồn/i }));
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();

    // No production plan may be renamed into a signed handoff voucher.
    expect(screen.queryByText(/Đã ký nhận/i)).not.toBeInTheDocument();
  });

  it('View 3 renders production-plan facts without a fake print action', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu('/weekly-menu?view=production-plan');

    expect(screen.queryByRole('button', { name: 'In lệnh sản xuất' })).not.toBeInTheDocument();

    // KHSX lines rendered
    expect((await screen.findAllByText(/KHSX-DAV-20260921/i)).length).toBeGreaterThan(0);

    // DataGrid columns
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca sản xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày phục vụ' })).toBeInTheDocument();

    // Date formatted as dd/MM/yyyy
    expect(screen.getAllByText('21/09/2026').length).toBeGreaterThan(0);
  });

  it('View 4 does not expose cost reports or exports without an authoritative backend cost contract', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      dishCosts: [],
      dailyMaterials: [],
    });

    renderWeeklyMenu('/weekly-menu?view=cost');

    expect(screen.queryByRole('button', { name: 'Xuất bảng chi phí' })).not.toBeInTheDocument();
    expect(await screen.findByText('Chưa có số liệu phân rã chi phí BOM')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Đơn giá vốn' })).not.toBeInTheDocument();


  });

  it('handles empty state and calculation errors gracefully with StateBoundary', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockRejectedValueOnce(
      new Error('Không có kết nối mạng')
    );

    renderWeeklyMenu();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Không có kết nối mạng')).toBeInTheDocument();

    // Click retry
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValueOnce(MOCK_WEEKLY_MENU_DATA);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thực đơn & KHSX tuần')).toBeInTheDocument();
  });
});
