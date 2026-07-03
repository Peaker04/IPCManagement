import type { User } from './authTypes';

const ACCESS_TOKEN_KEY = 'token';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const AUTH_COOKIE_NAMES = ['token', 'accessToken', 'refreshToken', 'authToken', 'user'];

export interface StoredAuthSnapshot {
  user: User | null;
  token: string | null;
}

const canUseWebStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readLocalStorageValue = (key: string) => {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.localStorage.getItem(key);
};

const readSessionStorageValue = (key: string) => {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.sessionStorage.getItem(key);
};

const parseStoredUser = (value: string | null): User | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<User>;
    if (!parsed.id || !parsed.username || !parsed.fullName || !parsed.role) {
      throw new Error('Invalid stored user');
    }

    return {
      id: parsed.id,
      username: parsed.username,
      fullName: parsed.fullName,
      role: parsed.role,
      roleCode: parsed.roleCode,
      roleName: parsed.roleName,
      isAdminFullAccess: parsed.isAdminFullAccess ?? parsed.role === 'admin',
      permissions: parsed.permissions ?? [],
    };
  } catch {
    if (canUseWebStorage()) {
      window.localStorage.removeItem(USER_KEY);
      window.sessionStorage.removeItem(USER_KEY);
    }
    return null;
  }
};

const clearCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/api; SameSite=Lax`;
};

const clearLegacyRefreshToken = () => {
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
};

const clearLegacyPersistentAccessToken = () => {
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const readStoredAuthSnapshot = (): StoredAuthSnapshot => {
  clearLegacyRefreshToken();
  clearLegacyPersistentAccessToken();

  return {
    token: readSessionStorageValue(ACCESS_TOKEN_KEY),
    user: parseStoredUser(readLocalStorageValue(USER_KEY)),
  };
};

export const persistAuthSnapshot = (snapshot: StoredAuthSnapshot) => {
  if (!canUseWebStorage()) {
    return;
  }

  if (snapshot.token) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, snapshot.token);
  } else {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  clearLegacyRefreshToken();
  clearLegacyPersistentAccessToken();

  if (snapshot.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(snapshot.user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
};

export const clearStoredAuth = () => {
  if (canUseWebStorage()) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(USER_KEY);
    clearLegacyRefreshToken();
  }

  AUTH_COOKIE_NAMES.forEach(clearCookie);
};
