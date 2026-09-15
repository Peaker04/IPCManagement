import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/statusPresentation';

export interface PageBannerProps {
  title: ReactNode;
  detail?: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  spin?: boolean;
  action?: ReactNode;
  className?: string;
}

const bannerClasses: Record<StatusTone, string> = {
  neutral: 'border-b border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-b border-[var(--alert-info-border,#bfdbfe)] bg-[var(--alert-info-bg,#eff6ff)] text-[var(--status-info-fg,#1a56a8)]',
  success: 'border-b border-[var(--alert-success-border,#99ddd2)] bg-[var(--alert-success-bg,#e6f7f3)] text-[var(--status-success-fg,#0f766e)]',
  warning: 'border-b border-[var(--alert-warning-border,#c05621)] bg-[var(--alert-warning-bg,#fff7e6)] text-[var(--status-warning-fg,#c05621)]',
  danger: 'border-b border-[var(--alert-danger-border,#fecaca)] bg-[var(--alert-danger-bg,#fff1f1)] text-[var(--status-danger-fg,#c53030)]',
};

const defaultIcons: Record<StatusTone, ReactNode> = {
  neutral: <Info className="size-4 shrink-0" aria-hidden="true" />,
  info: <Lock className="size-4 shrink-0" aria-hidden="true" />,
  success: <CheckCircle className="size-4 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />,
  danger: <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />,
};

/**
 * PageBanner - Full-width contextual banner for page/shift/system-level status.
 * Replaces ad-hoc custom colored header divs across routes.
 */
export function PageBanner({
  title,
  detail,
  tone = 'info',
  icon,
  spin = false,
  action,
  className,
}: PageBannerProps) {
  const displayIcon = icon ?? defaultIcons[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('ipc-page-banner flex items-center justify-between gap-2 px-4 py-2 text-sm', bannerClasses[tone], className)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {displayIcon && (
          <span className={cn('shrink-0', spin && 'animate-spin')}>{displayIcon}</span>
        )}
        <span className="font-semibold">{title}</span>
        {detail && <span className="opacity-80">— {detail}</span>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
