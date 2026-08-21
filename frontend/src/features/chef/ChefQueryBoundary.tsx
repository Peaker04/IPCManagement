import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert } from '@/components/common';
import type { QueryView } from '@/lib/queryView';
import { cn } from '@/lib/utils';

export type ChefQueryEntry = {
  label: string;
  view: QueryView<unknown>;
};

type Props = {
  queries: ChefQueryEntry[];
  children: ReactNode;
  preserveFallback?: boolean;
  stabilizeInitialLoad?: boolean;
};

const QueryNotice = ({
  entry,
  showRefreshing = true,
}: {
  entry: ChefQueryEntry;
  showRefreshing?: boolean;
}) => {
  const { label, view } = entry;
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title={`Không có quyền xem ${label}`} variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title={`Không tải được ${label}`}
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        {view.message} Không thể kết luận dữ liệu đang trống.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'uninitialized') {
    return (
      <InlineAlert title={`Chưa khởi tạo ${label}`} variant="info">
        {view.instruction}
      </InlineAlert>
    );
  }
  if (view.phase === 'loading') {
    return (
      <InlineAlert title={`Đang tải ${label}`} variant="info">
        Dữ liệu đang được đồng bộ.
      </InlineAlert>
    );
  }
  return (
    <>
      {showRefreshing && view.isRefreshing && (
        <InlineAlert title={`Đang cập nhật ${label}`} variant="info">
          Dữ liệu hiện tại vẫn được giữ trong khi đồng bộ.
        </InlineAlert>
      )}
      {view.truncation && (
        <InlineAlert title={`${label} bị giới hạn`} variant="warning">
          Đang hiển thị {view.truncation.shown}
          {view.truncation.total === undefined ? '' : `/${view.truncation.total}`} dòng; kết quả này chưa đầy đủ.
        </InlineAlert>
      )}
    </>
  );
};

export function ChefQueryBoundary({
  queries,
  children,
  preserveFallback = false,
  stabilizeInitialLoad = false,
}: Props) {
  const blocking = queries.find(({ view }) => view.phase !== 'ready');
  const isInitialLoad =
    stabilizeInitialLoad &&
    queries.some(({ view }) => view.phase === 'loading' || view.phase === 'uninitialized');
  const visibleEntries =
    isInitialLoad && blocking
      ? [blocking]
      : preserveFallback
        ? queries
        : blocking
          ? [blocking]
          : queries;
  const refreshingLabels = preserveFallback
    ? queries
        .filter(({ view }) => view.phase === 'ready' && view.isRefreshing)
        .map(({ label }) => label)
    : [];

  return (
    <div
      className={cn('relative flex flex-col gap-3', isInitialLoad && 'min-h-[32rem]')}
      data-initial-load={isInitialLoad || undefined}
    >
      {refreshingLabels.length > 0 && (
        <span
          className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200"
          role="status"
        >
          Đang cập nhật dữ liệu ca
        </span>
      )}
      <div className={cn(isInitialLoad && 'absolute inset-x-0 top-0')}>
        {visibleEntries.map((entry) => (
          <QueryNotice
            key={`${entry.label}-${entry.view.phase}`}
            entry={entry}
            showRefreshing={!preserveFallback}
          />
        ))}
      </div>
      {((preserveFallback && !isInitialLoad) || !blocking) && children}
    </div>
  );
}
