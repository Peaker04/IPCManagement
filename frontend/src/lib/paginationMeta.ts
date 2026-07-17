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
