import { useMemo, useState } from 'react';
import { formatPaginationRange } from './uiCopy';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  start: number;
  end: number;
  hasPrevious: boolean;
  hasNext: boolean;
  rangeLabel: string;
}

export const getPaginationMeta = (page: number, pageSize: number, totalItems: number): PaginationMeta => {
  const safePageSize = Math.max(1, pageSize);
  const safeTotalItems = Math.max(0, totalItems);
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = safeTotalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const end = safeTotalItems === 0 ? 0 : Math.min(safePage * safePageSize, safeTotalItems);

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    totalPages,
    start,
    end,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
    rangeLabel: formatPaginationRange(start, end, safeTotalItems),
  };
};

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
