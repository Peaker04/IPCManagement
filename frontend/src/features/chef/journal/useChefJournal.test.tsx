import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ documentQueries: [] as unknown[], movementQueries: [] as unknown[] }));

vi.mock('@/api/workflowDocumentsApi', () => ({
  useGetWorkflowDocumentsQuery: (query: unknown) => {
    mocks.documentQueries.push(query);
    return { data: [], isLoading: false, isFetching: false, isError: false };
  },
}));
vi.mock('@/api/reportsApi', () => ({
  useGetStockMovementsQuery: (query: unknown) => {
    mocks.movementQueries.push(query);
    return { data: [], isLoading: false, isFetching: false, isError: false };
  },
}));

import { useChefJournal } from './useChefJournal';

describe('useChefJournal scope', () => {
  beforeEach(() => {
    mocks.documentQueries = [];
    mocks.movementQueries = [];
  });

  it('requests documents and movements for the selected service date and shift', () => {
    renderHook(() => useChefJournal({ serviceDate: '2026-08-12', apiShiftName: 'MORNING' }, true));

    expect(mocks.documentQueries.at(-1)).toEqual({
      dateFrom: '2026-08-12',
      dateTo: '2026-08-12',
      shiftName: 'MORNING',
      limit: 20,
    });
    expect(mocks.movementQueries.at(-1)).toEqual({
      dateFrom: '2026-08-12',
      dateTo: '2026-08-12',
      shiftName: 'MORNING',
      limit: 20,
    });
  });
});
