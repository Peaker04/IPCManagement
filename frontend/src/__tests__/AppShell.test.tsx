import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/workbench/AppShell';
import { AuthProvider } from '../store/authContext';
import { systemApi } from '../api/systemApi';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { useDirtyNavigation } from '../components/workbench/dirty-navigation-context';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';

function DirtyProbe() {
  const { registerDirty } = useDirtyNavigation();
  return <button type="button" onClick={() => registerDirty('draft-1')}>Tạo bản nháp</button>;
}

function renderAppShell(initialEntry = '/', children = <div data-testid="workbench-content">Nội dung bàn làm việc</div>) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <DirtyNavigationProvider>
          <AppShell getAllowedRoles={(path) => CANONICAL_ROUTES.find((route) => route.path === path)?.allowedRoles}>{children}</AppShell>
        </DirtyNavigationProvider>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AppShell Component (Nested Sidebar Rule N6 & 3-Zone Architecture)', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(systemApi, 'setOperationalMode').mockImplementation(async (mode) => ({ mode, label: mode, version: 2, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }));
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
    expect(screen.getByRole('button', { name: 'Kho nguyên liệu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Bếp trưởng' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Đối soát nguyên liệu' })).toHaveAttribute('href', '/reconciliation');
    expect(screen.getByRole('button', { name: 'Báo cáo vận hành' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Quản trị hệ thống' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Danh mục nguyên liệu' })).toHaveAttribute('href', '/admin-data?view=ingredients');
    expect(screen.getByRole('link', { name: 'Quy trình phê duyệt' })).toHaveAttribute('href', '/settings/approval-rules');
    expect(screen.getByRole('link', { name: 'Chế độ vận hành' })).toHaveAttribute('href', '/settings/advanced?view=mode');

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
    expect(screen.getByRole('link', { name: 'Kế hoạch sản xuất', current: 'page' })).toHaveAttribute('href', '/weekly-menu?view=production-plan');
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

  it('renders warehouse work views as nested sidebar leaves instead of page tabs', () => {
    renderAppShell('/warehouse?view=receipts');

    expect(screen.getByRole('button', { name: 'Kho nguyên liệu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Phiếu xuất kho' })).toHaveAttribute('href', '/warehouse?view=issues');
    expect(screen.getByRole('link', { name: 'Phiếu nhập kho' })).toHaveAttribute('href', '/warehouse?view=receipts');
    expect(screen.getByRole('link', { name: 'Tồn kho hiện tại', current: 'page' })).toHaveAttribute('href', '/warehouse?view=stock');
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

  it('hides navigation destinations that the current role cannot access', () => {
    localStorage.setItem('ipc_v3_token', 'token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'u-1', fullName: 'Điều phối viên', username: 'coord', roleCode: 'Coordinator', roleName: 'Điều phối',
      isActive: true, isAdminFullAccess: false, permissions: [],
    }));
    renderAppShell();

    expect(screen.getByRole('link', { name: 'Điều phối đơn' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Duyệt vận hành' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Chế độ vận hành hiện tại: Mặc định' })).not.toBeInTheDocument();
    localStorage.removeItem('ipc_v3_token');
    localStorage.removeItem('ipc_v3_user');
  });

  it('requires accessible confirmation before sidebar navigation discards a registered draft', async () => {
    renderAppShell('/approvals', <DirtyProbe />);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
    await userEvent.click(screen.getByRole('link', { name: 'Tổng quan' }));

    expect(screen.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Duyệt vận hành' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await userEvent.click(screen.getByRole('link', { name: 'Tổng quan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(screen.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
  });

  it('routes operational-mode changes to the guarded settings owner instead of mutating from the shell', async () => {
    renderAppShell();

    const modeLink = screen.getByRole('link', { name: /Chế độ vận hành hiện tại: Mặc định/i });
    expect(modeLink).toHaveAttribute('href', '/settings/advanced?view=mode');
    await userEvent.click(modeLink);
    expect(systemApi.setOperationalMode).not.toHaveBeenCalled();
  });
});
