import { useMemo, useState } from 'react';
import { getPaginationMeta } from './paginationMeta';

export { getPaginationMeta } from './paginationMeta';
export type { PaginationMeta } from './paginationMeta';

export function usePaginatedRows<T>(rows: readonly T[], pageSize = 10) {
  const [requestedPage, setRequestedPage] = useState(1);
  const meta = useMemo(
    () => getPaginationMeta(requestedPage, pageSize, rows.length),
    [requestedPage, pageSize, rows.length],
  );

  const visibleRows = useMemo(
    () => rows.slice((meta.page - 1) * meta.pageSize, meta.page * meta.pageSize),
    [meta.page, meta.pageSize, rows],
  );

  return {
    ...meta,
    rows: visibleRows,
    setPage: (nextPage: number) => setRequestedPage(nextPage),
    nextPage: () => setRequestedPage((currentPage) => currentPage + 1),
    previousPage: () => setRequestedPage((currentPage) => currentPage - 1),
    resetPage: () => setRequestedPage(1),
  };
}
