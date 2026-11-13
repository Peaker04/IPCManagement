import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserInfo, OperationalMode, LoginResponse } from '../types';
import { useIdleSession } from '../hooks/useIdleSession';
import { authApi } from '../api/authApi';
import { systemApi } from '../api/systemApi';
import { AuthContext } from './useAuth';
import { clearSessionState } from './clearSessionState';
import { SessionExpiredModal } from '../components/workbench/SessionExpiredModal';

const TOKEN_KEY = 'ipc_v3_token';
const USER_KEY = 'ipc_v3_user';
const MODE_KEY = 'ipc_v3_mode';
const MODE_VERSION_KEY = 'ipc_v3_mode_version';

export function AuthProvider({ children, resolveLanding = () => '/', resolveEligibility = () => false, onIdleExpired }: {
  children: ReactNode;
  resolveLanding?: (user: UserInfo, mode: OperationalMode) => string;
  resolveEligibility?: (user: UserInfo, mode: OperationalMode, pathname: string, search: string) => boolean;
  onIdleExpired?: () => void;
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
  const [isOperationalModeReady, setIsOperationalModeReady] = useState(false);
  const [operationalModeError, setOperationalModeError] = useState<Error | null>(null);

  useEffect(() => {
    const handleExpiredEvent = (event: Event) => {
      if (token && user) {
        event.preventDefault();
        setIsSessionExpired(true);
      }
    };
    const handleRefreshedEvent = () => {
      const refreshedToken = localStorage.getItem(TOKEN_KEY);
      const refreshedUser = localStorage.getItem(USER_KEY);
      if (!refreshedToken || !refreshedUser) return;
      setToken(refreshedToken);
      setUser(JSON.parse(refreshedUser));
      setIsSessionExpired(false);
    };
    window.addEventListener('ipc:session-expired', handleExpiredEvent);
    window.addEventListener('ipc:session-refreshed', handleRefreshedEvent);
    return () => {
      window.removeEventListener('ipc:session-expired', handleExpiredEvent);
      window.removeEventListener('ipc:session-refreshed', handleRefreshedEvent);
    };
  }, [token, user]);

  const applyModeSnapshot = useCallback((snapshot: Awaited<ReturnType<typeof systemApi.getOperationalMode>>) => {
    setModeState(snapshot.mode);
    setOperationalModeVersion(snapshot.version);
    setOperationalModeReasonRequired(snapshot.reasonRequired);
    localStorage.setItem(MODE_KEY, snapshot.mode);
    localStorage.setItem(MODE_VERSION_KEY, String(snapshot.version));
    setOperationalModeError(null);
    setIsOperationalModeReady(true);
  }, []);

  const reloadOperationalMode = useCallback(async () => {
    setOperationalModeError(null);
    try {
      applyModeSnapshot(await systemApi.getOperationalMode());
    } catch (cause) {
      setOperationalModeError(cause instanceof Error ? cause : new Error('Không thể tải chế độ vận hành.'));
      throw cause;
    }
  }, [applyModeSnapshot]);

  const isAuthenticated = !!token && !!user;
  const expireIdleSession = useCallback(() => {
    // Revoke best-effort, but never let an offline server delay local logout.
    void authApi.logout().catch(() => undefined);
    clearSessionState();
    try { sessionStorage.setItem('ipc_login_notice', 'Phiên đã kết thúc do không hoạt động. Vui lòng đăng nhập lại.'); } catch { /* Storage may be unavailable. */ }
    setIsSessionExpired(false);
    setIsOperationalModeReady(false);
    setOperationalModeError(null);
    setToken(null);
    setUser(null);
    onIdleExpired?.();
  }, [onIdleExpired]);
  const idleWarning = useIdleSession(isAuthenticated && !isSessionExpired, expireIdleSession);

  useEffect(() => {
    if (!isAuthenticated || isOperationalModeReady) return;
    let active = true;
    systemApi.getOperationalMode().then((snapshot) => {
      if (active) applyModeSnapshot(snapshot);
    }).catch((cause: unknown) => {
      if (active) setOperationalModeError(cause instanceof Error ? cause : new Error('Không thể tải chế độ vận hành.'));
    });
    return () => { active = false; };
  }, [applyModeSnapshot, isAuthenticated, isOperationalModeReady]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, resp.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
      sessionStorage.removeItem('ipc_login_notice');
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
      clearSessionState();
      setIsSessionExpired(false);
      setIsOperationalModeReady(false);
      setOperationalModeError(null);
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

  const handleSessionRestored = useCallback(async (response: LoginResponse) => {
    if (response.user.userId !== user?.userId) throw new Error('Tài khoản xác thực không khớp phiên làm việc.');
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    try {
      applyModeSnapshot(await systemApi.getOperationalMode());
      setToken(response.accessToken);
      setUser(response.user);
      setIsSessionExpired(false);
    } catch (cause) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      throw cause;
    }
  }, [applyModeSnapshot, user?.userId]);

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
        isAuthenticated,
        isLoading,
        operationalMode,
        isOperationalModeReady,
        operationalModeError,
        operationalModeVersion,
        operationalModeReasonRequired,
        landingPath,
        isSessionExpired,
        idleWarning,
        triggerSessionExpired: () => setIsSessionExpired(true),
        reloadOperationalMode,
        login,
        logout,
        setOperationalMode,
        hasPermission,
        hasRole,
        canNavigate: (pathname, search = '') => Boolean(user && resolveEligibility(user, operationalMode, pathname, search)),
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
