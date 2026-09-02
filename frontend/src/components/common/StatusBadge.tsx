import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';
import { typography } from '@/lib/typography';

interface StatusBadgeProps {
  children?: ReactNode;
  variant?: StatusTone;
  size?: StatusBadgeSize;
  fullLabel?: string;
  tooltip?: string;
  loading?: boolean;
  className?: string;
}

export type StatusBadgeSize = 'sm' | 'default' | 'lg';

const badgeClasses = {
  neutral: 'is-neutral text-slate-700 font-medium bg-transparent border-0',
  info: 'is-info text-blue-700 font-semibold bg-transparent border-0',
  success: 'is-success text-emerald-700 font-semibold bg-transparent border-0',
  warning: 'is-warning text-amber-800 font-semibold bg-transparent border-0',
  danger: 'is-danger text-red-700 font-semibold bg-transparent border-0',
};

const dotClasses = {
  neutral: 'bg-slate-400 hidden',
  info: 'bg-blue-500 hidden',
  success: 'bg-emerald-500 hidden',
  warning: 'bg-amber-500 hidden',
  danger: 'bg-red-500 hidden',
};

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'gap-1 text-xs',
  default: 'gap-1.5 text-xs',
  lg: 'gap-2 text-sm',
};

/**
 * StatusBadge - Canonical Status Badge with Fixed Width Tokens (Rule C3, L4, L10)
 * Uses --cell-status-min-w to eliminate horizontal layout shifts.
 */
export function StatusBadge({
  children,
  variant = 'neutral',
  size = 'default',
  fullLabel,
  tooltip,
  loading = false,
  className,
}: StatusBadgeProps) {
  const label =
    fullLabel ??
    (typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined);

  // Abbreviations glossary lookup (Rule L10)
  const abbreviations: Record<string, string> = {
    'Đã gửi NCC': 'Đã gửi Nhà cung cấp',
    'Nhận 1 phần': 'Đã tiếp nhận một phần',
    'Chờ nhận': 'Chờ kho tiếp nhận',
    'Chờ duyệt': 'Chờ quản lý phê duyệt',
    'Chờ vật tư': 'Đang hoàn tất vật tư',
    'Chờ đóng': 'Sẵn sàng đóng ca sản xuất',
  };

  const resolvedTooltip = tooltip ?? (label && abbreviations[label] ? abbreviations[label] : label);

  if (loading) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label="Đang tải trạng thái..."
        data-size={size}
        data-layout-owner="status-badge"
        className={cn(
          typography.label,
          'ipc-status-badge ipc-status-badge--loading inline-flex min-h-5 min-w-0 items-center justify-center rounded-md border border-slate-200/60 bg-slate-100/60 whitespace-nowrap animate-pulse opacity-70',
          sizeClasses[size],
          badgeClasses[variant],
          className
        )}
      >
        <span className="ipc-status-badge-dot h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
        <span className="ipc-status-badge-label inline-block h-3 w-16 rounded bg-slate-200" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
      data-tooltip={resolvedTooltip}
      data-size={size}
      data-layout-owner="status-badge"
      className={cn(
        typography.label,
        'ipc-status-badge cell-status inline-flex min-h-5 items-center justify-center font-medium whitespace-nowrap select-none',
        sizeClasses[size],
        badgeClasses[variant],
        className
      )}
    >
      <span className={cn('ipc-status-badge-dot h-1.5 w-1.5 rounded-full shrink-0', dotClasses[variant])} aria-hidden="true" />
      <span className="ipc-status-badge-label whitespace-nowrap">{children}</span>
    </span>
  );
}
