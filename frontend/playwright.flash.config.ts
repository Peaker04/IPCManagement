import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.FLASH_BASE_URL;
if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) {
  throw new Error('Set FLASH_BASE_URL to the confirmed local DEV or preview URL.');
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'loading-ux-async-consistency.spec.ts',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    // Authenticated traces include bearer headers/init scripts; collect bounded frame evidence instead.
    trace: 'off',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-motion', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'no-preference' } } },
    { name: 'chromium-reduced', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } } },
    { name: 'chromium-mobile-motion', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'no-preference' } } },
    { name: 'chromium-mobile-reduced', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } } },
  ],
});
