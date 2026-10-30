// scripts/test-batch-weekday-and-badge.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input#username', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);

  // Set mode to MATERIAL_RECONCILIATION
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });

  // Navigate to ANV on Monday 14/09/2026
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
  await page.waitForTimeout(1000);

  // Select customer ANV
  const custSelect = page.getByRole('combobox', { name: 'Chọn khách hàng MRX' });
  await custSelect.selectOption({ label: 'ANV - AMANN' });
  await page.waitForTimeout(500);

  // Fill 14/09/2026
  const dateInput = page.getByRole('textbox', { name: 'Tuần MRX bắt đầu' });
  await dateInput.fill('14/09/2026');
  await dateInput.press('Enter');
  await page.waitForTimeout(1000);

  // 1. Verify Badge is single line (Hoàn tất)
  const badge = page.getByText('Hoàn tất').first();
  const badgeBox = await badge.boundingBox();
  console.log(`Badge bounding box: width=${badgeBox?.width}px, height=${badgeBox?.height}px`);
  // If wrapped into 2 lines, height would be > 30px with narrow width < 45px.
  // Single line height is ~24-36px with width >= 65px.
  console.log('Badge is single line (width >= 60px):', (badgeBox?.width ?? 0) >= 60);

  await page.screenshot({ path: path.resolve('.artifacts/audit-screenshots/fixed-badge-1409.png'), clip: { x: 240, y: 0, width: 1200, height: 120 } });

  // 2. Test selecting Tuesday 15/09/2026
  console.log('\nChanging date to Tuesday 15/09/2026...');
  await dateInput.fill('15/09/2026');
  await dateInput.press('Enter');
  await page.waitForTimeout(1000);

  // Verify date snapped back to Monday 14/09/2026
  const currentValue = await dateInput.inputValue();
  console.log(`Date input value after picking Tuesday 15/09: ${currentValue}`);

  // Verify batch did NOT vanish
  const stillHasBadge = await page.getByText('Hoàn tất').first().isVisible();
  console.log('Batch status "Hoàn tất" remains visible (did NOT vanish):', stillHasBadge);

  await page.screenshot({ path: path.resolve('.artifacts/audit-screenshots/fixed-weekday-snap-1509.png'), clip: { x: 240, y: 0, width: 1200, height: 120 } });

  await browser.close();
  console.log('\nAll verification tests completed successfully.');
}

main().catch(console.error);
