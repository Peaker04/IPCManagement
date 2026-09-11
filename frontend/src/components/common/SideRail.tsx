import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InfoNote } from './InfoNote';

interface SideRailProps {
  title?: ReactNode;
  description?: ReactNode;
  descriptionPlacement?: 'popover' | 'inline';
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SideRail({
  title,
  description,
  descriptionPlacement = 'popover',
  actions,
  children,
  className,
}: SideRailProps) {
  const showInlineDescription = description && descriptionPlacement === 'inline';
  const showPopoverDescription = description && descriptionPlacement === 'popover';

  return (
    <aside className={cn('ipc-side-rail', className)}>
      {(title || description || actions) && (
        <div className="ipc-side-rail-header">
          <div>
            {title && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="ipc-side-rail-title">{title}</h3>
                {showPopoverDescription && (
                  <InfoNote
                    title={typeof title === 'string' ? title : 'Hướng dẫn'}
                    content={description}
                  />
                )}
              </div>
            )}
            {showInlineDescription && <p className="ipc-side-rail-description">{description}</p>}
          </div>
          {actions && <div className="ipc-side-rail-actions">{actions}</div>}
        </div>
      )}
      <div className="ipc-side-rail-body">{children}</div>
    </aside>
  );
}
