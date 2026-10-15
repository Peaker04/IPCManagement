import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/workbench/AppShell';
import { AuthProvider } from '../store/authContext';
import { systemApi } from '../api/systemApi';

function renderAppShell(initialEntry = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppShell>
          <div data-testid="workbench-content">Nội dung bàn làm việc</div>
        </AppShell>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AppShell Component (Nested Sidebar Rule N6 & 3-Zone Architecture)', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', version: 1 });
    vi.spyOn(systemApi, 'setOperationalMode').mockImplementation(async (mode) => ({ mode, version: 1 }));
  });
  it('renders branding, hamburger toggle, and canonical system routes', () => {
    renderAppShell();

    // Check logo and branding
    expect(screen.getByText('IPC System')).toBeInTheDocument();
    expect(screen.getByText('Điều hành bếp ăn')).toBeInTheDocument();

    // Check hamburger toggle
    expect(screen.getByRole('button', { name: /Thu gọn sidebar/i })).toBeInTheDocument();

    // Check primary navigation routes
    expect(screen.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Điều phối đơn' })).toHaveAttribute('href', '/meal-orders');
    expect(screen.getByRole('link', { name: 'Duyệt vận hành' })).toHaveAttribute('href', '/approvals');
    expect(screen.getByRole('link', { name: 'Thu mua' })).toHaveAttribute('href', '/purchasing');
    expect(screen.getByRole('link', { name: 'Kho nguyên liệu' })).toHaveAttribute('href', '/warehouse');
    expect(screen.getByRole('link', { name: 'Bếp trưởng' })).toHaveAttribute('href', '/chef');
    expect(screen.getByRole('link', { name: 'Đối soát nguyên liệu' })).toHaveAttribute('href', '/reconciliation');
    expect(screen.getByRole('link', { name: 'Báo cáo vận hành' })).toHaveAttribute('href', '/reports');
    expect(screen.getByRole('link', { name: 'Quản trị dữ liệu' })).toHaveAttribute('href', '/admin-data');
    expect(screen.getByRole('link', { name: 'Thiết lập quy trình duyệt' })).toHaveAttribute('href', '/settings/approval-rules');
    expect(screen.getByRole('link', { name: 'Thiết lập nâng cao' })).toHaveAttribute('href', '/settings/advanced');

    // Check workbench main content
    expect(screen.getByTestId('workbench-content')).toBeInTheDocument();
  });

  it('renders Nested Sidebar (Rule N6) with tree hierarchy for Thực đơn tuần', async () => {
    renderAppShell('/weekly-menu');

    // Parent category button with aria-expanded
    const weeklyMenuParentBtn = screen.getByRole('button', { name: /Thực đơn tuần/i });
    expect(weeklyMenuParentBtn).toBeInTheDocument();
    expect(weeklyMenuParentBtn).toHaveAttribute('aria-expanded', 'true');

    // 4 nested child leaf routes (Rule N6)
    expect(screen.getByRole('link', { name: 'Kế hoạch tuần' })).toHaveAttribute('href', '/weekly-menu');
    expect(screen.getByRole('link', { name: 'Bàn giao nguyên liệu' })).toHaveAttribute('href', '/weekly-menu?view=demand');
    expect(screen.getByRole('link', { name: 'Kế hoạch sản xuất' })).toHaveAttribute('href', '/weekly-menu?view=production-plan');
    expect(screen.getByRole('link', { name: 'Giá vốn & Định mức BOM' })).toHaveAttribute('href', '/weekly-menu?view=cost');

    // Toggle parent collapse
    await userEvent.click(weeklyMenuParentBtn);
    expect(weeklyMenuParentBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Bàn giao nguyên liệu' })).not.toBeInTheDocument();

    // Toggle parent expand back
    await userEvent.click(weeklyMenuParentBtn);
    expect(weeklyMenuParentBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Bàn giao nguyên liệu' })).toBeInTheDocument();
  });

  it('toggles hamburger button to collapse and expand sidebar width', async () => {
    renderAppShell();

    const hamburgerBtn = screen.getByRole('button', { name: /Thu gọn sidebar/i });
    await userEvent.click(hamburgerBtn);

    // Sidebar is now collapsed
    expect(screen.getByRole('button', { name: /Mở rộng sidebar/i })).toBeInTheDocument();
    expect(screen.queryByText('IPC MANAGEMENT')).not.toBeInTheDocument();

    // Toggle back to expanded
    await userEvent.click(screen.getByRole('button', { name: /Mở rộng sidebar/i }));
    expect(screen.getByText('IPC System')).toBeInTheDocument();
  });

  it('toggles operational mode between DEFAULT and MATERIAL_RECONCILIATION (DOM-MODE-1)', async () => {
    renderAppShell();

    const modeBtn = screen.getByTitle(/Chuyển đổi chế độ vận hành/i);
    expect(modeBtn).toBeInTheDocument();
    expect(screen.getByText('Mặc định')).toBeInTheDocument();

    // Click to switch mode
    fireEvent.click(modeBtn);
    expect(screen.getByText('Đối soát MRX')).toBeInTheDocument();

    // Click again to toggle back
    fireEvent.click(modeBtn);
    expect(screen.getByText('Mặc định')).toBeInTheDocument();
  });
});
