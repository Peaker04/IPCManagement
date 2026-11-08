import { StrictMode } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AuthProvider } from '../store/authContext';
import { authApi } from '../api/authApi';
import { systemApi } from '../api/systemApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { clearAllServerCache } from '../store/serverStateCache';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { resolveLandingPath } from '../routes/navigationEligibility';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { useAuth } from '../store/useAuth';
import { apiClient } from '../api/client';

function ProtectedModeContent() {
  const { operationalMode, token, user } = useAuth();
  return <><output aria-label="Chế độ đang hiển thị">{operationalMode}</output>
    <output aria-label="Token của phiên">{token}</output><output aria-label="Người dùng của phiên">{user?.fullName}</output>
    <input aria-label="Công việc đang nhập" /></>;
}

function renderProtectedMode() {
  return render(<AuthProvider><MemoryRouter><Routes>
    <Route element={<ProtectedRoute />}><Route path="/" element={<ProtectedModeContent />} /></Route>
  </Routes></MemoryRouter></AuthProvider>);
}

function renderWithProviders(ui: React.ReactElement, initialEntry = '/login') {
  return render(
    <StrictMode><AuthProvider resolveLanding={(user, mode) => resolveLandingPath(CANONICAL_ROUTES, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={ui} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/" element={<div data-testid="dashboard-target">Bàn điều hành</div>} />
          <Route path="/reconciliation" element={<div data-testid="reconciliation-target">Đối soát nguyên liệu</div>} />
          <Route path="/weekly-menu" element={<div data-testid="mrx-batch-target">Chuẩn bị lô đối soát</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider></StrictMode>
  );
}

describe('Auth Feature (FR-AUTH)', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-10-17T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: ['dashboard'], pageTabs: {} },
    });
  });

  it('refreshes the provider session without unmounting protected work or losing entered values', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_token', 'provider-old');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['dashboard'], pageTabs: {} } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/auth/refresh') return new Response(JSON.stringify({ success: true, data: {
        accessToken: 'provider-new', tokenType: 'Bearer', expiresIn: 1800, user: { ...user, fullName: 'Tên đã cập nhật' },
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (path === '/api/session-check') return new Headers(init?.headers).get('Authorization') === 'Bearer provider-new'
        ? new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }) : new Response('', { status: 401 });
      throw new Error(`Unexpected session request ${path}`);
    });
    renderProtectedMode();
    await screen.findByLabelText('Chế độ đang hiển thị');
    const draft = screen.getByRole('textbox', { name: 'Công việc đang nhập' });
    await userEvent.type(draft, 'Nội dung chưa lưu');
    await act(async () => { await apiClient('/session-check'); });
    expect(screen.getByLabelText('Token của phiên')).toHaveTextContent('provider-new');
    expect(screen.getByLabelText('Người dùng của phiên')).toHaveTextContent('Tên đã cập nhật');
    expect(screen.getByRole('textbox', { name: 'Công việc đang nhập' })).toBe(draft);
    expect(draft).toHaveValue('Nội dung chưa lưu');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks a stored DEFAULT route until the authoritative MRX mode arrives', async () => {
    let resolveMode!: (mode: Awaited<ReturnType<typeof systemApi.getOperationalMode>>) => void;
    vi.spyOn(systemApi, 'getOperationalMode').mockImplementation(() => new Promise(resolve => { resolveMode = resolve; }));
    renderProtectedMode();
    expect(screen.queryByLabelText('Chế độ đang hiển thị')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải không gian làm việc');
    await act(async () => resolveMode({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } }));
    expect(await screen.findByLabelText('Chế độ đang hiển thị')).toHaveTextContent('MATERIAL_RECONCILIATION');
  });

  it('keeps failed mode bootstrap closed and recovers only after explicit retry', async () => {
    const mode = vi.spyOn(systemApi, 'getOperationalMode')
      .mockRejectedValueOnce(new Error('Không thể xác định chế độ vận hành.'))
      .mockResolvedValueOnce({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderProtectedMode();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác định chế độ vận hành.');
    expect(screen.queryByLabelText('Chế độ đang hiển thị')).not.toBeInTheDocument();
    expect(mode).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByLabelText('Chế độ đang hiển thị')).toHaveTextContent('MATERIAL_RECONCILIATION');
    expect(mode).toHaveBeenCalledTimes(2);
  });

  it('does not prefetch a feature customer catalog for a Chef session', async () => {
    const customers = vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([]);
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    clearAllServerCache();
    localStorage.setItem('ipc_v3_token', 'chef-test-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'chef-1', username: 'chef', fullName: 'Bếp trưởng', roleCode: 'CHEF', roleName: 'Bếp trưởng', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.kitchen.read'] }));
    // Exercise the real runtime effect rather than the inherited NODE_ENV test bypass.
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await act(async () => { render(<AuthProvider><span>Phiên bếp trưởng</span></AuthProvider>); });
      expect(screen.getByText('Phiên bếp trưởng')).toBeVisible();
      expect(systemApi.getOperationalMode).toHaveBeenCalled();
      expect(customers).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
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

  it('LoginPage: requests protected mode only after anonymous login, including StrictMode bootstrap', async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    const requests: { path: string; authorization: string | null }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const authorization = new Headers(init?.headers).get('Authorization');
      requests.push({ path, authorization });
      if (path === '/api/auth/login') {
        return new Response(JSON.stringify({ success: true, data: {
          accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600,
          user: { userId: 'u-1', username: 'admin', fullName: 'Quản trị viên', roleCode: 'ADMIN', roleName: 'Quản trị viên', isActive: true, isAdminFullAccess: true, permissions: ['*'] },
        } }), { status: 200 });
      }
      if (path === '/api/system-operation-mode') {
        return new Response(JSON.stringify({ success: true, data: { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } } }), { status: authorization ? 200 : 401 });
      }
      throw new Error(`Unexpected auth endpoint: ${path}`);
    });
    await act(async () => { renderWithProviders(<LoginPage />); });
    expect(requests).toEqual([]);

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'admin');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'password-from-test-only');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' }));

    expect(await screen.findByTestId('dashboard-target')).toBeInTheDocument();
    expect(requests).toEqual([
      { path: '/api/auth/login', authorization: null },
      { path: '/api/system-operation-mode', authorization: 'Bearer test-token' },
    ]);
    expect(localStorage.getItem('ipc_v3_mode')).toBe('MATERIAL_RECONCILIATION');
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
