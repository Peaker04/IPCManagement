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
    <div className="flex-1 min-h-0 space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} data-skeleton-row className="h-9 w-full bg-slate-50 border border-slate-100 rounded flex items-center gap-4 px-4 animate-pulse">
          {Array.from({ length: columns }).map((__, column) => (
            <span key={column} data-skeleton-cell className="h-3 flex-1 bg-slate-200 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function WorkbenchSkeleton({ geometry, className }: WorkbenchSkeletonProps) {
  const columns = Math.max(1, geometry.columns ?? 4);
  const rows = Math.max(1, geometry.rows ?? 6);
  const content = <SkeletonRows columns={columns} rows={rows} />;

  return (
    <div
      role="status"
      aria-label="Đang tải nội dung"
      aria-busy="true"
      data-skeleton-kind={geometry.kind}
      className={clsx('flex-1 min-h-0 w-full flex flex-col p-4 gap-2 bg-white', className)}
    >
      {geometry.toolbar && <div aria-hidden="true" className="h-8 w-full bg-slate-100 rounded animate-pulse" />}
      {geometry.kind === 'split' ? (
        <div className="flex flex-1 min-h-0 gap-3" data-split-ratio={geometry.splitRatio ?? '60/40'}>
          <div data-skeleton-pane className="flex-[3] min-w-0 flex flex-col">{content}</div>
          <div data-skeleton-pane className="flex-[2] min-w-0 border-l border-slate-200 pl-3">
            <div aria-hidden="true" className="h-full w-full bg-slate-50 border border-slate-100 rounded animate-pulse" />
          </div>
        </div>
      ) : geometry.kind === 'form' ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} data-skeleton-row className="h-10 w-full bg-slate-50 border border-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : content}
    </div>
  );
}
