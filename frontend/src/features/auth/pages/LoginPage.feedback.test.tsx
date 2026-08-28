import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  login: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/lib/reduxHooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('../authApi', () => ({
  useLoginMutation: () => [mocks.login],
}));

import LoginPage from './LoginPage';

describe('LoginPage validation feedback', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.login.mockReset();
    mocks.navigate.mockReset();
  });

  it('places its single page heading inside one named main landmark', () => {
    render(<LoginPage />);

    const main = screen.getByRole('main', { name: 'Đăng nhập IPC' });
    expect(main).toContainElement(screen.getByRole('heading', { level: 1, name: 'IPC Management System' }));
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('supports password managers and an accessible password visibility control', () => {
    render(<LoginPage />);

    const username = screen.getByLabelText('Tài khoản');
    const password = screen.getByLabelText('Mật khẩu');
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('associates the existing required-fields message with both empty fields', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByLabelText('Tài khoản')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Tài khoản')).toHaveAccessibleDescription('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAccessibleDescription('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('keeps the required-fields message beside only the field still missing', () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Tài khoản'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByLabelText('Tài khoản')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAccessibleDescription('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
  });

  it('owns only one login request while the current submission is in flight', () => {
    mocks.login.mockReturnValue({ unwrap: () => new Promise(() => undefined) });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Tài khoản'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } });
    const form = screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')!;

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mocks.login).toHaveBeenCalledOnce();
  });

  it('explains invalid credentials instead of suggesting a connection failure for a 401 response', async () => {
    mocks.login.mockReturnValue({ unwrap: () => Promise.reject({ status: 401 }) });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Tài khoản'), { target: { value: 'quanly' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Tài khoản hoặc mật khẩu không đúng.');
    });
  });
});
