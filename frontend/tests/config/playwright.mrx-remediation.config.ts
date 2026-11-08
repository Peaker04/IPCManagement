import { defineConfig } from '@playwright/test';

const baseURL = process.env.IPC_REMEDIATION_BASE_URL;
if (!baseURL || !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(baseURL)) {
  throw new Error('IPC_REMEDIATION_BASE_URL must explicitly target the approved local frontend. This config never starts a server.');
}

export default defineConfig({
  testDir: '../browser',
  testMatch: 'mrx-menu-remediation.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  outputDir: '../../../.artifacts/mrx-remediation-browser',
  reporter: [['list']],
  use: { baseURL, channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
