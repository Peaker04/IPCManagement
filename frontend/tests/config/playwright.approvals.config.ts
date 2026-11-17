import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('../browser', import.meta.url)),
  testMatch: 'operational-approvals.spec.ts', workers: 1,
  outputDir: fileURLToPath(new URL('../../../.artifacts/approval-browser', import.meta.url)),
  use: { baseURL: 'http://127.0.0.1:5187', channel: 'chrome', headless: true,
    reducedMotion: 'reduce', trace: 'retain-on-failure' },
});
