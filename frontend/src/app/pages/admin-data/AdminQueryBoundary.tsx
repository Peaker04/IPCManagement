import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert } from '@/components/common';
import type { QueryView } from '@/lib/queryView';

export interface AdminQueryEntry {
  label: string;
  view: QueryView<unknown>;
}

interface AdminQueryBoundaryProps {
  queries: AdminQueryEntry[];
  children: ReactNode;
}

export function AdminQueryBoundary({ queries, children }: AdminQueryBoundaryProps) {
  const forbidden = queries.find(({ view }) => view.phase === 'forbidden');
  if (forbidden?.view.phase === 'forbidden') {
    return (
      <InlineAlert title={`Không có quyền xem ${forbidden.label}`} variant="danger">
        <span role="alert">{forbidden.view.message}</span>
      </InlineAlert>
    );
  }

  const failed = queries.find(({ view }) => view.phase === 'error');
  if (failed?.view.phase === 'error') {
    return (
      <QueryErrorAlert
        title={`Không tải được ${failed.label}`}
        isRetrying={failed.view.isRetrying}
        onRetry={failed.view.retry}
      >
        {failed.view.message} Không thể kết luận dữ liệu đang trống.
      </QueryErrorAlert>
    );
  }

  const uninitialized = queries.find(({ view }) => view.phase === 'uninitialized');
  if (uninitialized?.view.phase === 'uninitialized') {
    return <InlineAlert title={`Chưa khởi tạo ${uninitialized.label}`} variant="info">{uninitialized.view.instruction}</InlineAlert>;
  }

  const loading = queries.find(({ view }) => view.phase === 'loading');
  if (loading) {
    return <InlineAlert title={`Đang tải ${loading.label}`} variant="info">Dữ liệu đang được đồng bộ.</InlineAlert>;
  }

  const refreshingLabels = queries
    .filter(({ view }) => view.phase === 'ready' && view.isRefreshing)
    .map(({ label }) => label);

  return (
    <>
      {refreshingLabels.length > 0 && (
        <InlineAlert title="Đang cập nhật dữ liệu quản trị" variant="info">
          Vẫn giữ dữ liệu hiện tại cho {refreshingLabels.join(', ')} trong khi đồng bộ bản mới.
        </InlineAlert>
      )}
      {children}
    </>
  );
}
