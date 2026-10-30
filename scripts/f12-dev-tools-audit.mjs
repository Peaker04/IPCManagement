import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:5173';
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, '.artifacts', 'f12-audit');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function runF12Audit() {
  console.log('========================================================================');
  console.log('       CHROME DEVTOOLS (F12) LIVE NETWORK & CONSOLE AUDIT               ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Create CDP session to emulate exact Chrome DevTools F12 panel
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Network.enable');
  await cdpSession.send('Console.enable');

  const f12Log = {
    consoleErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    domAudits: [],
  };

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`  [F12 CONSOLE ERROR] ${text}`);
      f12Log.consoleErrors.push({ text, location: msg.location() });
    } else if (msg.type() === 'warning') {
      f12Log.consoleWarnings.push({ text, location: msg.location() });
    }
  });

  page.on('pageerror', (err) => {
    console.log(`  [F12 UNCAUGHT EXCEPTION] ${err.message}`);
    f12Log.consoleErrors.push({ text: err.message, stack: err.stack });
  });

  page.on('response', async (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes('/favicon.ico')) {
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        bodyText = '<unreadable>';
      }
      console.log(`  [F12 NETWORK ERROR ${status}] ${res.request().method()} ${url}`);
      f12Log.networkFailures.push({
        status,
        method: res.request().method(),
        url,
        body: bodyText.slice(0, 500),
      });
    }
  });

  // Step 1: Login & inject Material Reconciliation Mode
  console.log('>>> [STEP 1: F12 AUTHENTICATION & REAL JWT INJECTION]');
  const loginRes = await fetch('http://localhost:5262/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
  });
  const loginData = await loginRes.json();
  const realToken = loginData.data?.accessToken;
  const realUser = loginData.data?.user;

  console.log(`  ✓ Obtained real backend JWT token for user: ${realUser?.username}`);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('ipc_v3_token', token);
    localStorage.setItem('ipc_v3_user', JSON.stringify(user));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, { token: realToken, user: realUser });

  const routesToTest = [
    { name: 'Trạm 1: Lập lô MRX', url: '/weekly-menu?view=mrx-batch' },
    { name: 'Trạm 2: Kho xuất ngày', url: '/warehouse?view=mrx-daily' },
    { name: 'Trạm 2b: Chuẩn bị phối hợp', url: '/warehouse?view=mrx-preparation' },
    { name: 'Trạm 2c: Thay đổi nguồn', url: '/warehouse?view=mrx-issues' },
    { name: 'Trạm 3: Bếp nấu ca', url: '/chef?view=mrx-cooking' },
    { name: 'Trạm 4: Đối soát dòng ngày', url: '/reconciliation' },
    { name: 'Trạm 4b: Sổ chênh lệch', url: '/reconciliation?view=variances' },
    { name: 'Trạm 4c: Lịch sử kho', url: '/reconciliation?view=transactions' },
    { name: 'Trạm 4d: Nhật ký kiểm toán', url: '/reconciliation?view=audit' },
    { name: 'Trạm 4e: Danh bạ hoàn tất', url: '/reconciliation?view=completed' },
  ];

  console.log('\n>>> [STEP 2: SCANNING 10 MRX ROUTES VIA F12 DEVTOOLS]');

  for (const r of routesToTest) {
    console.log(`\nTesting Route: ${r.name} (${r.url})...`);
    await page.goto(`${BASE_URL}${r.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Measure Date Input bounding box & icon overlap
    const dateInputInfo = await page.evaluate(() => {
      const input = document.querySelector('input[data-date-locale="vi-VN"]');
      if (!input) return null;
      const inputRect = input.getBoundingClientRect();
      const parent = input.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : null;
      const button = parent ? parent.querySelector('button') : null;
      const buttonRect = button ? button.getBoundingClientRect() : null;
      return {
        inputValue: input.value,
        inputWidth: inputRect.width,
        parentWidth: parentRect ? parentRect.width : 0,
        buttonRight: buttonRect ? buttonRect.right : 0,
        buttonLeft: buttonRect ? buttonRect.left : 0,
        overlapsText: buttonRect ? buttonRect.left < inputRect.left + 100 : false,
      };
    });

    // Check selectors in header
    const selectorsInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('header select'));
      return selects.map((s) => ({
        ariaLabel: s.getAttribute('aria-label') || '',
        value: s.value,
        disabled: s.disabled,
        optionsCount: s.options.length,
        firstOptionText: s.options[0]?.text || '',
      }));
    });

    // Check for raw enums in DOM text
    const rawEnumLeaks = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const banned = [
        'KITCHEN_FROZEN_LINEAGE_MISSING',
        'LEGACY_DAILY_LINEAGE_MISSING',
        'undefined',
        'NaN',
        '[object Object]',
      ];
      return banned.filter((b) => bodyText.includes(b));
    });

    // Screenshot
    const screenshotName = `${r.url.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, screenshotName) });

    f12Log.domAudits.push({
      route: r.name,
      url: r.url,
      dateInputInfo,
      selectorsInfo,
      rawEnumLeaks,
      screenshot: screenshotName,
    });

    console.log(`  ✓ Date Input Width: ${dateInputInfo?.parentWidth}px | Overlaps: ${dateInputInfo?.overlapsText}`);
    console.log(`  ✓ Header Selectors: ${selectorsInfo.map((s) => `[${s.ariaLabel}: ${s.firstOptionText || s.value}]`).join(', ')}`);
    console.log(`  ✓ Raw Enum Leaks: ${rawEnumLeaks.length === 0 ? 'None (Clean)' : rawEnumLeaks.join(', ')}`);
  }

  // Step 3: Test Route Switching Back and Forth to detect Skeleton
  console.log('\n>>> [STEP 3: TESTING BACK-AND-FORTH NAVIGATION FOR SKELETON FLASH]');
  let skeletonFlashDetected = false;

  const routesToSwitch = [
    '/weekly-menu?view=mrx-batch',
    '/warehouse?view=mrx-daily',
    '/reconciliation',
    '/weekly-menu?view=mrx-batch',
  ];

  for (const targetUrl of routesToSwitch) {
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(`${BASE_URL}${targetUrl}`, { waitUntil: 'domcontentloaded' });
    const hadSkeleton = await page.evaluate(() => {
      const skel = document.querySelector('[data-loading-geometry], .animate-pulse');
      return Boolean(skel);
    });
    if (hadSkeleton) {
      console.log(`  ⚠️ Skeleton pulse detected during switch to ${targetUrl}!`);
      skeletonFlashDetected = true;
    } else {
      console.log(`  ✓ 0ms Transition - No Skeleton`);
    }
    await page.waitForTimeout(400);
  }

  await browser.close();

  // Save report
  const reportPath = path.join(ARTIFACTS_DIR, 'F12-AUDIT-REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(f12Log, null, 2), 'utf-8');

  console.log('\n========================================================================');
  console.log(`AUDIT FINISHED. Report saved to: ${reportPath}`);
  console.log(`Total F12 Console Errors: ${f12Log.consoleErrors.length}`);
  console.log(`Total F12 Network Failures: ${f12Log.networkFailures.length}`);
  console.log('========================================================================\n');
}

runF12Audit().catch((err) => {
  console.error('[F12 AUDIT FATAL]', err);
  process.exit(1);
});
