import { clsx } from 'clsx';
import { LOADING_INDICATOR_DELAY_MS, useDeferredSkeleton } from '../../hooks/useDeferredSkeleton';

export type SkeletonKind = 'table' | 'matrix' | 'split' | 'form';

export interface SkeletonGeometry {
  kind: SkeletonKind;
  columns?: number;
  rows?: number;
  columnWidths?: string[];
  splitRatio?: '40/60' | '60/40' | '65/35';
  toolbar?: boolean;
}

export interface WorkbenchSkeletonProps {
  geometry: SkeletonGeometry;
  className?: string;
  delayMs?: number;
}

function SkeletonRows({ columns, rows, columnWidths }: { columns: number; rows: number; columnWidths?: string[] }) {
  return (
    <div className="flex-1 min-h-0 bg-white" aria-hidden="true">
      {/* Table Header Skeleton */}
      <div data-skeleton-header data-skeleton-mark className="h-10 w-full bg-slate-100 border-b border-slate-200 flex items-center gap-4 px-4 shrink-0">
        {Array.from({ length: columns }).map((__, column) => {
          const width = columnWidths?.[column];
          return (
            <span
              data-skeleton-mark
              key={column}
              style={width ? { width, flex: 'none' } : undefined}
              className={clsx('h-3.5 bg-slate-300/80 rounded', !width && 'flex-1')}
            />
          );
        })}
      </div>
      {/* Table Body Rows Skeleton (fills full viewport) */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} data-skeleton-row className="h-10 w-full bg-white flex items-center gap-4 px-4">
          {Array.from({ length: columns }).map((__, column) => {
            const width = columnWidths?.[column];
            return (
              <span
                key={column}
                data-skeleton-cell
                data-skeleton-mark
                style={width ? { width, flex: 'none' } : undefined}
                className={clsx('h-3 bg-slate-200 rounded', !width && 'flex-1')}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function WorkbenchSkeleton({ geometry, className, delayMs = LOADING_INDICATOR_DELAY_MS }: WorkbenchSkeletonProps) {
  const showMarks = useDeferredSkeleton(true, delayMs);
  const columns = Math.max(1, geometry.columns ?? 6);
  const rows = Math.max(1, geometry.rows ?? 12);
  const content = <SkeletonRows columns={columns} rows={rows} columnWidths={geometry.columnWidths} />;

  return (
    <div
      role="status"
      aria-label="Đang tải nội dung"
      aria-busy="true"
      data-skeleton-kind={geometry.kind}
      data-loading-phase={showMarks ? 'visible' : 'reserved'}
      className={clsx('flex-1 min-h-0 w-full flex flex-col bg-white overflow-hidden', className)}
    >
      {/* Zone 2 TelemetrySubbar Skeleton (44px / h-11) */}
      {geometry.toolbar && (
        <div data-skeleton-mark aria-hidden="true" className="h-11 shrink-0 border-b border-slate-200 bg-slate-50 px-5 flex items-center justify-between gap-4">
          <div data-skeleton-mark className="h-4 w-44 bg-slate-200 rounded" />
          <div data-skeleton-mark className="h-4 w-60 bg-slate-200 rounded" />
        </div>
      )}

      {geometry.kind === 'split' ? (
        <div className="flex flex-1 min-h-0 w-full" data-split-ratio={geometry.splitRatio ?? '60/40'}>
          <div data-skeleton-pane className={`${geometry.splitRatio === '40/60' ? 'w-5/12' : 'w-7/12'} min-w-0 flex flex-col`}>{content}</div>
          <div data-skeleton-pane data-skeleton-mark className="flex-1 min-w-0 border-l border-slate-200 bg-slate-50/40 p-5 space-y-4">
            <div data-skeleton-mark className="h-5 w-48 bg-slate-200 rounded" />
            <div data-skeleton-mark className="h-28 w-full bg-slate-100 border border-slate-200 rounded-md" />
            <div className="space-y-2">
              <div data-skeleton-mark className="h-4 w-32 bg-slate-200 rounded" />
              <div data-skeleton-mark className="h-8 w-full bg-slate-100 rounded" />
              <div data-skeleton-mark className="h-8 w-full bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ) : geometry.kind === 'form' ? (
        <div className="p-6 space-y-4 max-w-2xl" aria-hidden="true">
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} data-skeleton-row data-skeleton-mark className="h-10 w-full bg-slate-50 border border-slate-200 rounded"><span data-skeleton-mark className="block h-3 w-1/3 bg-slate-200 rounded" /></div>
          ))}
        </div>
      ) : content}
    </div>
  );
}
