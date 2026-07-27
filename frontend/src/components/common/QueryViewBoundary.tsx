import type { ReactNode } from 'react'
import { InlineAlert } from './InlineAlert'
import { QueryErrorAlert } from './QueryErrorAlert'
import type { QueryView } from '@/lib/queryView'

export type QueryViewEntry = {
  label: string
  view: QueryView<unknown>
}

type Props = {
  queries: QueryViewEntry[]
  children: ReactNode
  preserveFallback?: boolean
  refreshLabel?: string
}

function QueryNotice({ entry }: { entry: QueryViewEntry }) {
  const { label, view } = entry
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title={`Không có quyền xem ${label}`} variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    )
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert title={`Không tải được ${label}`} isRetrying={view.isRetrying} onRetry={view.retry}>
        {view.message} Không thể kết luận dữ liệu đang trống.
      </QueryErrorAlert>
    )
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title={`Chưa khởi tạo ${label}`} variant="info">{view.instruction}</InlineAlert>
  }
  if (view.phase === 'loading') {
    return <InlineAlert title={`Đang tải ${label}`} variant="info">Dữ liệu đang được đồng bộ.</InlineAlert>
  }
  if (view.truncation) {
    return (
      <InlineAlert title={`${label} bị giới hạn`} variant="warning">
        Đang hiển thị {view.truncation.shown}{view.truncation.total === undefined ? '' : `/${view.truncation.total}`} dòng; kết quả này chưa đầy đủ.
      </InlineAlert>
    )
  }
  return null
}

export function QueryViewBoundary({
  queries,
  children,
  preserveFallback = false,
  refreshLabel = 'Đang cập nhật dữ liệu',
}: Props) {
  const blocking = queries.filter(({ view }) => view.phase !== 'ready')
  const actionableBlocking = blocking.filter(({ view }) => view.phase === 'error' || view.phase === 'forbidden')
  const visibleBlocking = preserveFallback
    ? actionableBlocking.length > 0 ? actionableBlocking : blocking.slice(0, 1)
    : blocking.slice(0, 1)
  const readyNotices = queries.filter(({ view }) => view.phase === 'ready' && view.truncation)
  const isRefreshing = queries.some(({ view }) => view.phase === 'ready' && view.isRefreshing)

  return (
    <div className="relative flex flex-col gap-3">
      {isRefreshing && (
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm" role="status">
          {refreshLabel}
        </span>
      )}
      {[...visibleBlocking, ...readyNotices].map((entry) => (
        <QueryNotice key={`${entry.label}-${entry.view.phase}`} entry={entry} />
      ))}
      {(preserveFallback || blocking.length === 0) && children}
    </div>
  )
}
