import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';
import { typography } from '@/lib/typography';
import { resolveStatus, type StatusDomain } from '@/lib/status/statusRegistry';

export interface StatusBadgeProps {
  children?: ReactNode;
  status?: string | null;
  domain?: StatusDomain;
  variant?: StatusTone;
  tone?: StatusTone;
  label?: string;
  size?: StatusBadgeSize;
  fullLabel?: string;
  tooltip?: string;
  loading?: boolean;
  className?: string;
}

export type StatusBadgeSize = 'sm' | 'default' | 'lg';

const badgeClasses: Record<StatusTone, string> = {
  neutral: 'is-neutral text-[var(--status-neutral-fg,#334155)] font-medium bg-transparent border-0',
  info: 'is-info text-[var(--status-info-fg,#1a56a8)] font-semibold bg-transparent border-0',
  success: 'is-success text-[var(--status-success-fg,#0f766e)] font-semibold bg-transparent border-0',
  warning: 'is-warning text-[var(--status-warning-fg,#c05621)] font-semibold bg-transparent border-0',
  danger: 'is-danger text-[var(--status-danger-fg,#c53030)] font-semibold bg-transparent border-0',
};

const dotClasses: Record<StatusTone, string> = {
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
 * StatusBadge / StatusLozenge - Canonical Status Presentation with Fixed Width Tokens (Rule C3, L4, L10)
 * Resolves business status via Domain Status Registry or explicit tone/label props.
 */
export function StatusBadge({
  children,
  status,
  domain,
  variant,
  tone,
  label: explicitLabel,
  size = 'default',
  fullLabel,
  tooltip,
  loading = false,
  className,
}: StatusBadgeProps) {
  const resolved = status ? resolveStatus(status, domain) : undefined;
  const rawVariant = variant ?? tone ?? resolved?.tone ?? 'neutral';
  const effectiveVariant: StatusTone = (rawVariant in badgeClasses) ? (rawVariant as StatusTone) : 'neutral';
  const effectiveChildren = children ?? explicitLabel ?? resolved?.label;

  const label =
    fullLabel ??
    (typeof effectiveChildren === 'string' || typeof effectiveChildren === 'number'
      ? String(effectiveChildren)
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
          badgeClasses[effectiveVariant],
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
        badgeClasses[effectiveVariant],
        className
      )}
    >
      <span className={cn('ipc-status-badge-dot h-1.5 w-1.5 rounded-full shrink-0', dotClasses[effectiveVariant])} aria-hidden="true" />
      <span className="ipc-status-badge-label inline-flex items-center gap-1.5 whitespace-nowrap">{effectiveChildren}</span>
    </span>
  );
}

export const StatusLozenge = StatusBadge;
export type StatusLozengeProps = StatusBadgeProps;
