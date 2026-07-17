import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { formatPaginationRange } from './uiCopy';
import { getPaginationMeta, usePaginatedRows } from './usePaginatedRows';
import { createCursorPaginationContract, createLocalPaginationContract, createPageNumberPaginationContract } from './paginationContract';
import { useLocalPagination } from './useLocalPagination';

describe('pagination helpers', () => {
  it('clamps an invalid page and exposes a Vietnamese range', () => {
    expect(getPaginationMeta(99, 10, 23)).toMatchObject({
      page: 3,
      totalPages: 3,
      start: 21,
      end: 23,
      hasPrevious: true,
      hasNext: false,
      rangeLabel: 'Đang xem 21–23 trên tổng 23',
    });
  });

  it('keeps empty data bounded without producing an invalid range', () => {
    expect(getPaginationMeta(2, 0, 0)).toMatchObject({
      page: 1,
      pageSize: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      rangeLabel: 'Đang xem 0–0 trên tổng 0',
    });
  });

  it('formats the shared range copy consistently', () => {
    expect(formatPaginationRange(1, 10, 42)).toBe('Đang xem 1–10 trên tổng 42');
  });

  it('keeps local, page-number and cursor pagination contracts distinct', () => {
    expect(createLocalPaginationContract(0, -1)).toEqual({ mode: 'local', pageSize: 1, totalItems: 0 });
    expect(createPageNumberPaginationContract(20, 42)).toEqual({ mode: 'page-number', pageSize: 20, totalItems: 42 });
    expect(createCursorPaginationContract(20, true, false)).toEqual({ mode: 'cursor', pageSize: 20, hasNext: true, hasPrevious: false });
  });

  it('exports the local controller for route consumers', () => {
    expect(useLocalPagination).toBeTypeOf('function');
  });

  it('keeps the legacy hook API while using the canonical local contract', () => {
    const { result } = renderHook(() => usePaginatedRows(['A', 'B', 'C'], 2));

    expect(result.current).toMatchObject({
      page: 1,
      rows: ['A', 'B'],
      totalItems: 3,
      totalPages: 2,
      contract: { mode: 'local', pageSize: 2, totalItems: 3 },
    });

    act(() => result.current.nextPage());

    expect(result.current.rows).toEqual(['C']);
    expect(result.current.rangeLabel).toBe('Đang xem 3–3 trên tổng 3');
  });
});
