import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5262';
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, '.artifacts', 'expert-audit');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function runExpertFeAudit() {
  console.log('========================================================================');
  console.log('       EXPERT SENIOR FRONTEND AUDIT (F12 NETWORK, CONSOLE & UX)         ');
  console.log('========================================================================\n');

  // Obtain real backend JWT
  console.log('>>> [1/5: AUTHENTICATING AGAINST REAL BACKEND]');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const user = loginData.data?.user;

  if (!token) {
    throw new Error('Failed to obtain real JWT token from Backend!');
  }
  console.log(`  ✓ Authenticated as ${user.username} (${user.roleName}). Token acquired.\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Pre-seed auth & mode
  await context.addInitScript(({ authToken, authUser }) => {
    localStorage.setItem('ipc_v3_token', authToken);
    localStorage.setItem('ipc_v3_user', JSON.stringify(authUser));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, { authToken: token, authUser: user });

  const page = await context.newPage();

  // Audit Logs
  const auditResults = {
    timestamp: new Date().toISOString(),
    networkRequests: [],
    consoleMessages: [],
    scenarioFindings: [],
    performanceMetrics: {},
  };

  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: Date.now(),
    };
    auditResults.consoleMessages.push(entry);
    if (msg.type() === 'error') {
      console.log(`  [F12 CONSOLE ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning' && !msg.text().includes('React Router')) {
      console.log(`  [F12 CONSOLE WARN] ${msg.text()}`);
    }
  });

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/')) {
      req._startTime = Date.now();
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/')) {
      const duration = res.request()._startTime ? Date.now() - res.request()._startTime : 0;
      const status = res.status();
      const method = res.request().method();

      let bodySnippet = '';
      try {
        const text = await res.text();
        bodySnippet = text.slice(0, 300);
      } catch {
        bodySnippet = '<unreadable>';
      }

      const entry = {
        method,
        url: url.replace(BASE_URL, '').replace(BACKEND_URL, ''),
        status,
        durationMs: duration,
        bodySnippet,
      };
      auditResults.networkRequests.push(entry);

      if (status >= 400) {
        console.log(`  [F12 HTTP ${status}] ${method} ${entry.url} (${duration}ms)`);
      }
    }
  });

  // =========================================================================
  // SCENARIO 1: TRẠM 1 (LẬP LÔ MRX) - THAO TÁC ĐỔI KHÁCH HÀNG & ĐỔI NGÀY
  // =========================================================================
  console.log('>>> [2/5: SCENARIO 1 - TRẠM 1: LẬP LÔ MRX INTERACTION]');
  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Measure initial header state
  const step1State = await page.evaluate(() => {
    const customerSelect = document.querySelector('header select[aria-label="Chọn khách hàng MRX"]');
    const dateInput = document.querySelector('input[aria-label="Tuần MRX bắt đầu"]');
    const title = document.querySelector('header h1')?.textContent;
    return {
      title,
      selectedCustomer: customerSelect ? customerSelect.value : null,
      selectedDate: dateInput ? dateInput.value : null,
      emptyStatePresent: Boolean(document.querySelector('[role="status"], [role="alert"]')),
    };
  });
  console.log(`  Header loaded: "${step1State.title}" | Khách hàng: ${step1State.selectedCustomer} | Ngày: ${step1State.selectedDate}`);

  // Test interaction: Change date to week 21/09/2026 (week with published batch)
  console.log('  Testing Interaction: Switching date to 21/09/2026...');
  const dateInput = page.locator('input[aria-label="Tuần MRX bắt đầu"]');
  await dateInput.click();
  await dateInput.fill('21/09/2026');
  await dateInput.press('Enter');
  await page.waitForTimeout(800);

  const step1AfterDateChange = await page.evaluate(() => {
    const batchSummary = document.querySelector('[aria-label="Tiến trình vòng đời lô đối soát"]');
    const primaryButton = document.querySelector('header button.bg-slate-900');
    return {
      hasLifecycleStrip: Boolean(batchSummary),
      primaryButtonText: primaryButton ? primaryButton.textContent?.trim() : null,
    };
  });
  console.log(`  After date change -> Lifecycle Strip: ${step1AfterDateChange.hasLifecycleStrip} | Primary CTA: "${step1AfterDateChange.primaryButtonText}"`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_mrx_batch_interaction.png') });

  // =========================================================================
  // SCENARIO 2: TRẠM 2 (KHO XUẤT NGÀY) - KIỂM CHỨNG ĐỒNG BỘ BỘ LỌC
  // =========================================================================
  console.log('\n>>> [3/5: SCENARIO 2 - TRẠM 2: KHO XUẤT NGÀY & SYNC]');
  // Click sidebar link to go to warehouse daily issue
  const warehouseDailyLink = page.locator('aside a[href*="mrx-daily"]');
  if (await warehouseDailyLink.count() > 0) {
    await warehouseDailyLink.click();
  } else {
    await page.goto(`${BASE_URL}/warehouse?view=mrx-daily`);
  }
  await page.waitForTimeout(800);

  const warehouseState = await page.evaluate(() => {
    const title = document.querySelector('header h1')?.textContent;
    const batchSelect = document.querySelector('header select[aria-label="Chọn lô đối soát xuất kho"]');
    const dateInputEl = document.querySelector('input[aria-label="Ngày xuất kho"]');
    const tableRows = document.querySelectorAll('tbody tr').length;
    const emptyBanner = document.querySelector('[role="status"], [role="alert"]')?.textContent;
    return {
      title,
      selectedBatch: batchSelect ? batchSelect.options[batchSelect.selectedIndex]?.text : null,
      activeDate: dateInputEl ? dateInputEl.value : null,
      tableRows,
      emptyBanner: emptyBanner ? emptyBanner.slice(0, 80) : null,
    };
  });
  console.log(`  Trạm Kho loaded: "${warehouseState.title}" | Lô đang chọn: "${warehouseState.selectedBatch}" | Ngày: ${warehouseState.activeDate}`);
  console.log(`  Bảng xuất kho: ${warehouseState.tableRows} dòng | Banner: ${warehouseState.emptyBanner || 'None'}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_warehouse_daily_sync.png') });

  // =========================================================================
  // SCENARIO 3: TRẠM 4 (ĐỐI SOÁT NGUYÊN LIỆU) - THAO TÁC QUA 5 TẦNG VIEW
  // =========================================================================
  console.log('\n>>> [4/5: SCENARIO 3 - TRẠM 4: ĐỐI SOÁT NGUYÊN LIỆU & BÁO CÁO]');
  await page.goto(`${BASE_URL}/reconciliation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const reconState = await page.evaluate(() => {
    const customerSelect = document.querySelector('header select[aria-label="Chọn khách hàng đối soát"]');
    const batchSelect = document.querySelector('header select[aria-label="Chọn lô đối soát"]');
    const dateInputEl = document.querySelector('input[aria-label="Ngày đối soát"]');
    const emptyTitle = document.querySelector('h3.font-semibold')?.textContent;
    const emptyDesc = document.querySelector('p.text-slate-500')?.textContent;
    return {
      customer: customerSelect ? customerSelect.options[customerSelect.selectedIndex]?.text : null,
      batch: batchSelect ? batchSelect.options[batchSelect.selectedIndex]?.text : null,
      date: dateInputEl ? dateInputEl.value : null,
      emptyTitle,
      emptyDesc: emptyDesc ? emptyDesc.slice(0, 90) : null,
    };
  });
  console.log(`  Trạm Đối soát: Khách hàng: "${reconState.customer}" | Lô: "${reconState.batch}" | Ngày: ${reconState.date}`);
  console.log(`  Trạng thái nội dung: Title="${reconState.emptyTitle}"`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_reconciliation_empty_honest.png') });

  // Test Tab Lịch sử kho (?view=transactions)
  console.log('  Checking Tab: Lịch sử kho (?view=transactions)...');
  await page.goto(`${BASE_URL}/reconciliation?view=transactions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const txState = await page.evaluate(() => {
    const emptyTitle = document.querySelector('h3.font-semibold')?.textContent;
    const tableRows = document.querySelectorAll('tbody tr').length;
    return { emptyTitle, tableRows };
  });
  console.log(`  Tab Lịch sử kho: Empty Title="${txState.emptyTitle}" | Dòng bảng: ${txState.tableRows}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_reconciliation_tx_honest.png') });

  // Test Tab Danh bạ hoàn tất (?view=completed)
  console.log('  Checking Tab: Danh bạ hoàn tất (?view=completed)...');
  await page.goto(`${BASE_URL}/reconciliation?view=completed`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const completedState = await page.evaluate(() => {
    const subtitle = document.querySelector('header span.text-slate-500')?.textContent;
    const tableRows = document.querySelectorAll('tbody tr').length;
    const hasSingleBatchLifecycle = Boolean(document.querySelector('[aria-label="Tiến trình vòng đời lô đối soát"]'));
    return { subtitle, tableRows, hasSingleBatchLifecycle };
  });
  console.log(`  Tab Danh bạ hoàn tất: Subtitle="${completedState.subtitle}" | Số lô đã quyết toán: ${completedState.tableRows} | Stepper đơn lô ẩn: ${!completedState.hasSingleBatchLifecycle}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_reconciliation_completed_purified.png') });

  // =========================================================================
  // SCENARIO 4: ĐO LƯỜNG TỐC ĐỘ SWR RAM CACHE KHI DUYỆT QUA LẠI (0ms REVISIT)
  // =========================================================================
  console.log('\n>>> [5/5: SCENARIO 4 - CHUYỂN TRANG QUA LẠI ĐO SKELETON FLASH]');
  const navigationTrials = [
    { from: 'Danh bạ hoàn tất', to: '/weekly-menu?view=mrx-batch' },
    { from: 'Lập lô MRX', to: '/warehouse?view=mrx-daily' },
    { from: 'Kho xuất ca', to: '/reconciliation' },
    { from: 'Đối soát', to: '/weekly-menu?view=mrx-batch' },
  ];

  for (const trial of navigationTrials) {
    const t0 = Date.now();
    await page.goto(`${BASE_URL}${trial.to}`);
    // Check if skeleton is present synchronously
    const hasSkeleton = await page.evaluate(() => {
      const skel = document.querySelector('[data-loading-geometry], .animate-pulse');
      return Boolean(skel);
    });
    const duration = Date.now() - t0;
    console.log(`  Chuyển sang ${trial.to} -> Thời gian: ${duration}ms | Skeleton flash: ${hasSkeleton ? 'CÓ (FAIL)' : 'KHÔNG (PASS)'}`);
    auditResults.performanceMetrics[trial.to] = { durationMs: duration, hasSkeleton };
  }

  await browser.close();

  // Summary analysis
  const duplicateKeyErrors = auditResults.consoleMessages.filter((m) =>
    m.text.includes('Encountered two children with the same key')
  );
  const fatalErrors = auditResults.consoleMessages.filter((m) => m.type === 'error');
  const failed4xx5xx = auditResults.networkRequests.filter((r) => r.status >= 400);

  console.log('\n========================================================================');
  console.log('                 TỔNG KẾT KIỂM ĐỊNH FE CHUYÊN GIA                       ');
  console.log('========================================================================');
  console.log(`  • Tổng số lỗi F12 Console:        ${fatalErrors.length}`);
  console.log(`  • Lỗi trùng key React:            ${duplicateKeyErrors.length} (Mục tiêu: 0)`);
  console.log(`  • Tổng số request mạng thất bại:  ${failed4xx5xx.length}`);
  console.log(`  • Skeleton flash khi chuyển tab:   ${Object.values(auditResults.performanceMetrics).some((p) => p.hasSkeleton) ? 'CÓ PHÁT HIỆN' : 'ZERO SKELETON (100% Sạch)'}`);
  console.log('========================================================================\n');

  // Save report
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'EXPERT-AUDIT-REPORT.json'),
    JSON.stringify(auditResults, null, 2),
    'utf-8'
  );
}

runExpertFeAudit().catch((err) => {
  console.error('[EXPERT AUDIT FATAL]', err);
  process.exit(1);
});
