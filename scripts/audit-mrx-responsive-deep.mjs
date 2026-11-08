import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://127.0.0.1:5173';
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, '.artifacts', 'mrx-responsive-audit');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '1440p_Desktop', width: 1440, height: 900 },
  { name: '1280p_Laptop', width: 1280, height: 800 },
  { name: '1024p_Tablet_Landscape', width: 1024, height: 768 },
  { name: '768p_Tablet_Portrait', width: 768, height: 1024 },
  { name: '390p_Mobile', width: 390, height: 844 },
];

const MRX_STATIONS = [
  { name: '00_Dashboard', path: '/' },
  { name: '01_Coordinator_Batch', path: '/weekly-menu?view=mrx-batch' },
  { name: '02_Warehouse_Daily', path: '/warehouse?view=mrx-daily' },
  { name: '02b_Warehouse_Prep', path: '/warehouse?view=mrx-preparation' },
  { name: '02c_Warehouse_Issues', path: '/warehouse?view=mrx-issues' },
  { name: '03_Chef_Cooking', path: '/chef?view=mrx-cooking' },
  { name: '04a_Reconciliation_Lines', path: '/reconciliation' },
  { name: '04b_Reconciliation_Variances', path: '/reconciliation?view=variances' },
  { name: '04c_Reconciliation_Transactions', path: '/reconciliation?view=transactions' },
  { name: '04d_Reconciliation_Audit', path: '/reconciliation?view=audit' },
  { name: '04e_Reconciliation_Completed', path: '/reconciliation?view=completed' },
];

async function runResponsiveAudit() {
  console.log('========================================================================');
  console.log('     COMPREHENSIVE MRX RESPONSIVE E2E AUDIT & PIXEL VERIFICATION        ');
  console.log('========================================================================\n');

  // Authenticate against real backend
  console.log('>>> [STEP 1: AUTHENTICATION]');
  const loginRes = await fetch('http://127.0.0.1:5262/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const user = loginData.data?.user;
  console.log(`  ✓ Authenticated as ${user?.username} (${user?.roleCode})\n`);

  const browser = await chromium.launch({ headless: true });
  const auditReport = {
    viewportsTested: VIEWPORTS.length,
    stationsTested: MRX_STATIONS.length,
    results: [],
    dateInputIntegrity: [],
    headerHeightIntegrity: [],
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n========================================================================`);
    console.log(`>>> TESTING BREAKPOINT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });

    const page = await context.newPage();

    // Inject auth & MRX mode
    await page.addInitScript(({ tok, usr }) => {
      localStorage.setItem('ipc_v3_token', tok);
      localStorage.setItem('ipc_v3_user', JSON.stringify(usr));
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
      localStorage.setItem('ipc_v3_mode_version', '1');
    }, { tok: token, usr: user });

    for (const station of MRX_STATIONS) {
      const fullUrl = `${BASE_URL}${station.path}`;
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      // Perform measurements
      const metrics = await page.evaluate(() => {
        // 1. Header height
        const header = document.querySelector('header');
        const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : null;

        // 2. Subbar height
        const subbar = document.querySelector('div.h-11, div[class*="TelemetrySubbar"]');
        const subbarHeight = subbar ? Math.round(subbar.getBoundingClientRect().height) : null;

        // 3. Date input measurements
        const dateInput = document.querySelector('input[data-date-locale="vi-VN"], input[aria-label*="Ngày"], input[placeholder="dd/MM/yyyy"]');
        let dateInfo = null;
        if (dateInput) {
          const rect = dateInput.getBoundingClientRect();
          const parent = dateInput.parentElement;
          const parentRect = parent ? parent.getBoundingClientRect() : null;
          dateInfo = {
            value: dateInput.value,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            parentWidth: parentRect ? Math.round(parentRect.width) : null,
            isTruncated: dateInput.scrollWidth > dateInput.clientWidth,
          };
        }

        // 4. DataGrid overflow check
        const table = document.querySelector('table');
        const tableContainer = table ? table.parentElement : null;
        let tableInfo = null;
        if (table && tableContainer) {
          tableInfo = {
            tableWidth: Math.round(table.getBoundingClientRect().width),
            containerWidth: Math.round(tableContainer.getBoundingClientRect().width),
            hasHorizontalScroll: tableContainer.scrollWidth > tableContainer.clientWidth,
          };
        }

        // 5. Check if any body element horizontally overflows window width
        const docWidth = document.documentElement.clientWidth;
        const overflowing = Array.from(document.querySelectorAll('*')).filter(el => {
          if (el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'DIV' && el.id === 'root') return false;
          const r = el.getBoundingClientRect();
          return r.right > docWidth + 2 && !el.closest('.overflow-x-auto') && !el.closest('.no-scrollbar') && !el.closest('table');
        }).length;

        return {
          headerHeight,
          subbarHeight,
          dateInfo,
          tableInfo,
          overflowing,
        };
      });

      // Capture screenshot artifact
      const screenshotFile = `${station.name}_${vp.name}.png`;
      const screenshotPath = path.join(ARTIFACTS_DIR, screenshotFile);
      await page.screenshot({ path: screenshotPath });

      const datePassed = !metrics.dateInfo || (!metrics.dateInfo.isTruncated && metrics.dateInfo.width >= 140);
      const statusIcon = datePassed ? '✓' : '✗';

      console.log(`  ${statusIcon} [${station.name}] Header=${metrics.headerHeight}px | Subbar=${metrics.subbarHeight}px | DateWidth=${metrics.dateInfo?.width ?? 'N/A'}px | DateVal="${metrics.dateInfo?.value ?? 'N/A'}" | Truncated=${metrics.dateInfo?.isTruncated ?? false}`);

      auditReport.results.push({
        viewport: vp.name,
        station: station.name,
        metrics,
        screenshot: screenshotFile,
      });
    }

    await context.close();
  }

  await browser.close();

  // Save report
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'RESPONSIVE-AUDIT-REPORT.json'), JSON.stringify(auditReport, null, 2));

  console.log('\n========================================================================');
  console.log(`AUDIT FINISHED. Tested ${VIEWPORTS.length} viewports x ${MRX_STATIONS.length} stations (${VIEWPORTS.length * MRX_STATIONS.length} captures)`);
  console.log(`Artifacts saved to: ${ARTIFACTS_DIR}`);
  console.log('========================================================================\n');
}

runResponsiveAudit().catch(console.error);
