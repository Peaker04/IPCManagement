import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  className?: string;
  render?: ReactNode;
}

const toneNumberStyles: Record<StatusTone, string> = {
  neutral: 'text-slate-800',
  info: 'text-[var(--status-info-fg,#1a56a8)]',
  success: 'text-[var(--status-success-fg,#0f766e)]',
  warning: 'text-[var(--status-warning-fg,#c05621)]',
  danger: 'text-[var(--status-danger-fg,#c53030)]',
};

/**
 * MetricCard - Dedicated primitive for KPIs, aggregate counts, and operational summary figures.
 * Decoupled from StatusLozenge and NotificationBadge to prevent semantic mixing.
 */
export function MetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
  icon,
  className,
}: MetricCardProps) {
  return (
    <article
      className={cn(
        'ipc-metric-card flex flex-col justify-between rounded-md border border-slate-200 bg-white p-3 shadow-xs',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </span>
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <strong className={cn('text-2xl tabular-nums font-bold tracking-tight', toneNumberStyles[tone])}>
          {value}
        </strong>
      </div>
      {helper && (
        <small className="mt-1 text-xs text-slate-500 line-clamp-1">
          {helper}
        </small>
      )}
    </article>
  );
}
