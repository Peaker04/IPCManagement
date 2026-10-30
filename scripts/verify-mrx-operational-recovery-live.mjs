// scripts/verify-mrx-operational-recovery-live.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/operational-recovery-audit/mrx');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';

function log(msg) {
  console.log(`[MRX-AUDIT] ${new Date().toISOString().slice(11, 19)} ${msg}`);
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

const SAMPLE_IN_PROGRESS_BATCH = {
  batchId: 'recon-live-test-01',
  batchCode: 'BATCH-LIVE-01',
  customerCode: 'DAV',
  customerName: 'Draxlmaier',
  version: 3,
  status: 'IN_PROGRESS',
  dailyReview: {
    weeklyStatus: 'WEEK_COMPLETE',
    lines: [
      {
        batchLineId: 'batch-line-01',
        dailyLineId: 'daily-line-01',
        serviceDate: '2026-09-14',
        ingredientId: 'ing-1',
        ingredientCode: 'NL-THIT-01',
        ingredientName: 'Thịt heo nạc mông',
        canonicalUnitId: 'u-kg',
        canonicalUnitName: 'kg',
        requiredQuantity: 100,
        issuedQuantity: 112.5,
        issuedRequiredDifference: 12.5,
        status: 'UNRESOLVED_VARIANCE',
        version: 1,
        triggers: ['EXCESS_ISSUE'],
        disposition: null,
        issueNotes: ['Kho xuất bù thêm ca trưa do phát sinh thêm 20 suất'],
      },
      {
        batchLineId: 'batch-line-02',
        dailyLineId: 'daily-line-02',
        serviceDate: '2026-09-14',
        ingredientId: 'ing-2',
        ingredientCode: 'NL-RAU-01',
        ingredientName: 'Rau cải xanh sạch',
        canonicalUnitId: 'u-kg',
        canonicalUnitName: 'kg',
        requiredQuantity: 50,
        issuedQuantity: 50,
        issuedRequiredDifference: 0,
        status: 'MATCHED',
        version: 1,
        triggers: [],
        disposition: null,
        issueNotes: [],
      },
    ],
  },
};

async function main() {
  log('Starting MRX Operational Recovery & Zero Dead-Ends Live Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const auditResults = [];

  try {
    await loginUser(page, 'admin');

    // Route active batch to SAMPLE_IN_PROGRESS_BATCH to test active disposition & completion blockers
    await page.route('**/api/reconciliation/batches/recon-live-test-01*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: SAMPLE_IN_PROGRESS_BATCH }),
      });
    });

    await page.route('**/api/reconciliation/batches?*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                batchId: 'recon-live-test-01',
                customerCode: 'DAV',
                customerName: 'Draxlmaier',
                status: 'IN_PROGRESS',
                weekStartDate: '2026-09-14',
              },
            ],
            totalCount: 1,
          },
        }),
      });
    });

    // =========================================================================
    // SCENARIO 1: /reconciliation — Disposition Form Preservation on Failure
    // =========================================================================
    log('--- Scenario 1: /reconciliation - Disposition Form Preservation on Failure ---');
    await page.goto(`${BASE_URL}/reconciliation?customerId=DAV&batchId=recon-live-test-01&date=2026-09-14`);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    log('  Loaded in-progress reconciliation batch.');

    const resolveBtn = page.locator('button:has-text("Xử lý chênh lệch")').first();
    await resolveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await resolveBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const reasonText = 'Bếp nấu hao hụt thực tế do nhiệt độ lò hấp cao hơn tiêu chuẩn kiểm toán';
    const reasonInput = page.locator('div[role="dialog"] input#disposition-reason, div[role="dialog"] input[type="text"]').last();
    await reasonInput.fill(reasonText);
    log(`  Entered disposition reason: "${reasonText}"`);

    // Mock disposition API failure (500)
    await page.route('**/api/reconciliation/**/disposition', (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Lỗi kết nối máy chủ đối soát (Simulated 500 Failure)' }),
      });
    });

    const submitBtn = page.locator('div[role="dialog"] button:has-text("Lưu hướng xử lý")');
    await submitBtn.click();
    await page.waitForTimeout(500);

    const isModalOpen = await page.locator('div[role="dialog"]').isVisible();
    const preservedReason = await reasonInput.inputValue();
    const isErrorBannerVisible = await page.locator('div[role="dialog"] [role="alert"]').isVisible();

    log(`  Modal still open: ${isModalOpen}`);
    log(`  Preserved reason: "${preservedReason}"`);
    log(`  Error banner in modal: ${isErrorBannerVisible}`);

    const s1Pass = isModalOpen && preservedReason === reasonText && isErrorBannerVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-mrx-disposition-form-preserved.png') });
    auditResults.push({ scenario: '1. MRX Disposition Form Preservation', passed: s1Pass });

    await page.unroute('**/api/reconciliation/**/disposition');

    // =========================================================================
    // SCENARIO 2: /reconciliation — 409 Concurrency Conflict & Reload Action
    // =========================================================================
    log('--- Scenario 2: /reconciliation - 409 Concurrency Conflict Handling ---');
    await page.route('**/api/reconciliation/**/disposition', (route) => {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Dòng chênh lệch đã được cập nhật bởi quản lý khác (Simulated 409)' }),
      });
    });

    await submitBtn.click();
    await page.waitForTimeout(500);

    const isConflictBannerVisible = await page.locator('div[role="dialog"] [role="alert"]:has-text("Xung đột dữ liệu đồng thời")').isVisible();
    const isReloadBtnVisible = await page.locator('div[role="dialog"] button:has-text("Tải lại dữ liệu mới nhất")').isVisible();

    log(`  Conflict banner visible in dialog: ${isConflictBannerVisible}`);
    log(`  Reload button visible in dialog: ${isReloadBtnVisible}`);

    const s2Pass = isConflictBannerVisible && isReloadBtnVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-mrx-disposition-409-conflict.png') });
    auditResults.push({ scenario: '2. MRX 409 Conflict & Reload CTA', passed: s2Pass });

    await page.unroute('**/api/reconciliation/**/disposition');
    await page.click('div[role="dialog"] button:has-text("Quay lại")');
    await page.waitForTimeout(500);

    // =========================================================================
    // SCENARIO 3: /reconciliation — Completion Modal Blocked Diagnostics
    // =========================================================================
    log('--- Scenario 3: /reconciliation - Completion Blocked Diagnostics ---');
    const completeBtn = page.locator('button:has-text("Chốt đối soát tuần")');
    await completeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await completeBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const isWarningVisible = await page.locator('div[role="dialog"] div:has-text("dòng chênh lệch chưa có quyết định xử lý")').first().isVisible();
    const isFilterLinkVisible = await page.locator('div[role="dialog"] button:has-text("Lọc xem")').isVisible();

    log(`  Completion blocker warning visible: ${isWarningVisible}`);
    log(`  Quick-filter jump button visible: ${isFilterLinkVisible}`);

    const s3Pass = isWarningVisible && isFilterLinkVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-mrx-completion-blocked-diagnostics.png') });
    auditResults.push({ scenario: '3. MRX Completion Diagnostics & Jump CTA', passed: s3Pass });

    // Click jump button
    await page.click('div[role="dialog"] button:has-text("Lọc xem")');
    await page.waitForTimeout(500);

    // =========================================================================
    // SCENARIO 4: /reconciliation — Empty Batch Escape Hatch to Preparation
    // =========================================================================
    log('--- Scenario 4: /reconciliation - Empty Batch Escape Hatch ---');
    await page.unroute('**/api/reconciliation/batches/recon-live-test-01*');
    await page.route('**/api/reconciliation/batches?*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], totalCount: 0 } }),
      });
    });

    await page.goto(`${BASE_URL}/reconciliation`);
    await page.waitForTimeout(1000);

    const emptyCtaBtn = page.locator('button:has-text("Chuyển đến Chuẩn bị lô đối soát")');
    const isCtaVisible = await emptyCtaBtn.isVisible();
    log(`  Empty batch CTA button visible: ${isCtaVisible}`);

    const s4Pass = isCtaVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-mrx-empty-batch-escape-hatch.png') });
    auditResults.push({ scenario: '4. Empty Batch Cross-Station Escape Hatch', passed: s4Pass });

    await page.unroute('**/api/reconciliation/batches?*');

    // =========================================================================
    // SCENARIO 5: /warehouse?view=mrx-daily — Supplemental Issue Form Preservation
    // =========================================================================
    log('--- Scenario 5: /warehouse?view=mrx-daily - Supplemental Issue Preservation ---');
    await page.route('**/warehouse-daily*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batchId: 'recon-live-test-01',
            customerCode: 'DAV',
            sourceVersion: 2,
            dates: [
              {
                serviceDate: '2026-09-14',
                dayOfWeek: 'Monday',
                hasInitialIssue: true,
                lines: [
                  {
                    dailyLineId: 'dl-1',
                    batchLineId: 'bl-1',
                    ingredientId: 'ing-1',
                    ingredientCode: 'NL-THIT-01',
                    ingredientName: 'Thịt đùi heo tươi',
                    canonicalUnitId: 'u-kg',
                    canonicalUnitName: 'kg',
                    requiredQuantity: 50,
                    issuedQuantity: 50,
                    varianceReason: null,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.route('**/reconciliation/batches/recon-live-test-01/dishes', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto(`${BASE_URL}/warehouse?view=mrx-daily&batchId=recon-live-test-01&date=2026-09-14`);
    await page.waitForTimeout(1500);

    const openSuppBtn = page.locator('button:has-text("Xuất bổ sung ca")');
    await openSuppBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openSuppBtn.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const qtyInput = page.locator('div[role="dialog"] input[type="number"]');
    await qtyInput.fill('15.5');

    const suppReasonInput = page.locator('div[role="dialog"] input[type="text"]').last();
    await suppReasonInput.fill('Bếp nấu hỏng cần bù gấp');

    // Mock failure
    await page.route('**/api/inventory-issues', (route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Số lượng xuất bổ sung vượt hạn mức tồn kho an toàn (Simulated 400)' }),
      });
    });

    const confirmSuppBtn = page.locator('div[role="dialog"] button:has-text("Xác nhận xuất bổ sung")');
    await confirmSuppBtn.click();
    await page.waitForTimeout(500);

    const isSuppModalOpen = await page.locator('div[role="dialog"]').isVisible();
    const preservedQty = await qtyInput.inputValue();
    const isSuppErrorVisible = await page.locator('div[role="dialog"] [role="alert"]').isVisible();

    log(`  Supplemental modal remains open: ${isSuppModalOpen}`);
    log(`  Preserved quantity: ${preservedQty}`);
    log(`  Error banner visible: ${isSuppErrorVisible}`);

    const s5Pass = isSuppModalOpen && preservedQty === '15.5' && isSuppErrorVisible;
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-mrx-supplemental-issue-preserved.png') });
    auditResults.push({ scenario: '5. Supplemental Issue Form Preservation', passed: s5Pass });

    await page.unroute('**/api/inventory-issues');
    await page.unroute('**/warehouse-daily*');
    await page.click('div[role="dialog"] button:has-text("Hủy bỏ")');

    log('--- MRX LIVE AUDIT COMPLETED ---');
    console.table(auditResults);

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
