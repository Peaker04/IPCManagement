// scripts/capture-mrx-screenshots.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('.artifacts/audit-screenshots');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login as admin
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // 1. Sidebar with 5 nested leaves under "Đối soát nguyên liệu"
  await page.goto(`${BASE_URL}/reconciliation`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-mrx-sidebar-leaves.png') });
  console.log('Captured: 01-mrx-sidebar-leaves.png');

  // 2. Reconciliation Lines view with Lifecycle strip, Control tower & Quick filters
  await page.goto(`${BASE_URL}/reconciliation?view=lines`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02-mrx-reconciliation-lines.png') });
  console.log('Captured: 02-mrx-reconciliation-lines.png');

  // 3. Control Tower 5 Queue Cards close view
  await page.screenshot({
    path: path.join(OUTPUT_DIR, '03-mrx-control-tower.png'),
    clip: { x: 240, y: 56, width: 1200, height: 120 },
  });
  console.log('Captured: 03-mrx-control-tower.png');

  // 4. Completed Register view via Nested Sidebar
  await page.goto(`${BASE_URL}/reconciliation?view=completed`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04-mrx-completed-register.png') });
  console.log('Captured: 04-mrx-completed-register.png');

  // 5. Chef Cooking Workbench (Card per Dish & Zone 2 Subbar)
  await page.goto(`${BASE_URL}/chef?view=mrx-cooking&batchId=b2d7e7be-6be0-40bd-8409-d4cc1bd5471d`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05-mrx-chef-cards.png') });
  console.log('Captured: 05-mrx-chef-cards.png');

  // 6. Warehouse Deltas (DataGrid & Zone 2 Subbar)
  await page.goto(`${BASE_URL}/warehouse?view=mrx-issues`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06-mrx-warehouse-deltas.png') });
  console.log('Captured: 06-mrx-warehouse-deltas.png');

  // 7. Warehouse Preparation (Multi-customer coordinated issue & 3-Zone layout)
  await page.goto(`${BASE_URL}/warehouse?view=mrx-preparation`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07-mrx-warehouse-prep.png') });
  console.log('Captured: 07-mrx-warehouse-prep.png');

  // 8. Variance Register (Zero-CLS & DataGrid)
  await page.goto(`${BASE_URL}/reconciliation?view=variances`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08-mrx-zero-cls.png') });
  console.log('Captured: 08-mrx-zero-cls.png');

  await browser.close();
  console.log('All 8 audit screenshots captured successfully.');
}

main().catch(console.error);
