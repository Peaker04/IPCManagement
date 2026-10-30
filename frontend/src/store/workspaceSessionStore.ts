import { useState, useEffect } from 'react';
import { weekStartFor } from '../utils/dates';

export interface WorkspaceSessionScope {
  customerId: string;
  customerCode: string;
  customerName: string;
  serviceDate: string;
  weekStartDate: string;
  batchId: string;
}

const STORAGE_KEY = 'ipc_mrx_workspace_session_scope';

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
    return {
      customerId: parsed.customerId || '',
      customerCode: parsed.customerCode || '',
      customerName: parsed.customerName || '',
      serviceDate: parsed.serviceDate || '',
      weekStartDate: parsed.weekStartDate || (parsed.serviceDate ? weekStartFor(parsed.serviceDate) : ''),
      batchId: parsed.batchId || '',
    };
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
    const updated: WorkspaceSessionScope = {
      ...currentScope,
      ...patch,
    };
    if (patch.serviceDate && !patch.weekStartDate) {
      updated.weekStartDate = weekStartFor(patch.serviceDate);
    } else if (patch.weekStartDate && !patch.serviceDate) {
      updated.serviceDate = patch.weekStartDate;
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
