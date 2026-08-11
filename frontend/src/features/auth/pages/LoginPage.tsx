import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/lib/reduxHooks';
import { setCredentials } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { normalizeUserRole, type AppRole } from '../roleUtils';
import { ROUTES } from '@/lib/routeConfig';
import { ChefHat } from 'lucide-react';
import { FieldRow } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Explicit local-only fallback for UI smoke/demo runs without a backend.
const isDevLoginFallbackEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true';

const getDevAccount = (value: string) => {
  if (import.meta.env.PROD || !isDevLoginFallbackEnabled) {
    return null;
  }

  const devAccounts: Record<string, { fullName: string; role: AppRole; permissions: string[] }> = {
    admin: { fullName: 'Trần Văn Giám Đốc', role: 'admin', permissions: ['*'] },
    quanly: { fullName: 'Lê Văn Quản Lý', role: 'quanly', permissions: ['coordination.read', 'coordination.order.lock', 'catalog.read', 'purchase.read', 'purchase.generate', 'warehouse.read', 'demand.generate'] },
    dieuphoi: { fullName: 'Trần Thị Điều Phối', role: 'dieuphoi', permissions: ['coordination.read', 'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff', 'demand.generate'] },
    beptruong: { fullName: 'Phạm Bếp Trưởng', role: 'beptruong', permissions: ['production.read'] },
    thukho: { fullName: 'Hoàng Thủ Kho', role: 'thukho', permissions: ['warehouse.read', 'inventory.read'] },
    thumua: { fullName: 'Đinh Thu Mua', role: 'thumua', permissions: ['purchase.read', 'purchase.generate'] },
    staff: { fullName: 'Nguyễn Thị Thu Mua', role: 'staff', permissions: [] },
  };

  return devAccounts[value] ?? null;
};

const getDevFallbackToken = (value: string) => {
  if (import.meta.env.PROD || !isDevLoginFallbackEnabled) {
    return '';
  }

  return `dev-login-fallback-token-${value}`;
};

const isUnauthorizedLoginError = (error: unknown) =>
  typeof error === 'object'
  && error !== null
  && 'status' in error
  && error.status === 401;

const DevLoginFallbackHint = () => {
  if (import.meta.env.PROD || !isDevLoginFallbackEnabled) {
    return null;
  }

  return (
    <div className="ipc-auth-footer">
      <p className="ipc-auth-hint">Chế độ kiểm thử cục bộ đang bật.</p>
      <p className="ipc-auth-hint text-xs mt-1">Hãy dùng tài khoản kiểm thử được cấp cho phiên làm việc này.</p>
    </div>
  );
};

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState({ username: false, password: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlight.current) return;

    const usernameMissing = !username.trim();
    const passwordMissing = !password.trim();
    if (usernameMissing || passwordMissing) {
      setMissingFields({ username: usernameMissing, password: passwordMissing });
      setError('');
      return;
    }

    setMissingFields({ username: false, password: false });
    setError('');
    submissionInFlight.current = true;
    setIsSubmitting(true);

    try {
      const result = await login({ username, password }).unwrap();
      const loginData = result.data;
      const user = loginData?.user;
      if (result.success && loginData?.accessToken && user?.userId && user.username && user.fullName) {
        dispatch(
          setCredentials({
            user: {
              id: user.userId,
              username: user.username,
              fullName: user.fullName,
              role: normalizeUserRole(user.roleCode, user.roleName),
              roleCode: user.roleCode,
              roleName: user.roleName,
              isAdminFullAccess: user.isAdminFullAccess ?? false,
              permissions: [...(user.permissions ?? [])],
            },
            token: loginData.accessToken,
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError(result.message || 'Đăng nhập thất bại.');
      }
    } catch (error) {
      if (!isDevLoginFallbackEnabled) {
        setError(isUnauthorizedLoginError(error)
          ? 'Tài khoản hoặc mật khẩu không đúng.'
          : 'Không thể đăng nhập. Vui lòng kiểm tra kết nối máy chủ.');
        return;
      }

      const devAccount = getDevAccount(username);
      if (devAccount && password === username) {
        dispatch(
          setCredentials({
            user: {
              id: `dev-${username}`,
              username,
              fullName: devAccount.fullName,
              role: devAccount.role,
              roleCode: devAccount.role.toUpperCase(),
              roleName: devAccount.role,
              isAdminFullAccess: devAccount.role === 'admin',
              permissions: devAccount.permissions,
            },
            token: getDevFallbackToken(username),
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError('Tài khoản hoặc mật khẩu không đúng.');
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ipc-auth-shell" data-ui-owner="uio-k" data-ui-floorplan="uif-k" data-ui-region="uir-k">
      <div className="ipc-auth-card">
        <div className="ipc-auth-header">
          <span className="ipc-auth-mark">
            <ChefHat size={30} />
          </span>
          <h1 className="ipc-auth-title">IPC Management System</h1>
          <p className="ipc-auth-subtitle">Hệ thống quản lý bếp ăn công nghiệp</p>
        </div>

        <form onSubmit={handleSubmit} className="ipc-auth-form">
          {error && <div className="ipc-auth-alert" role="alert">{error}</div>}

          <FieldRow label="Tài khoản" htmlFor="username">
            <Input
              type="text"
              id="username"
              value={username}
              aria-invalid={missingFields.username || undefined}
              aria-describedby={missingFields.username ? 'username-required-error' : undefined}
              onChange={(event) => {
                setUsername(event.target.value);
                setMissingFields((current) => ({ ...current, username: false }));
              }}
              placeholder="Nhập tên đăng nhập"
              disabled={isSubmitting}
            />
            {missingFields.username && <p id="username-required-error" className="mt-1 text-xs text-red-700">Vui lòng nhập đầy đủ tài khoản và mật khẩu.</p>}
          </FieldRow>

          <FieldRow label="Mật khẩu" htmlFor="password">
            <Input
              type="password"
              id="password"
              value={password}
              aria-invalid={missingFields.password || undefined}
              aria-describedby={missingFields.password ? 'password-required-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setMissingFields((current) => ({ ...current, password: false }));
              }}
              placeholder="Nhập mật khẩu"
              disabled={isSubmitting}
            />
            {missingFields.password && <p id="password-required-error" className="mt-1 text-xs text-red-700">Vui lòng nhập đầy đủ tài khoản và mật khẩu.</p>}
          </FieldRow>

          <Button type="submit" variant="default" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <DevLoginFallbackHint />
      </div>
    </div>
  );
};

export default LoginPage;
