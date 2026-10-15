import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { AuthProvider } from '../store/authContext';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
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
  it('renders single 56px WorkspaceHeader with client selectors, dd/MM/yyyy date, and dynamic primary button (Rule D7)', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu();

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();

    // Client select, week date input, and pricing context pill
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // Rule: VietnameseDateInput must display dd/MM/yyyy (21/09/2026), never MM/dd/yyyy!
    expect(screen.getByDisplayValue('21/09/2026')).toBeInTheDocument();
    expect(screen.getByText('Định mức: 25.000 ₫')).toBeInTheDocument();

    // Rule D7: 1 primary + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const primaryBtn = screen.getByRole('button', { name: 'Duyệt kế hoạch tuần' });
    expect(primaryBtn).toBeInTheDocument();
    expect(primaryBtn).toHaveClass('bg-slate-900');
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

  it('View 2 (Bàn giao nguyên liệu — ?view=demand): Header adapts to [Mở hàng đợi duyệt] as primary (Rule D7), and ZERO <details>', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu?view=demand');

    // Header primary button dynamically adapted to View 2
    const headerPrimaryBtn = await screen.findByRole('button', { name: 'Mở hàng đợi duyệt' });
    expect(headerPrimaryBtn).toBeInTheDocument();
    expect(headerPrimaryBtn).toHaveClass('bg-slate-900');

    // Day navigator [<] Thứ Hai, 21/09/2026 [>]
    expect(screen.getByText(/Thứ Hai, 21\/09\/2026/i)).toBeInTheDocument();

    // Segmented tabs replace legacy bottom details!
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /KHSX nguồn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chứng từ bàn giao/i })).toBeInTheDocument();

    // Subbar button is outline
    const recalculateBtn = screen.getByRole('button', { name: 'Tính lại nhu cầu' });
    expect(recalculateBtn).toBeInTheDocument();
    expect(recalculateBtn).toHaveClass('border-slate-300');

    // 6 Columns in Primary DataGrid
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Món sử dụng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cần' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Chưa xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to "KHSX nguồn" tab
    await userEvent.click(screen.getByRole('tab', { name: /KHSX nguồn/i }));
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();

    // Switch to "Chứng từ bàn giao" tab
    await userEvent.click(screen.getByRole('tab', { name: /Chứng từ bàn giao/i }));
    expect(screen.getByRole('columnheader', { name: 'Mã chứng từ' })).toBeInTheDocument();
  });

  it('View 3 (Kế hoạch sản xuất — ?view=production-plan): Header adapts to [In lệnh sản xuất] and dates are dd/MM/yyyy', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu('/weekly-menu?view=production-plan');

    // Header primary button dynamically adapted to View 3
    const headerPrimaryBtn = await screen.findByRole('button', { name: 'In lệnh sản xuất' });
    expect(headerPrimaryBtn).toBeInTheDocument();
    expect(headerPrimaryBtn).toHaveClass('bg-slate-900');

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

  it('View 4 (Giá vốn & Định mức BOM — ?view=cost): Header adapts to [Xuất bảng chi phí], shows 5 BOM columns including Đơn giá, and ZERO <details>', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu?view=cost');

    // Header primary button dynamically adapted to View 4
    const headerPrimaryBtn = await screen.findByRole('button', { name: 'Xuất bảng chi phí' });
    expect(headerPrimaryBtn).toBeInTheDocument();
    expect(headerPrimaryBtn).toHaveClass('bg-slate-900');

    // Master Left: Dishes table
    expect(await screen.findByRole('columnheader', { name: 'Món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đơn giá vốn' })).toBeInTheDocument();

    // Detail Right: 2 Tabs
    expect(screen.getByRole('tab', { name: /Định mức BOM món đang chọn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tổng nguyên liệu ngày/i })).toBeInTheDocument();

    // Check BOM table has 5 columns: Nguyên liệu | ĐVT | Định mức/suất | Đơn giá | Thành tiền
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Định mức/suất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đơn giá' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Thành tiền' }).length).toBeGreaterThanOrEqual(1);

    // Check Kilogram renders without overflow
    expect(screen.getAllByText('Kilogram').length).toBeGreaterThan(0);

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to Tab 2: Tổng nguyên liệu ngày
    await userEvent.click(screen.getByRole('tab', { name: /Tổng nguyên liệu ngày/i }));
    expect(screen.getByText(/Tổng hợp nguyên liệu ca ngày/i)).toBeInTheDocument();
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
