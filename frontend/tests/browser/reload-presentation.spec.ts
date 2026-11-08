import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test.beforeEach(async ({ page }) => {
  // Existing unit-test actor only; every API request stays inside this browser test.
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'test-jwt-token');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin User',
      roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'],
    }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '9');
  });
  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/system-operation-mode') {
      return route.fulfill({ json: { success: true, data: {
        mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9,
        updatedAt: '2026-10-20T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} },
      } } });
    }
    return route.fulfill({ status: 503, json: { success: false, message: 'Business API unavailable in isolated reload test.' } });
  });
});

test('does not resize the MRX header when a cold font finishes late', async ({ page }) => {
  let releaseFonts!: () => void;
  const fontsReady = new Promise<void>((resolve) => { releaseFonts = resolve; });
  let fontRequests = 0;
  const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
  await page.route('**/*', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.startsWith('/api/')) return route.fallback();
    if (pathname.endsWith('.woff2')) { fontRequests++; await fontsReady; }
    return route.fulfill({ path: resolve(dist, pathname.startsWith('/assets/') ? `.${pathname}` : 'index.html') });
  });
  await page.route('**/api/reconciliation/reports/completed-register*', route => route.fulfill({ json: { success: true, data: { rows: [], totalCount: 0 } } }));
  await page.route('**/api/coordination/customers*', route => route.fulfill({ json: { success: true, data: [] } }));
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/reconciliation?view=completed', { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { name: 'Đối soát nguyên liệu', exact: true });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Chưa có lô đối soát nào hoàn tất.', { exact: true })).toBeVisible();
    // Hold beyond the browser's short font block period, not an application loading delay.
    await page.waitForTimeout(250);
    expect(fontRequests).toBeGreaterThan(0);
    const before = await heading.boundingBox();
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    const fontStatuses = await page.evaluate(() => [...document.fonts].filter(face => face.family.includes('Inter Variable') && face.status !== 'unloaded').map(face => face.status));
    expect(fontStatuses.length).toBeGreaterThan(0);
    expect(fontStatuses.every(status => status === 'loaded')).toBe(true);
    const after = await heading.boundingBox();
    expect(before).not.toBeNull(); expect(after).not.toBeNull();
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(0.5);
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(0.5);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(0.5);
  } finally { releaseFonts(); }
});

test('renders a styled startup status while the app entry is still loading', async ({ page }) => {
  let releaseEntry!: () => void;
  const entryReady = new Promise<void>((resolve) => { releaseEntry = resolve; });
  await page.route('**/src/main.tsx*', async (route) => {
    await entryReady;
    await route.continue();
  });
  try {
    await page.goto('/weekly-menu?view=mrx-batch', { waitUntil: 'commit' });
    const startup = page.getByRole('status', { name: 'Đang tải không gian làm việc' });
    await expect(startup).toBeVisible();
    await expect(startup).toHaveCSS('background-color', 'rgb(248, 250, 252)');
    await expect(startup).toHaveCSS('color', 'rgb(30, 41, 59)');
    releaseEntry();
    await expect(page.getByRole('button', { name: 'Thu gọn sidebar', exact: true })).toBeVisible();
    await expect(startup).toHaveCount(0);
  } finally {
    releaseEntry();
    await page.waitForLoadState('domcontentloaded');
  }
});

test('retains the collapsed sidebar width from the first frame after a cache-bypassing reload', async ({ page }) => {
  await page.goto('/weekly-menu?view=mrx-batch');
  await page.getByRole('button', { name: 'Thu gọn sidebar', exact: true }).click();
  const sidebar = page.getByRole('complementary', { name: 'Thanh điều hướng chính' });
  await expect(sidebar).toHaveCSS('width', '64px');
  await page.addInitScript(() => {
    const widths: number[] = [];
    Object.assign(window, { reloadSidebarWidths: widths });
    new MutationObserver(() => {
      const aside = document.querySelector('aside');
      if (aside) widths.push(aside.getBoundingClientRect().width);
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mở rộng sidebar', exact: true })).toBeVisible();
  await expect(sidebar).toHaveCSS('width', '64px');
  expect(await page.evaluate(() => (window as Window & { reloadSidebarWidths: number[] }).reloadSidebarWidths[0])).toBe(64);
  await page.getByRole('button', { name: 'Mở rộng sidebar', exact: true }).click();
  await expect(sidebar).toHaveCSS('width', '240px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở menu điều hướng', exact: true }).click();
  await expect(sidebar).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mở menu điều hướng', exact: true })).toBeVisible();
  await expect(sidebar).not.toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Thu gọn sidebar', exact: true })).toBeVisible();
  await expect(sidebar).toHaveCSS('width', '240px');
});
