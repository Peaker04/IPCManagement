import { describe, expect, it } from 'vitest';
import { formatPaginationRange } from './uiCopy';
import { getPaginationMeta } from './usePaginatedRows';

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
});
