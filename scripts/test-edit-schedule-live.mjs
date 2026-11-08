import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:5173';
const OUTPUT_DIR = path.resolve('.artifacts/live-audit-reality');

async function testEditScheduleLive() {
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

  console.log('Going to /weekly-menu?view=mrx-batch&weekStartDate=2026-09-21...');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&weekStartDate=2026-09-21`);
  await page.waitForTimeout(2000);

  const editScheduleBtn = page.locator('button:has-text("Chỉnh sửa lịch tuần")');
  console.log('Checking "Chỉnh sửa lịch tuần" button...');
  await editScheduleBtn.waitFor({ state: 'visible', timeout: 5000 });
  await editScheduleBtn.click();
  await page.waitForTimeout(1000);

  console.log('Taking screenshot of WeeklyScheduleEditorModal on live MRX Batch...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07-live-schedule-editor-modal.png') });

  // Click Tab 2: Đổi món ăn
  console.log('Switching to Tab 2: Đổi món ăn...');
  const tabDishes = page.locator('button:has-text("2. Đổi món ăn")');
  await tabDishes.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07b-live-schedule-editor-dishes-tab.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await browser.close();
  console.log('Test completed successfully!');
}

testEditScheduleLive().catch(console.error);
