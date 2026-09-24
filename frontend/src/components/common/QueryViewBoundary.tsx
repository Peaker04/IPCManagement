import type { ReactNode } from 'react';
import { InlineAlert } from './InlineAlert';
import { QueryErrorAlert } from './QueryErrorAlert';
import { RefreshStatus } from './RefreshStatus';
import type { QueryView } from '@/lib/queryView';

export type QueryViewEntry = { label: string; view: QueryView<unknown> };
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

function BlockingQueryNotice({ entry }: { entry: QueryViewEntry }) {
  const { label, view } = entry;
  if (view.phase === 'forbidden') {
    return <InlineAlert title={`Không có quyền xem ${label}`} variant="danger"><span role="alert">{view.message}</span></InlineAlert>;
  }
  if (view.phase === 'error') {
    return <QueryErrorAlert title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>{view.message} Dữ liệu hiện tại chưa được xác nhận.</QueryErrorAlert>;
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title={`Chưa khởi tạo ${label}`} variant="info">{view.instruction}</InlineAlert>;
  }
  return <InlineAlert title={`Đang tải ${label}`} variant="info">Dữ liệu đang được đồng bộ.</InlineAlert>;
}

export function QueryViewBoundary({
  queries,
  children,
  preserveFallback = false,
  refreshLabel = 'Đang cập nhật dữ liệu',
  geometry = 'section',
  minHeight = 'min-h-0',
  noticePlacement = 'inline',
}: Props) {
  const forbidden = queries.find(({ view }) => view.phase === 'forbidden');
  const errors = queries.filter(({ view }) => view.phase === 'error');
  const uninitialized = queries.find(({ view }) => view.phase === 'uninitialized');
  const loading = queries.find(({ view }) => view.phase === 'loading');
  const blocking = forbidden
    ?? (!preserveFallback ? errors[0] : undefined)
    ?? uninitialized
    ?? loading;
  const isRefreshing = queries.some(({ view }) => view.phase === 'ready' && view.isRefreshing);

  return (
    <div className={`relative flex flex-col gap-3 ${minHeight}`} data-query-geometry={geometry}>
      {preserveFallback && noticePlacement === 'overlay' && errors.length > 0 && !blocking && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2">
          {errors.map(({ label, view }) => view.phase === 'error' ? (
            <div key={`err-${label}`} className="pointer-events-auto">
              <QueryErrorAlert title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>{view.message}</QueryErrorAlert>
            </div>
          ) : null)}
        </div>
      )}
      {preserveFallback && noticePlacement === 'inline' && !blocking && errors.map(({ label, view }) => view.phase === 'error' ? (
        <QueryErrorAlert key={`err-${label}`} title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>{view.message}</QueryErrorAlert>
      ) : null)}
      {isRefreshing && <RefreshStatus>{refreshLabel}</RefreshStatus>}
      {!blocking && queries.map(({ label, view }) => view.phase === 'ready' && view.truncation ? (
        <InlineAlert key={`trunc-${label}`} title={`${label} bị giới hạn`} variant="warning">
          Đang hiển thị {view.truncation.shown}{view.truncation.total === undefined ? '' : `/${view.truncation.total}`} dòng; kết quả này chưa đầy đủ.
        </InlineAlert>
      ) : null)}
      <div className="relative grid">
        {blocking && <div className="relative z-10 col-start-1 row-start-1"><BlockingQueryNotice entry={blocking} /></div>}
        <div
          className={`col-start-1 row-start-1 ${blocking ? 'invisible' : ''}`}
          inert={Boolean(blocking) || undefined}
          aria-hidden={Boolean(blocking) || undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
