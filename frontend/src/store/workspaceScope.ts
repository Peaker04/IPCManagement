import { createContext, useContext } from 'react';

export interface WorkspaceScope {
  customerId: string;
  customerCode: string;
  customerName: string;
  batchId: string;
  serviceDate: string;
  weekStartDate: string;
}

export interface WorkspaceScopeContextValue {
  scope: WorkspaceScope;
  setScope: (patch: Partial<WorkspaceScope>) => void;
  snapToMonday: (date: string) => string;
}

export const WorkspaceScopeContext = createContext<WorkspaceScopeContextValue | null>(null);

export function useWorkspaceScope(): WorkspaceScopeContextValue {
  const context = useContext(WorkspaceScopeContext);
  if (!context) {
    throw new Error('useWorkspaceScope must be used within a WorkspaceScopeProvider');
  }
  return context;
}
