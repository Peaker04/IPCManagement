import type { ReactNode } from 'react';
import { InlineAlert } from './InlineAlert';
import { QueryErrorAlert } from './QueryErrorAlert';
import type { QueryView } from '@/lib/queryView';

export type QueryViewEntry = {
  label: string;
  view: QueryView<unknown>;
};

export type QueryViewGeometry = 'compact' | 'section' | 'table' | 'workspace';

type Props = {
  queries: QueryViewEntry[];
  children: ReactNode;
  preserveFallback?: boolean;
  refreshLabel?: string;
  geometry?: QueryViewGeometry;
  minHeight?: string;
  noticePlacement?: 'inline' | 'overlay';
};

const geometryMinHeight: Record<QueryViewGeometry, string> = {
  compact: 'min-h-0',
  section: 'min-h-[180px]',
  table: 'min-h-[380px]',
  workspace: 'min-h-[380px]',
};

/**
 * QueryViewBoundary - Centralized Layout-Preserving Boundary (Rule C1, C6, E1, E8)
 * Keeps layout structure intact during loading, avoiding intrusive inline alert layout shifts.
 */
export function QueryViewBoundary({
  queries,
  children,
  preserveFallback = false,
  refreshLabel = 'Đang cập nhật dữ liệu',
  geometry = 'section',
  minHeight,
  noticePlacement = 'inline',
}: Props) {
  const boundaryMinHeight = minHeight ?? geometryMinHeight[geometry];
  const forbidden = queries.find(({ view }) => view.phase === 'forbidden');
  if (forbidden && forbidden.view.phase === 'forbidden') {
    return (
      <div className={`relative flex flex-col gap-3 ${boundaryMinHeight}`} data-query-geometry={geometry}>
        <InlineAlert title={`Không có quyền xem ${forbidden.label}`} variant="danger">
          <span role="alert">{forbidden.view.message}</span>
        </InlineAlert>
      </div>
    );
  }

  const errors = queries.filter(({ view }) => view.phase === 'error');
  if (errors.length > 0 && !preserveFallback) {
    const primary = errors[0];
    if (primary.view.phase === 'error') {
      return (
        <div className={`relative flex flex-col gap-3 ${boundaryMinHeight}`} data-query-geometry={geometry}>
          <QueryErrorAlert
            title={`Không tải được ${primary.label}`}
            isRetrying={primary.view.isRetrying}
            onRetry={primary.view.retry}
          >
            {primary.view.message} Không thể kết luận dữ liệu đang trống.
          </QueryErrorAlert>
        </div>
      );
    }
  }

  const uninitialized = queries.find(({ view }) => view.phase === 'uninitialized');
  if (uninitialized && !preserveFallback && queries.every(({ view }) => view.phase === 'uninitialized') && uninitialized.view.phase === 'uninitialized') {
    return (
      <div className={`relative flex flex-col gap-3 ${boundaryMinHeight}`} data-query-geometry={geometry}>
        <InlineAlert title={`Chưa khởi tạo ${uninitialized.label}`} variant="info">
          {uninitialized.view.instruction}
        </InlineAlert>
      </div>
    );
  }

  const loadingEntries = queries.filter(({ view }) => view.phase === 'loading');
  if (loadingEntries.length > 0 && !preserveFallback) {
    return (
      <div className={`relative flex flex-col gap-3 ${boundaryMinHeight}`} data-query-geometry={geometry} role="status">
        {loadingEntries.map(({ label }) => (
          <InlineAlert key={`loading-${label}`} title={`Đang tải ${label}`} variant="info">
            Dữ liệu đang được đồng bộ.
          </InlineAlert>
        ))}
      </div>
    );
  }

  const isRefreshing = queries.some(({ view }) => view.phase === 'ready' && view.isRefreshing);

  return (
    <div className={`relative flex flex-col gap-3 ${boundaryMinHeight}`} data-query-geometry={geometry}>
      {/* If preserveFallback and there are errors, show error notice */}
      {preserveFallback && noticePlacement === 'overlay' && errors.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2">
          {errors.map(({ label, view }) => view.phase === 'error' ? (
            <div key={`err-${label}`} className="pointer-events-auto">
              <QueryErrorAlert title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>
                {view.message}
              </QueryErrorAlert>
            </div>
          ) : null)}
        </div>
      )}
      {preserveFallback && noticePlacement === 'inline' &&
        errors.map(({ label, view }) => {
          if (view.phase === 'error') {
            return (
              <QueryErrorAlert
                key={`err-${label}`}
                title={`Không tải được ${label}`}
                isRetrying={view.isRetrying}
                onRetry={view.retry}
              >
                {view.message}
              </QueryErrorAlert>
            );
          }
          return null;
        })}

      {/* Floating non-intrusive refresh badge (Rule C6) */}
      {isRefreshing && (
        <span
          className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200"
          role="status"
        >
          {refreshLabel}
        </span>
      )}

      {/* Truncation warning if present */}
      {queries.map(({ label, view }) => {
        if (view.phase === 'ready' && view.truncation) {
          return (
            <InlineAlert
              key={`trunc-${label}`}
              title={`${label} bị giới hạn`}
              variant="warning"
            >
              Đang hiển thị {view.truncation.shown}
              {view.truncation.total === undefined ? '' : `/${view.truncation.total}`} dòng; kết quả này chưa đầy đủ.
            </InlineAlert>
          );
        }
        return null;
      })}

      {/* Children is always rendered */}
      {children}
    </div>
  );
}
