import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TableViewport } from './TableViewport';

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
    <TableViewport
      ariaLabel={ariaLabel}
      className={cn('ipc-paginated-table-frame', className)}
    >
      {children}
    </TableViewport>
  );
}
