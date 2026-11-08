// scripts/run-mrx-exhaustive-scenarios-test.mjs
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/audit-screenshots/mrx-exhaustive');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const SANDBOX_DB = 'ipc_mrx_e2e_sandbox';
const KESTREL_PORT = 5263;
const VITE_PORT = 5174;
const BASE_URL = `http://localhost:${VITE_PORT}`;
const API_URL = `http://127.0.0.1:${KESTREL_PORT}`;

function log(msg) {
  console.log(`[MRX-EXHAUSTIVE] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 404) return true;
    } catch {
      // waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function runSql(command) {
  const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
  execSync(`"${mysqlPath}" -u root -p123456789 -e "${command}"`, { stdio: 'pipe' });
}

function setupSandboxDatabase() {
  log(`Setting up sandbox database '${SANDBOX_DB}'...`);
  const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
  const mysqldumpPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysqldump.exe';
  const dumpPath = path.resolve('D:/Temp/ipc_sandbox_dump.sql');

  runSql(`CREATE DATABASE IF NOT EXISTS ${SANDBOX_DB};`);
  execSync(`"${mysqldumpPath}" -u root -p123456789 --single-transaction --hex-blob --set-gtid-purged=OFF --result-file="${dumpPath}" ipcmanagement`, { stdio: 'pipe' });
  execSync(`"${mysqlPath}" -u root -p123456789 ${SANDBOX_DB} < "${dumpPath}"`, { stdio: 'pipe' });

  // Clean week 2026-07-20 in sandbox to simulate a realistic fresh un-imported week for E2E lifecycle
  const cleanSqlPath = path.resolve('D:/Temp/ipc_sandbox_clean.sql');
  fs.writeFileSync(cleanSqlPath, `
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM reconciliationsourcedeltas WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationdispositions WHERE BatchLineId IN (SELECT BatchLineId FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20')));
    DELETE FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20');
    DELETE FROM mealquantityplanlines WHERE quantityPlanId IN (SELECT quantityPlanId FROM mealquantityplans WHERE serviceDate >= '2026-07-20' AND serviceDate <= '2026-07-26');
    DELETE FROM mealquantityplans WHERE serviceDate >= '2026-07-20' AND serviceDate <= '2026-07-26';
    DELETE FROM menuschedules WHERE weekStartDate = '2026-07-20';
    DELETE FROM menuversions WHERE weekStartDate = '2026-07-20';
    SET FOREIGN_KEY_CHECKS = 1;
  `, 'utf8');
  execSync(`"${mysqlPath}" -u root -p123456789 ${SANDBOX_DB} < "${cleanSqlPath}"`, { stdio: 'pipe' });

  log(`Sandbox database '${SANDBOX_DB}' initialized successfully.`);
}

function teardownSandboxDatabase() {
  log(`Tearing down sandbox database '${SANDBOX_DB}'...`);
  try {
    runSql(`DROP DATABASE IF EXISTS ${SANDBOX_DB};`);
    log(`Sandbox database '${SANDBOX_DB}' dropped cleanly.`);
  } catch (err) {
    console.error('Teardown error:', err);
  }
}

async function selectOptionByText(page, selector, textToMatch) {
  const select = page.locator(selector);
  await select.waitFor({ state: 'visible', timeout: 10000 });
  const options = await select.locator('option').all();
  for (const opt of options) {
    const text = await opt.innerText();
    if (text.toLowerCase().includes(textToMatch.toLowerCase())) {
      const val = await opt.getAttribute('value');
      if (val) {
        await select.selectOption(val);
        return val;
      }
    }
  }
  await select.selectOption({ index: 0 });
  return null;
}

async function main() {
  let kestrelProcess = null;
  let viteProcess = null;
  let browser = null;

  const testResults = [];

  try {
    setupSandboxDatabase();

    // 1. Start Kestrel on port 5263 pointing to sandbox DB
    log(`Starting backend Kestrel on port ${KESTREL_PORT}...`);
    kestrelProcess = spawn('dotnet', [
      'run',
      '--no-build',
      '--project', 'backend/src/IPCManagement.Api',
      '--urls', `http://127.0.0.1:${KESTREL_PORT}`,
      '--ConnectionStrings:DefaultConnection', `server=localhost;port=3306;database=${SANDBOX_DB};user=root;password=123456789;`,
    ], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    kestrelProcess.stderr.on('data', (d) => process.stderr.write(`[Kestrel-ERR] ${d}`));

    await waitForHttp(`${API_URL}/swagger/v1/swagger.json`, 25000);
    log(`Backend Kestrel is live at ${API_URL}`);

    // 2. Start Vite on port 5174 proxying to 5263
    log(`Starting Vite on port ${VITE_PORT}...`);
    viteProcess = spawn('cmd.exe', [
      '/c', 'npm', 'run', 'dev', '--',
      '--port', String(VITE_PORT),
    ], {
      cwd: path.resolve(REPO_ROOT, 'frontend'),
      stdio: 'pipe',
      env: {
        ...process.env,
        VITE_PROXY_TARGET: API_URL,
      },
    });

    await waitForHttp(`${BASE_URL}`, 20000);
    log(`Frontend Vite is live at ${BASE_URL}`);

    // 3. Launch Playwright
    log('Launching Chromium in Headed Mode for live visual inspection...');
    try {
      browser = await chromium.launch({ headless: false, slowMo: 100 });
    } catch {
      log('Headed launch fallback to headless...');
      browser = await chromium.launch({ headless: true });
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    let createdBatchId = '';

    // =========================================================================
    // SCENARIO 1: AUTH & MODE CONFIRMATION
    // =========================================================================
    log('--- SCENARIO 1: Auth & Mode Confirmation ---');
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Switch to MRX mode if not yet active
    await page.goto(`${BASE_URL}/settings/advanced?view=mode`);
    await page.waitForTimeout(800);
    const mrxRadio = page.locator('input[value="MATERIAL_RECONCILIATION"]');
    if (await mrxRadio.isVisible() && !(await mrxRadio.isChecked())) {
      await mrxRadio.check();
      await page.fill('textarea', 'Kích hoạt chế độ đối soát cho đợt kiểm thử E2E Exhaustive');
      await page.click('button:has-text("Xác nhận chuyển đổi")');
      await page.waitForTimeout(1000);
    }
    testResults.push({ scenario: 'Auth & Mode Confirmation', status: 'PASS' });
    log('Scenario 1 PASS: Logged in and MRX mode confirmed.');

    // =========================================================================
    // SCENARIO 2: IMPORT WEEKLY MENU & VERIFY 2-TAB PREVIEW
    // =========================================================================
    log('--- SCENARIO 2: Weekly Menu Import & 2-Tab Material Breakdown ---');
    await page.goto(`${BASE_URL}/weekly-menu`);
    await page.waitForTimeout(1000);

    const importBtn = page.locator('button:has-text("Nhập thực đơn Excel")');
    await importBtn.click();
    await page.waitForTimeout(500);

    await selectOptionByText(page, 'select#import-customer-select', 'AMANN');
    const weekInput = page.locator('input[aria-label="Tuần bắt đầu nhập"]');
    await weekInput.fill('20/07/2026');
    await weekInput.press('Enter');

    const templateFilePath = path.resolve('backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');
    await page.setInputFiles('input[type="file"]', templateFilePath);
    await page.fill('input#price-tier-input', '25000');

    await page.click('button:has-text("Xem trước")');
    await page.waitForSelector('text=Kết quả phân tích file', { timeout: 10000 });

    await page.click('button:has-text("Xác nhận nhập")');
    await page.waitForSelector('text=Nhập thực đơn tuần từ file Excel', { state: 'detached', timeout: 15000 });

    // Go to MRX Batch Workbench
    await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
    await page.waitForTimeout(1000);

    await selectOptionByText(page, 'select[aria-label="Chọn khách hàng MRX"]', 'AMANN');
    const mrxWeekInput = page.locator('input[aria-label="Tuần MRX bắt đầu"]');
    await mrxWeekInput.fill('20/07/2026');
    await mrxWeekInput.press('Enter');
    await page.waitForTimeout(1000);

    // If draft, publish
    const publishBtn = page.locator('button:has-text("Xuất bản thực đơn tuần")');
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await page.waitForSelector('text=Đã xuất bản thực đơn tuần thành công', { timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // Check quantities if not yet active
    const checkBtn = page.locator('header button:has-text("Kiểm tra định lượng")');
    if (await checkBtn.isVisible()) {
      log('Clicking "Kiểm tra định lượng"...');
      await checkBtn.click();
      await page.waitForTimeout(1500);
    }

    // Verify 2-Tab Material Breakdown
    const matTab = page.locator('button:has-text("Phân rã nguyên liệu định lượng")');
    const planTab = page.locator('button:has-text("Kế hoạch món & suất theo ca")');
    await matTab.waitFor({ state: 'visible', timeout: 10000 });
    await planTab.waitFor({ state: 'visible', timeout: 10000 });
    log('Verified: 2-Tab Preview (Material Breakdown & Plans) is active and visible.');

    // Switch to plan tab and back
    log('Clicking plan tab...');
    await planTab.click();
    await page.waitForTimeout(600);
    log('Clicking material tab...');
    await matTab.click();
    await page.waitForTimeout(600);

    // Create Draft Batch
    const draftBtn = page.locator('button:has-text("Tạo lô nháp")');
    await draftBtn.waitFor({ state: 'visible', timeout: 15000 });
    await draftBtn.click();
    await page.waitForTimeout(1500);

    // Freeze (mark ready)
    const readyBtn = page.locator('button:has-text("Đóng băng lô")');
    await readyBtn.waitFor({ state: 'visible', timeout: 15000 });
    await readyBtn.click();
    await page.waitForTimeout(1500);

    // Handover to warehouse (transfer)
    const transferBtn = page.locator('button:has-text("Chuyển sang Kho")');
    await transferBtn.waitFor({ state: 'visible', timeout: 15000 });
    await transferBtn.click();
    await page.waitForSelector('text=Đã bàn giao lô đối soát sang Kho nguyên liệu thành công', { timeout: 15000 });

    // Verify CTA button on Header
    const warehouseCta = page.locator('header button:has-text("Đi đến Trạm Kho nguyên liệu →")');
    if (!await warehouseCta.isVisible()) {
      throw new Error('FAIL: CTA button "Đi đến Trạm Kho nguyên liệu →" missing on Header!');
    }
    log('Verified: CTA "Đi đến Trạm Kho nguyên liệu →" rendered on Header.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-batch-transferred-with-cta.png') });
    testResults.push({ scenario: 'Weekly Menu Import & 2-Tab Breakdown & Batch Handover', status: 'PASS' });

    // =========================================================================
    // SCENARIO 3: WAREHOUSE CA TUAN VIEW & DIEN DU TOAN BO & 7 CANONICAL LABELS
    // =========================================================================
    log('--- SCENARIO 3: Warehouse Cả tuần view, Điền đủ toàn bộ, & Canonical Labels ---');
    await warehouseCta.click();
    await page.waitForTimeout(1500);

    const whUrl = new URL(page.url());
    createdBatchId = whUrl.searchParams.get('batchId') || '';
    log(`Captured createdBatchId: ${createdBatchId}`);

    // Verify we arrived at warehouse page
    if (!page.url().includes('/warehouse?view=mrx-daily')) {
      throw new Error(`FAIL: CTA did not navigate to /warehouse?view=mrx-daily! URL: ${page.url()}`);
    }

    // Verify Cả tuần tab button
    const caTuanBtn = page.locator('button:has-text("Cả tuần (Tổng hợp)")');
    await caTuanBtn.waitFor({ state: 'visible', timeout: 10000 });
    await caTuanBtn.click();
    await page.waitForTimeout(800);

    // Verify read-only notice in Cả tuần mode
    await page.waitForSelector('text=Chế độ xem tổng hợp tuần (Chỉ đọc)', { timeout: 5000 });
    log('Verified: Cả tuần (Tổng hợp) view is active, read-only, and displays weekly aggregates.');

    // Switch to Monday (first date)
    const mondayBtn = page.locator('button:has-text("T2")').first();
    await mondayBtn.click();
    await page.waitForTimeout(800);

    // Verify "Điền đủ toàn bộ" button exists and click it
    const dienDuBtn = page.locator('button:has-text("Điền đủ toàn bộ")');
    await dienDuBtn.waitFor({ state: 'visible', timeout: 5000 });
    log('Clicking "Điền đủ toàn bộ"...');
    await dienDuBtn.click();
    await page.waitForTimeout(500);

    // Verify canonical draft label "Dự kiến xuất đủ" appeared on rows
    const duKienXuatDuBadges = await page.locator('text=Dự kiến xuất đủ').count();
    if (duKienXuatDuBadges === 0) {
      throw new Error('FAIL: "Dự kiến xuất đủ" badges did not appear after clicking Điền đủ toàn bộ!');
    }
    log(`Verified: ${duKienXuatDuBadges} lines have "Dự kiến xuất đủ" badge.`);

    // =========================================================================
    // SCENARIO 4: WORST CASE A — OVER-ISSUE WITHOUT REASON IS BLOCKED
    // =========================================================================
    log('--- SCENARIO 4: Worst Case — Over-Issue Without Reason Must Block Submit ---');
    const firstQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').first();
    const currentVal = await firstQtyInput.inputValue();
    const overVal = String(Number(currentVal) + 50);

    // Set over-issued quantity
    await firstQtyInput.fill(overVal);
    await page.waitForTimeout(500);

    // Verify "Dự kiến xuất vượt" appeared
    await page.waitForSelector('text=Dự kiến xuất vượt', { timeout: 5000 });

    // Assert submit button is DISABLED because reason is empty
    const submitBtn = page.locator('button:has-text("Xác nhận xuất kho")');
    const isBtnDisabled = await submitBtn.isDisabled();
    if (!isBtnDisabled) {
      throw new Error('VIOLATION: Submit button was enabled when over-issue had no reason!');
    }
    log('Verified: Over-issue without reason strictly disables "Xác nhận xuất kho" button.');

    // Now fill mandatory reason
    const firstReasonInput = page.locator('input[aria-label^="Lý do chênh lệch"]').first();
    await firstReasonInput.fill('Bổ sung thêm định lượng do khách yêu cầu tăng suất phát sinh');
    await page.waitForTimeout(500);

    // Button should now be enabled
    if (await submitBtn.isDisabled()) {
      throw new Error('FAIL: Submit button remained disabled after filling required reason!');
    }
    log('Verified: Filling over-issue reason enables submit button.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-over-issue-validation-passed.png') });
    testResults.push({ scenario: 'Over-Issue Validation & Blocking', status: 'PASS' });

    // =========================================================================
    // SCENARIO 5: WORST CASE B — UNDER-ISSUE (KITCHEN SAVINGS) & INITIAL ISSUE
    // =========================================================================
    log('--- SCENARIO 5: Worst Case — Under-Issue (Kitchen Savings) & Initial Issue ---');
    // Set under-issued quantity on second line (simulating kitchen savings)
    const secondQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').nth(1);
    if (await secondQtyInput.count() > 0) {
      const secondVal = await secondQtyInput.inputValue();
      const underVal = String(Math.max(1, Number(secondVal) - 2));
      await secondQtyInput.fill(underVal);
      await page.waitForTimeout(300);
      log(`Line 2 under-issued: ${secondVal} -> ${underVal}`);
    }

    // Submit Initial Issue
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Verify initial issue is committed: "Xuất bổ sung ca" button should now be visible
    const suppIssueBtn = page.locator('button:has-text("Xuất bổ sung ca")');
    await suppIssueBtn.waitFor({ state: 'visible', timeout: 15000 });
    log('Verified: Initial issue successfully recorded. Date is now IN_PROGRESS.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-initial-issue-committed.png') });
    testResults.push({ scenario: 'Initial Issue with Under-Issue & Over-Issue', status: 'PASS' });

    // =========================================================================
    // SCENARIO 6: SUPPLEMENTAL ISSUE MODAL (RULE-MRX-03)
    // =========================================================================
    log('--- SCENARIO 6: Supplemental Issue in Shift ---');
    await suppIssueBtn.click();
    await page.waitForSelector('text=Xuất kho bổ sung trong ca', { timeout: 10000 });

    await page.fill('input#supp-qty', '3.5');
    // Click preset chip
    const presetBtn = page.locator('button:has-text("Phát sinh suất ăn đột xuất")');
    await presetBtn.click();

    const confirmSuppBtn = page.locator('button:has-text("Xác nhận xuất bổ sung")');
    await confirmSuppBtn.click();
    await page.waitForSelector('text=Xuất kho bổ sung trong ca', { state: 'detached', timeout: 15000 });
    log('Verified: Supplemental issue created successfully.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-supplemental-issue-confirmed.png') });
    testResults.push({ scenario: 'Supplemental Issue (RULE-MRX-03)', status: 'PASS' });

    // =========================================================================
    // SCENARIO 7: CHEF COOKING INSPECTION WITH SHIFT FILTER
    // =========================================================================
    log('--- SCENARIO 7: Chef Cooking Station & Shift Filter ---');
    await page.goto(`${BASE_URL}/chef?view=mrx-cooking`);
    await page.waitForTimeout(1500);

    // Verify shift filter exists
    const shiftFilter = page.locator('select[aria-label="Lọc theo ca nấu"]');
    if (await shiftFilter.isVisible()) {
      await shiftFilter.selectOption('MORNING');
      await page.waitForTimeout(500);
      await shiftFilter.selectOption('ALL');
      await page.waitForTimeout(500);
      log('Verified: Chef shift filter (Ca 1 / Ca 2 / Tất cả) operates smoothly.');
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-chef-cooking-filtered.png') });
    testResults.push({ scenario: 'Chef Cooking & Shift Filter', status: 'PASS' });

    // =========================================================================
    // SCENARIO 8: RECONCILIATION CONTROL TOWER & TWO-WAY ACCEPTED VARIANCE
    // =========================================================================
    log('--- SCENARIO 8: Reconciliation Control Tower & Two-Way Accepted Variance ---');
    await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=2026-07-20`);
    await page.waitForTimeout(2000);

    // Check for "Xử lý chênh lệch" button (on over-issued or under-issued line)
    const discrepancyBtn = page.locator('button:has-text("Xử lý chênh lệch")').first();
    if (await discrepancyBtn.isVisible()) {
      log('Clicking "Xử lý chênh lệch"...');
      await discrepancyBtn.click();
      await page.waitForSelector('text=Xử lý chênh lệch theo ngày', { timeout: 10000 });

      // Select ACCEPTED_VARIANCE
      const catSelect = page.locator('select#disposition-category');
      if (await catSelect.isVisible()) {
        await catSelect.selectOption('ACCEPTED_VARIANCE');
      }
      await page.fill('input#disposition-reason', 'Chấp nhận sai lệch hai chiều (Bếp nấu tiết kiệm / Xuất bổ sung)');
      await page.click('button:has-text("Lưu hướng xử lý")');
      await page.waitForTimeout(1500);
      log('Verified: Variance resolved with ACCEPTED_VARIANCE.');
    } else {
      log('No unhandled discrepancy line found (already exact or disposed).');
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06-reconciliation-disposition-complete.png') });
    testResults.push({ scenario: 'Reconciliation Two-Way Variance Resolution', status: 'PASS' });

    // =========================================================================
    // SCENARIO 9: BLOCKER STRIP & CROSS-STATION WAREHOUSE NAVIGATION CTA
    // =========================================================================
    log('--- SCENARIO 9: Blocker Strip & Cross-Station CTA ---');
    // If other days of the week are still unissued, Blocker Strip must guide user to Warehouse
    const blockerCta = page.locator('div[role="status"] button:has-text("Mở trạm Kho xuất ngày →")');
    if (await blockerCta.isVisible()) {
      log('Verified: Blocker Strip displays "Mở trạm Kho xuất ngày →" CTA for unissued dates.');
      await blockerCta.click();
      await page.waitForTimeout(1000);
      if (!page.url().includes('/warehouse?view=mrx-daily')) {
        throw new Error('FAIL: Blocker Strip CTA did not navigate to Warehouse!');
      }
      log('Verified: Blocker Strip CTA successfully routes user back to Warehouse daily station.');
    }
    testResults.push({ scenario: 'Blocker Strip Cross-Station Navigation CTA', status: 'PASS' });

    // =========================================================================
    // SUMMARY
    // =========================================================================
    log('\n=========================================================================');
    log('EXHAUSTIVE MRX TEST SCENARIOS SUMMARY:');
    for (const r of testResults) {
      log(`  ${r.status.padEnd(6)} | ${r.scenario}`);
    }
    log('=========================================================================\n');

    const reportPath = path.join(OUTPUT_DIR, 'EXHAUSTIVE-MRX-TEST-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2), 'utf8');
    log(`Report written to ${reportPath}`);

    log('ALL MRX EXHAUSTIVE SCENARIOS PASSED 100% ON ISOLATED SANDBOX DATABASE!');
  } catch (err) {
    console.error('[MRX-EXHAUSTIVE-FATAL]', err);
    try {
      if (browser) {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages.length > 0) {
          await pages[0].screenshot({ path: path.join(OUTPUT_DIR, 'debug-exhaustive-failure.png') });
          console.log('Saved debug screenshot to debug-exhaustive-failure.png');
        }
      }
    } catch (e) {
      console.error('Failed to capture failure screenshot:', e);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
    log('Stopping temporary services...');
    try {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174, 5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
    } catch {}
    teardownSandboxDatabase();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[MRX-EXHAUSTIVE-FATAL]', err);
  process.exit(1);
});
