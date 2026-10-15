import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tên đăng nhập hoặc mật khẩu không chính xác.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (user: string) => {
    setUsername(user);
    setPassword('Admin@123456');
  };

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-slate-100/70 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded bg-slate-900 text-white font-black text-sm">
            IPC
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            IPC MANAGEMENT
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hệ thống điều hành bếp ăn công nghiệp
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="username"
              className="block text-xs font-medium text-slate-700"
            >
              Tên đăng nhập
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-700"
            >
              Mật khẩu
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting}
            className="w-full h-9 font-medium"
          >
            {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
          </Button>
        </form>

        {/* Quick account helper */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 mb-2 text-center">
            Tài khoản mẫu kiểm thử nhanh:
          </p>
          <div className="flex justify-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('chef')}
              className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              chef
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('manager')}
              className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              manager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
