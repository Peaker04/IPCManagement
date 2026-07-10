import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearStoredAuth,
  persistAuthSnapshot,
  readStoredAuthSnapshot,
} from './authStorage';
import { canAccessRole, normalizeUserRole } from './roleUtils';
import {
  notifySessionExpired,
  resetSessionExpiredNotice,
  subscribeSessionExpired,
} from './sessionEvents';

describe('authStorage boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('persists token in session storage and user in local storage without legacy refresh token leakage', () => {
    window.localStorage.setItem('refreshToken', 'legacy-refresh');
    window.localStorage.setItem('token', 'legacy-access');

    persistAuthSnapshot({
      token: 'session-token',
      user: {
        id: 'u1',
        username: 'admin',
        fullName: 'Admin User',
        role: 'admin',
        roleCode: 'ADMIN',
        roleName: 'Quản trị',
        isAdminFullAccess: true,
        permissions: ['*'],
      },
    });

    expect(window.sessionStorage.getItem('token')).toBe('session-token');
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('refreshToken')).toBeNull();
    expect(readStoredAuthSnapshot().user?.isAdminFullAccess).toBe(true);
  });

  it('removes malformed stored user instead of returning a partial identity', () => {
    window.localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'broken' }));

    const snapshot = readStoredAuthSnapshot();

    expect(snapshot.user).toBeNull();
    expect(window.localStorage.getItem('user')).toBeNull();
  });

  it('clears current and legacy auth state together', () => {
    window.localStorage.setItem('user', 'stored-user');
    window.localStorage.setItem('token', 'legacy-access');
    window.localStorage.setItem('refreshToken', 'legacy-refresh');
    window.sessionStorage.setItem('token', 'session-token');

    clearStoredAuth();

    expect(window.localStorage.getItem('user')).toBeNull();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('refreshToken')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });
});

describe('role equivalence partitions', () => {
  it.each([
    ['ADMIN', undefined, 'admin'],
    [undefined, 'Quản lý', 'quanly'],
    ['COORDINATOR', undefined, 'dieuphoi'],
    [undefined, 'Bếp trưởng', 'beptruong'],
    ['WAREHOUSE STAFF', undefined, 'thukho'],
    [undefined, 'Thu mua', 'thumua'],
    ['unknown', 'Nhân viên', 'staff'],
  ] as const)('normalizes %s/%s to %s', (roleCode, roleName, expected) => {
    expect(normalizeUserRole(roleCode, roleName)).toBe(expected);
  });

  it('lets admin bypass allowed-role lists and rejects missing users', () => {
    expect(canAccessRole(null, ['thukho'])).toBe(false);
    expect(canAccessRole({ role: 'admin' }, ['thukho'])).toBe(true);
    expect(canAccessRole({ role: 'staff', isAdminFullAccess: true }, [])).toBe(true);
    expect(canAccessRole({ role: 'thukho' }, ['thukho'])).toBe(true);
    expect(canAccessRole({ role: 'thumua' }, ['thukho'])).toBe(false);
  });
});

describe('session expiry notification', () => {
  afterEach(() => {
    resetSessionExpiredNotice();
  });

  it('notifies subscribers once until the notice is reset', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    notifySessionExpired();
    notifySessionExpired();
    resetSessionExpiredNotice();
    notifySessionExpired();
    unsubscribe();
    resetSessionExpiredNotice();
    notifySessionExpired();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
