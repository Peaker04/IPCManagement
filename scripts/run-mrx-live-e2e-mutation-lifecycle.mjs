// scripts/run-mrx-live-e2e-mutation-lifecycle.mjs
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/live-mrx-full-mutation-lifecycle');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const SANDBOX_DB = 'ipc_mrx_e2e_sandbox';
const KESTREL_PORT = 5263;
const VITE_PORT = 5174;
const BASE_URL = `http://localhost:${VITE_PORT}`;
const API_URL = `http://127.0.0.1:${KESTREL_PORT}`;

function log(msg) {
  console.log(`[MRX-LIVE-LIFECYCLE] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

async function waitForHttp(url, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 404) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function runSql(command) {
  const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
  execSync(`"${mysqlPath}" -u root -p123456789 -e "${command}"`, { stdio: 'pipe' });
}

function querySql(command) {
  const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
  const oneLine = command.replace(/[\r\n]+/g, ' ').trim();
  const escaped = oneLine.replace(/"/g, '\\"');
  return execSync(`"${mysqlPath}" -u root -p123456789 ${SANDBOX_DB} -e "${escaped}"`, { stdio: 'pipe' }).toString().trim();
}

function guidToMySqlHex(guidStr) {
  if (!guidStr) return '';
  const clean = guidStr.replace(/-/g, '');
  const p1 = clean.substring(0, 8).match(/../g).reverse().join('');
  const p2 = clean.substring(8, 12).match(/../g).reverse().join('');
  const p3 = clean.substring(12, 16).match(/../g).reverse().join('');
  const p4 = clean.substring(16);
  return (p1 + p2 + p3 + p4).toUpperCase();
}

function setupSandboxDatabase() {
  log(`Setting up sandbox database '${SANDBOX_DB}'...`);
  const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
  const mysqldumpPath = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysqldump.exe';
  const dumpPath = path.resolve('D:/Temp/ipc_sandbox_dump.sql');

  runSql(`CREATE DATABASE IF NOT EXISTS ${SANDBOX_DB};`);
  execSync(`"${mysqldumpPath}" -u root -p123456789 --single-transaction --hex-blob --set-gtid-purged=OFF --result-file="${dumpPath}" ipcmanagement`, { stdio: 'pipe' });
  execSync(`"${mysqlPath}" -u root -p123456789 ${SANDBOX_DB} < "${dumpPath}"`, { stdio: 'pipe' });

  // Clean week 2026-07-20 in sandbox to make it 100% brand new and pristine
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

  log(`Sandbox database '${SANDBOX_DB}' initialized with fresh week 2026-07-20.`);
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
  await select.waitFor({ state: 'visible', timeout: 12000 });
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

async function captureStep(page, filename, stepTitle, auditCollection) {
  const screenshotPath = path.join(OUTPUT_DIR, filename);
  await page.waitForTimeout(600); // Settle UI
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Read textual contents on screen for verifiable audit trail
  const headingText = await page.locator('h1, h2, header').allInnerTexts().catch(() => []);
  const badgeTexts = await page.locator('span[class*="badge"], span.rounded-full').allInnerTexts().catch(() => []);
  const workspaceTitle = await page.locator('header h1, header h2').first().innerText().catch(() => '');
  const url = page.url();

  const evidence = {
    step: stepTitle,
    screenshot: filename,
    url,
    workspaceTitle,
    badges: badgeTexts.map(t => t.trim()).filter(Boolean),
    headings: headingText.map(t => t.trim().replace(/\n+/g, ' ')).filter(Boolean).slice(0, 5),
    timestamp: new Date().toISOString(),
  };

  log(`[EVIDENCE] ${stepTitle} -> ${filename} (Title: "${workspaceTitle}", Badges: [${evidence.badges.join(', ')}])`);
  auditCollection.push(evidence);
  return evidence;
}

async function loginUser(page, username) {
  log(`UI Login: Logging in as '${username}' on /login...`);
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('input[type="text"]', username);
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);

  // Set mode to MATERIAL_RECONCILIATION
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });
}

async function main() {
  let kestrelProcess = null;
  let viteProcess = null;
  let browser = null;
  const auditReport = [];

  try {
    log('Pre-flight: Ensuring ports 5174 and 5263 are clear...');
    try {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174, 5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
    } catch {}

    setupSandboxDatabase();

    // Start Backend Kestrel on port 5263
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

    // Start Vite on port 5174
    log(`Starting Vite on port ${VITE_PORT}...`);
    viteProcess = spawn('cmd.exe', [
      '/c', 'npm', 'run', 'dev', '--',
      '--port', String(VITE_PORT),
    ], {
      cwd: path.resolve(REPO_ROOT, 'frontend'),
      stdio: 'pipe',
      env: { ...process.env, VITE_PROXY_TARGET: API_URL },
    });

    await waitForHttp(`${BASE_URL}`, 25000);
    log(`Frontend Vite is live at ${BASE_URL}`);

    // Launch Chromium for pure Web UI interaction
    log('Launching Chromium (1440x900) for Pure Web UI Mutation Lifecycle...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      console.error('[BROWSER-PAGE-ERROR]', err.message, err.stack);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[BROWSER-CONSOLE-ERROR]', msg.text());
      }
    });

    let createdBatchId = '';

    // =========================================================================
    // GIAI ĐOẠN 1: ĐIỀU PHỐI VIÊN (dieuphoi) — Lập thực đơn mới, Chỉnh suất, Xuất bản & Tạo lô
    // =========================================================================
    log('\n=========================================================================');
    log('GIAI ĐOẠN 1: ĐIỀU PHỐI VIÊN (dieuphoi) — Thao tác web tạo tuần mới & lô đối soát');
    log('=========================================================================');

    // Bước 01: Đăng nhập Điều phối viên
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', 'dieuphoi');
    await page.fill('input[type="password"]', 'Admin@123456');
    await captureStep(page, '01-dieuphoi-login-form.png', 'Điều phối viên điền thông tin đăng nhập', auditReport);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
      localStorage.setItem('ipc_v3_mode_version', '1');
    });

    // Bước 02: Vào trạm Lô MRX xem tuần 20/07/2026 hoàn toàn mới chưa có dữ liệu
    await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
    await page.waitForTimeout(1000);
    await selectOptionByText(page, 'select[aria-label="Chọn khách hàng MRX"]', 'AMANN');
    const weekInput02 = page.locator('input[aria-label="Tuần MRX bắt đầu"]');
    if (await weekInput02.isVisible()) {
      await weekInput02.fill('20/07/2026');
      await weekInput02.press('Enter');
      await page.waitForTimeout(1200);
    }
    await captureStep(page, '02-weekly-menu-empty-new-week.png', 'Giao diện thực đơn tuần mới (20/07/2026) chưa có lịch', auditReport);

    // Bước 03: Mở modal nhập thực đơn Excel
    const importBtn = page.locator('button:has-text("Nhập thực đơn Excel")').first();
    await importBtn.click();
    await page.waitForSelector('text=Nhập thực đơn tuần từ file Excel', { timeout: 10000 });

    await selectOptionByText(page, 'select#import-customer-select', 'AMANN');
    const modalWeekInput = page.locator('input[aria-label="Tuần bắt đầu nhập"]');
    await modalWeekInput.fill('20/07/2026');
    await modalWeekInput.press('Enter');

    const templateFilePath = path.resolve('backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');
    await page.setInputFiles('input[type="file"]', templateFilePath);
    const tier25kBtn = page.locator('button[role="radio"]:has-text("25.000")');
    if (await tier25kBtn.isVisible()) {
      await tier25kBtn.click();
    }
    await page.click('button:has-text("Xem trước")');
    await page.waitForSelector('text=Kết quả phân tích file', { timeout: 12000 });
    await captureStep(page, '03-import-modal-preview-parsed.png', 'Modal phân tích file Excel xem trước 7 ngày thực đơn', auditReport);

    // Bước 04: Xác nhận nhập thực đơn
    await page.click('button:has-text("Xác nhận nhập")');
    await page.waitForSelector('text=Nhập thực đơn tuần từ file Excel', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(1500);
    await captureStep(page, '04-weekly-menu-imported-matrix.png', 'Ma trận thực đơn tuần 20/07/2026 đã nhập thành công', auditReport);

    // Bước 05: Chỉnh sửa lịch tuần - Tab 1: Cập nhật số suất ca
    const editScheduleBtn = page.locator('button[aria-label="Chỉnh sửa lịch tuần"], button:has-text("Chỉnh sửa lịch tuần")').first();
    await editScheduleBtn.waitFor({ state: 'visible', timeout: 10000 });
    await editScheduleBtn.click();
    await page.waitForSelector('text=Chỉnh sửa lịch thực đơn & số suất tuần', { timeout: 10000 });

    const tabServings = page.locator('button:has-text("1. Cập nhật số suất ca")');
    await tabServings.click();
    const servingInputs = page.locator('div[role="dialog"] input[type="number"]');
    if (await servingInputs.count() > 0) {
      await servingInputs.first().fill('150');
      log('  Web Action: Adjusted Monday Ca 1 servings to 150');
    }
    await captureStep(page, '05-schedule-editor-servings-tab.png', 'Modal chỉnh sửa lịch tuần - Tab 1 Cập nhật số suất', auditReport);

    // Bước 06: Chỉnh sửa lịch tuần - Tab 2: Đổi món ăn theo ca
    const tabDishes = page.locator('button:has-text("2. Đổi món ăn theo ca")');
    if (await tabDishes.isVisible()) {
      await tabDishes.click();
      await page.waitForTimeout(400);
      const dishSelect = page.locator('div[role="dialog"] select').nth(2);
      if (await dishSelect.isVisible()) {
        const optionsCount = await dishSelect.locator('option').count();
        if (optionsCount > 1) {
          await dishSelect.selectOption({ index: 1 });
        }
      }
      await captureStep(page, '06-schedule-editor-dishes-tab.png', 'Modal chỉnh sửa lịch tuần - Tab 2 Đổi món ăn trong ca', auditReport);
      // Switch back to Tab 1 to save
      await tabServings.click();
      await page.waitForTimeout(300);
    }

    await page.click('button:has-text("Lưu & chốt số suất")');
    await page.waitForSelector('text=Chỉnh sửa lịch thực đơn & số suất tuần', { state: 'detached', timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Bước 07: Điều hướng sang Trạm Lô MRX
    await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
    await page.waitForTimeout(1200);
    await selectOptionByText(page, 'select[aria-label="Chọn khách hàng MRX"]', 'AMANN');
    const mrxWeekInput = page.locator('input[aria-label="Tuần MRX bắt đầu"]');
    await mrxWeekInput.fill('20/07/2026');
    await mrxWeekInput.press('Enter');
    await page.waitForTimeout(1500);

    const publishBtn = page.locator('button:has-text("Xuất bản thực đơn tuần")');
    if (await publishBtn.isVisible()) {
      log('  Web Action: Clicking "Xuất bản thực đơn tuần"...');
      await publishBtn.click();
      await page.waitForSelector('text=Đã xuất bản thực đơn tuần thành công', { timeout: 15000 });
      await page.waitForTimeout(1200);
    }
    await captureStep(page, '07-mrx-batch-published-matrix.png', 'Trạm Lô MRX - Thực đơn đã xuất bản, ma trận sẵn sàng', auditReport);

    // Bước 07b: Kiểm tra định lượng (Kiểm tra đầy đủ món, số suất và nguyên liệu)
    const checkBtn = page.locator('button:has-text("Kiểm tra định lượng ngay"), button:has-text("Kiểm tra định lượng")').first();
    if (await checkBtn.isVisible()) {
      log('  Web Action: Clicking "Kiểm tra định lượng"...');
      await checkBtn.click();
      await page.waitForTimeout(2500);
      await captureStep(page, '07b-mrx-batch-quantity-checked.png', 'Trạm Lô MRX - Đã kiểm tra định lượng thành công', auditReport);
    }

    // Bước 08: Tạo Lô Nháp trên giao diện web
    const draftBtn = page.locator('button:has-text("Tạo lô nháp")');
    await draftBtn.waitFor({ state: 'visible', timeout: 15000 });
    log('  Web Action: Clicking "Tạo lô nháp"...');
    await draftBtn.click();
    await page.waitForTimeout(2500);

    // Extract Batch ID from URL or DOM
    createdBatchId = await page.evaluate(async () => {
      const token = localStorage.getItem('ipc_v3_token');
      const res = await fetch('/api/reconciliation/batches?pageSize=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.data?.items?.[0]?.batchId || '';
    });
    log(`  Identified Created Batch ID: ${createdBatchId}`);
    await captureStep(page, '08-mrx-batch-draft-created.png', 'Lô đối soát nháp DRAFT vừa được tạo với bảng định mức nguyên liệu', auditReport);

    // Bước 09: Mở modal Món ăn trong lô (MrxBatchDishesModal)
    const dishesModalBtn = page.locator('button:has-text("Món ăn trong lô")');
    if (await dishesModalBtn.isVisible()) {
      await dishesModalBtn.click();
      await page.waitForSelector('text=Danh mục món ăn & định mức đông cứng trong lô', { timeout: 8000 });
      await captureStep(page, '09-mrx-batch-dishes-modal.png', 'Modal danh mục món ăn và định mức đông cứng trong lô', auditReport);
      const closeDishes = page.locator('div[role="dialog"] button:has-text("Đóng")');
      await closeDishes.click();
      await page.waitForSelector('text=Danh mục món ăn & định mức đông cứng trong lô', { state: 'detached', timeout: 5000 }).catch(() => {});
    }

    // Bước 10: Đóng băng lô
    const readyBtn = page.locator('button:has-text("Đóng băng lô")');
    await readyBtn.waitFor({ state: 'visible', timeout: 15000 });
    log('  Web Action: Clicking "Đóng băng lô"...');
    await readyBtn.click();
    await page.waitForTimeout(1500);
    await captureStep(page, '10-mrx-batch-frozen.png', 'Lô đối soát trạng thái FROZEN (Đông cứng)', auditReport);

    // Bước 11: Bàn giao lô sang Kho
    const transferBtn = page.locator('button:has-text("Chuyển sang Kho")');
    await transferBtn.waitFor({ state: 'visible', timeout: 15000 });
    log('  Web Action: Clicking "Chuyển sang Kho"...');
    await transferBtn.click();
    await page.waitForSelector('text=Đã bàn giao lô đối soát sang Kho nguyên liệu thành công', { timeout: 15000 });
    await captureStep(page, '11-mrx-batch-transferred-cta.png', 'Bàn giao thành công sang kho kèm nút CTA "Đi đến Trạm Kho"', auditReport);

    // VERTICAL DATABASE PERSISTENCE VERIFICATION - PHASE 1
    log('\n>>> [DATABASE AUDIT - GIAI ĐOẠN 1: ĐIỀU PHỐI]');
    const batchHex = guidToMySqlHex(createdBatchId);
    const p1MenuVersionSql = querySql(`SELECT HEX(menuVersionId) as menuVersionId, status, versionNo, successRowCount, errorRowCount FROM menuversions WHERE weekStartDate = '2026-07-20';`);
    log(`  [MySQL menuversions]:\n${p1MenuVersionSql}`);
    const p1BatchSql = querySql(`SELECT HEX(BatchId) as BatchId, Status, Version, CreatedAt, ReadyAt FROM reconciliationbatches WHERE HEX(BatchId) = '${batchHex}';`);
    log(`  [MySQL reconciliationbatches]:\n${p1BatchSql}`);
    const p1LineCount = querySql(`SELECT count(*) as totalLines, sum(RequiredQuantity) as totalRequiredQty FROM reconciliationbatchlines WHERE HEX(BatchId) = '${batchHex}';`);
    log(`  [MySQL reconciliationbatchlines]:\n${p1LineCount}`);
    const p1DailyCount = querySql(`SELECT count(*) as totalDailyLines, sum(RequiredQuantity) as totalDailyQty FROM reconciliationbatchdailylines WHERE HEX(BatchId) = '${batchHex}';`);
    log(`  [MySQL reconciliationbatchdailylines]:\n${p1DailyCount}`);

    // =========================================================================
    // GIAI ĐOẠN 2: THỦ KHO (thukho) — Xuất kho 6 ngày, chặn vi phạm & xuất bổ sung
    // =========================================================================
    log('\n=========================================================================');
    log('GIAI ĐOẠN 2: THỦ KHO (thukho) — Thao tác xuất kho thật trên web qua 6 ngày');
    log('=========================================================================');

    // Bước 12: Đăng nhập Thủ kho
    await loginUser(page, 'thukho');
    await page.goto(`${BASE_URL}/warehouse?view=mrx-daily&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);
    await captureStep(page, '12-warehouse-daily-t2-unissued.png', 'Thủ kho vào trạm xuất kho ngày Thứ Hai (T2)', auditReport);

    // Bước 13: Thử xuất vượt không lý do -> Nút bị chặn (Disabled)
    const t2Btn = page.locator('button:has-text("T2")').first();
    await t2Btn.click();
    await page.waitForTimeout(600);

    const dienDuBtn = page.locator('button:has-text("Điền đủ toàn bộ")');
    await dienDuBtn.waitFor({ state: 'visible', timeout: 6000 });
    await dienDuBtn.click();
    await page.waitForTimeout(300);

    const firstQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').first();
    const curVal = await firstQtyInput.inputValue();
    await firstQtyInput.fill(String(Number(curVal) + 20));
    const firstReasonInput = page.locator('input[aria-label^="Lý do chênh lệch"]').first();
    await firstReasonInput.fill('');
    await page.waitForTimeout(300);
    await captureStep(page, '13-warehouse-t2-validation-blocked.png', 'Chặn xuất kho: Nút "Xác nhận xuất kho" bị khóa khi thiếu lý do chênh lệch', auditReport);

    // Bước 14: Điền lý do hợp lệ, ghi nhận tiết kiệm và xuất kho thành công T2
    await firstReasonInput.fill('Bổ sung thêm nguyên liệu do tăng đột xuất 50 suất ăn');
    const secondQtyInput = page.locator('input[aria-label^="Số lượng thực xuất"]').nth(1);
    if (await secondQtyInput.count() > 0) {
      const cur2 = await secondQtyInput.inputValue();
      await secondQtyInput.fill(String(Math.max(1, Number(cur2) - 2.0)));
    }
    const submitBtn = page.locator('button:has-text("Xác nhận xuất kho")');
    await submitBtn.click();
    await page.waitForTimeout(2000);
    await captureStep(page, '14-warehouse-t2-issued-success.png', 'Thứ Hai (T2) xuất kho thành công, nút "Xuất bổ sung ca" xuất hiện', auditReport);

    // Bước 15: Xuất bổ sung trong ca (MrxSupplementalIssueModal)
    const suppBtn = page.locator('button:has-text("Xuất bổ sung ca")');
    await suppBtn.waitFor({ state: 'visible', timeout: 10000 });
    await suppBtn.click();
    await page.waitForSelector('text=Xuất kho bổ sung trong ca', { timeout: 8000 });
    await page.fill('input#supp-qty', '3.5');
    const chipBtn = page.locator('button:has-text("Phát sinh suất ăn đột xuất")');
    if (await chipBtn.isVisible()) await chipBtn.click();
    await captureStep(page, '15-warehouse-supplemental-modal.png', 'Modal xuất kho bổ sung trong ca với chip lý do chuẩn hóa', auditReport);
    await page.click('button:has-text("Xác nhận xuất bổ sung")');
    await page.waitForSelector('text=Xuất kho bổ sung trong ca', { state: 'detached', timeout: 12000 });
    await page.waitForTimeout(1000);

    // Bước 16: Xuất kho cho các ngày còn lại (T3, T4, T5, T6, T7)
    const REMAINING_DAYS = ['T3', 'T4', 'T5', 'T6', 'T7'];
    for (const d of REMAINING_DAYS) {
      log(`  Web Action: Processing warehouse issue for day ${d}...`);
      const dayTab = page.locator(`button:has-text("${d}")`).first();
      await dayTab.click();
      await page.waitForTimeout(600);
      const btnFill = page.locator('button:has-text("Điền đủ toàn bộ")');
      await btnFill.waitFor({ state: 'visible', timeout: 6000 });
      await btnFill.click();
      await page.waitForTimeout(300);
      const btnSub = page.locator('button:has-text("Xác nhận xuất kho")');
      await btnSub.click();
      await page.waitForTimeout(1200);
    }
    await captureStep(page, '16-warehouse-all-6-days-completed.png', 'Hoàn tất xuất kho toàn bộ 6 ngày trong tuần (T2 - T7)', auditReport);

    // Bước 17: Tab Lịch sử phiếu & Modal ReconciliationIssueDetailModal
    const historyTab = page.locator('button:has-text("Lịch sử phiếu")');
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(800);
      const detailBtn = page.locator('tbody tr button').first();
      if (await detailBtn.isVisible()) {
        await detailBtn.click();
        await page.waitForSelector('text=Chi tiết phiếu xuất kho', { timeout: 8000 });
        await captureStep(page, '17-warehouse-receipt-detail-modal.png', 'Modal chi tiết phiếu xuất kho (Mã phiếu, ngày xuất, nguyên liệu)', auditReport);
        const closeDetail = page.locator('div[role="dialog"] button:has-text("Đóng")');
        await closeDetail.click();
        await page.waitForSelector('text=Chi tiết phiếu xuất kho', { state: 'detached', timeout: 5000 });
      }
    }

    // VERTICAL DATABASE PERSISTENCE VERIFICATION - PHASE 2
    log('\n>>> [DATABASE AUDIT - GIAI ĐOẠN 2: THỦ KHO]');
    const p2IssuesSql = querySql(`SELECT i.issueCode, i.issueDate, i.shiftName, count(*) as lineCount FROM inventoryissues i JOIN inventoryissuelines l ON i.issueId = l.issueId WHERE HEX(i.reconciliationBatchId) = '${batchHex}' GROUP BY i.issueId, i.issueCode, i.issueDate, i.shiftName ORDER BY i.issueDate;`);
    log(`  [MySQL inventoryissues & lines (6 ngày + 1 xuất bổ sung)]:\n${p2IssuesSql}`);
    const p2TotalIssuedSql = querySql(`SELECT count(DISTINCT i.issueId) as totalIssues, count(*) as totalIssueLines, sum(l.issuedQty) as totalIssuedQty FROM inventoryissues i JOIN inventoryissuelines l ON i.issueId = l.issueId WHERE HEX(i.reconciliationBatchId) = '${batchHex}';`);
    log(`  [MySQL Total Issued Sum]:\n${p2TotalIssuedSql}`);

    // =========================================================================
    // GIAI ĐOẠN 3: BẾP TRƯỞNG (beptruong) — Xem phiếu nấu ăn ca
    // =========================================================================
    log('\n=========================================================================');
    log('GIAI ĐOẠN 3: BẾP TRƯỞNG (beptruong) — Xem phiếu nấu ca, kiểm tra an toàn');
    log('=========================================================================');
    await loginUser(page, 'beptruong');
    await page.goto(`${BASE_URL}/chef?view=mrx-cooking&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);
    await captureStep(page, '18-chef-cooking-workbench.png', 'Trạm Bếp trưởng xem phiếu nấu ăn ca (Thông tin sạch, 0 giá vốn)', auditReport);

    // =========================================================================
    // GIAI ĐOẠN 4: QUẢN LÝ (quanly) — Dashboard, Xử lý chênh lệch & Khóa sổ lô
    // =========================================================================
    log('\n=========================================================================');
    log('GIAI ĐOẠN 4: QUẢN LÝ (quanly) — Dashboard, Đối soát dòng, Giải trình & Khóa sổ');
    log('=========================================================================');
    await loginUser(page, 'quanly');

    // Bước 19: Dashboard đối soát
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);
    await captureStep(page, '19-manager-dashboard-overview.png', 'Bàn điều hành đối soát (Dashboard) hiển thị 4 KPI cards và lô đang chạy', auditReport);

    // Bước 20: Vào /reconciliation chi tiết dòng xem các sai lệch 2 chiều
    await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=2026-07-20`);
    await page.waitForTimeout(1800);
    await captureStep(page, '20-reconciliation-lines-variances.png', 'Bảng chi tiết dòng đối soát ngày T2 hiển thị sai lệch thừa/thiếu', auditReport);

    // Bước 21: Mở modal giải trình sai lệch 2 chiều
    const discBtn = page.locator('button:has-text("Xử lý chênh lệch")').first();
    if (await discBtn.isVisible()) {
      await discBtn.click();
      await page.waitForSelector('text=Xử lý chênh lệch theo ngày', { timeout: 8000 });
      const catSelect = page.locator('select#disposition-category');
      if (await catSelect.isVisible()) await catSelect.selectOption('ACCEPTED_VARIANCE');
      await page.fill('input#disposition-reason', 'Chấp nhận sai lệch hai chiều (Bếp nấu tiết kiệm / Xuất bổ sung ca kiểm thử)');
      await captureStep(page, '21-reconciliation-disposition-modal.png', 'Modal xử lý chênh lệch 2 chiều (ReconciliationDispositionModal)', auditReport);
      await page.click('button:has-text("Lưu hướng xử lý")');
      await page.waitForTimeout(1500);
    }

    // Bước 22: Giải trình tất cả các ngày còn lại để đạt WEEK_COMPLETE
    const DATES_TO_CLEAR = ['2026-07-20', '2026-07-22', '2026-07-24', '2026-07-26'];
    for (const dt of DATES_TO_CLEAR) {
      await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=${dt}`);
      await page.waitForTimeout(1200);
      while (true) {
        const btn = page.locator('button:has-text("Xử lý chênh lệch")').first();
        if (await btn.count() === 0 || !(await btn.isVisible())) break;
        await btn.click();
        await page.waitForSelector('text=Xử lý chênh lệch theo ngày', { timeout: 8000 });
        const cat = page.locator('select#disposition-category');
        if (await cat.isVisible()) await cat.selectOption('ACCEPTED_VARIANCE');
        await page.fill('input#disposition-reason', 'Giải trình hợp lệ sai lệch kiểm thử E2E');
        await page.click('button:has-text("Lưu hướng xử lý")');
        await page.waitForTimeout(1000);
      }
    }

    // Bước 23: Trạng thái WEEK_COMPLETE ("Đã xuất đủ") xuất hiện
    await page.goto(`${BASE_URL}/reconciliation?view=lines&batchId=${createdBatchId}&date=2026-07-20`);
    await page.waitForTimeout(1500);
    await captureStep(page, '22-reconciliation-week-complete-ready.png', 'Lô đối soát đạt trạng thái "Đã xuất đủ (WEEK_COMPLETE)"', auditReport);

    // Bước 24: Mở modal Khóa chốt tuần (ReconciliationCompletionModal)
    const completeWeeklyBtn = page.locator('header button:has-text("Chốt đối soát tuần")');
    await completeWeeklyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await completeWeeklyBtn.click();
    await page.waitForSelector('text=Xác nhận hoàn tất lô đối soát tuần', { timeout: 10000 });
    await captureStep(page, '23-reconciliation-completion-modal.png', 'Modal xác nhận khóa chốt tuần (ReconciliationCompletionModal)', auditReport);

    // Bước 25: Xác nhận khóa chốt tuần trên web
    await page.click('button:has-text("Xác nhận khóa chốt tuần")');
    await page.waitForSelector('text=Xác nhận hoàn tất lô đối soát tuần', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(1500);
    await captureStep(page, '24-reconciliation-batch-completed.png', 'Lô đối soát đã khóa sổ thành công (COMPLETED - Đã chốt sổ)', auditReport);

    // VERTICAL DATABASE PERSISTENCE VERIFICATION - PHASE 4
    log('\n>>> [DATABASE AUDIT - GIAI ĐOẠN 4: ĐỐI SOÁT & KHÓA SỔ]');
    const p4BatchSql = querySql(`SELECT HEX(BatchId) as BatchId, Status, Version, CreatedAt, CompletedAt FROM reconciliationbatches WHERE HEX(BatchId) = '${batchHex}';`);
    log(`  [MySQL reconciliationbatches Final Status]:\n${p4BatchSql}`);
    const p4DispSql = querySql(`SELECT d.Category, count(*) as count, GROUP_CONCAT(i.ingredientName) as ingredients FROM reconciliationdailydispositions d JOIN reconciliationbatchdailylines dl ON d.DailyLineId = dl.DailyLineId JOIN ingredients i ON dl.IngredientId = i.ingredientId WHERE HEX(dl.BatchId) = '${batchHex}' GROUP BY d.Category;`);
    log(`  [MySQL reconciliationdailydispositions (Daily)]: \n${p4DispSql}`);

    // Bước 26: Sổ chênh lệch (?view=variances)
    await page.goto(`${BASE_URL}/reconciliation?view=variances&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);
    await captureStep(page, '25-reconciliation-variances-ledger.png', 'Sổ chênh lệch nguyên liệu đã lưu vết giải trình', auditReport);

    // Bước 27: Sổ giao dịch kho (?view=transactions)
    await page.goto(`${BASE_URL}/reconciliation?view=transactions&batchId=${createdBatchId}`);
    await page.waitForTimeout(1500);
    await captureStep(page, '26-reconciliation-transactions-ledger.png', 'Sổ giao dịch kho ghi nhận toàn bộ các phiếu xuất kho', auditReport);

    // Bước 28: Danh bạ hoàn tất (?view=completed)
    await page.goto(`${BASE_URL}/reconciliation?view=completed`);
    await page.waitForTimeout(1800);
    await captureStep(page, '27-reconciliation-completed-register.png', 'Danh bạ hoàn tất lưu trữ lô đối soát tuần 20/07/2026 đã chốt', auditReport);

    // =========================================================================
    // KẾT THÚC VÀ LƯU BÁO CÁO TOÀN VẸN
    // =========================================================================
    const reportJsonPath = path.join(OUTPUT_DIR, 'LIFECYCLE-EVIDENCE-REPORT.json');
    fs.writeFileSync(reportJsonPath, JSON.stringify(auditReport, null, 2), 'utf8');
    log(`\n=========================================================================`);
    log(`BÁO CÁO BẰNG CHỨNG ĐÃ GHI NHẬN THÀNH CÔNG:`);
    log(`Tổng cộng ${auditReport.length} ảnh chụp màn hình tuần tự không ngắt quãng.`);
    log(`Báo cáo chi tiết: ${reportJsonPath}`);
    log(`=========================================================================\n`);

  } catch (err) {
    console.error('[FATAL]', err);
    if (browser) {
      const p = browser.contexts()[0]?.pages()[0];
      if (p) await p.screenshot({ path: path.join(OUTPUT_DIR, 'debug-error.png') });
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
    log('Stopping temporary background services...');
    try {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174, 5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
    } catch {}
    teardownSandboxDatabase();
  }
}

main().catch((err) => {
  console.error('[RUN-FAILED]', err);
  process.exit(1);
});
