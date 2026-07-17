import { useMemo, useState } from 'react';
import { createLocalPaginationContract } from './paginationContract';
import { getPaginationMeta } from './paginationMeta';

/**
 * Local collection controller. It owns visible-row state and exposes the
 * explicit local pagination contract to the route without touching API query
 * parameters.
 */
export function useLocalPagination<T>(rows: readonly T[], pageSize = 10) {
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
    contract: createLocalPaginationContract(meta.pageSize, meta.totalItems),
    setPage: (nextPage: number) => setRequestedPage(nextPage),
    nextPage: () => setRequestedPage((currentPage) => currentPage + 1),
    previousPage: () => setRequestedPage((currentPage) => currentPage - 1),
    resetPage: () => setRequestedPage(1),
  };
}
