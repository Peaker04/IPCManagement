import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../app/hooks';
import { setCredentials } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { ROUTES } from '../../../routes/routeConfig';

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
      // Đầu tiên thử gọi API thật qua RTK Query
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
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError(result.message || 'Đăng nhập thất bại.');
      }
    } catch (err: unknown) {
      console.warn('Backend API connection failed, falling back to mock login', err);
      // Chế độ MOCK để dễ dàng chạy thử giao diện khi không có backend chạy song song
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
          })
        );
        navigate(ROUTES.DASHBOARD);
      } else {
        setError('Tài khoản hoặc mật khẩu không đúng. Thử: admin/admin hoặc staff/staff (Mock Dev).');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logo}>🍳</span>
          <h1 style={styles.title}>IPC Management System</h1>
          <p style={styles.subtitle}>Hệ thống quản lý bếp ăn công nghiệp</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.errorAlert}>{error}</div>}

          <div style={styles.formGroup}>
            <label htmlFor="username" style={styles.label}>
              Tài khoản
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập (ví dụ: admin)"
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Mật khẩu
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu (ví dụ: admin)"
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" style={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>Tài khoản thử nghiệm: <b>admin / admin</b> hoặc <b>staff / staff</b></p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '40px 32px',
    border: '1px solid #e2e8f0',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  logo: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1e3b8a', // Corporate Navy
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #fee2e2',
    fontWeight: 500,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    textAlign: 'left' as const,
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    outline: 'none',
    transition: 'border-color 0.2s',
    '&:focus': {
      borderColor: '#3b82f6',
    },
  },
  button: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: '#1e3b8a',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#172554',
    },
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center' as const,
    borderTop: '1px solid #f1f5f9',
    paddingTop: '16px',
  },
  hint: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
};

export default LoginPage;
