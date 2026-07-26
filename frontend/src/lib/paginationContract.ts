export type PaginationMode = 'local' | 'page-number' | 'cursor';

interface BasePaginationContract {
  pageSize: number;
}

export interface LocalPaginationContract extends BasePaginationContract {
  mode: 'local';
  totalItems: number;
}

export interface PageNumberPaginationContract extends BasePaginationContract {
  mode: 'page-number';
  totalItems: number;
}

export interface CursorPaginationContract extends BasePaginationContract {
  mode: 'cursor';
  hasNext: boolean;
  hasPrevious: boolean;
}

export type PaginationContract = LocalPaginationContract | PageNumberPaginationContract | CursorPaginationContract;

export const createLocalPaginationContract = (pageSize: number, totalItems: number): PaginationContract => ({
  mode: 'local',
  pageSize: Math.max(1, pageSize),
  totalItems: Math.max(0, totalItems),
});

export const createPageNumberPaginationContract = (pageSize: number, totalItems: number): PaginationContract => ({
  mode: 'page-number',
  pageSize: Math.max(1, pageSize),
  totalItems: Math.max(0, totalItems),
});

export const createCursorPaginationContract = (pageSize: number, hasNext: boolean, hasPrevious: boolean): PaginationContract => ({
  mode: 'cursor',
  pageSize: Math.max(1, pageSize),
  hasNext,
  hasPrevious,
});
