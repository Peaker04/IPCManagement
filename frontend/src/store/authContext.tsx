import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserInfo, OperationalMode } from '../types';
import { authApi } from '../api/authApi';
import { systemApi } from '../api/systemApi';
import { AuthContext } from './useAuth';

const TOKEN_KEY = 'ipc_v3_token';
const USER_KEY = 'ipc_v3_user';
const MODE_KEY = 'ipc_v3_mode';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [operationalMode, setModeState] = useState<OperationalMode>(() => {
    return (localStorage.getItem(MODE_KEY) as OperationalMode) || 'DEFAULT';
  });
  const [operationalModeVersion, setOperationalModeVersion] = useState<number | null>(null);
  const [operationalModeReasonRequired, setOperationalModeReasonRequired] = useState(false);

  const applyModeSnapshot = useCallback((snapshot: Awaited<ReturnType<typeof systemApi.getOperationalMode>>) => {
    setModeState(snapshot.mode);
    setOperationalModeVersion(snapshot.version);
    setOperationalModeReasonRequired(snapshot.reasonRequired);
    localStorage.setItem(MODE_KEY, snapshot.mode);
  }, []);

  const reloadOperationalMode = useCallback(async () => {
    applyModeSnapshot(await systemApi.getOperationalMode());
  }, [applyModeSnapshot]);

  useEffect(() => {
    systemApi.getOperationalMode().then(applyModeSnapshot).catch(() => {});
  }, [applyModeSnapshot]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, resp.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
      setToken(resp.accessToken);
      setUser(resp.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  const setOperationalMode = useCallback(async (mode: OperationalMode, reason?: string) => {
    if (operationalModeVersion == null) throw new Error('Chưa tải được phiên bản chế độ vận hành mới nhất.');
    applyModeSnapshot(await systemApi.setOperationalMode(mode, operationalModeVersion, reason));
  }, [applyModeSnapshot, operationalModeVersion]);

  const hasPermission = useCallback((perm: string): boolean => {
    if (!user) return false;
    if (user.isAdminFullAccess || user.permissions.includes('*')) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const hasRole = useCallback((roleCode: string | string[]): boolean => {
    if (!user) return false;
    if (user.isAdminFullAccess) return true;
    const allowed = (Array.isArray(roleCode) ? roleCode : [roleCode]).map((r) => r.toUpperCase());
    const userRoleCode = user.roleCode?.toUpperCase() || '';
    const userRoleName = user.roleName?.toUpperCase() || '';
    return allowed.includes(userRoleCode) || allowed.includes(userRoleName);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        operationalMode,
        operationalModeVersion,
        operationalModeReasonRequired,
        reloadOperationalMode,
        login,
        logout,
        setOperationalMode,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
