import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { workspaceSessionStore, type WorkspaceSessionScope } from '../store/workspaceSessionStore';

export interface UrlWorkbenchState {
  q: string;
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  selectedId: string | null;
  view: string | null;
  filters: Record<string, string>;
}

export interface UseUrlWorkbenchStateOptions {
  defaultView?: string;
  defaultPageSize?: number;
}

/**
 * Enterprise URL as Single Source of Truth Hook (Rule L3-DATA-01)
 * Two-way synchronizes search query, filters, pagination, sort, active view, and selected ID with URL search parameters.
 * Guarantees that refreshing (F5) or sharing URLs preserves 100% of the workbench state.
 */
export function useUrlWorkbenchState(options?: UseUrlWorkbenchStateOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const state: UrlWorkbenchState = useMemo(() => {
    const q = searchParams.get('q') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get('pageSize') || String(options?.defaultPageSize || 25), 10)
    );
    const sortBy = searchParams.get('sortBy');
    const sortDir = (searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    const selectedId = searchParams.get('selectedId');
    const view = searchParams.get('view') || options?.defaultView || null;

    const filters: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (!['q', 'page', 'pageSize', 'sortBy', 'sortDir', 'selectedId', 'view'].includes(key)) {
        filters[key] = val;
      }
    });

    return {
      q,
      page,
      pageSize,
      sortBy,
      sortDir,
      selectedId,
      view,
      filters,
    };
  }, [searchParams, options?.defaultView, options?.defaultPageSize]);

  const updateParams = useCallback(
    (mutator: (prev: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutator(next);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setQ = useCallback(
    (q: string) => {
      updateParams((params) => {
        if (q) {
          params.set('q', q);
        } else {
          params.delete('q');
        }
        params.set('page', '1');
      });
    },
    [updateParams]
  );

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      updateParams((params) => {
        if (value !== null && value !== '' && value !== 'ALL') {
          params.set(key, value);
        } else {
          params.delete(key);
        }
        params.set('page', '1');
      });
    },
    [updateParams]
  );

  const setPage = useCallback(
    (page: number | ((prev: number) => number)) => {
      updateParams((params) => {
        const currentPage = Math.max(1, parseInt(params.get('page') || '1', 10));
        const resolvedPage = typeof page === 'function' ? page(currentPage) : page;
        params.set('page', String(Math.max(1, resolvedPage)));
      });
    },
    [updateParams]
  );

  const setSort = useCallback(
    (sortBy: string, sortDir?: 'asc' | 'desc') => {
      updateParams((params) => {
        params.set('sortBy', sortBy);
        if (sortDir) {
          params.set('sortDir', sortDir);
        } else {
          const currentDir = params.get('sortDir') === 'desc' ? 'desc' : 'asc';
          params.set('sortDir', currentDir === 'asc' ? 'desc' : 'asc');
        }
      });
    },
    [updateParams]
  );

  const setSelectedId = useCallback(
    (id: string | null) => {
      updateParams((params) => {
        if (id) {
          params.set('selectedId', id);
        } else {
          params.delete('selectedId');
        }
      });
    },
    [updateParams]
  );

  const setView = useCallback(
    (view: string) => {
      updateParams((params) => {
        params.set('view', view);
      });
    },
    [updateParams]
  );

  const resetFilters = useCallback(() => {
    updateParams((params) => {
      const keysToDelete: string[] = [];
      params.forEach((_, key) => {
        if (!['view'].includes(key)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((k) => params.delete(k));
    });
  }, [updateParams]);

  const syncScope = useCallback(
    (patch: Partial<WorkspaceSessionScope>) => {
      workspaceSessionStore.setScope(patch);
      updateParams((params) => {
        if (patch.batchId !== undefined) {
          if (patch.batchId) params.set('batchId', patch.batchId);
          else params.delete('batchId');
        }
        if (patch.customerId !== undefined) {
          if (patch.customerId) params.set('customerId', patch.customerId);
          else params.delete('customerId');
        }
        if (patch.serviceDate !== undefined) {
          if (patch.serviceDate) params.set('date', patch.serviceDate);
          else params.delete('date');
        }
        if (patch.weekStartDate !== undefined) {
          if (patch.weekStartDate) params.set('weekStartDate', patch.weekStartDate);
          else params.delete('weekStartDate');
        }
      });
    },
    [updateParams]
  );

  return {
    ...state,
    setQ,
    setFilter,
    setPage,
    setSort,
    setSelectedId,
    setView,
    resetFilters,
    syncScope,
  };
}
