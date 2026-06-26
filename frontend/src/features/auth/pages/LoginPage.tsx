import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../app/hooks';
import { setCredentials } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { ROUTES } from '../../../routes/routeConfig';
import { ChefHat } from 'lucide-react';
import { FieldRow } from '@/components/common';

// Fallback login hoạt động khi không có backend (demo mode)
const isDevLoginFallbackEnabled = true;


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
              role: result.data.user.roleName.toLowerCase(),
              isAdminFullAccess: result.data.user.isAdminFullAccess,
              permissions: result.data.user.permissions || [],
            },
            token: result.data.accessToken,
            refreshToken: result.data.refreshToken,
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

      if (username === 'admin' && password === 'admin') {
        dispatch(
          setCredentials({
            user: {
              id: '1',
              username: 'admin',
              fullName: 'Trần Văn Giám Đốc',
              role: 'admin',
              isAdminFullAccess: true,
              permissions: ['*'],
            },
            token: 'dev-login-fallback-token-admin',
            refreshToken: 'dev-fallback-refresh-admin',
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'staff' && password === 'staff') {
        dispatch(
          setCredentials({
            user: {
              id: '2',
              username: 'staff',
              fullName: 'Nguyễn Thị Thu Mua',
              role: 'staff',
              isAdminFullAccess: false,
              permissions: [],
            },
            token: 'dev-login-fallback-token-staff',
            refreshToken: 'dev-fallback-refresh-staff',
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'quanly' && password === 'quanly') {
        dispatch(setCredentials({
          user: { id: '3', username: 'quanly', fullName: 'Lê Văn Quản Lý', role: 'quanly', isAdminFullAccess: false, permissions: [] },
          token: 'dev-login-fallback-token-quanly', refreshToken: 'dev-fallback-refresh-quanly'
        }));
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'dieuphoi' && password === 'dieuphoi') {
        dispatch(setCredentials({
          user: { id: '4', username: 'dieuphoi', fullName: 'Trần Thị Điều Phối', role: 'dieuphoi', isAdminFullAccess: false, permissions: [] },
          token: 'dev-login-fallback-token-dieuphoi', refreshToken: 'dev-fallback-refresh-dieuphoi'
        }));
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'beptruong' && password === 'beptruong') {
        dispatch(setCredentials({
          user: { id: '5', username: 'beptruong', fullName: 'Phạm Bếp Trưởng', role: 'beptruong', isAdminFullAccess: false, permissions: [] },
          token: 'dev-login-fallback-token-beptruong', refreshToken: 'dev-fallback-refresh-beptruong'
        }));
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'thukho' && password === 'thukho') {
        dispatch(setCredentials({
          user: { id: '6', username: 'thukho', fullName: 'Hoàng Thủ Kho', role: 'thukho', isAdminFullAccess: false, permissions: [] },
          token: 'dev-login-fallback-token-thukho', refreshToken: 'dev-fallback-refresh-thukho'
        }));
        navigate(ROUTES.DASHBOARD);
      } else if (username === 'thumua' && password === 'thumua') {
        dispatch(setCredentials({
          user: { id: '7', username: 'thumua', fullName: 'Đinh Thu Mua', role: 'thumua', isAdminFullAccess: false, permissions: [] },
          token: 'dev-login-fallback-token-thumua', refreshToken: 'dev-fallback-refresh-thumua'
        }));
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
            <p className="ipc-auth-hint">Fallback dev (Tài khoản / Mật khẩu):</p>
            <p className="ipc-auth-hint text-xs mt-1">
              <b>admin/admin</b> | <b>quanly/quanly</b> | <b>dieuphoi/dieuphoi</b><br/>
              <b>beptruong/beptruong</b> | <b>thukho/thukho</b> | <b>thumua/thumua</b>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
