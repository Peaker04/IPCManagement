import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: path.resolve(__dirname, '../specs'),
  testMatch: '**/*.spec.ts',
  workers: 1, // Strict single-worker to prevent database race conditions on sandbox DB
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  globalSetup: path.resolve(__dirname, '../core/globalSetup.ts'),
  globalTeardown: path.resolve(__dirname, '../core/globalTeardown.ts'),
  use: {
    baseURL: process.env.MRX_E2E_BASE_URL ?? 'http://127.0.0.1:5174',
    launchOptions: process.env.MRX_E2E_PROFILE === 'qualification' && process.env.MRX_E2E_PHASE === 'functional'
      ? { slowMo: 250 } : undefined,
    trace: process.env.MRX_E2E_PHASE === 'data-path-performance' ? 'off'
      : process.env.MRX_E2E_PROFILE === 'qualification' && process.env.MRX_E2E_PHASE === 'functional'
        ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'mrx-chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
  ],
});
