import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}

const badgeClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

const dotClasses = {
  neutral: 'is-neutral',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function StatusBadge({ children, variant = 'neutral', className }: StatusBadgeProps) {
  return (
    <span className={cn('ipc-status-badge inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[12px] font-semibold leading-tight', badgeClasses[variant], className)}>
      <span className={cn('ipc-status-badge-dot h-1.5 w-1.5 rounded-full', dotClasses[variant])} aria-hidden="true" />
      <span className="ipc-status-badge-label">{children}</span>
    </span>
  );
}
