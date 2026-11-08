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

let unexpectedRequests: string[] = [];

function resolveFetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (typeof Request !== 'undefined' && input instanceof Request && input.method) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }
  return String(input);
}

const failClosedFetch: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const method = resolveFetchMethod(input, init);
  const url = resolveFetchUrl(input);
  const signature = `${method} ${url}`;
  unexpectedRequests.push(signature);
  throw new Error(`Unexpected unit-test fetch: ${signature}`);
};

function installFailClosedFetchBoundary(): void {
  Object.defineProperty(globalThis, 'fetch', {
    value: failClosedFetch,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'fetch', {
      value: failClosedFetch,
      writable: true,
      configurable: true,
    });
  }
}

installFailClosedFetchBoundary();

const originalRestoreAllMocks = vi.restoreAllMocks.bind(vi);
vi.restoreAllMocks = () => {
  const result = originalRestoreAllMocks();
  installFailClosedFetchBoundary();
  return result;
};

const originalUnstubAllGlobals = vi.unstubAllGlobals.bind(vi);
vi.unstubAllGlobals = () => {
  const result = originalUnstubAllGlobals();
  installFailClosedFetchBoundary();
  return result;
};

beforeEach(() => {
  unexpectedRequests = [];
  installFailClosedFetchBoundary();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.clear();
  }
  clearAllServerCache();
  workspaceSessionStore.clearScope();
  localStorage.setItem('ipc_v3_token', 'test-jwt-token');
  localStorage.setItem('ipc_v3_user', JSON.stringify(DEFAULT_TEST_USER));
  localStorage.setItem('ipc_v3_mode', 'DEFAULT');
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
  installFailClosedFetchBoundary();

  if (unexpectedRequests.length > 0) {
    const recorded = [...unexpectedRequests];
    unexpectedRequests = [];
    throw new Error(`Unexpected unit-test network request(s): ${recorded.join(', ')}`);
  }
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
