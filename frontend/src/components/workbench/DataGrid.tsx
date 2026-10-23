import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ColumnDef<T> {
  id: string;
  header: ReactNode;
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  cell: (row: T, index: number) => ReactNode;
}

export interface DataGridProps<T = unknown> {
  data: readonly T[];
  columns: readonly ColumnDef<T>[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  emptyState?: ReactNode;
  emptyMessage?: string;
  className?: string;
  minWidth?: string;
}

/**
 * Zone 3: DataGrid (Occupies 85% Viewport — calc(100dvh - 100px))
 * Rule T7: Sticky top-0 z-10 thead, single vertical scrollbar.
 * Rule T8: Compact operational density (rows h-10 / 40px, text-sm).
 */
export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedKey,
  emptyState,
  emptyMessage,
  className,
  minWidth,
}: DataGridProps<T>) {
  if (data.length === 0 && (emptyState || emptyMessage)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 bg-white text-center">
        {emptyState || <p className="text-xs text-slate-500">{emptyMessage}</p>}
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'flex-1 min-h-0 w-full overflow-auto bg-white select-text relative',
          className
        )
      )}
    >
      <table className={twMerge('w-full text-left text-sm text-slate-800 border-collapse table-fixed', minWidth ?? 'min-w-[800px]')}>
        <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200">
          <tr>
            {columns.map((col, colIdx) => (
              <th
                key={col.id}
                style={{ width: col.width, minWidth: col.minWidth }}
                className={clsx(
                  'h-10 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
                  colIdx === 0 && 'sticky left-0 z-20 bg-slate-100',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center'
                )}
                title={typeof col.header === 'string' ? col.header : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, index) => {
            const key = keyExtractor(row, index);
            const isSelected = selectedKey === key;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                onKeyDown={onRowClick ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? isSelected : undefined}
                className={clsx(
                  'h-10 transition-colors',
                  onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500',
                  isSelected
                    ? 'bg-blue-50 hover:bg-blue-100/70'
                    : 'hover:bg-slate-50/80',
                  index % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                )}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.id}
                    style={{ minWidth: col.minWidth }}
                    className={clsx(
                      'px-3 py-2 truncate text-sm',
                      colIdx === 0 && 'sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_var(--border-subtle)]',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
