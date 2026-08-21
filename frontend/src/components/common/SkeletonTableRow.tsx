import { cn } from '@/lib/utils';
import type { TableDensity } from './tablePreferences';

export interface ColumnSkeletonDef {
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface SkeletonTableRowProps {
  columns?: number | ColumnSkeletonDef[];
  rowCount?: number;
  density?: TableDensity;
  className?: string;
}

const densityHeights: Record<TableDensity, string> = {
  compact: 'h-[40px]',
  standard: 'h-[48px]',
  comfortable: 'h-[56px]',
};

/**
 * SkeletonTableRow - Standard Table Skeleton Rows (Rule C2, T8, E8)
 * Renders exact column count and row height matching density tokens.
 * Placed inside <tbody> with aria-hidden="true".
 */
export function SkeletonTableRow({
  columns = 5,
  rowCount = 5,
  density = 'standard',
  className,
}: SkeletonTableRowProps) {
  const colDefs: ColumnSkeletonDef[] =
    typeof columns === 'number'
      ? Array.from({ length: columns }, () => ({}))
      : columns;

  const rows = Array.from({ length: rowCount });

  return (
    <tbody
      className={cn('ipc-skeleton-tbody animate-pulse', className)}
      aria-hidden="true"
    >
      {rows.map((_, rIdx) => (
        <tr
          key={`skel-row-${rIdx}`}
          className={cn(
            'ipc-skeleton-row border-b border-slate-100/80 transition-none',
            densityHeights[density]
          )}
        >
          {colDefs.map((col, cIdx) => (
            <td
              key={`skel-cell-${rIdx}-${cIdx}`}
              style={col.width ? { width: col.width } : undefined}
              className={cn(
                'px-3 py-2 align-middle',
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                col.className
              )}
            >
              <div
                className={cn(
                  'h-3.5 rounded-sm bg-slate-200/70',
                  cIdx === 0
                    ? 'w-3/4'
                    : cIdx === colDefs.length - 1
                      ? 'w-1/2 ml-auto'
                      : 'w-4/5',
                  col.align === 'center' && 'mx-auto',
                  col.align === 'right' && 'ml-auto'
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
