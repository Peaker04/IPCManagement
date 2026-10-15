import { createContext, useContext } from 'react';
import type { UserInfo, OperationalMode } from '../types';

export interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  operationalMode: OperationalMode;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setOperationalMode: (mode: OperationalMode) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleCode: string | string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
