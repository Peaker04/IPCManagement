import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AuthProvider } from '../store/authContext';
import { authApi } from '../api/authApi';

function renderWithProviders(ui: React.ReactElement, initialEntry = '/login') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={ui} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/" element={<div data-testid="dashboard-target">Bàn điều hành</div>} />
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

  it('LoginPage: quick login helper auto-populates credentials', async () => {
    renderWithProviders(<LoginPage />);

    const chefBtn = screen.getByRole('button', { name: 'chef' });
    await userEvent.click(chefBtn);

    expect(screen.getByLabelText('Tên đăng nhập')).toHaveValue('chef');
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('Admin@123456');
  });

  it('LoginPage: successfully authenticates and redirects to dashboard', async () => {
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

    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' });
    await userEvent.click(submitBtn);

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

    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào hệ thống' });
    await userEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tên đăng nhập hoặc mật khẩu không chính xác.'
    );
  });

  it('ForbiddenPage: renders clean 403 screen with navigation buttons', () => {
    render(
      <MemoryRouter initialEntries={['/forbidden']}>
        <ForbiddenPage />
      </MemoryRouter>
    );

    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Truy cập bị từ chối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về bàn điều hành' })).toBeInTheDocument();
  });
});
