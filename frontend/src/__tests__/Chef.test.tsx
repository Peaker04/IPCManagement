import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChefDashboardPage } from '../features/chef/ChefDashboardPage';
import { AuthProvider } from '../store/authContext';
import { chefApi, getBaselineChefData } from '../api/chefApi';

function renderChef(initialEntry = '/chef') {
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

describe('Chef Feature (FR-CHEF — Bếp trưởng & Ca nấu)', () => {
  it('renders Zone 1 WorkspaceHeader (56px) with shift select, chef name, and single primary button (Rule D7)', async () => {
    renderChef();

    expect(await screen.findByRole('heading', { name: 'Bếp trưởng & Ca nấu' })).toBeInTheDocument();

    // Select shift and chef info
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/Phụ trách: Bếp trưởng Nguyễn Văn A/i)).toBeInTheDocument();
    expect(screen.getByText(/Ca đang nấu/i)).toBeInTheDocument();

    // Rule D7: 1 primary + 1 outline
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    const completeBtn = screen.getByRole('button', { name: 'Xác nhận hoàn tất ca nấu' });
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn).toHaveClass('bg-slate-900');
  });

  it('renders Zone 2 TelemetrySubbar (44px) with 3 Segmented Tabs and telemetry pills', async () => {
    renderChef();

    // 3 Segmented Tabs
    expect(await screen.findByRole('tab', { name: /Lệnh sản xuất ca/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Checklist nhận vật tư/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Đề xuất bổ sung \/ Trả thừa/i })).toBeInTheDocument();

    // Inline pills
    expect(screen.getByText(/Mã lệnh:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng suất:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tiến độ:/i)).toBeInTheDocument();
  });

  it('Tab 1 (Lệnh sản xuất ca): renders dishes table and zero <details> tags', async () => {
    const { container } = renderChef();

    // Table columns
    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Tên món ăn/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phân loại' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất cần nấu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();

    // Data rows
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();

    // Invariant: Zero <details> tags in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('Tab 2 (Checklist nhận vật tư): renders material checklist and supports checkbox toggle', async () => {
    renderChef();

    // Switch to Tab 2
    const checklistTab = await screen.findByRole('tab', { name: /Checklist nhận vật tư/i });
    await userEvent.click(checklistTab);

    // Columns
    expect(await screen.findByRole('columnheader', { name: 'Mã vật tư' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số lượng giao' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thực nhận' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đạt chất lượng' })).toBeInTheDocument();

    // Checkbox interaction
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes[0]).toBeChecked();
    await userEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('Tab 3 (Đề xuất bổ sung / Trả thừa): renders excess material table', async () => {
    renderChef();

    // Switch to Tab 3
    const excessTab = await screen.findByRole('tab', { name: /Đề xuất bổ sung \/ Trả thừa/i });
    await userEvent.click(excessTab);

    expect(await screen.findByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Phân loại đề xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lý do ghi nhận' })).toBeInTheDocument();

    expect(screen.getByText('Giá đỗ sạch')).toBeInTheDocument();
  });

  it('opens complete shift modal and triggers completion', async () => {
    renderChef();

    const completeBtn = await screen.findByRole('button', { name: 'Xác nhận hoàn tất ca nấu' });
    await userEvent.click(completeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xác nhận hoàn tất ca nấu' })).toBeInTheDocument();

    const confirmModalBtn = screen.getByRole('button', { name: 'Xác nhận hoàn tất & Chốt ca' });
    await userEvent.click(confirmModalBtn);
  });

  it('handles error state and provides retry mechanism', async () => {
    vi.spyOn(chefApi, 'getChefDashboardData').mockRejectedValueOnce(
      new Error('Lỗi đồng bộ dữ liệu bếp')
    );

    renderChef();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi đồng bộ dữ liệu bếp')).toBeInTheDocument();

    // Click retry
    vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValueOnce(getBaselineChefData());
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Bếp trưởng & Ca nấu')).toBeInTheDocument();
  });
});
