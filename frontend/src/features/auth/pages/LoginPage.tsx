import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../app/hooks';
import { setCredentials } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { normalizeUserRole, type AppRole } from '../roleUtils';
import { ROUTES } from '../../../routes/routeConfig';
import { ChefHat } from 'lucide-react';
import { FieldRow } from '@/components/common';

// Fallback login hoạt động khi không có backend (demo mode)
const isDevLoginFallbackEnabled = true;

const devAccounts: Record<string, { fullName: string; role: AppRole; permissions: string[] }> = {
  admin: { fullName: 'Trần Văn Giám Đốc', role: 'admin', permissions: ['*'] },
  quanly: { fullName: 'Lê Văn Quản Lý', role: 'quanly', permissions: ['coordination.read', 'catalog.read', 'purchase.read', 'purchase.generate', 'warehouse.read', 'demand.generate'] },
  dieuphoi: { fullName: 'Trần Thị Điều Phối', role: 'dieuphoi', permissions: ['coordination.read', 'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff', 'demand.generate'] },
  beptruong: { fullName: 'Phạm Bếp Trưởng', role: 'beptruong', permissions: ['production:read'] },
  thukho: { fullName: 'Hoàng Thủ Kho', role: 'thukho', permissions: ['warehouse:read', 'inventory:read'] },
  thumua: { fullName: 'Đinh Thu Mua', role: 'thumua', permissions: ['purchase.read', 'purchase.generate'] },
  staff: { fullName: 'Nguyễn Thị Thu Mua', role: 'staff', permissions: [] },
}

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await login({ username, password }).unwrap();
      if (result.success && result.data) {
        dispatch(
          setCredentials({
            user: {
              id: result.data.user.userId,
              username: result.data.user.username,
              fullName: result.data.user.fullName,
              role: normalizeUserRole(result.data.user.roleCode, result.data.user.roleName),
              roleCode: result.data.user.roleCode,
              roleName: result.data.user.roleName,
              isAdminFullAccess: result.data.user.isAdminFullAccess ?? false,
              permissions: result.data.user.permissions ?? [],
            },
            token: result.data.accessToken,
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError(result.message || 'Đăng nhập thất bại.');
      }
    } catch {
      if (!isDevLoginFallbackEnabled) {
        setError('Không thể đăng nhập. Vui lòng kiểm tra tài khoản hoặc kết nối máy chủ.');
        return;
      }

      const devAccount = devAccounts[username];
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
            token: `dev-login-fallback-token-${username}`,
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError('Tài khoản hoặc mật khẩu không đúng.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ipc-auth-shell">
      <div className="ipc-auth-card">
        <div className="ipc-auth-header">
          <span className="ipc-auth-mark">
            <ChefHat size={30} />
          </span>
          <h1 className="ipc-auth-title">IPC Management System</h1>
          <p className="ipc-auth-subtitle">Hệ thống quản lý bếp ăn công nghiệp</p>
        </div>

        <form onSubmit={handleSubmit} className="ipc-auth-form">
          {error && <div className="ipc-auth-alert">{error}</div>}

          <FieldRow label="Tài khoản" htmlFor="username">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              className="ipc-input"
              disabled={isSubmitting}
            />
          </FieldRow>

          <FieldRow label="Mật khẩu" htmlFor="password">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="ipc-input"
              disabled={isSubmitting}
            />
          </FieldRow>

          <button type="submit" className="ipc-button ipc-button-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {isDevLoginFallbackEnabled && (
          <div className="ipc-auth-footer">
            <p className="ipc-auth-hint">Fallback dev: <b>admin/admin</b>, <b>quanly/quanly</b>, <b>dieuphoi/dieuphoi</b></p>
            <p className="ipc-auth-hint text-xs mt-1"><b>beptruong/beptruong</b>, <b>thukho/thukho</b>, <b>thumua/thumua</b></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
