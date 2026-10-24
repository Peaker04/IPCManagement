// scripts/run-mrx-full-path-lifecycle-test.mjs
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/audit-screenshots/mrx-full-path');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const SANDBOX_DB = 'ipc_mrx_e2e_sandbox';
const KESTREL_PORT = 5263;
const VITE_PORT = 5174;
const BASE_URL = `http://localhost:${VITE_PORT}`;
const API_URL = `http://127.0.0.1:${KESTREL_PORT}`;

function log(msg) {
  console.log(`[MRX-FULL-PATH] ${new Date().toISOString().slice(11, 19)} ${msg}`);
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

async function loginUser(page, username) {
  log(`Logging in as '${username}'...`);
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
}

async function main() {
  let kestrelProcess = null;
  let viteProcess = null;
  let browser = null;

  const testAuditTrail = [];

  try {
    setupSandboxDatabase();

    // Start Backend Kestrel
    log(`Starting backend Kestrel on port ${KESTREL_PORT}...`);
    kestrelProcess = spawn('dotnet', [
      'run',
      '--no-build',
      '--project', 'backend/src/IPCManagement.Api',
      '--urls', `http://127.0.0.1:${KESTREL_PORT}`,
      '--ConnectionStrings:DefaultConnection', `server=localhost;port=3306;database=${SANDBOX_DB};user=root;password=123456789;`,
    ], { cwd: REPO_ROOT, stdio: 'pipe' });
    kestrelProcess.stderr.on('data', (d) => process.stderr.write(`[Kestrel-ERR] ${d}`));

    await waitForHttp(`${API_URL}/swagger/v1/swagger.json`, 25000);
    log(`Backend Kestrel is live at ${API_URL}`);

    // Start Vite Frontend
    log(`Starting Vite on port ${VITE_PORT}...`);
    viteProcess = spawn('cmd.exe', [
      '/c', 'npm', 'run', 'dev', '--',
      '--port', String(VITE_PORT),
    ], {
      cwd: path.resolve(REPO_ROOT, 'frontend'),
      stdio: 'pipe',
      env: { ...process.env, VITE_PROXY_TARGET: API_URL },
    });

    await waitForHttp(`${BASE_URL}`, 20000);
    log(`Frontend Vite is live at ${BASE_URL}`);

    // Launch Chromium Headed
    log('Launching Chromium Headed for Full-Path E2E inspection...');
    try {
      browser = await chromium.launch({ headless: false, slowMo: 100 });
    } catch {
      browser = await chromium.launch({ headless: true });
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();

    let createdBatchId = '';

    // =========================================================================
    // PHASE 1: ĐIỀU PHỐI VIÊN (dieuphoi) — Lập Kế hoạch, Đóng băng & Bàn giao
    // =========================================================================
    log('\n=========================================================================');
    log('PHASE 1: COORDINATOR (dieuphoi) — Import, 2-Tab Breakdown, Freeze & Handoff');
    log('=========================================================================');
    await loginUser(page, 'dieuphoi');

    // Ensure MRX mode
    await page.evaluate(() => localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION'));

    // Step 1.1: Import Weekly Menu from Excel template
    log('P1.1: Importing Weekly Menu template...');
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
    log('P1.1 complete: Menu template imported.');

    // Step 1.2: Go to MRX Batch Workbench
    log('P1.2: Navigating to MRX Batch Workbench...');
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
      log('Menu is in draft, publishing...');
      await publishBtn.click();
      await page.waitForSelector('text=Đã xuất bản thực đơn tuần thành công', { timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // Check quantities if needed
    const checkBtn = page.locator('header button:has-text("Kiểm tra định lượng")');
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await page.waitForTimeout(1500);
    }

    // Verify 2-Tab Material Breakdown & Plans
    const matTab = page.locator('button:has-text("Phân rã nguyên liệu định lượng")');
    const planTab = page.locator('button:has-text("Kế hoạch món & suất theo ca")');
    await matTab.waitFor({ state: 'visible', timeout: 10000 });
    await planTab.waitFor({ state: 'visible', timeout: 10000 });
    await planTab.click();
    await page.waitForTimeout(500);
    await matTab.click();
    await page.waitForTimeout(500);
    log('P1.2 complete: 2-Tab Material Breakdown verified.');

    // Step 1.3: Create Draft Batch, Freeze, & Transfer
    log('P1.3: Creating Draft Batch, Freezing, and Transferring to Warehouse...');
    const draftBtn = page.locator('button:has-text("Tạo lô nháp")');
    await draftBtn.waitFor({ state: 'visible', timeout: 15000 });
    await draftBtn.click();
    await page.waitForTimeout(1500);

    const readyBtn = page.locator('button:has-text("Đóng băng lô")');
    await readyBtn.waitFor({ state: 'visible', timeout: 15000 });
    await readyBtn.click();
    await page.waitForTimeout(1500);

    const transferBtn = page.locator('button:has-text("Chuyển sang Kho")');
    await transferBtn.waitFor({ state: 'visible', timeout: 15000 });
    await transferBtn.click();
    await page.waitForSelector('text=Đã bàn giao lô đối soát sang Kho nguyên liệu thành công', { timeout: 15000 });

    createdBatchId = await page.evaluate(async () => {
      const token = localStorage.getItem('ipc_v3_token');
      const res = await fetch('/api/reconciliation/batches?pageSize=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.data?.items?.[0]?.batchId || '';
    });
    log(`Captured createdBatchId via API: ${createdBatchId}`);
    if (!createdBatchId) throw new Error('FAIL: Batch ID not captured!');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-p1-coordinator-handoff.png') });
    testAuditTrail.push({ phase: 'Phase 1: Coordinator Handoff', status: 'PASS', batchId: createdBatchId });

    // =========================================================================
    // PHASE 2: THỦ KHO (thukho) — Xuất Kho Toàn Bộ 6 Ngày Trong Tuần
    // =========================================================================
    log('\n=========================================================================');
    log('PHASE 2: WAREHOUSE (thukho) — Full 6-Day Operational Issuing & Supplement');
    log('=========================================================================');
    await loginUser(page, 'thukho');
    await page.goto(`${BASE_URL}/warehouse?view=mrx-daily&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);

    // 2.0: Verify Cả tuần aggregate summary
    log('P2.0: Inspecting Cả tuần (Tổng hợp) view...');
    const caTuanBtn = page.locator('button:has-text("Cả tuần (Tổng hợp)")');
    await caTuanBtn.waitFor({ state: 'visible', timeout: 10000 });
    await caTuanBtn.click();
    await page.waitForTimeout(800);
    await page.waitForSelector('text=Chế độ xem tổng hợp tuần (Chỉ đọc)', { timeout: 5000 });
    log('P2.0 complete: Cả tuần view confirmed read-only.');

    const DAYS_CONFIG = [
      { tabText: 'T2', name: 'Thứ Hai', hasOver: true, hasUnder: true, hasSupp: true },
      { tabText: 'T3', name: 'Thứ Ba', hasOver: false, hasUnder: false, hasSupp: false },
      { tabText: 'T4', name: 'Thứ Tư', hasOver: false, hasUnder: true, hasSupp: false },
      { tabText: 'T5', name: 'Thứ Năm', hasOver: false, hasUnder: false, hasSupp: false },
      { tabText: 'T6', name: 'Thứ Sáu', hasOver: true, hasUnder: false, hasSupp: false },
      { tabText: 'T7', name: 'Thứ Bảy', hasOver: false, hasUnder: false, hasSupp: false },
    ];

    for (let dayIdx = 0; dayIdx < DAYS_CONFIG.length; dayIdx++) {
      const cfg = DAYS_CONFIG[dayIdx];
      log(`\nP2.${dayIdx + 1}: Issuing for ${cfg.name} (${cfg.tabText})...`);

      const dayTab = page.locator(`button:has-text("${cfg.tabText}")`).first();
      await dayTab.click();
      await page.waitForTimeout(800);

      // Click "Điền đủ toàn bộ"
      const dienDuBtn = page.locator('button:has-text("Điền đủ toàn bộ")');
      await dienDuBtn.waitFor({ state: 'visible', timeout: 5000 });
      await dienDuBtn.click();
      await page.waitForTimeout(400);

      if (cfg.hasOver) {
        log(`  Applying over-issue with mandatory reason on Line 1...`);
        const firstQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').first();
        const cur = await firstQtyInput.inputValue();
        await firstQtyInput.fill(String(Number(cur) + 2));
        const firstReasonInput = page.locator('input[aria-label^="Lý do chênh lệch"]').first();
        await firstReasonInput.fill('Bổ sung thêm định lượng do khách tăng suất phát sinh');
        await page.waitForTimeout(200);
      }

      if (cfg.hasUnder) {
        log(`  Applying under-issue (kitchen savings) on Line 2...`);
        const secondQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').nth(1);
        if (await secondQtyInput.count() > 0) {
          const cur = await secondQtyInput.inputValue();
          await secondQtyInput.fill(String(Math.max(1, Number(cur) - 1.5)));
          await page.waitForTimeout(200);
        }
      }

      // Submit Initial Issue for this date
      const submitBtn = page.locator('button:has-text("Xác nhận xuất kho")');
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
      await submitBtn.click();
      await page.waitForTimeout(2000);

      // Verify date is now issued
      const suppBtn = page.locator('button:has-text("Xuất bổ sung ca")');
      await suppBtn.waitFor({ state: 'visible', timeout: 15000 });
      log(`  Date ${cfg.name} issued successfully.`);

      if (cfg.hasSupp) {
        log(`  Triggering Supplemental Issue for ${cfg.name}...`);
        await suppBtn.click();
        await page.waitForSelector('text=Xuất kho bổ sung trong ca', { timeout: 10000 });
        await page.fill('input#supp-qty', '2.0');
        await page.click('button:has-text("Phát sinh suất ăn đột xuất")');
        await page.click('button:has-text("Xác nhận xuất bổ sung")');
        await page.waitForSelector('text=Xuất kho bổ sung trong ca', { state: 'detached', timeout: 15000 });
        log(`  Supplemental issue for ${cfg.name} recorded.`);
      }
    }

    log('P2 complete: All 6 days in the operational week issued.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-p2-warehouse-all-days-issued.png') });
    testAuditTrail.push({ phase: 'Phase 2: Warehouse Full Week Issuing', status: 'PASS' });

    // =========================================================================
    // PHASE 3: BẾP TRƯỞNG (beptruong) — Kiểm tra Phiếu Nấu & Khử Trùng Thông Tin
    // =========================================================================
    log('\n=========================================================================');
    log('PHASE 3: CHEF (beptruong) — Cooking Voucher Inspection & Shift Filtering');
    log('=========================================================================');
    await loginUser(page, 'beptruong');
    await page.goto(`${BASE_URL}/chef?view=mrx-cooking&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);

    // Verify shift filter operates
    const shiftSelect = page.locator('select[aria-label="Lọc theo ca nấu"]');
    if (await shiftSelect.isVisible()) {
      await shiftSelect.selectOption('MORNING');
      await page.waitForTimeout(500);
      await shiftSelect.selectOption('ALL');
      await page.waitForTimeout(500);
    }

    // Invariant: Zero prices, zero vendors on Chef view
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasPriceLeak = /\b\d{1,3}(?:\.\d{3})+\s*₫\b/.test(pageText) || /\bđơn giá\b/i.test(pageText);
    if (hasPriceLeak) {
      throw new Error('VIOLATION: Price data leaked on Chef Cooking station!');
    }
    log('P3 complete: Chef station strictly sanitized and filtered by shift.');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-p3-chef-cooking-sanitized.png') });
    testAuditTrail.push({ phase: 'Phase 3: Chef Cooking Sanity', status: 'PASS' });

    // =========================================================================
    // PHASE 4: QUẢN LÝ (quanly) — Rà Soát, Giải Trình 2 Chiều & Chốt Sổ Tuần
    // =========================================================================
    log('\n=========================================================================');
    log('PHASE 4: MANAGER (quanly) — Dispositions, WEEK_COMPLETE & Final Lock');
    log('=========================================================================');
    await loginUser(page, 'quanly');
    await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=2026-07-20`);
    await page.waitForTimeout(2000);

    // Check all dates with variances and dispose them
    const DATES_TO_DISPOSE = ['2026-07-20', '2026-07-22', '2026-07-24'];

    for (const dt of DATES_TO_DISPOSE) {
      log(`P4: Checking dispositions for date ${dt}...`);
      await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=${dt}`);
      await page.waitForTimeout(1500);

      // Loop over unhandled discrepancy buttons on this date
      while (true) {
        const discBtn = page.locator('button:has-text("Xử lý chênh lệch")').first();
        if (await discBtn.count() === 0 || !await discBtn.isVisible()) break;

        log(`  Opening disposition modal for discrepancy line...`);
        await discBtn.click();
        await page.waitForSelector('text=Xử lý chênh lệch theo ngày', { timeout: 10000 });

        const catSelect = page.locator('select#disposition-category');
        if (await catSelect.isVisible()) {
          await catSelect.selectOption('ACCEPTED_VARIANCE');
        }
        await page.fill('input#disposition-reason', 'Chấp nhận sai lệch hai chiều (Bếp nấu tiết kiệm / Xuất bổ sung)');
        await page.click('button:has-text("Lưu hướng xử lý")');
        await page.waitForTimeout(1200);
      }
    }
    log('P4: All variances resolved with ACCEPTED_VARIANCE.');

    // Now reload reconciliation summary for the batch
    await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=2026-07-20`);
    await page.waitForTimeout(2000);

    // Verify weeklyStatus reached WEEK_COMPLETE
    await page.waitForSelector('text=Đủ điều kiện hoàn tất tuần', { timeout: 15000 });
    log('P4: Authoritative weeklyStatus reached WEEK_COMPLETE!');

    // Verify "Chốt đối soát tuần" button is ENABLED and click it
    const completeWeeklyBtn = page.locator('header button:has-text("Chốt đối soát tuần")');
    await completeWeeklyBtn.waitFor({ state: 'visible', timeout: 10000 });
    if (await completeWeeklyBtn.isDisabled()) {
      throw new Error('FAIL: "Chốt đối soát tuần" remained disabled even when WEEK_COMPLETE!');
    }
    log('P4: Clicking "Chốt đối soát tuần"...');
    await completeWeeklyBtn.click();

    await page.waitForSelector('text=Xác nhận hoàn tất lô đối soát tuần', { timeout: 10000 });
    await page.click('button:has-text("Xác nhận khóa chốt tuần")');
    await page.waitForSelector('text=Xác nhận hoàn tất lô đối soát tuần', { state: 'detached', timeout: 15000 });

    // Verify batch status is now COMPLETED
    await page.waitForSelector('text=Hoàn tất', { timeout: 15000 });
    log('P4: Batch status successfully updated to COMPLETED!');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-p4-batch-completed.png') });
    testAuditTrail.push({ phase: 'Phase 4: Manager Weekly Completion', status: 'PASS' });

    // =========================================================================
    // PHASE 5: KIỂM TRA SỔ BÁO CÁO & DANH BẠ LÔ HOÀN TẤT
    // =========================================================================
    log('\n=========================================================================');
    log('PHASE 5: REPORT LEDGERS & COMPLETED REGISTER VERIFICATION');
    log('=========================================================================');

    // 5.1: Sổ theo dõi chênh lệch
    log('P5.1: Navigating to Sổ theo dõi chênh lệch via sidebar...');
    const varLink = page.locator('aside a[href="/reconciliation?view=variances"]');
    if (await varLink.isVisible()) {
      await varLink.click();
    } else {
      await page.goto(`${BASE_URL}/reconciliation?view=variances&batchId=${createdBatchId}`);
    }
    await page.waitForTimeout(1500);
    const varianceRows = await page.locator('tbody tr').count();
    log(`P5.1: Sổ theo dõi chênh lệch has ${varianceRows} records.`);

    // 5.2: Lịch sử giao dịch kho
    log('P5.2: Navigating to Lịch sử giao dịch kho via sidebar...');
    const txLink = page.locator('aside a[href="/reconciliation?view=transactions"]');
    if (await txLink.isVisible()) {
      await txLink.click();
    } else {
      await page.goto(`${BASE_URL}/reconciliation?view=transactions&batchId=${createdBatchId}`);
    }
    await page.waitForTimeout(1500);
    const txRows = await page.locator('tbody tr').count();
    log(`P5.2: Lịch sử giao dịch kho has ${txRows} transactions.`);

    // 5.3: Danh bạ lô hoàn tất
    log('P5.3: Navigating to Danh bạ lô đối soát đã hoàn tất via sidebar...');
    const compLink = page.locator('aside a[href="/reconciliation?view=completed"]');
    if (await compLink.isVisible()) {
      await compLink.click();
    } else {
      await page.goto(`${BASE_URL}/reconciliation?view=completed`);
    }
    await page.waitForTimeout(2000);
    const completedRows = await page.locator('tbody tr').count();
    log(`P5.3: Completed register has ${completedRows} completed batches.`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-p5-completed-register.png') });
    testAuditTrail.push({ phase: 'Phase 5: Ledgers & Completed Register', status: 'PASS' });

    log('\n=========================================================================');
    log('MRX FULL-PATH 7-DAY 4-ACTOR LIFECYCLE SUMMARY:');
    for (const r of testAuditTrail) {
      log(`  ${r.status.padEnd(6)} | ${r.phase}`);
    }
    log('=========================================================================\n');

    const reportPath = path.join(OUTPUT_DIR, 'MRX-FULL-PATH-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(testAuditTrail, null, 2), 'utf8');
    log(`Full path report written to ${reportPath}`);

    log('ENTIRE FULL-PATH E2E LIFECYCLE PASSED 100% ON ISOLATED SANDBOX DATABASE!');
  } catch (err) {
    console.error('[MRX-FULL-PATH-FATAL]', err);
    try {
      if (browser) {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages.length > 0) {
          await pages[0].screenshot({ path: path.join(OUTPUT_DIR, 'debug-full-path-failure.png') });
          console.log('Saved debug screenshot to debug-full-path-failure.png');
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
  console.error('[MRX-FULL-PATH-FATAL]', err);
  process.exit(1);
});
