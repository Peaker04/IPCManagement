import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Boxes, type LucideIcon } from 'lucide-react';
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
  highlightedKeys?: string[];
  emptyState?: ReactNode;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  className?: string;
  minWidth?: string;
  virtualized?: boolean;
  rowHeight?: number;
}

/**
 * Zone 3: DataGrid (Occupies 85% Viewport — calc(100dvh - 100px))
 * Rule T7: Sticky top-0 z-10 thead, single vertical scrollbar.
 * Rule T8: Compact operational density (rows h-10 / 40px, text-sm).
 * Rule L2-UI-02: Roving Tabindex & Excel-style Arrow Navigation (ArrowUp/Down/Home/End/Enter/Space).
 */
export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedKey,
  highlightedKeys,
  emptyState,
  emptyMessage,
  emptyIcon: CustomEmptyIcon,
  className,
  minWidth,
  virtualized = false,
  rowHeight = 40,
}: DataGridProps<T>) {
  const EmptyIcon = CustomEmptyIcon || Boxes;
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Task L3-00: Safely bound focused row index when filters reduce row count so 1 row always holds tabIndex=0
  const effectiveFocusedIndex = data.length > 0 ? Math.min(focusedRowIndex, data.length - 1) : 0;

  // Task L5-06: Virtual windowing computation for massive datasets (INP < 100ms)
  const totalCount = data.length;
  const viewportHeight = 600;
  const overscan = 5;
  const startIndex = virtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0;
  const endIndex = virtualized ? Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan) : totalCount;

  const visibleData = virtualized ? data.slice(startIndex, endIndex) : data;
  const topSpacerHeight = virtualized ? startIndex * rowHeight : 0;
  const bottomSpacerHeight = virtualized ? (totalCount - endIndex) * rowHeight : 0;

  // Keep focused row in sync with selectedKey if externally controlled
  useEffect(() => {
    if (selectedKey && data.length > 0) {
      const idx = data.findIndex((row, i) => keyExtractor(row, i) === selectedKey);
      if (idx !== -1) {
        setFocusedRowIndex(idx);
      }
    }
  }, [selectedKey, data, keyExtractor]);

  if (data.length === 0 && (emptyState || emptyMessage)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 bg-white text-center">
        {emptyState || (
          <div className="flex flex-col items-center justify-center">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400"
            >
              <EmptyIcon size={20} strokeWidth={1.75} />
            </div>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    if (!onRowClick) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = Math.min(data.length - 1, index + 1);
        setFocusedRowIndex(nextIndex);
        rowRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = Math.max(0, index - 1);
        setFocusedRowIndex(prevIndex);
        rowRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        setFocusedRowIndex(0);
        rowRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        const lastIndex = data.length - 1;
        setFocusedRowIndex(lastIndex);
        rowRefs.current[lastIndex]?.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        onRowClick(row);
        break;
      }
    }
  };

  return (
    <div
      onScroll={virtualized ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      className={twMerge(
        clsx(
          'flex-1 min-h-0 w-full overflow-auto bg-white select-text relative scroll-smooth overscroll-contain',
          className
        )
      )}
    >
      <table className={twMerge('w-full text-left text-sm text-slate-800 border-collapse table-fixed', minWidth ?? 'min-w-full')}>
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
          {topSpacerHeight > 0 && (
            <tr style={{ height: `${topSpacerHeight}px` }} aria-hidden="true">
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          )}
          {visibleData.map((row, index) => {
            const actualIndex = startIndex + index;
            const key = keyExtractor(row, actualIndex);
            const isSelected = selectedKey === key;
            const isFocused = actualIndex === effectiveFocusedIndex;
            const isHighlighted = highlightedKeys?.includes(key);
            return (
              <tr
                key={key}
                ref={(el) => { rowRefs.current[actualIndex] = el; }}
                onClick={() => {
                  setFocusedRowIndex(actualIndex);
                  onRowClick?.(row);
                }}
                onKeyDown={(e) => handleRowKeyDown(e, actualIndex, row)}
                tabIndex={onRowClick ? (isFocused ? 0 : -1) : undefined}
                aria-selected={onRowClick ? isSelected : undefined}
                data-highlighted={isHighlighted ? true : undefined}
                className={clsx(
                  'h-10 transition-colors',
                  onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500',
                  isHighlighted && 'animate-row-flash bg-blue-50/80',
                  isSelected
                    ? 'bg-blue-50 hover:bg-blue-100/70'
                    : 'hover:bg-slate-50/80',
                  actualIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'
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
                    {col.cell(row, actualIndex)}
                  </td>
                ))}
              </tr>
            );
          })}
          {bottomSpacerHeight > 0 && (
            <tr style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true">
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
