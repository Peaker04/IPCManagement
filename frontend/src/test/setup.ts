import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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
  vi.clearAllMocks();
});

// Mock window.matchMedia if not implemented in JSDOM
if (typeof window !== 'undefined') {
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
