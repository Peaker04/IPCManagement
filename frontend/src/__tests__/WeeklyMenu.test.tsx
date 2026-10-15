import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { AuthProvider } from '../store/authContext';
import { weeklyMenuApi, getBaselineWeeklyMenuData } from '../api/weeklyMenuApi';

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
  it('renders single 56px WorkspaceHeader with client selectors and 1 primary button (Rule D7)', async () => {
    renderWeeklyMenu();

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();

    // Client select, week date input, and pricing context pill
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-09-21')).toBeInTheDocument();
    expect(screen.getByText('Định mức: 25.000 ₫')).toBeInTheDocument();

    // Rule D7: 1 primary + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const primaryBtn = screen.getByRole('button', { name: 'Duyệt kế hoạch tuần' });
    expect(primaryBtn).toHaveClass('bg-slate-900');
  });

  it('View 1 (Kế hoạch tuần): renders TelemetrySubbar and Mon-Sat matrix without duplicate subbar tabs or repetitive text', async () => {
    const { container } = renderWeeklyMenu('/weekly-menu');

    // Telemetry pills
    expect(await screen.findByText(/Trạng thái: Đã duyệt tuần/i)).toBeInTheDocument();

    // Matrix columns: Monday to Saturday
    expect(screen.getByRole('columnheader', { name: /Thứ Hai/i })).toBeInTheDocument();
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

  it('View 2 (Bàn giao nguyên liệu — ?view=demand): renders segmented tabs, 6-col DataGrid, single primary action (Rule D7), and ZERO <details>', async () => {
    const { container } = renderWeeklyMenu('/weekly-menu?view=demand');

    // Day navigator [<] Thứ Hai, 21/09/2026 [>]
    expect(await screen.findByText(/Thứ Hai, 21\/09\/2026/i)).toBeInTheDocument();

    // Segmented tabs replace legacy bottom details!
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /KHSX nguồn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chứng từ bàn giao/i })).toBeInTheDocument();

    // Action buttons: TelemetrySubbar buttons are outline to preserve Rule D7
    expect(screen.getByRole('button', { name: 'Tính lại nhu cầu' })).toBeInTheDocument();
    const openApprovalBtn = screen.getByRole('button', { name: 'Mở hàng đợi duyệt' });
    expect(openApprovalBtn).toBeInTheDocument();
    expect(openApprovalBtn).not.toHaveClass('bg-slate-900'); // Outline, not black primary!

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

  it('View 3 (Kế hoạch sản xuất — ?view=production-plan): renders KHSX lines with dd/MM/yyyy date and NO repeated company text', async () => {
    renderWeeklyMenu('/weekly-menu?view=production-plan');

    // Telemetry pills and KHSX rows
    expect((await screen.findAllByText(/KHSX-DAV-20260921/i)).length).toBeGreaterThan(0);

    // DataGrid columns
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca sản xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày phục vụ' })).toBeInTheDocument();

    // Date formatted as dd/MM/yyyy
    expect(screen.getAllByText('21/09/2026').length).toBeGreaterThan(0);

    // Invariant: Repetitive subtitle "Draxlmaier Automotive · Định mức 25k" removed!
    expect(screen.queryByText(/Draxlmaier Automotive · Định mức 25k/i)).not.toBeInTheDocument();
  });

  it('View 4 (Giá vốn & Định mức BOM — ?view=cost): renders SplitView with wide ĐVT column and ZERO <details>', async () => {
    const { container } = renderWeeklyMenu('/weekly-menu?view=cost');

    // Telemetry pills
    expect(await screen.findByText(/37.445.061 ₫/i)).toBeInTheDocument();

    // Master Left: Dishes table
    expect(screen.getByRole('columnheader', { name: 'Món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giá vốn BOM' })).toBeInTheDocument();

    // Detail Right: 2 Tabs
    expect(screen.getByRole('tab', { name: 'Định mức BOM món đang chọn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tổng nguyên liệu ngày/i })).toBeInTheDocument();

    // Check BOM table column ĐVT is present and wide
    const uomHeader = screen.getByRole('columnheader', { name: 'ĐVT' });
    expect(uomHeader).toBeInTheDocument();
    expect(uomHeader).toHaveClass('w-[20%]');

    // Check Kilogram renders without overflow
    expect(screen.getAllByText('Kilogram').length).toBeGreaterThan(0);

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to Tab 2: Tổng nguyên liệu ngày
    await userEvent.click(screen.getByRole('tab', { name: /Tổng nguyên liệu ngày/i }));
    expect(screen.getByText(/Tổng hợp 29 nguyên liệu/i)).toBeInTheDocument();
  });

  it('handles empty state and calculation errors gracefully', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockRejectedValueOnce(
      new Error('Không có kết nối mạng')
    );

    renderWeeklyMenu();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Không có kết nối mạng')).toBeInTheDocument();

    // Click retry
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValueOnce(getBaselineWeeklyMenuData());
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thực đơn & KHSX tuần')).toBeInTheDocument();
  });
});
