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

  const rowList = Array.from({ length: rows }, (_, i) => i);

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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {showHeader && (
            <thead className="border-b border-slate-200 bg-slate-50/90">
              <tr>
                {columnConfigs.map((col, idx) => (
                  <th
                    key={idx}
                    className="h-9 border-r border-slate-200 p-2.5 px-3 last:border-r-0"
                    style={{ width: col.width }}
                  >
                    <div
                      className={cn(
                        'h-3.5 animate-pulse rounded bg-slate-200/80',
                        idx === 0 ? 'w-24' : idx === columnConfigs.length - 1 ? 'w-16' : 'w-20',
                        col.align === 'right' && 'ml-auto',
                        col.align === 'center' && 'mx-auto'
                      )}
                    />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-200 bg-white">
            {rowList.map((rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/40">
                {columnConfigs.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className="border-r border-slate-200 p-2.5 px-3 last:border-r-0"
                    style={{ width: col.width }}
                  >
                    <div
                      className={cn(
                        'h-4 animate-pulse rounded bg-slate-100',
                        colIdx === 0
                          ? 'w-32'
                          : colIdx === 1
                            ? 'w-44'
                            : colIdx === columnConfigs.length - 1
                              ? 'w-16'
                              : 'w-24',
                        col.align === 'right' && 'ml-auto',
                        col.align === 'center' && 'mx-auto'
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
