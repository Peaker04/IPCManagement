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
  neutral: 'is-neutral bg-slate-100 text-slate-700 border-slate-200',
  info: 'is-info bg-blue-50 text-blue-700 border-blue-200',
  success: 'is-success bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'is-warning bg-amber-50 text-amber-800 border-amber-200',
  danger: 'is-danger bg-red-50 text-red-700 border-red-200',
};

const dotClasses = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'gap-1 px-1.5 py-0.5 text-xs',
  default: 'gap-1.5 px-2 py-0.5',
  lg: 'gap-2 px-2.5 py-1 text-sm',
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
        'ipc-status-badge inline-flex min-h-5 min-w-0 items-center justify-center rounded-md border font-medium whitespace-nowrap select-none transition-colors duration-150',
        sizeClasses[size],
        badgeClasses[variant],
        className
      )}
    >
      <span className={cn('ipc-status-badge-dot h-1.5 w-1.5 rounded-full shrink-0', dotClasses[variant])} aria-hidden="true" />
      <span className="ipc-status-badge-label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap truncate">{children}</span>
    </span>
  );
}
