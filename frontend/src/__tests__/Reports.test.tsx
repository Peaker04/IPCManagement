import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportsPage } from '../features/reports/ReportsPage';
import { AuthProvider } from '../store/authContext';
import { reportsApi } from '../api/reportsApi';

function renderReports(initialEntry = '/reports') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Reports Feature (FR-REP — Báo cáo chi phí & Hao hụt)', () => {
  it('renders Zone 1 WorkspaceHeader (56px) with period select, customer select, and single primary button (Rule D7)', async () => {
    renderReports();

    expect(await screen.findByRole('heading', { name: 'Báo cáo chi phí & Hao hụt' })).toBeInTheDocument();

    // Select period and customer
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Dữ liệu chốt sổ')).toBeInTheDocument();

    // Rule D7: Exactly 1 primary button + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const exportBtn = screen.getByRole('button', { name: 'Xuất báo cáo Excel' });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with report tabs and telemetry pills', async () => {
    renderReports();

    // Report tabs
    expect(await screen.findByRole('tab', { name: /Báo cáo chi phí suất ăn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Biến động giá mua/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tồn kho hiện tại/i })).toBeInTheDocument();

    // Telemetry pills
    expect(screen.getByText(/Tổng chi phí:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hao hụt TB:/i)).toBeInTheDocument();
    expect(screen.getByText(/Định mức:/i)).toBeInTheDocument();
  });

  it('Tab 1 (Chi phí suất ăn): renders meal cost table and zero <details> tags', async () => {
    const { container } = renderReports();

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn phục vụ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất nấu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Định mức bán' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giá vốn thực tế' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tỷ lệ chi phí' })).toBeInTheDocument();

    // Row item check
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();

    // Invariant: Zero <details> tags anywhere in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('Tab 2 (Biến động giá mua): renders price variance table', async () => {
    renderReports();

    const priceTab = await screen.findByRole('tab', { name: /Biến động giá mua/i });
    await userEvent.click(priceTab);

    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giá kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Giá mua thực tế' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Biến động (%)' })).toBeInTheDocument();

    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
  });

  it('Tab 3 (Tồn kho hiện tại): renders current stock table', async () => {
    renderReports();

    const stockTab = await screen.findByRole('tab', { name: /Tồn kho hiện tại/i });
    await userEvent.click(stockTab);

    expect(await screen.findByRole('columnheader', { name: 'Kho lưu trữ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên nguyên liệu thực phẩm/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số lượng tồn kho' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mức khả dụng' })).toBeInTheDocument();

    expect(screen.getAllByText(/Thịt đùi heo tươi/i).length).toBeGreaterThan(0);
  });

  it('handles error state and provides retry action', async () => {
    vi.spyOn(reportsApi, 'getMealCostReports').mockRejectedValueOnce(
      new Error('Lỗi máy chủ báo cáo')
    );

    renderReports();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ báo cáo')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Báo cáo chi phí & Hao hụt')).toBeInTheDocument();
  });
});
