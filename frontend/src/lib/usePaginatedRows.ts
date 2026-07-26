import { useLocalPagination } from './useLocalPagination';

export { getPaginationMeta } from './paginationMeta';
export type { PaginationMeta } from './paginationMeta';

export function usePaginatedRows<T>(rows: readonly T[], pageSize = 10) {
  return useLocalPagination(rows, pageSize);
}
