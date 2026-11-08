// scripts/verify-batch1-live-browser.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/operational-recovery-audit/batch-1');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';

function log(msg) {
  console.log(`[BATCH-1-AUDIT] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

async function loginUser(page, username = 'admin', password = 'Admin@123456') {
  log(`Logging in as '${username}'...`);
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });
}

async function main() {
  log('Starting Batch 1 Live Browser Verification (/approvals & /meal-orders)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const auditResults = [];

  try {
    await loginUser(page, 'admin');

    // =========================================================================
    // SCENARIO 1: /approvals — Rejection Decision Form Preservation on Failure
    // =========================================================================
    log('--- Scenario 1: /approvals - Rejection Form State Preservation on Failure ---');
    await page.goto(`${BASE_URL}/approvals`);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    log('  Loaded approvals table.');

    // Click first "Từ chối hồ sơ" button in drawer
    const rejectBtn = page.locator('button:has-text("Từ chối hồ sơ")').first();
    await rejectBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const reasonText = 'Hồ sơ đề xuất thiếu hợp đồng nguyên tắc và bảng kê đơn giá của bên thứ ba';
    await page.fill('div[role="dialog"] input', reasonText);
    log(`  Entered rejection reason: "${reasonText}"`);

    // Intercept decide API and simulate server failure (500)
    await page.route('**/api/approvals/**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Lỗi máy chủ thẩm định (Simulated 500 Failure)' }),
        });
      }
      return route.continue();
    });

    const confirmRejectBtn = page.locator('div[role="dialog"] button:has-text("Xác nhận từ chối")');
    await confirmRejectBtn.click();
    await page.waitForTimeout(500);

    // Verify modal is still open, text is preserved, and error banner is visible
    const isModalOpen = await page.locator('div[role="dialog"]').isVisible();
    const preservedValue = await page.locator('div[role="dialog"] input').inputValue();
    const isErrorBannerVisible = await page.locator('div[role="dialog"] [role="alert"]').isVisible();

    log(`  Modal still open: ${isModalOpen}`);
    log(`  Preserved reason: "${preservedValue}"`);
    log(`  Error banner in modal: ${isErrorBannerVisible}`);

    const s1Pass = isModalOpen && preservedValue === reasonText && isErrorBannerVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-approvals-rejection-form-preserved.png') });
    auditResults.push({ scenario: '1. Rejection Form Preservation', passed: s1Pass });

    // Close modal
    await page.unroute('**/api/approvals/**');
    await page.click('div[role="dialog"] button:has-text("Hủy bỏ")');
    await page.waitForTimeout(300);

    // =========================================================================
    // SCENARIO 2: /approvals — 409 Concurrency Conflict & Table Integrity
    // =========================================================================
    log('--- Scenario 2: /approvals - 409 Concurrency Conflict Handling ---');
    const approveBtn = page.locator('button:has-text("Phê duyệt hồ sơ")').first();
    await approveBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    // Mock 409 conflict on decide
    await page.route('**/api/approvals/**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Hồ sơ đã được phê duyệt bởi Quản lý khác (Simulated 409)' }),
        });
      }
      return route.continue();
    });

    const confirmApproveBtn = page.locator('div[role="dialog"] button:has-text("Xác nhận phê duyệt")');
    await confirmApproveBtn.click();
    await page.waitForTimeout(500);

    // Verify: modal closed, top banner shows conflict, table remains visible
    const isModalClosed = !(await page.locator('div[role="dialog"]').isVisible());
    const isConflictBannerVisible = await page.locator('[role="alert"]:has-text("Xung đột dữ liệu đồng thời")').isVisible();
    const isTableStillVisible = await page.locator('table tbody tr').count() > 0;

    log(`  Modal closed on 409: ${isModalClosed}`);
    log(`  Conflict banner visible: ${isConflictBannerVisible}`);
    log(`  Table still visible: ${isTableStillVisible}`);

    const s2Pass = isModalClosed && isConflictBannerVisible && isTableStillVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-approvals-409-conflict-table-intact.png') });
    auditResults.push({ scenario: '2. 409 Concurrency & Table Integrity', passed: s2Pass });

    await page.unroute('**/api/approvals/**');

    // =========================================================================
    // SCENARIO 3: /approvals — Filter Empty State with Reset Filters Escape Hatch
    // =========================================================================
    log('--- Scenario 3: /approvals - Filter Empty State & Reset Escape Hatch ---');
    await page.selectOption('select[aria-label="Lọc loại yêu cầu phê duyệt"]', 'purchase-order');
    await page.waitForTimeout(500);

    const filterEmptyHeading = await page.locator('h3:has-text("Không tìm thấy kết quả phù hợp")').isVisible();
    const resetFilterBtn = page.locator('button:has-text("Xóa bộ lọc")');
    const isResetBtnVisible = await resetFilterBtn.isVisible();

    log(`  Filter-empty heading visible: ${filterEmptyHeading}`);
    log(`  Reset filters button visible: ${isResetBtnVisible}`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-approvals-filter-empty-reset-cta.png') });

    // Click reset filters button
    await resetFilterBtn.click();
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    const activeSelectVal = await page.locator('select[aria-label="Lọc loại yêu cầu phê duyệt"]').inputValue();
    const restoredRowsCount = await page.locator('table tbody tr').count();
    log(`  Select value after reset: ${activeSelectVal} (expected ALL)`);
    log(`  Restored rows count: ${restoredRowsCount}`);

    const s3Pass = filterEmptyHeading && isResetBtnVisible && activeSelectVal === 'ALL' && restoredRowsCount > 0;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-approvals-filter-reset-success.png') });
    auditResults.push({ scenario: '3. Filter Empty & Reset Action', passed: s3Pass });

    // =========================================================================
    // SCENARIO 4: /meal-orders — Prerequisite Blocked when No Customers Exist
    // =========================================================================
    log('--- Scenario 4: /meal-orders - Prerequisite Blocked when Customers Empty ---');
    await page.route('**/api/coordination/customers**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto(`${BASE_URL}/meal-orders`);
    await page.waitForTimeout(1000);

    const prereqHeading = await page.locator('h3:has-text("Chưa có dữ liệu Khách hàng")').isVisible();
    const prereqActionBtn = page.locator('button:has-text("Đi đến thiết lập: Khách hàng & Hợp đồng")');
    const isPrereqBtnVisible = await prereqActionBtn.isVisible();

    log(`  Prerequisite heading visible: ${prereqHeading}`);
    log(`  Prerequisite navigation button visible: ${isPrereqBtnVisible}`);

    const s4Pass = prereqHeading && isPrereqBtnVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-meal-orders-prerequisite-blocked-cta.png') });
    auditResults.push({ scenario: '4. Prerequisite Navigation Escape Hatch', passed: s4Pass });

    await page.unroute('**/api/coordination/customers**');

    // =========================================================================
    // SCENARIO 5: /meal-orders — Normal Data & Lock Mutation Failure Preservation
    // =========================================================================
    log('--- Scenario 5: /meal-orders - Normal Data & Lock Mutation Failure Preservation ---');
    await page.route('**/api/coordination/orders?*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'ord-101',
              quantityPlanLineId: 'line-101',
              quantityPlanId: 'plan-101',
              menuScheduleId: 'sch-101',
              customerId: 'cust-1',
              customerCode: 'ANV',
              customerName: 'AMANN',
              mealType: 'Trưa',
              forecastQuantity: 500,
              actualQuantity: 520,
              unitPrice: 30000,
              appliedRate: 1,
              specialNotes: 'Không cay',
              serviceDate: '2026-09-14',
              shiftName: 'MORNING',
              menuId: 'menu-1',
              menuCode: 'MN-01',
              menuName: 'Thực đơn ca sáng',
              dishes: [],
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE_URL}/meal-orders`);
    await page.waitForTimeout(1500);

    const lockBtn = page.locator('button:has-text("Chốt đơn ca")');
    await lockBtn.waitFor({ state: 'visible', timeout: 5000 });
    await lockBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    // Mock lock API failure
    await page.route('**/api/coordination/orders/lock**', (route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Ca sản xuất chưa được phê duyệt KHSX (Simulated 400)' }),
      });
    });

    const confirmLockBtn = page.locator('div[role="dialog"] button:has-text("Xác nhận chốt đơn")');
    await confirmLockBtn.click();
    await page.waitForTimeout(500);

    const isLockModalStillOpen = await page.locator('div[role="dialog"]').isVisible();
    const isLockErrorBannerVisible = await page.locator('div[role="dialog"] [role="alert"]').isVisible();

    log(`  Lock modal remains open on failure: ${isLockModalStillOpen}`);
    log(`  Lock error banner inside modal: ${isLockErrorBannerVisible}`);

    const s5Pass = isLockModalStillOpen && isLockErrorBannerVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06-meal-orders-lock-failure-modal-preserved.png') });
    auditResults.push({ scenario: '5. Meal Orders Lock Failure Preservation', passed: s5Pass });

    await page.unroute('**/api/coordination/orders/lock**');
    await page.unroute('**/api/coordination/orders?*');
    await page.click('div[role="dialog"] button:has-text("Hủy")');

    log('--- BATCH 1 LIVE AUDIT COMPLETED ---');
    console.table(auditResults);

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
