import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineAlertProps {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'warning' | 'danger' | 'info';
  className?: string;
}

const alertClasses = {
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const titleClasses = {
  warning: 'text-amber-800',
  danger: 'text-red-800',
  info: 'text-blue-800',
};

const defaultIcons = {
  warning: <AlertTriangle size={20} />,
  danger: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

export function InlineAlert({ title, icon, action, children, variant = 'warning', className }: InlineAlertProps) {
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <aside className={cn('ipc-inline-alert-enter flex flex-wrap items-center justify-between gap-3 rounded-[3px] border px-3 py-2.5', alertClasses[variant], className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {displayIcon && <div className="flex shrink-0 items-center justify-center opacity-80">{displayIcon}</div>}
        <div>
          <h4 className={cn('m-0 mb-1 text-[15px] font-semibold', titleClasses[variant])}>{title}</h4>
          <div className="text-[13px] leading-5">{children}</div>
        </div>
      </div>
      {action}
    </aside>
  );
}
