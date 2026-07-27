import { toQueryView, type QuerySnapshot, type QueryViewTruncation } from './queryView'

type LabeledQueryOptions<T> = {
  instruction?: string
  retry?: () => unknown
  getTruncation?: (data: T) => QueryViewTruncation | null
}

export const toLabeledQueryView = <T,>(
  query: QuerySnapshot<T> & { refetch?: () => unknown },
  label: string,
  options: LabeledQueryOptions<T> = {},
) => toQueryView(query, {
  instruction: options.instruction ?? `Mở vùng ${label} để tải dữ liệu.`,
  retry: options.retry ?? (() => query.refetch?.()),
  errorMessage: `Không tải được ${label}.`,
  forbiddenMessage: `Bạn không có quyền xem ${label}.`,
  getTruncation: options.getTruncation,
})
