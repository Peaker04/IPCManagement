import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearAllServerCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

const DEFAULT_TEST_USER = {
  userId: '10000000-0000-0000-0000-000000000001',
  username: 'admin',
  fullName: 'Admin User',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  isActive: true,
  isAdminFullAccess: true,
  permissions: ['*'],
};

beforeEach(() => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.clear();
  }
  clearAllServerCache();
  workspaceSessionStore.clearScope();
  localStorage.setItem('ipc_v3_token', 'test-jwt-token');
  localStorage.setItem('ipc_v3_user', JSON.stringify(DEFAULT_TEST_USER));
  localStorage.setItem('ipc_v3_mode', 'DEFAULT');

  // Default fetch mock so background queries in tests resolve safely without ECONNREFUSED
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    return new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.clear();
  }
  clearAllServerCache();
  workspaceSessionStore.clearScope();
  vi.clearAllMocks();
});

// Mock window.matchMedia if not implemented in JSDOM
if (typeof window !== 'undefined') {
  // Mock window.alert to eliminate JSDOM 'Not implemented: Window's alert() method' warnings
  window.alert = vi.fn();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock navigator.clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  });
}
