import { useState, useEffect, useCallback, useMemo } from 'react';

export type WorkspaceDensity = 'compact' | 'cozy' | 'touch';

export interface WorkspaceConfig {
  density: WorkspaceDensity;
  hiddenColumns: string[];
  columnWidths: Record<string, string>;
  pinnedColumns: string[];
  sidebarOpen: boolean;
}

export interface SavedView<TFilter = unknown> {
  id: string;
  name: string;
  createdAt: string;
  config: WorkspaceConfig;
  filters?: TFilter;
}

const STORAGE_PREFIX = 'ipc_ws_';

export function getWorkspaceStorageKey(tableKey: string, userId?: string | null): string {
  const safeUser = userId || 'default';
  return `${STORAGE_PREFIX}${safeUser}_${tableKey}`;
}

export function getSavedViewsStorageKey(tableKey: string, userId?: string | null): string {
  const safeUser = userId || 'default';
  return `${STORAGE_PREFIX}${safeUser}_views_${tableKey}`;
}

/**
 * Global State Teardown / Cache Purge for Workspace UI State (Rule NFR-03)
 * Completely clears all cached workspace states upon logout.
 */
export function clearAllWorkspaceState(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.error('Failed to purge workspace storage:', err);
  }
}

export interface UseWorkspaceUiStateOptions {
  tableKey: string;
  userId?: string | null;
  defaultConfig?: Partial<WorkspaceConfig>;
}

/**
 * Enterprise Workspace UI State & Saved Views Engine (Rules L3-UI-01, L1-UI-03, FR-04, NFR-03)
 * - Persists density, hidden/pinned columns, widths across reloads (F5).
 * - Applies data-density attribute to the document element.
 * - Supports 1-click personal presets / Saved Views.
 * - Enforces clean state teardown on session logout.
 */
export function useWorkspaceUiState<TFilter = unknown>({
  tableKey,
  userId,
  defaultConfig,
}: UseWorkspaceUiStateOptions) {
  const storageKey = useMemo(() => getWorkspaceStorageKey(tableKey, userId), [tableKey, userId]);
  const viewsStorageKey = useMemo(() => getSavedViewsStorageKey(tableKey, userId), [tableKey, userId]);

  const resolvedDefaultConfig: WorkspaceConfig = useMemo(() => ({
    density: 'cozy',
    hiddenColumns: [],
    columnWidths: {},
    pinnedColumns: [],
    sidebarOpen: true,
    ...defaultConfig,
  }), [defaultConfig]);

  // Load initial config from localStorage
  const [config, setConfigState] = useState<WorkspaceConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { ...resolvedDefaultConfig, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return resolvedDefaultConfig;
  });

  // Load saved views
  const [savedViews, setSavedViews] = useState<SavedView<TFilter>[]>(() => {
    try {
      const saved = localStorage.getItem(viewsStorageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  // Apply density attribute to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-density', config.density);
  }, [config.density]);

  // Persist config changes to localStorage
  const updateConfig = useCallback((patch: Partial<WorkspaceConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save workspace config:', err);
      }
      return next;
    });
  }, [storageKey]);

  const setDensity = useCallback((density: WorkspaceDensity) => {
    updateConfig({ density });
  }, [updateConfig]);

  const toggleColumnVisibility = useCallback((columnId: string) => {
    setConfigState((prev) => {
      const hidden = prev.hiddenColumns.includes(columnId)
        ? prev.hiddenColumns.filter((id) => id !== columnId)
        : [...prev.hiddenColumns, columnId];
      const next = { ...prev, hiddenColumns: hidden };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  const setColumnWidth = useCallback((columnId: string, width: string) => {
    setConfigState((prev) => {
      const next = { ...prev, columnWidths: { ...prev.columnWidths, [columnId]: width } };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  // Saved Views / Presets management (Rule FR-04)
  const saveCurrentView = useCallback((name: string, filters?: TFilter): SavedView<TFilter> => {
    const newView: SavedView<TFilter> = {
      id: `view_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      config,
      filters,
    };
    setSavedViews((prev) => {
      const next = [...prev, newView];
      try {
        localStorage.setItem(viewsStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    return newView;
  }, [config, viewsStorageKey]);

  const deleteSavedView = useCallback((id: string) => {
    setSavedViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      try {
        localStorage.setItem(viewsStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [viewsStorageKey]);

  const applySavedView = useCallback((view: SavedView<TFilter>): TFilter | undefined => {
    updateConfig(view.config);
    return view.filters;
  }, [updateConfig]);

  return {
    config,
    density: config.density,
    hiddenColumns: config.hiddenColumns,
    columnWidths: config.columnWidths,
    pinnedColumns: config.pinnedColumns,
    sidebarOpen: config.sidebarOpen,
    setDensity,
    updateConfig,
    toggleColumnVisibility,
    setColumnWidth,
    savedViews,
    saveCurrentView,
    deleteSavedView,
    applySavedView,
  };
}
