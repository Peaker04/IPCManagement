import { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/authApi';
import type { LoginResponse } from '../../types';

export interface SessionExpiredModalProps {
  isOpen: boolean;
  username?: string;
  onSuccess: (response: LoginResponse) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Enterprise Session Expired In-Place Re-Login Modal (Rule NFR-03 & S-UI-04)
 * Overlays current screen when HTTP 401 occurs, preventing page redirect and preserving dirty form state.
 */
export function SessionExpiredModal({
  isOpen,
  username = '',
  onSuccess,
  onCancel,
}: SessionExpiredModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu xác thực.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const resp = await authApi.login(username, password);
      await onSuccess(resp);
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xác thực lại không thành công.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Phiên làm việc ca đã hết hạn (401)"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Bảo toàn dữ liệu đang nhập dở</p>
            <p className="text-slate-600">
              Phiên bảo mật đã hết hạn. Vui lòng xác thực lại mật khẩu để tiếp tục thao tác mà không bị mất dữ liệu biểu mẫu.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 select-none">Tài khoản</label>
            <Input value={username} readOnly disabled className="bg-slate-100 font-medium" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 select-none">
              Mật khẩu xác thực ca <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                disabled={isSubmitting}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 cursor-pointer disabled:pointer-events-none disabled:opacity-50"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="text-xs text-rose-600 flex items-center gap-1.5 font-medium">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Hủy & Đăng xuất
          </Button>
          <Button
            variant="default"
            size="sm"
            type="submit"
            loading={isSubmitting}
            loadingText="Đang xác thực..."
          >
            Tiếp tục phiên làm việc
          </Button>
        </div>
      </form>
    </Modal>
  );
}
