import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SideRailProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SideRail({ title, description, actions, children, className }: SideRailProps) {
  return (
    <aside className={cn('ipc-side-rail', className)}>
      {(title || description || actions) && (
        <div className="ipc-side-rail-header">
          <div>
            {title && <h3 className="ipc-side-rail-title">{title}</h3>}
            {description && <p className="ipc-side-rail-description">{description}</p>}
          </div>
          {actions && <div className="ipc-side-rail-actions">{actions}</div>}
        </div>
      )}
      <div className="ipc-side-rail-body">{children}</div>
    </aside>
  );
}
