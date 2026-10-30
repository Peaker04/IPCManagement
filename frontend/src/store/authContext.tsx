import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserInfo, OperationalMode } from '../types';
import { authApi } from '../api/authApi';
import { systemApi } from '../api/systemApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { AuthContext } from './useAuth';
import { clearAllWorkspaceState } from './workspaceUiState';
import { workspaceSessionStore } from './workspaceSessionStore';
import { clearAllClientDrafts } from '../hooks/useClientDraftPersistence';
import { serverStateCache, clearAllServerCache } from './serverStateCache';
import { clearAllOfflineQueue } from './offlineMutationQueue';
import { idempotencyManager } from '../utils/idempotencyKey';
import { SessionExpiredModal } from '../components/workbench/SessionExpiredModal';

const TOKEN_KEY = 'ipc_v3_token';
const USER_KEY = 'ipc_v3_user';
const MODE_KEY = 'ipc_v3_mode';
const MODE_VERSION_KEY = 'ipc_v3_mode_version';

export function AuthProvider({ children, resolveLanding = () => '/' }: {
  children: ReactNode;
  resolveLanding?: (user: UserInfo, mode: OperationalMode) => string;
}) {
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
  const [operationalModeVersion, setOperationalModeVersion] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(MODE_VERSION_KEY);
      return stored ? Number(stored) : (token && user ? 1 : null);
    } catch {
      return token && user ? 1 : null;
    }
  });
  const [operationalModeReasonRequired, setOperationalModeReasonRequired] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useEffect(() => {
    const handleExpiredEvent = () => {
      if (token && user) {
        setIsSessionExpired(true);
      }
    };
    window.addEventListener('ipc:session-expired', handleExpiredEvent);
    return () => window.removeEventListener('ipc:session-expired', handleExpiredEvent);
  }, [token, user]);

  const applyModeSnapshot = useCallback((snapshot: Awaited<ReturnType<typeof systemApi.getOperationalMode>>) => {
    setModeState(snapshot.mode);
    setOperationalModeVersion(snapshot.version);
    setOperationalModeReasonRequired(snapshot.reasonRequired);
    localStorage.setItem(MODE_KEY, snapshot.mode);
    localStorage.setItem(MODE_VERSION_KEY, String(snapshot.version));
  }, []);

  const reloadOperationalMode = useCallback(async () => {
    applyModeSnapshot(await systemApi.getOperationalMode());
  }, [applyModeSnapshot]);

  useEffect(() => {
    systemApi.getOperationalMode().then(applyModeSnapshot).catch(() => {});
  }, [applyModeSnapshot]);

  useEffect(() => {
    if (!token || !user || process.env.NODE_ENV === 'test') return;
    const cached = serverStateCache.get('catalog_customers')?.data;
    if (cached) return;
    weeklyMenuApi.getCustomers().then((list) => {
      serverStateCache.set('catalog_customers', list);
      serverStateCache.set('snapshot:catalog_customers', list);
    }).catch(() => {});
  }, [token, user]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, resp.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
      try {
        const modeSnapshot = await systemApi.getOperationalMode();
        applyModeSnapshot(modeSnapshot);
        setToken(resp.accessToken);
        setUser(resp.user);
        return { user: resp.user, operationalMode: modeSnapshot.mode, landingPath: resolveLanding(resp.user, modeSnapshot.mode) };
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyModeSnapshot, resolveLanding]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MODE_VERSION_KEY);
      clearAllWorkspaceState();
      workspaceSessionStore.clearScope();
      clearAllClientDrafts();
      clearAllServerCache();
      clearAllOfflineQueue();
      idempotencyManager.clearAll();
      setIsSessionExpired(false);
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

  const handleSessionRestored = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setIsSessionExpired(false);
  }, []);

  const handleSessionCancel = useCallback(() => {
    setIsSessionExpired(false);
    logout();
  }, [logout]);

  const landingPath = user ? resolveLanding(user, operationalMode) : '/login';

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
        landingPath,
        isSessionExpired,
        triggerSessionExpired: () => setIsSessionExpired(true),
        reloadOperationalMode,
        login,
        logout,
        setOperationalMode,
        hasPermission,
        hasRole,
      }}
    >
      {children}
      {isSessionExpired && user && (
        <SessionExpiredModal
          isOpen={isSessionExpired}
          username={user.username}
          onSuccess={handleSessionRestored}
          onCancel={handleSessionCancel}
        />
      )}
    </AuthContext.Provider>
  );
}
