import { defineConfig } from '@playwright/test';
import { SUPPORTED_BROWSER_CHANNELS, SUPPORTED_MOTION_PREFERENCES } from '../browserSupportPolicy';

const projects = SUPPORTED_BROWSER_CHANNELS.flatMap((browser) =>
  SUPPORTED_MOTION_PREFERENCES.map((motion) => ({
    name: `${browser.id}-${motion}`,
    use: {
      channel: browser.channel,
      reducedMotion: motion,
    },
  })),
);

export default defineConfig({
  testDir: '..',
  testMatch: '**/browser-support-evidence.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.BROWSER_SUPPORT_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
});
