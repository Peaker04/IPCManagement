import { expect, test } from '@playwright/test';
import {
  SUPPORTED_DESKTOP_VIEWPORTS,
  SUPPORTED_ZOOM_PERCENTAGES,
} from './browserSupportPolicy';

test('browser-support preflight records operator-supplied runtime slice metadata', async ({ page }, testInfo) => {
  test.skip(!process.env.BROWSER_SUPPORT_BASE_URL, 'BROWSER_SUPPORT_BASE_URL is required; missing runtime is NEEDS_EVIDENCE.');
  expect(process.env.BROWSER_SUPPORT_RUN_ID).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(process.env.BROWSER_SUPPORT_SOURCE_REF).toMatch(/^[A-Fa-f0-9]{7,40}$/);
  expect(process.env.BROWSER_SUPPORT_OS).toMatch(/^windows-(10|11)$/);
  expect(process.env.BROWSER_SUPPORT_VERSION_BAND).toMatch(/^(current|previous)$/);

  expect(testInfo.project.name).toMatch(/^(chrome|edge)-(no-preference|reduce)$/);
  for (const viewport of SUPPORTED_DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const zoom of SUPPORTED_ZOOM_PERCENTAGES) {
      await page.goto('/login');
      await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      await expect(page.getByRole('main')).toBeVisible();
      expect(Math.max(0, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(2);
    }
  }

  const nativeUserAgent = await page.evaluate(() => navigator.userAgent);
  if (testInfo.project.name.startsWith('edge-')) expect(nativeUserAgent).toContain('Edg/');
  if (testInfo.project.name.startsWith('chrome-')) expect(nativeUserAgent).not.toContain('Edg/');

  // Preflight only: metadata is operator-supplied and critical workflow evidence is not manufactured here.
});
