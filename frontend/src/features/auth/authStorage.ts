import type { User } from './authSlice';

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const AUTH_COOKIE_NAMES = ['token', 'accessToken', 'refreshToken', 'authToken', 'user'];

export interface StoredAuthSnapshot {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

const canUseWebStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStorageValue = (key: string) => {
  if (!canUseWebStorage()) {
    return null;
  }

  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
};

const parseUser = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as User;
  } catch {
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

export const readStoredAuthSnapshot = (): StoredAuthSnapshot => ({
  token: readStorageValue(ACCESS_TOKEN_KEY),
  refreshToken: readStorageValue(REFRESH_TOKEN_KEY),
  user: parseUser(readStorageValue(USER_KEY)),
});

export const persistAuthSnapshot = (snapshot: StoredAuthSnapshot) => {
  if (!canUseWebStorage()) {
    return;
  }

  if (snapshot.token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, snapshot.token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (snapshot.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, snapshot.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (snapshot.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(snapshot.user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
};

export const clearStoredAuth = () => {
  if (canUseWebStorage()) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(USER_KEY);
  }

  AUTH_COOKIE_NAMES.forEach(clearCookie);
};
