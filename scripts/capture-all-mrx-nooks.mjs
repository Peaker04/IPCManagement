// scripts/capture-all-mrx-nooks.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('.artifacts/audit-screenshots/mrx-exhaustive');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Authenticate as Admin
  console.log('[1/20] Logging in as Admin...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  // Set mode to MATERIAL_RECONCILIATION
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });

  // 2. MRX Batch Workbench (Populated)
  console.log('[2/20] Capturing 01-mrx-batch-workbench-populated.png...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-mrx-batch-workbench-populated.png') });

  // 3. Modal: Món ăn trong lô
  console.log('[3/20] Capturing 02-mrx-batch-dishes-modal.png...');
  const dishesBtn = page.getByRole('button', { name: 'Món ăn trong lô' });
  if (await dishesBtn.isVisible().catch(() => false)) {
    await dishesBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-mrx-batch-dishes-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 4. Modal: Nhập thực đơn Excel
  console.log('[4/20] Capturing 03-mrx-batch-import-modal.png...');
  const importBtn = page.getByRole('button', { name: 'Nhập thực đơn Excel' });
  if (await importBtn.isVisible().catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-mrx-batch-import-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 5. MRX Batch Empty State
  console.log('[5/20] Capturing 04-mrx-batch-empty.png...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&weekStartDate=2030-01-01`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04-mrx-batch-empty.png') });

  // 6. MRX Daily Issue Workbench (Populated)
  console.log('[6/20] Capturing 05-mrx-daily-workbench-populated.png...');
  await page.goto(`${BASE_URL}/warehouse?view=mrx-daily`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05-mrx-daily-workbench-populated.png') });

  // 7. Modal: Xuất bổ sung ca
  console.log('[7/20] Capturing 06-mrx-daily-supplemental-modal.png...');
  const suppBtn = page.getByRole('button', { name: 'Xuất bổ sung ca' });
  if (await suppBtn.isVisible().catch(() => false)) {
    await suppBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06-mrx-daily-supplemental-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 8. MRX Daily Issue Empty State
  console.log('[8/20] Capturing 07-mrx-daily-empty.png...');
  await page.goto(`${BASE_URL}/warehouse?view=mrx-daily&date=2030-01-01`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07-mrx-daily-empty.png') });

  // 9. MRX Preparation Workbench (Populated)
  console.log('[9/20] Capturing 08-mrx-prep-workbench-populated.png...');
  await page.goto(`${BASE_URL}/warehouse?view=mrx-preparation`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08-mrx-prep-workbench-populated.png') });

  // 10. MRX Preparation Empty State
  console.log('[10/20] Capturing 09-mrx-prep-empty.png...');
  await page.goto(`${BASE_URL}/warehouse?view=mrx-preparation&date=2030-01-01`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '09-mrx-prep-empty.png') });

  // 11. MRX Warehouse Issues / Deltas (Populated / Queue)
  console.log('[11/20] Capturing 10-mrx-issues-deltas.png...');
  await page.goto(`${BASE_URL}/warehouse?view=mrx-issues`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '10-mrx-issues-deltas.png') });

  // 12. MRX Chef Cooking Workbench (Populated)
  console.log('[12/20] Capturing 11-mrx-chef-cooking-populated.png...');
  await page.goto(`${BASE_URL}/chef?view=mrx-cooking`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '11-mrx-chef-cooking-populated.png') });

  // 13. MRX Chef Cooking Workbench (Filter Ca Sáng)
  console.log('[13/20] Capturing 12-mrx-chef-cooking-morning-shift.png...');
  const morningTab = page.getByRole('button', { name: /Ca 1|Sáng/i });
  if (await morningTab.first().isVisible().catch(() => false)) {
    await morningTab.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '12-mrx-chef-cooking-morning-shift.png') });
  }

  // 14. MRX Chef Cooking Empty State
  console.log('[14/20] Capturing 13-mrx-chef-cooking-empty.png...');
  await page.goto(`${BASE_URL}/chef?view=mrx-cooking&batchId=empty-batch-id-0000`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '13-mrx-chef-cooking-empty.png') });

  // 15. MRX Reconciliation - Tab Lines (Populated)
  console.log('[15/20] Capturing 14-mrx-reconciliation-lines-populated.png...');
  await page.goto(`${BASE_URL}/reconciliation`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '14-mrx-reconciliation-lines-populated.png') });

  // 16. Modal: Reconciliation Disposition Modal
  console.log('[16/20] Capturing 15-mrx-reconciliation-disposition-modal.png...');
  const resolveBtn = page.getByRole('button', { name: /Giải trình|Xử lý/i }).first();
  if (await resolveBtn.isVisible().catch(() => false)) {
    await resolveBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '15-mrx-reconciliation-disposition-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 17. MRX Reconciliation - Tab Variances
  console.log('[17/20] Capturing 16-mrx-reconciliation-variances.png...');
  await page.goto(`${BASE_URL}/reconciliation?view=variances`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '16-mrx-reconciliation-variances.png') });

  // 18. MRX Reconciliation - Tab Transactions
  console.log('[18/20] Capturing 17-mrx-reconciliation-transactions.png...');
  await page.goto(`${BASE_URL}/reconciliation?view=transactions`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '17-mrx-reconciliation-transactions.png') });

  // 19. MRX Reconciliation - Tab Audit
  console.log('[19/20] Capturing 18-mrx-reconciliation-audit.png...');
  await page.goto(`${BASE_URL}/reconciliation?view=audit`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '18-mrx-reconciliation-audit.png') });

  // 20. MRX Reconciliation - Tab Completed
  console.log('[20/20] Capturing 19-mrx-reconciliation-completed.png...');
  await page.goto(`${BASE_URL}/reconciliation?view=completed`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '19-mrx-reconciliation-completed.png') });

  await browser.close();
  console.log(`\nAll 19 MRX screenshots captured into: ${OUTPUT_DIR}`);
}

main().catch(console.error);
