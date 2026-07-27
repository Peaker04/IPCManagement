import { toQueryView, type QuerySnapshot, type QueryViewTruncation } from '@/lib/queryView'

type ChefQueryOptions<T> = {
  instruction?: string
  getTruncation?: (data: T) => QueryViewTruncation | null
}

export const toChefView = <T,>(
  query: QuerySnapshot<T> & { refetch: () => unknown },
  label: string,
  options: ChefQueryOptions<T> = {},
) => toQueryView(query, {
  instruction: options.instruction ?? `Mở vùng ${label} để tải dữ liệu.`,
  retry: () => query.refetch(),
  errorMessage: `Không tải được ${label}.`,
  forbiddenMessage: `Bạn không có quyền xem ${label}.`,
  getTruncation: options.getTruncation,
})
