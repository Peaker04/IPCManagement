import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';
import { typography } from '@/lib/typography';

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusTone;
  size?: StatusBadgeSize;
  fullLabel?: string;
  className?: string;
}

export type StatusBadgeSize = 'sm' | 'default' | 'lg';

const badgeClasses = {
  neutral: 'is-neutral',
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const dotClasses = {
  neutral: 'is-neutral',
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'gap-1 px-1.5 py-0.5 text-xs',
  default: 'gap-1.5 px-2 py-0.5',
  lg: 'gap-2 px-2.5 py-1 text-sm',
};

export function StatusBadge({ children, variant = 'neutral', size = 'default', fullLabel, className }: StatusBadgeProps) {
  const label = fullLabel ?? (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
      data-size={size}
      className={cn(typography.label, 'ipc-status-badge inline-flex min-w-0 items-center rounded-[3px] whitespace-nowrap', sizeClasses[size], badgeClasses[variant], className)}
    >
      <span className={cn('ipc-status-badge-dot h-1.5 w-1.5 rounded-full', dotClasses[variant])} aria-hidden="true" />
      <span className="ipc-status-badge-label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </span>
  );
}
