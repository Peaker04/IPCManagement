import { fireEvent, render, screen } from '@testing-library/react';
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
});
