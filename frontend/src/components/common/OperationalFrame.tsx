import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OperationalFrameProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  command?: ReactNode;
  context?: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
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
}: OperationalFrameProps) {
  return (
    <section className={cn('ipc-operational-frame', className)}>
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

      <div className={cn('ipc-operational-body', rail && 'has-rail', contentClassName)}>
        <div className="ipc-operational-primary">{children}</div>
        {rail && <aside className="ipc-operational-rail">{rail}</aside>}
      </div>
    </section>
  );
}
