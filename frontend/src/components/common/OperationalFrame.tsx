import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type UiOwnershipMarker = {
  ownerId?: `uio-${string}`;
  floorplanId?: `uif-${string}`;
  regionId: `uir-${string}`;
};

// eslint-disable-next-line react-refresh/only-export-components
export const UiOwnershipContext = createContext<UiOwnershipMarker | undefined>(undefined);

export interface OperationalFrameProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  command?: ReactNode;
  context?: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  uiOwnership?: UiOwnershipMarker;
}

export function OperationalFrame({
  eyebrow,
  title,
  description,
  command,
  context,
  rail,
  children,
  className,
  contentClassName,
  uiOwnership,
}: OperationalFrameProps) {
  const inheritedOwnership = useContext(UiOwnershipContext);

  return (
    <section
      className={cn('ipc-operational-frame', className)}
      data-ui-owner={uiOwnership?.ownerId}
      data-ui-floorplan={uiOwnership?.floorplanId}
      data-ui-region={uiOwnership?.regionId ?? inheritedOwnership?.regionId ?? 'uir-i'}
    >
      {(eyebrow || title || description || command || context) && (
        <div className="ipc-operational-head">
          {(eyebrow || title || description) && (
            <div className="ipc-operational-title-group">
              {eyebrow && <div className="ipc-operational-eyebrow">{eyebrow}</div>}
              {title && <h2 className="ipc-operational-title">{title}</h2>}
              {description && <p className="ipc-operational-description">{description}</p>}
            </div>
          )}
          {command}
          {context}
        </div>
      )}

      <div className={cn('ipc-operational-body flex-1 min-h-0', rail && 'has-rail', contentClassName)}>
        <div className="ipc-operational-primary flex-1 min-h-0 flex flex-col">{children}</div>
        {rail && <aside className="ipc-operational-rail">{rail}</aside>}
      </div>
    </section>
  );
}
