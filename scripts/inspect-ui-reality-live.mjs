import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.resolve('.artifacts/live-audit-reality');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function inspectReality() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });

  console.log('>>> [1] Logging in as admin...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Set mode to MATERIAL_RECONCILIATION
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });

  // [CHECK 1]: Admin BOM page: /admin-data?view=bom
  console.log('>>> [CHECK 1] Visiting /admin-data?view=bom...');
  await page.goto(`${BASE_URL}/admin-data?view=bom`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-admin-data-bom.png') });

  // Try opening DishBomEditorModal from /admin-data?view=bom
  console.log('>>> [CHECK 1b] Testing Edit BOM modal on /admin-data?view=bom...');
  const editBomBtn = page.locator('button:has-text("Chỉnh sửa BOM")').first();
  const editBomVisible = await editBomBtn.isVisible().catch(() => false);
  if (editBomVisible) {
    await editBomBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01b-dish-bom-editor-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // [CHECK 2]: Weekly Menu MRX Batch: /weekly-menu?view=mrx-batch
  console.log('>>> [CHECK 2] Visiting /weekly-menu?view=mrx-batch...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02-mrx-batch-initial.png') });

  // Test "Chỉnh sửa lịch tuần" button
  console.log('>>> [CHECK 2b] Testing "Chỉnh sửa lịch tuần" on /weekly-menu?view=mrx-batch...');
  const editScheduleBtn = page.locator('button:has-text("Chỉnh sửa lịch tuần")');
  const editScheduleVisible = await editScheduleBtn.isVisible().catch(() => false);
  console.log('  "Chỉnh sửa lịch tuần" button visible:', editScheduleVisible);
  if (editScheduleVisible) {
    await editScheduleBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02b-schedule-editor-modal.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // [CHECK 3]: /admin-data?view=ingredients & /admin-data?view=dishes
  console.log('>>> [CHECK 3] Visiting /admin-data?view=ingredients & dishes...');
  await page.goto(`${BASE_URL}/admin-data?view=ingredients`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03-admin-data-ingredients.png') });

  await page.goto(`${BASE_URL}/admin-data?view=dishes`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03b-admin-data-dishes.png') });

  // [CHECK 4]: /reconciliation
  console.log('>>> [CHECK 4] Visiting /reconciliation...');
  await page.goto(`${BASE_URL}/reconciliation`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04-reconciliation-root.png') });

  // [CHECK 5]: Check console errors
  const errors = consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror');
  console.log('\n>>> TOTAL CONSOLE ERRORS CAPTURED:', errors.length);
  for (const err of errors) {
    console.log(`  [${err.type}]`, err.text);
  }

  await browser.close();
}

inspectReality().catch(console.error);
