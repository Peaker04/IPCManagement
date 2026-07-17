import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PaginatedTableFrameProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}

/**
 * Stable table boundary for route migrations. It deliberately does not own
 * data, filtering or totals; those remain with the route/API adapter.
 */
export function PaginatedTableFrame({ children, ariaLabel, className }: PaginatedTableFrameProps) {
  return (
    <div
      className={cn('ipc-paginated-table-frame w-full overflow-auto', className)}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
