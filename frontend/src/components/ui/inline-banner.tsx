import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from './button';

export type InlineBannerVariant =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'stale'
  | 'conflict'
  | 'offline';

export interface InlineBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: InlineBannerVariant;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  isActionLoading?: boolean;
}

const variantConfig: Record<
  InlineBannerVariant,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
    defaultTitle: string;
  }
> = {
  info: {
    bg: 'bg-blue-50/90',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: <Info size={16} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Thông tin hệ thống',
  },
  success: {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Thành công',
  },
  warning: {
    bg: 'bg-amber-50/90',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Cảnh báo vận hành',
  },
  error: {
    bg: 'bg-rose-50/90',
    border: 'border-rose-200',
    text: 'text-rose-900',
    icon: <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Đã xảy ra lỗi',
  },
  stale: {
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-800',
    icon: <Clock size={16} className="text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Dữ liệu có thể chưa mới nhất',
  },
  conflict: {
    bg: 'bg-orange-50/90',
    border: 'border-orange-200',
    text: 'text-orange-950',
    icon: <RefreshCw size={16} className="text-orange-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Xung đột dữ liệu đồng thời (409 Conflict)',
  },
  offline: {
    bg: 'bg-zinc-100',
    border: 'border-zinc-300',
    text: 'text-zinc-900',
    icon: <WifiOff size={16} className="text-zinc-600 shrink-0 mt-0.5" aria-hidden="true" />,
    defaultTitle: 'Mất kết nối mạng',
  },
};

/**
 * Enterprise Inline Banner Component (Rule L1-DATA-03 & S-DATA-03)
 * Provides Level 2 Feedback: Attached to top of Grid, Form, or Workbench.
 * Pastel background, WCAG AA contrast, Lucide icons, action button & close handle.
 */
export function InlineBanner({
  variant = 'info',
  title,
  actionLabel,
  onAction,
  onClose,
  isActionLoading = false,
  children,
  className,
  ...props
}: InlineBannerProps) {
  const config = variantConfig[variant];
  const isAlert = variant === 'error' || variant === 'conflict';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={twMerge(
        clsx(
          'flex items-start justify-between gap-3 px-3.5 py-2.5 rounded border text-xs leading-relaxed transition-all shadow-2xs',
          config.bg,
          config.border,
          config.text,
          className
        )
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {config.icon}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs leading-snug">
            {title || config.defaultTitle}
          </p>
          {children && (
            <div className="mt-0.5 text-xs opacity-90 leading-relaxed font-normal">
              {children}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        {actionLabel && onAction && (
          <Button
            variant="outline"
            size="xs"
            onClick={onAction}
            disabled={isActionLoading}
            className="h-6 px-2 text-[11px] font-medium bg-white/80 hover:bg-white text-slate-800 border-slate-300"
          >
            {isActionLoading ? 'Đang xử lý...' : actionLabel}
          </Button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
