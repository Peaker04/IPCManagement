import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('ipc-page-header', className)}>
      <div className="min-w-0">
        <h2 className="ipc-page-heading">{title}</h2>
        {description && <p className="ipc-page-description">{description}</p>}
      </div>
      {actions && <div className="ipc-page-actions">{actions}</div>}
    </div>
  );
}
