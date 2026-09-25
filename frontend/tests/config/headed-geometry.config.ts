import { defineConfig } from '@playwright/test'

export const headedGeometryConfig = (outputDir: string) => defineConfig({
  testDir: '..',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: 'chrome',
    headless: false,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir,
})
