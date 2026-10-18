import { clsx } from 'clsx';

export type SkeletonKind = 'table' | 'matrix' | 'split' | 'form';

export interface SkeletonGeometry {
  kind: SkeletonKind;
  columns?: number;
  rows?: number;
  splitRatio?: '60/40' | '65/35';
  toolbar?: boolean;
}

export interface WorkbenchSkeletonProps {
  geometry: SkeletonGeometry;
  className?: string;
}

function SkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="flex-1 min-h-0 divide-y divide-slate-100 bg-white" aria-hidden="true">
      {/* Table Header Skeleton */}
      <div className="h-10 w-full bg-slate-100 border-b border-slate-200 flex items-center gap-4 px-4 shrink-0">
        {Array.from({ length: columns }).map((__, column) => (
          <span key={column} className="h-3.5 flex-1 bg-slate-300/80 rounded" />
        ))}
      </div>
      {/* Table Body Rows Skeleton (fills full viewport) */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} data-skeleton-row className="h-10 w-full bg-white flex items-center gap-4 px-4 animate-pulse">
          {Array.from({ length: columns }).map((__, column) => (
            <span key={column} data-skeleton-cell className="h-3 flex-1 bg-slate-200 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function WorkbenchSkeleton({ geometry, className }: WorkbenchSkeletonProps) {
  const columns = Math.max(1, geometry.columns ?? 6);
  const rows = Math.max(1, geometry.rows ?? 12);
  const content = <SkeletonRows columns={columns} rows={rows} />;

  return (
    <div
      role="status"
      aria-label="Đang tải nội dung"
      aria-busy="true"
      data-skeleton-kind={geometry.kind}
      className={clsx('flex-1 min-h-0 w-full flex flex-col bg-white overflow-hidden', className)}
    >
      {/* Zone 2 TelemetrySubbar Skeleton (44px / h-11) */}
      {geometry.toolbar && (
        <div aria-hidden="true" className="h-11 shrink-0 border-b border-slate-200 bg-slate-50 px-5 flex items-center justify-between gap-4">
          <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-60 bg-slate-200 rounded animate-pulse" />
        </div>
      )}

      {geometry.kind === 'split' ? (
        <div className="flex flex-1 min-h-0 w-full" data-split-ratio={geometry.splitRatio ?? '60/40'}>
          <div data-skeleton-pane className="w-7/12 min-w-0 flex flex-col">{content}</div>
          <div data-skeleton-pane className="flex-1 min-w-0 border-l border-slate-200 bg-slate-50/40 p-5 space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-28 w-full bg-slate-100 border border-slate-200 rounded-md animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-8 w-full bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ) : geometry.kind === 'form' ? (
        <div className="p-6 space-y-4 max-w-2xl" aria-hidden="true">
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} data-skeleton-row className="h-10 w-full bg-slate-50 border border-slate-200 rounded animate-pulse" />
          ))}
        </div>
      ) : content}
    </div>
  );
}
