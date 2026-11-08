// scripts/test-all-cold-starts.mjs
import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5173';

const TEST_ROUTES = [
  { path: '/reconciliation', name: 'Reconciliation' },
  { path: '/weekly-menu', name: 'Weekly Menu' },
  { path: '/meal-orders', name: 'Meal Orders' },
  { path: '/chef', name: 'Chef Dashboard' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const route of TEST_ROUTES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Authenticate
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input#username', 'admin');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(600);

    // Clean session storage to simulate 100% clean cold start
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    });

    console.log(`\n--- TESTING COLD START: ${route.name} (${route.path}) ---`);
    let emptyNoticeFlashes = 0;
    let skeletonFlashes = 0;
    let tableAppearances = 0;

    await page.exposeFunction('recordState', (p) => {
      if (p.hasEmptyNotice) emptyNoticeFlashes++;
      if (p.hasSkeleton) skeletonFlashes++;
      if (p.hasTable) tableAppearances++;
      console.log(`[${route.name} ${p.time}ms] Skeleton=${p.hasSkeleton} | Empty=${p.hasEmptyNotice} | Table=${p.hasTable}`);
    });

    await page.addInitScript(() => {
      const start = performance.now();
      function initObserver() {
        const obs = new MutationObserver(() => {
          const time = Math.round(performance.now() - start);
          const text = document.body ? document.body.innerText || '' : '';
          const hasSkeleton = Boolean(document.querySelector('[data-skeleton-kind], [data-skeleton-row], .animate-pulse'));
          const hasEmptyNotice = text.includes('Chưa có dữ liệu') || text.includes('Không có bản ghi') || text.includes('Chưa có thực đơn');
          const hasTable = Boolean(document.querySelector('table tbody tr td'));
          window.recordState({ time, hasSkeleton, hasEmptyNotice, hasTable });
        });
        obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      }
      if (document.documentElement) initObserver();
      else document.addEventListener('DOMContentLoaded', initObserver);
    });

    await page.goto(`${BASE_URL}${route.path}`);
    await page.waitForTimeout(1500);

    console.log(`Summary for ${route.name}:`);
    console.log(`- Empty Notice Flashes before Table: ${emptyNoticeFlashes}`);
    console.log(`- Skeleton active frames: ${skeletonFlashes}`);
    console.log(`- Table active frames: ${tableAppearances}`);

    await context.close();
  }

  await browser.close();
}

main().catch(console.error);
