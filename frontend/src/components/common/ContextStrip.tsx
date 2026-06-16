import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ContextStripItem {
  label: ReactNode;
  value: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}

interface ContextStripProps {
  items: ContextStripItem[];
  className?: string;
}

const toneClasses = {
  neutral: 'is-neutral',
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
};

export function ContextStrip({ items, className }: ContextStripProps) {
  return (
    <dl className={cn('ipc-context-strip', className)}>
      {items.map((item, index) => (
        <div key={index} className={cn('ipc-context-badge', toneClasses[item.tone ?? 'neutral'])}>
          {item.icon && <span className="ipc-context-icon">{item.icon}</span>}
          <dt className="ipc-context-label">{item.label}</dt>
          <dd className="ipc-context-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
