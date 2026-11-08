import { useState, useEffect } from 'react';
import { isIsoDate, isWeekStartDate, weekStartFor } from '../utils/dates';

export interface WorkspaceSessionScope {
  customerId: string;
  customerCode: string;
  customerName: string;
  serviceDate: string;
  weekStartDate: string;
  batchId: string;
  weeklyMenuScope?: { customerId: string; weekStartDate: string } | null;
}

const STORAGE_KEY = 'ipc_mrx_workspace_session_scope';

function normalizeWeeklyScope(value: WorkspaceSessionScope['weeklyMenuScope']): WorkspaceSessionScope['weeklyMenuScope'] {
  return value && typeof value.customerId === 'string' && value.customerId.trim() && isWeekStartDate(value.weekStartDate)
    ? { customerId: value.customerId, weekStartDate: value.weekStartDate } : null;
}

function loadPersistedScope(): WorkspaceSessionScope {
  const fallback: WorkspaceSessionScope = {
    customerId: '',
    customerCode: '',
    customerName: '',
    serviceDate: '',
    weekStartDate: '',
    batchId: '',
  };

  if (typeof window === 'undefined' || !window.sessionStorage) return fallback;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSessionScope>;
    const serviceDate = isIsoDate(parsed.serviceDate) ? parsed.serviceDate : isIsoDate(parsed.weekStartDate) ? parsed.weekStartDate : '';
    const weekStartDate = isIsoDate(parsed.weekStartDate) ? parsed.weekStartDate : weekStartFor(serviceDate);
    const scope = {
      customerId: parsed.customerId || '',
      customerCode: parsed.customerCode || '',
      customerName: parsed.customerName || '',
      serviceDate,
      weekStartDate,
      batchId: parsed.batchId || '',
      weeklyMenuScope: normalizeWeeklyScope(parsed.weeklyMenuScope),
    };
    if (serviceDate !== parsed.serviceDate || weekStartDate !== parsed.weekStartDate) persist(scope);
    return scope;
  } catch {
    return fallback;
  }
}

let currentScope: WorkspaceSessionScope = loadPersistedScope();
const listeners = new Set<(scope: WorkspaceSessionScope) => void>();

function persist(scope: WorkspaceSessionScope) {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
    } catch {
      // Ignore storage quota
    }
  }
}

export const workspaceSessionStore = {
  getScope(): WorkspaceSessionScope {
    if (!currentScope.customerId && typeof window !== 'undefined' && window.sessionStorage) {
      currentScope = loadPersistedScope();
    }
    return currentScope;
  },

  setScope(patch: Partial<WorkspaceSessionScope>): WorkspaceSessionScope {
    const { serviceDate, weekStartDate, weeklyMenuScope, ...identity } = patch;
    const updated: WorkspaceSessionScope = { ...currentScope, ...identity };
    if (weeklyMenuScope !== undefined) updated.weeklyMenuScope = normalizeWeeklyScope(weeklyMenuScope);
    // Whole-week sentinels belong to the local view, never the shared calendar scope.
    if (serviceDate === '' || isIsoDate(serviceDate)) updated.serviceDate = serviceDate;
    if (weekStartDate === '' || isIsoDate(weekStartDate)) updated.weekStartDate = weekStartDate;
    if (isIsoDate(serviceDate) && !isIsoDate(weekStartDate)) {
      updated.weekStartDate = weekStartFor(serviceDate);
    } else if (isIsoDate(weekStartDate) && !isIsoDate(serviceDate)) {
      updated.serviceDate = weekStartDate;
    }
    currentScope = updated;
    persist(updated);
    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch {
        // Safe dispatch
      }
    });
    return updated;
  },

  clearScope(): void {
    currentScope = {
      customerId: '',
      customerCode: '',
      customerName: '',
      serviceDate: '',
      weekStartDate: '',
      batchId: '',
    };
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    listeners.forEach((listener) => {
      try {
        listener(currentScope);
      } catch {
        // Safe dispatch
      }
    });
  },

  subscribe(listener: (scope: WorkspaceSessionScope) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useWorkspaceSessionScope(): [
  WorkspaceSessionScope,
  (patch: Partial<WorkspaceSessionScope>) => void
] {
  const [scope, setScope] = useState<WorkspaceSessionScope>(workspaceSessionStore.getScope);

  useEffect(() => {
    return workspaceSessionStore.subscribe(setScope);
  }, []);

  return [scope, workspaceSessionStore.setScope];
}
