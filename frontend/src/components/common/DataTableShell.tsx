import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataTableShellProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function DataTableShell({ children, className, ariaLabel = 'Bảng dữ liệu có thể cuộn' }: DataTableShellProps) {
  return (
    <div className={cn('ipc-table-shell w-full overflow-x-auto', className)} role="region" aria-label={ariaLabel} tabIndex={0}>
      {children}
    </div>
  );
}
