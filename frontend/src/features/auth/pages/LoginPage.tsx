import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../app/hooks';
import { setCredentials } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { ROUTES } from '../../../routes/routeConfig';
import { ChefHat } from 'lucide-react';
import { FieldRow } from '@/components/common';

// Mock login always active as fallback when backend is unavailable

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

      if (username === 'admin' && password === 'admin') {
        dispatch(
          setCredentials({
            user: {
              id: '1',
              username: 'admin',
              fullName: 'Trần Văn Giám Đốc',
              role: 'admin',
            },
            token: 'mock-jwt-token-for-dev',
            refreshToken: 'mock-refresh-token-for-dev',
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
            },
            token: 'mock-jwt-token-for-dev-staff',
            refreshToken: 'mock-refresh-token-for-dev-staff',
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

        <div className="ipc-auth-footer">
          <p className="ipc-auth-hint">Demo: <b>admin / admin</b> hoặc <b>staff / staff</b></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
