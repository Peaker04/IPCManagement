// scripts/reproduce-first-load-trace.mjs
import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Clean context with ZERO pre-existing cache
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  // Set mode to MATERIAL_RECONCILIATION
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    // Clear all session storage snapshots to simulate 100% clean cold start
    sessionStorage.clear();
  });

  console.log('\n--- OBSERVING COLD START ON /reconciliation ---');
  // Inject MutationObserver to log DOM state every frame
  await page.exposeFunction('logStateChange', (payload) => {
    console.log(`[DOM ${payload.time}ms] hasSkeleton=${payload.hasSkeleton} | hasEmptyNotice=${payload.hasEmptyNotice} | hasTable=${payload.hasTable}`);
  });

  await page.addInitScript(() => {
    const start = performance.now();
    function startObserver() {
      const observer = new MutationObserver(() => {
        const time = Math.round(performance.now() - start);
        const text = document.body ? document.body.innerText || '' : '';
        const hasSkeleton = Boolean(document.querySelector('[data-skeleton-kind], [data-skeleton-row], .animate-pulse'));
        const hasEmptyNotice = text.includes('Chưa có dữ liệu') || text.includes('Không có bản ghi') || text.includes('Chưa có thực đơn');
        const hasTable = Boolean(document.querySelector('table tbody tr td'));
        window.logStateChange({ time, hasSkeleton, hasEmptyNotice, hasTable });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    }
    if (document.documentElement) {
      startObserver();
    } else {
      document.addEventListener('DOMContentLoaded', startObserver);
    }
  });

  page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto(`${BASE_URL}/reconciliation`);
  await page.waitForTimeout(2000);

  await browser.close();
}

main().catch(console.error);
