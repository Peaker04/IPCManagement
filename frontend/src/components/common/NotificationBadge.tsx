import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';

export interface NotificationBadgeProps {
  count?: number;
  max?: number;
  dot?: boolean;
  variant?: StatusTone;
  size?: 'sm' | 'default' | 'lg';
  label?: string;
  className?: string;
  children?: ReactNode;
}

const variantStyles: Record<StatusTone, string> = {
  neutral: 'bg-slate-200 text-slate-700 border-slate-300',
  info: 'bg-[var(--status-info-bg,#eff6ff)] text-[var(--status-info-fg,#1a56a8)] border-[var(--status-info-border,#bfdbfe)]',
  success: 'bg-[var(--status-success-bg,#e6f7f3)] text-[var(--status-success-fg,#0f766e)] border-[var(--status-success-border,#99ddd2)]',
  warning: 'bg-[var(--status-warning-bg,#fff7e6)] text-[var(--status-warning-fg,#c05621)] border-[var(--status-warning-border,#c05621)]',
  danger: 'bg-[var(--status-danger-bg,#fff1f1)] text-[var(--status-danger-fg,#c53030)] border-[var(--status-danger-border,#fecaca)]',
};

const sizeStyles = {
  sm: 'min-w-4 h-4 text-xs px-1',
  default: 'min-w-5 h-5 text-xs px-1.5',
  lg: 'min-w-6 h-6 text-sm px-2',
};

/**
 * NotificationBadge - Dedicated primitive for numeric indicators, counters, and unread dots.
 * Strictly decoupled from business workflow status (StatusLozenge).
 */
export function NotificationBadge({
  count,
  max,
  dot = false,
  variant = 'neutral',
  size = 'default',
  label,
  className,
  children,
}: NotificationBadgeProps) {
  if (dot) {
    return (
      <span
        role="status"
        aria-label={label ?? 'Chấm thông báo'}
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'size-2' : size === 'lg' ? 'size-3.5' : 'size-2.5',
          variant === 'danger'
            ? 'bg-[var(--status-danger-fg,#c53030)]'
            : variant === 'warning'
            ? 'bg-[var(--status-warning-fg,#c05621)]'
            : variant === 'success'
            ? 'bg-[var(--status-success-fg,#0f766e)]'
            : variant === 'info'
            ? 'bg-[var(--status-info-fg,#1a56a8)]'
            : 'bg-slate-400',
          className,
        )}
      />
    );
  }

  const displayCount =
    count !== undefined
      ? max !== undefined && count > max
        ? `${max}+`
        : String(count)
      : children;

  if (displayCount === undefined || displayCount === null || displayCount === '') {
    return null;
  }

  const accessibleLabel = label ?? (typeof count === 'number' ? `${count} thông báo` : String(displayCount));

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold tabular-nums border leading-none shrink-0 select-none',
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
    >
      {displayCount}
    </span>
  );
}
