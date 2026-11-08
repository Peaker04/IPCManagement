import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.resolve('.artifacts/live-audit-reality');

async function inspectWeeks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in as admin...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });

  // Week 14/09/2026
  console.log('Visiting week 14/09/2026...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&weekStartDate=2026-09-14`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05-mrx-batch-week-2026-09-14.png') });

  // Week 21/09/2026
  console.log('Visiting week 21/09/2026...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&weekStartDate=2026-09-21`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06-mrx-batch-week-2026-09-21.png') });

  // Check draft sources API
  const draftSources = await page.evaluate(async () => {
    const token = localStorage.getItem('ipc_v3_token');
    const res = await fetch('/api/reconciliation/batches/draft-sources', {
      headers: { Authorization: 'Bearer ' + token }
    });
    return res.json().catch(() => null);
  });
  console.log('Draft sources API response:', draftSources);

  await browser.close();
}

inspectWeeks().catch(console.error);
