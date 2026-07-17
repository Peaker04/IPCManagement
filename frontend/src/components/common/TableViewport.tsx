import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TableViewportProps {
  children: ReactNode;
  ariaLabel: string;
  caption?: string;
  className?: string;
}

/**
 * Canonical boundary for operational tables. Data, filters and pagination
 * remain outside this component so the viewport cannot silently change API
 * contracts while route families are being migrated.
 */
export function TableViewport({ children, ariaLabel, caption, className }: TableViewportProps) {
  return (
    <div
      className={cn('ipc-table-viewport w-full overflow-auto', className)}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {caption ? <div className="sr-only">{caption}</div> : null}
      {children}
    </div>
  );
}
