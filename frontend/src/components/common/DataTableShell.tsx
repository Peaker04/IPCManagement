import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';
import type { TableDensity } from './TableViewport';

interface DataTableShellProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  density?: TableDensity;
  stickyHeader?: boolean;
  frozenFirstIdentifier?: boolean;
}

export function DataTableShell({
  children,
  className,
  ariaLabel = 'Bảng dữ liệu có thể cuộn',
  density = 'standard',
  stickyHeader = true,
  frozenFirstIdentifier = true,
}: DataTableShellProps) {
  return (
    <div
      className={cn(typography.body, 'ipc-table-shell w-full overflow-x-auto', className)}
      data-ui-table-shell="true"
      data-density={density}
      data-sticky-header={stickyHeader}
      data-frozen-identifier={frozenFirstIdentifier}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
