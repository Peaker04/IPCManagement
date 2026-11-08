// scripts/audit-mrx-matrix-responsive-deep.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts/mrx-deep-responsive-audit');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1440p-Desktop', width: 1440, height: 900 },
  { name: '1280p-Laptop', width: 1280, height: 800 },
  { name: '1024p-Tablet-Landscape', width: 1024, height: 768 },
  { name: '768p-Tablet-Portrait', width: 768, height: 1024 },
  { name: '390p-Mobile', width: 390, height: 844 },
];

function log(msg) {
  console.log(`[DEEP-RESPONSIVE-AUDIT] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

async function loginUser(page, username = 'admin', password = 'Admin@123456') {
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
  log('Starting Deep Responsive & UI/UX Audit across 5 Device Viewports...');
  const browser = await chromium.launch({ headless: true });

  const auditReport = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.map((v) => v.name),
    checks: [],
    overallStatus: 'UNKNOWN',
  };

  try {
    for (const vp of VIEWPORTS) {
      log(`\n=========================================================================`);
      log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      log(`=========================================================================`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      await loginUser(page, 'admin');

      // -----------------------------------------------------------------------
      // 1. Dashboard: Label wrapping check & Date sorting check
      // -----------------------------------------------------------------------
      log(`[${vp.name}] Checking Dashboard (/)...`);
      await page.goto(`${BASE_URL}/`);
      await page.waitForSelector('table tbody tr', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Check label "Kỳ thời gian:"
      const labelText = await page.locator('span:has-text("Kỳ thời gian:")').innerText();
      const isLabelNowrap = await page.locator('span:has-text("Kỳ thời gian:")').evaluate((el) => {
        return window.getComputedStyle(el).whiteSpace === 'nowrap';
      });
      log(`  Label: "${labelText}", white-space: nowrap: ${isLabelNowrap}`);

      // Check date sorting (descending)
      const dateCells = await page.locator('table tbody tr td:nth-child(3)').allInnerTexts();
      log(`  Batch dates on dashboard: ${dateCells.slice(0, 5).join(', ')}`);

      let isSortedDescending = true;
      for (let i = 0; i < dateCells.length - 1; i++) {
        const partsA = dateCells[i].split('/').map(Number);
        const partsB = dateCells[i + 1].split('/').map(Number);
        const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime();
        const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime();
        if (dateA < dateB) {
          isSortedDescending = false;
          break;
        }
      }
      log(`  Dates sorted strictly descending: ${isSortedDescending}`);

      await page.screenshot({ path: path.join(OUTPUT_DIR, `01-dashboard-${vp.name}.png`) });

      auditReport.checks.push({
        viewport: vp.name,
        screen: 'Dashboard',
        labelNowrap: isLabelNowrap,
        datesSortedDescending: isSortedDescending,
      });

      // -----------------------------------------------------------------------
      // 2. Reconciliation (/reconciliation): Verify 5-badge strip removed
      // -----------------------------------------------------------------------
      log(`[${vp.name}] Checking Reconciliation (/reconciliation)...`);
      await page.goto(`${BASE_URL}/reconciliation`);
      await page.waitForSelector('table', { timeout: 10000 });
      await page.waitForTimeout(1000);

      const hasOldQueueCards = await page.locator('button:has-text("Đổi nguồn chờ duyệt")').count();
      log(`  Old queue badge cards count: ${hasOldQueueCards} (expected 0)`);

      await page.screenshot({ path: path.join(OUTPUT_DIR, `02-reconciliation-${vp.name}.png`) });

      auditReport.checks.push({
        viewport: vp.name,
        screen: 'Reconciliation',
        queueCardsRemoved: hasOldQueueCards === 0,
      });

      // -----------------------------------------------------------------------
      // 3. Weekly Menu MRX Batch (/weekly-menu?view=mrx-batch):
      //    Tabs, Schedule matrix (no servings row), Shift dishes modal
      // -----------------------------------------------------------------------
      log(`[${vp.name}] Checking MRX Batch (/weekly-menu?view=mrx-batch)...`);
      await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch&customerId=b1e40f3e-bda5-4c16-be27-ea7146e10d37&weekStartDate=2026-09-14`);
      await page.waitForSelector('table', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Check Tab labels
      const tabTexts = await page.locator('div[role="tablist"] button').allInnerTexts();
      log(`  Tab labels: ${tabTexts.join(' | ')}`);
      const tabsClean = tabTexts.includes('Thực đơn tuần') && tabTexts.includes('Định lượng nguyên liệu') && tabTexts.includes('Kế hoạch theo ca');

      // Check that "Số suất ăn ca" row is removed from table
      const hasServingsRow = await page.locator('table thead tr th:has-text("Số suất ăn ca")').count();
      log(`  Servings row in schedule table: ${hasServingsRow} (expected 0)`);

      await page.screenshot({ path: path.join(OUTPUT_DIR, `03-mrx-batch-schedule-${vp.name}.png`) });

      // Check Plans Tab & Modal
      const plansTab = page.locator('div[role="tablist"] button:has-text("Kế hoạch theo ca")');
      await plansTab.click();
      await page.waitForTimeout(800);

      const viewDishBtn = page.locator('table tbody tr button:has-text("Xem ma trận món")').first();
      const hasDishBtn = await viewDishBtn.isVisible();
      log(`  Matrix dish button visible in plans tab: ${hasDishBtn}`);

      if (hasDishBtn) {
        await viewDishBtn.click();
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
        await page.waitForTimeout(400);

        // Verify modal is spacious
        const modalBox = await page.locator('div[role="dialog"] > div').boundingBox();
        log(`  Modal dimensions at ${vp.name}: width=${Math.round(modalBox?.width ?? 0)}px, height=${Math.round(modalBox?.height ?? 0)}px`);

        await page.screenshot({ path: path.join(OUTPUT_DIR, `03b-shift-modal-${vp.name}.png`) });
        await page.click('div[role="dialog"] button:has-text("Đóng")');
        await page.waitForTimeout(300);
      }

      auditReport.checks.push({
        viewport: vp.name,
        screen: 'MRX Batch',
        tabsClean,
        servingsRowRemoved: hasServingsRow === 0,
        hasShiftDishesModal: hasDishBtn,
      });

      // -----------------------------------------------------------------------
      // 4. Warehouse Daily (/warehouse?view=mrx-daily): Date tabs & Telemetry
      // -----------------------------------------------------------------------
      log(`[${vp.name}] Checking Warehouse Daily (/warehouse?view=mrx-daily)...`);
      await page.goto(`${BASE_URL}/warehouse?view=mrx-daily`);
      await page.waitForTimeout(1500);

      await page.screenshot({ path: path.join(OUTPUT_DIR, `04-warehouse-daily-${vp.name}.png`) });

      await context.close();
    }

    log(`\n=========================================================================`);
    log(`Deep Responsive & UI/UX Audit Summary`);
    log(`=========================================================================`);
    console.table(auditReport.checks);

    const allPassed = auditReport.checks.every((c) => {
      if (c.screen === 'Dashboard') return c.labelNowrap && c.datesSortedDescending;
      if (c.screen === 'Reconciliation') return c.queueCardsRemoved;
      if (c.screen === 'MRX Batch') return c.tabsClean && c.servingsRowRemoved && c.hasShiftDishesModal;
      return true;
    });

    auditReport.overallStatus = allPassed ? 'PASS' : 'FAIL';
    log(`OVERALL RESPONSIVE AUDIT STATUS: ${auditReport.overallStatus}`);

    const reportPath = path.join(OUTPUT_DIR, 'RESPONSIVE-AUDIT-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    log(`Report written to: ${reportPath}`);

  } finally {
    await browser.close();
  }

  if (auditReport.overallStatus !== 'PASS') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
