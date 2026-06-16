import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  backgroundColor: string;
  valueColor: string;
  className?: string;
  style?: CSSProperties;
}

export function StatCard({ label, value, icon, backgroundColor, valueColor, className, style }: StatCardProps) {
  return (
    <div
      className={cn('ipc-stat-card flex items-center gap-2 rounded-md border border-slate-300 p-3', className)}
      style={{ backgroundColor, ...style }}
    >
      {icon && <div className="ipc-stat-icon flex size-9 shrink-0 items-center justify-center rounded-md bg-white">{icon}</div>}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-xl font-bold" style={{ color: valueColor }}>
          {value}
        </span>
      </div>
    </div>
  );
}
