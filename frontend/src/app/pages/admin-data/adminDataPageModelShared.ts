import { toQueryView, type QuerySnapshot } from '@/lib/queryView';

export const EMPTY_ADMIN_LIST: never[] = [];

export const toAdminView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở mục ${label} để tải dữ liệu.`,
  retry: () => query.refetch(),
  errorMessage: `Không tải được ${label}.`,
  forbiddenMessage: `Bạn không có quyền xem ${label}.`,
});
