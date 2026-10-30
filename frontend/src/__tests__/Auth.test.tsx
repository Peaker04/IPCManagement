import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AuthProvider } from '../store/authContext';
import { authApi } from '../api/authApi';
import { systemApi } from '../api/systemApi';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { resolveLandingPath } from '../routes/navigationEligibility';

function renderWithProviders(ui: React.ReactElement, initialEntry = '/login') {
  return render(
    <AuthProvider resolveLanding={(user, mode) => resolveLandingPath(CANONICAL_ROUTES, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={ui} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/" element={<div data-testid="dashboard-target">Bàn điều hành</div>} />
          <Route path="/reconciliation" element={<div data-testid="reconciliation-target">Đối soát nguyên liệu</div>} />
          <Route path="/weekly-menu" element={<div data-testid="mrx-batch-target">Chuẩn bị lô đối soát</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Auth Feature (FR-AUTH)', () => {
  it('LoginPage: renders clean flat login form with single primary button (Rule D7)', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'IPC MANAGEMENT' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveClass('bg-slate-900'); // Single primary
  });

  it('LoginPage: starts empty and exposes no credential shortcuts', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText('Tên đăng nhập')).toHaveValue('');
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('');
    expect(screen.queryByText(/Tài khoản mẫu|Admin@123456|beptruong|quick login/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('LoginPage: successfully authenticates and redirects to dashboard', async () => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['dashboard'], pageTabs: {} } });
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        userId: 'u-1',
        username: 'admin',
        fullName: 'Quản trị viên',
        roleCode: 'ADMIN',
        roleName: 'Quản trị viên',
        isActive: true,
        isAdminFullAccess: true,
        permissions: ['*'],
      },
    });

    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'password-from-test-only');
    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' });
    await userEvent.click(submitBtn);

    expect(await screen.findByTestId('dashboard-target')).toBeInTheDocument();
  });

  it('LoginPage: reloads the protected operation mode after authentication', async () => {
    const mode = vi.spyOn(systemApi, 'getOperationalMode')
      .mockRejectedValueOnce(new Error('401 before login'))
      .mockResolvedValueOnce({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600,
      user: { userId: 'u-1', username: 'admin', fullName: 'Quản trị viên', roleCode: 'ADMIN', roleName: 'Quản trị viên', isActive: true, isAdminFullAccess: true, permissions: ['*'] },
    });
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'password-from-test-only');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' }));

    expect(await screen.findByTestId('dashboard-target')).toBeInTheDocument();
    await vi.waitFor(() => expect(mode).toHaveBeenCalledTimes(2));
  });

  it('LoginPage: sends a Manager in MRX mode to the dashboard', async () => {
    vi.spyOn(systemApi, 'getOperationalMode')
      .mockRejectedValueOnce(new Error('401 before login'))
      .mockResolvedValueOnce({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['reconciliation'], pageTabs: {} } });
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      accessToken: 'manager-token', tokenType: 'Bearer', expiresIn: 3600,
      user: { userId: 'manager-1', username: 'quanly', fullName: 'Quản lý', roleCode: 'MANAGER', roleName: 'Quản lý', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.read', 'reconciliation.disposition', 'reconciliation.complete'] },
    });
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'quanly');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'password-from-test-only');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' }));

    expect(await screen.findByTestId('dashboard-target')).toBeInTheDocument();
  });

  it('LoginPage: displays clear error feedback when authentication fails', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new Error('Tên đăng nhập hoặc mật khẩu không chính xác.')
    );

    renderWithProviders(<LoginPage />);

    const usernameInput = screen.getByLabelText('Tên đăng nhập');
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'wrong_user');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'invalid-password');

    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' });
    await userEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên đăng nhập hoặc mật khẩu không chính xác.'
    );
  });

  it('ForbiddenPage: returns an authenticated Manager to the MRX reconciliation landing', async () => {
    localStorage.setItem('ipc_v3_token', 'manager-token');
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'manager-1', username: 'quanly', fullName: 'Quản lý', roleCode: 'MANAGER', roleName: 'Quản lý', isActive: true,
      isAdminFullAccess: false, permissions: ['reconciliation.read', 'reconciliation.disposition', 'reconciliation.complete'],
    }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['reconciliation'], pageTabs: {} } });
    renderWithProviders(<ForbiddenPage />, '/forbidden');

    await userEvent.click(screen.getByRole('button', { name: 'Về bàn điều hành' }));

    expect(await screen.findByTestId('dashboard-target')).toBeInTheDocument();
    localStorage.clear();
  });

  it('ForbiddenPage: renders clean 403 screen with navigation buttons', () => {
    renderWithProviders(<ForbiddenPage />, '/forbidden');

    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Truy cập bị từ chối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về bàn điều hành' })).toBeInTheDocument();
  });

  it('Route 1: resolves exact MRX landing page for Coordinator, Warehouse, and Chef', () => {
    const coordinator = { roleCode: 'Coordinator', permissions: ['reconciliation.source.read'] };
    const warehouse = { roleCode: 'WarehouseStaff', permissions: ['reconciliation.warehouse.read'] };
    const chef = { roleCode: 'Chef', permissions: ['reconciliation.kitchen.read'] };

    expect(resolveLandingPath(CANONICAL_ROUTES, coordinator, 'MATERIAL_RECONCILIATION')).toBe('/weekly-menu?view=mrx-batch');
    expect(resolveLandingPath(CANONICAL_ROUTES, warehouse, 'MATERIAL_RECONCILIATION')).toBe('/warehouse?view=mrx-daily');
    expect(resolveLandingPath(CANONICAL_ROUTES, chef, 'MATERIAL_RECONCILIATION')).toBe('/chef?view=mrx-cooking');
  });
});
