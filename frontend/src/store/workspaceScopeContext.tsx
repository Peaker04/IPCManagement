import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { weekStartFor, todayInBusinessTimezone } from '../utils/dates';
import { workspaceSessionStore } from './workspaceSessionStore';

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

const WorkspaceScopeContext = createContext<WorkspaceScopeContextValue | null>(null);

export interface WorkspaceScopeProviderProps {
  children: ReactNode;
  defaultCustomerId?: string;
}

export function WorkspaceScopeProvider({
  children,
  defaultCustomerId = '',
}: WorkspaceScopeProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCustomer = searchParams.get('customerId') || '';
  const urlBatch = searchParams.get('batchId') || '';
  const urlDate = searchParams.get('date') || '';
  const urlWeek = searchParams.get('weekStartDate') || '';

  const session = workspaceSessionStore.getScope();

  const customerId = urlCustomer || session.customerId || defaultCustomerId;
  const batchId = urlBatch || session.batchId || '';
  const serviceDate = urlDate || session.serviceDate || todayInBusinessTimezone();
  const weekStartDate = urlWeek || (urlDate ? weekStartFor(urlDate) : (session.weekStartDate || weekStartFor(serviceDate)));

  const scope: WorkspaceScope = useMemo(() => ({
    customerId,
    customerCode: session.customerCode || '',
    customerName: session.customerName || '',
    batchId,
    serviceDate,
    weekStartDate,
  }), [customerId, session.customerCode, session.customerName, batchId, serviceDate, weekStartDate]);

  const snapToMonday = useCallback((date: string): string => {
    return weekStartFor(date);
  }, []);

  const setScope = useCallback((patch: Partial<WorkspaceScope>) => {
    workspaceSessionStore.setScope(patch);

    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      if (patch.customerId !== undefined) {
        if (patch.customerId) next.set('customerId', patch.customerId);
        else next.delete('customerId');
      }
      if (patch.batchId !== undefined) {
        if (patch.batchId) next.set('batchId', patch.batchId);
        else next.delete('batchId');
      }
      if (patch.serviceDate !== undefined) {
        if (patch.serviceDate) next.set('date', patch.serviceDate);
        else next.delete('date');
      }
      if (patch.weekStartDate !== undefined) {
        if (patch.weekStartDate) next.set('weekStartDate', patch.weekStartDate);
        else next.delete('weekStartDate');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const value = useMemo<WorkspaceScopeContextValue>(() => ({
    scope,
    setScope,
    snapToMonday,
  }), [scope, setScope, snapToMonday]);

  return (
    <WorkspaceScopeContext.Provider value={value}>
      {children}
    </WorkspaceScopeContext.Provider>
  );
}

export function useWorkspaceScope(): WorkspaceScopeContextValue {
  const ctx = useContext(WorkspaceScopeContext);
  if (!ctx) {
    throw new Error('useWorkspaceScope must be used within a WorkspaceScopeProvider');
  }
  return ctx;
}
