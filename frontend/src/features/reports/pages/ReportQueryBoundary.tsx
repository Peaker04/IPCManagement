import type { ReactNode } from 'react';
import { InlineAlert, QueryErrorAlert } from '@/components/common';
import type { QueryView } from '@/lib/queryView';

interface ReportQueryBoundaryProps {
  view: QueryView<unknown>;
  children: ReactNode;
}

export function ReportQueryBoundary({ view, children }: ReportQueryBoundaryProps) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem báo cáo" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title="Không tải được dữ liệu báo cáo"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        {view.message} Không thể kết luận báo cáo đang trống.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo báo cáo" variant="info">{view.instruction}</InlineAlert>;
  }
  if (view.phase === 'loading') {
    return <InlineAlert title="Đang tải dữ liệu báo cáo" variant="info">Dữ liệu đang được đồng bộ.</InlineAlert>;
  }

  return (
    <>
      {view.isRefreshing && (
        <InlineAlert title="Đang cập nhật báo cáo" variant="info">
          Dữ liệu hiện tại vẫn được giữ trong khi đồng bộ bản mới.
        </InlineAlert>
      )}
      {children}
    </>
  );
}
