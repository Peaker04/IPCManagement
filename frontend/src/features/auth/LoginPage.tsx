import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { useAuth } from '../../store/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const SAMPLE_DB_ACCOUNTS = [
  { username: 'admin', label: 'Admin User', role: 'Quản trị viên' },
  { username: 'quanly', label: 'Quản lý', role: 'Quản lý vận hành' },
  { username: 'dieuphoi', label: 'Điều phối', role: 'Điều phối suất ăn' },
  { username: 'beptruong', label: 'Bếp trưởng', role: 'Bếp trưởng sản xuất' },
  { username: 'thukho', label: 'Thủ kho', role: 'Thủ kho nguyên liệu' },
  { username: 'thumua', label: 'Thu mua', role: 'Nhân viên thu mua' },
];

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

  const handleQuickLogin = (uname: string) => {
    setUsername(uname);
    setPassword('Admin@123456');
  };

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-slate-100/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs">
            <ChefHat size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            IPC MANAGEMENT
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hệ thống điều hành bếp ăn công nghiệp v3.0
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-xs font-semibold text-slate-700"
            >
              Tên đăng nhập
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên tài khoản"
              required
              autoFocus
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700"
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
              className="h-10 text-sm"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting}
            className="w-full h-10 font-semibold text-sm shadow-2xs mt-2"
          >
            {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
          </Button>
        </form>

        {/* Real Database Accounts Helper */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2.5 text-center font-medium">
            Tài khoản mẫu từ Database hệ thống (Mật khẩu: <span className="font-mono text-slate-800 font-semibold">Admin@123456</span>):
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLE_DB_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => handleQuickLogin(acc.username)}
                className="flex flex-col items-center justify-center p-2 rounded-md border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer text-center"
              >
                <span className="text-xs font-mono font-bold text-slate-900">{acc.username}</span>
                <span className="text-xs text-slate-500">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
