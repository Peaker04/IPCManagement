import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabContentSkeletonGeometry = 'compact' | 'section' | 'table' | 'workspace';

export interface TabContentSkeletonProps {
  /** Variant of layout: 'table' (default), 'split' (master-detail), or 'cards' */
  variant?: 'table' | 'split' | 'cards';
  /** Stable loading footprint matching the owning ready-state surface. */
  geometry?: TabContentSkeletonGeometry;
  /** Number of table rows to simulate (default: 6) */
  rows?: number;
  /** Number of columns (default: 6) */
  columns?: number;
  /** Optional custom minimum height. Prefer geometry for canonical surfaces. */
  minHeight?: string;
  /** Optional loading message to display alongside spinner */
  message?: string;
  className?: string;
}

const geometryClasses: Record<TabContentSkeletonGeometry, string> = {
  compact: 'min-h-[12rem]',
  section: 'min-h-[20rem]',
  table: 'min-h-[26rem]',
  workspace: 'min-h-[34rem]',
};

export const TabContentSkeleton = memo(function TabContentSkeleton({
  variant = 'table',
  geometry = variant === 'split' ? 'workspace' : 'table',
  rows = 6,
  columns = 6,
  minHeight,
  message = 'Đang tải dữ liệu...',
  className,
}: TabContentSkeletonProps) {
  const rowList = Array.from({ length: rows }, (_, i) => i);
  const colList = Array.from({ length: columns }, (_, i) => i);

  if (variant === 'split') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        role="status"
        data-geometry={geometry}
        className={cn(
          'w-full flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-2xs animate-in fade-in duration-150',
          minHeight ?? geometryClasses[geometry],
          className
        )}
      >
        {/* Top bar with search and spinner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-64 animate-pulse rounded-md bg-slate-100 border border-slate-200/80" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Loader2 className="size-3.5 animate-spin text-blue-600" />
            <span>{message}</span>
          </div>
        </div>

        {/* 2-column split layout */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Master queue list (7 cols) */}
          <div className="space-y-3 lg:col-span-7">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200/70" />
            <div className="space-y-2.5">
              {rowList.slice(0, 4).map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-slate-50/50 p-3.5"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200/80" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-7 w-20 animate-pulse rounded-md bg-slate-200/60" />
                </div>
              ))}
            </div>
          </div>

          {/* Detail preview pane (5 cols) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200/80" />
              <div className="space-y-2 pt-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-slate-200/50" />
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-200/50" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200/50" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <div className="h-8 w-20 animate-pulse rounded bg-slate-200/60" />
              <div className="h-8 w-24 animate-pulse rounded bg-blue-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      role="status"
      data-geometry={geometry}
      className={cn(
        'w-full flex flex-col rounded-md border border-slate-200 bg-white p-4 shadow-2xs animate-in fade-in duration-150',
        minHeight ?? geometryClasses[geometry],
        className
      )}
    >
      {/* Top action / search bar placeholder */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-9 w-64 animate-pulse rounded-md bg-slate-100 border border-slate-200/80" />
          <div className="hidden sm:block h-8 w-24 animate-pulse rounded-md bg-slate-100" />
          <div className="hidden md:block h-8 w-20 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 className="size-3.5 animate-spin text-blue-600" />
          <span>{message}</span>
        </div>
      </div>

      {/* Structured table-like skeleton without introducing a new raw table owner. */}
      <div role="table" aria-label={message} className="flex-1 overflow-hidden rounded border border-slate-200">
        <div role="rowgroup" className="border-b border-slate-200 bg-slate-50/90">
          <div role="row" className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {colList.map((colIdx) => (
              <div role="columnheader" key={colIdx} className="h-9 border-r border-slate-200/80 px-3 py-2 last:border-r-0">
                <div
                  className={cn(
                    'h-3.5 animate-pulse rounded bg-slate-200/80',
                    colIdx === 0
                      ? 'w-24'
                      : colIdx === colList.length - 1
                        ? 'w-16 ml-auto'
                        : 'w-20'
                  )}
                />
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="divide-y divide-slate-100 bg-white">
          {rowList.map((rowIdx) => (
            <div
              role="row"
              key={rowIdx}
              className="grid hover:bg-slate-50/40"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {colList.map((colIdx) => (
                <div role="cell" key={colIdx} className="border-r border-slate-100 px-3 py-2.5 last:border-r-0">
                  <div
                    className={cn(
                      'h-3.5 animate-pulse rounded',
                      colIdx === 0
                        ? 'w-32 bg-slate-200/70'
                        : colIdx === 1
                          ? 'w-48 bg-slate-100'
                          : colIdx === colList.length - 1
                            ? 'w-20 ml-auto bg-slate-100'
                            : 'w-24 bg-slate-100'
                    )}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Pagination Bar Skeleton */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100 border border-slate-200" />
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100 border border-slate-200" />
        </div>
      </div>
    </div>
  );
});
