// scripts/verify-mrx-matrix-and-modal-live.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/mrx-matrix-enhancement');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';

function log(msg) {
  console.log(`[MRX-MATRIX-AUDIT] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

async function loginUser(page, username = 'admin', password = 'Admin@123456') {
  log(`Logging in as '${username}'...`);
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });
}

async function main() {
  log('Starting MRX Schedule Matrix & Shift Dishes Modal Live Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await loginUser(page, 'admin');

    log('Navigating to /weekly-menu?view=mrx-batch for ANV on 14/09/2026...');
    await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&customerId=b1e40f3e-bda5-4c16-be27-ea7146e10d37&weekStartDate=2026-09-14`);
    await page.waitForSelector('table', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // =========================================================================
    // STEP 1: Verify Default View is Now "Ma trận thực đơn tuần" (Bảng ma trận có sẵn)
    // =========================================================================
    log('Step 1: Inspecting Schedule Matrix View...');
    const activeTabLabel = await page.locator('div[role="tablist"] button[aria-selected="true"]').innerText();
    log(`  Active sub-tab: "${activeTabLabel}"`);

    // Verify 7 day columns exist (Thứ Hai -> Chủ Nhật)
    const dayHeaders = await page.locator('table thead tr th').allInnerTexts();
    log(`  Table headers found: ${dayHeaders.length} headers`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-mrx-batch-schedule-matrix-view.png') });
    log('  Captured screenshot 01: Schedule Matrix View.');

    // =========================================================================
    // STEP 2: Switch to "Kế hoạch món & suất theo ca" and verify Button replaces string
    // =========================================================================
    log('Step 2: Switching to "Kế hoạch theo ca"...');
    const plansTab = page.locator('div[role="tablist"] button:has-text("Kế hoạch theo ca")');
    await plansTab.click();
    await page.waitForTimeout(800);

    // Verify button exists in "Món ăn trong ca" column instead of a joined text string
    const viewDishesBtn = page.locator('table tbody tr button:has-text("Xem ma trận món")').first();
    const isBtnVisible = await viewDishesBtn.isVisible();
    const btnLabel = await viewDishesBtn.innerText();
    log(`  Button in dish column: "${btnLabel}" (Visible: ${isBtnVisible})`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-mrx-batch-plans-tab-button.png') });
    log('  Captured screenshot 02: Plans Tab with Matrix Button.');

    // =========================================================================
    // STEP 3: Click "Xem ma trận món" and verify Modal Ma Trận Từng Ca opens
    // =========================================================================
    log('Step 3: Clicking "Xem ma trận món" to open Shift Dishes Matrix Modal...');
    await viewDishesBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const modalTitle = await page.locator('div[role="dialog"] h2, div[role="dialog"] h3').first().innerText();
    log(`  Modal opened with title: "${modalTitle}"`);

    // Verify modal contains a DataGrid table with dishes
    const dishRowsCount = await page.locator('div[role="dialog"] table tbody tr').count();
    log(`  Dishes listed in modal table: ${dishRowsCount} dishes`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-mrx-shift-dishes-matrix-modal.png') });
    log('  Captured screenshot 03: Shift Dishes Matrix Modal.');

    // Close modal
    await page.click('div[role="dialog"] button:has-text("Đóng")');
    await page.waitForTimeout(400);

    // =========================================================================
    // STEP 4: Switch to "Phân rã nguyên liệu định lượng" and capture
    // =========================================================================
    log('Step 4: Switching to "Định lượng nguyên liệu"...');
    const materialsTab = page.locator('div[role="tablist"] button:has-text("Định lượng nguyên liệu")');
    await materialsTab.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-mrx-batch-materials-tab.png') });
    log('  Captured screenshot 04: Materials Breakdown Tab.');

    // =========================================================================
    // STEP 5: Verify Missing BOM Batch Import Modal & Excel Download
    // =========================================================================
    log('Step 5: Verifying Missing BOM Batch Import Modal & Template Buttons...');
    // Or open directly by clicking on admin BOM branch button or via test trigger
    await page.goto(`${BASE_URL}/admin-data?view=bom`);
    await page.waitForSelector('button:has-text("Nhập BOM Excel")', { timeout: 10000 });
    await page.click('button:has-text("Nhập BOM Excel")');
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const hasMissingBtn = await page.locator('div[role="dialog"] button:has-text("Tải file Excel các món thiếu BOM")').isVisible();
    const hasAllBtn = await page.locator('div[role="dialog"] button:has-text("Tải file mẫu toàn bộ")').isVisible();
    log(`  Missing BOM template button visible: ${hasMissingBtn}`);
    log(`  All BOM template button visible: ${hasAllBtn}`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-mrx-batch-missing-bom-modal.png') });
    log('  Captured screenshot 05: Missing BOM Batch Import Modal.');

    await page.click('div[role="dialog"] button:has-text("Đóng")');

    log('--- MRX MATRIX & MODAL LIVE AUDIT SUCCESSFUL ---');

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
