import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';
import type { StatusTone } from '@/lib/statusPresentation';

export type InlineAlertVariant = StatusTone;

interface InlineAlertProps {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  variant?: InlineAlertVariant;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  role?: string;
}

const alertClasses: Record<InlineAlertVariant, string> = {
  warning: 'border-[var(--alert-warning-border,#c05621)] bg-[var(--alert-warning-bg,#fff7e6)] text-[var(--ipc-slate-900,#0f172a)]',
  danger: 'border-[var(--alert-danger-border,#fecaca)] bg-[var(--alert-danger-bg,#fff1f1)] text-[var(--ipc-slate-900,#0f172a)]',
  info: 'border-[var(--alert-info-border,#bfdbfe)] bg-[var(--alert-info-bg,#eff6ff)] text-[var(--ipc-slate-900,#0f172a)]',
  success: 'border-[var(--alert-success-border,#99ddd2)] bg-[var(--alert-success-bg,#e6f7f3)] text-[var(--ipc-slate-900,#0f172a)]',
  neutral: 'border-[var(--alert-neutral-border,#cbd5e1)] bg-[var(--alert-neutral-bg,#f1f5f9)] text-[var(--ipc-slate-900,#0f172a)]',
};

const titleClasses: Record<InlineAlertVariant, string> = {
  warning: 'text-[var(--status-warning-fg,#c05621)]',
  danger: 'text-[var(--status-danger-fg,#c53030)]',
  info: 'text-[var(--status-info-fg,#1a56a8)]',
  success: 'text-[var(--status-success-fg,#0f766e)]',
  neutral: 'text-[var(--status-neutral-fg,#334155)]',
};

const defaultIcons: Record<InlineAlertVariant, ReactNode> = {
  warning: <AlertTriangle size={20} className="text-[var(--status-warning-fg,#c05621)]" />,
  danger: <AlertTriangle size={20} className="text-[var(--status-danger-fg,#c53030)]" />,
  info: <Info size={20} className="text-[var(--status-info-fg,#1a56a8)]" />,
  success: <CheckCircle2 size={20} className="text-[var(--status-success-fg,#0f766e)]" />,
  neutral: <Info size={20} className="text-[var(--status-neutral-fg,#334155)]" />,
};

export function InlineAlert({ title, icon, action, children, variant = 'warning', headingLevel = 4, className, role }: InlineAlertProps) {
  const displayIcon = icon ?? defaultIcons[variant];
  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <aside role={role} className={cn('ipc-inline-alert-enter flex flex-wrap items-center justify-between gap-3 rounded-[3px] border px-3 py-2.5', alertClasses[variant], className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {displayIcon && <div className="flex shrink-0 items-center justify-center opacity-80">{displayIcon}</div>}
        <div>
          {title && <HeadingTag className={cn(typography.sectionTitle, 'm-0 mb-1', titleClasses[variant])}>{title}</HeadingTag>}
          {children && <div className={typography.body}>{children}</div>}
        </div>
      </div>
      {action}
    </aside>
  );
}
