import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('./tests', import.meta.url)),
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/e2e-mrx/**'],
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/login',
    env: {
      VITE_ENABLE_MOCK_LOGIN: 'true',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
