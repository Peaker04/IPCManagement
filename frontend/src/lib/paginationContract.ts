export type PaginationMode = 'local' | 'page-number' | 'cursor';

export interface PaginationContract {
  mode: PaginationMode;
  pageSize: number;
  totalItems?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

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
