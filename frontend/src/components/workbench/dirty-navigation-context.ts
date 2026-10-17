import { createContext, useContext } from 'react';

export interface DirtyNavigationContextValue {
  isDirty: boolean;
  registerDirty: (key: string) => () => void;
  requestNavigation: (action: () => void) => boolean;
}

export const DirtyNavigationContext = createContext<DirtyNavigationContextValue | null>(null);

export function useDirtyNavigation() {
  const context = useContext(DirtyNavigationContext);
  if (!context) throw new Error('useDirtyNavigation must be used within DirtyNavigationProvider');
  return context;
}

export function useOptionalDirtyNavigation() {
  return useContext(DirtyNavigationContext);
}
