import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  columns?: number | Array<{ width?: string; align?: 'left' | 'center' | 'right' }>;
  rows?: number;
  showHeader?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function TableSkeleton({
  columns = 5,
  rows = 6,
  showHeader = true,
  className,
  ariaLabel = 'Đang tải dữ liệu bảng...',
}: TableSkeletonProps) {
  const columnConfigs = typeof columns === 'number'
    ? Array.from({ length: columns }, () => ({ width: undefined, align: 'left' as const }))
    : columns;
  const gridTemplateColumns = columnConfigs
    .map((column) => column.width ?? 'minmax(0, 1fr)')
    .join(' ');
  const rowList = Array.from({ length: rows }, (_, index) => index);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn(
        'w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs',
        className
      )}
    >
      <div role="table" aria-label={ariaLabel} className="min-w-full overflow-x-auto text-sm">
        {showHeader && (
          <div role="rowgroup" className="border-b border-slate-200 bg-slate-50/90">
            <div role="row" className="grid" style={{ gridTemplateColumns }}>
              {columnConfigs.map((column, index) => (
                <div
                  role="columnheader"
                  key={index}
                  className="h-9 border-r border-slate-200 p-2.5 px-3 last:border-r-0"
                >
                  <div
                    className={cn(
                      'h-3.5 animate-pulse rounded bg-slate-200/80',
                      index === 0 ? 'w-24' : index === columnConfigs.length - 1 ? 'w-16' : 'w-20',
                      column.align === 'right' && 'ml-auto',
                      column.align === 'center' && 'mx-auto'
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div role="rowgroup" className="divide-y divide-slate-200 bg-white">
          {rowList.map((rowIndex) => (
            <div
              role="row"
              key={rowIndex}
              className="grid hover:bg-slate-50/40"
              style={{ gridTemplateColumns }}
            >
              {columnConfigs.map((column, columnIndex) => (
                <div
                  role="cell"
                  key={columnIndex}
                  className="border-r border-slate-200 p-2.5 px-3 last:border-r-0"
                >
                  <div
                    className={cn(
                      'h-4 animate-pulse rounded bg-slate-100',
                      columnIndex === 0
                        ? 'w-32'
                        : columnIndex === 1
                          ? 'w-44'
                          : columnIndex === columnConfigs.length - 1
                            ? 'w-16'
                            : 'w-24',
                      column.align === 'right' && 'ml-auto',
                      column.align === 'center' && 'mx-auto'
                    )}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
