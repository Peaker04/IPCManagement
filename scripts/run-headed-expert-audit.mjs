import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(REPO_ROOT, '.artifacts', 'headed-live-audit');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = process.env.VITE_URL || 'http://localhost:5173';

const USERS = [
  { username: 'admin', role: 'ADMIN', name: 'Quản trị viên' },
  { username: 'quanly', role: 'MANAGER', name: 'Quản lý' },
  { username: 'dieuphoi', role: 'COORDINATOR', name: 'Điều phối viên' },
  { username: 'thukho', role: 'WAREHOUSE', name: 'Thủ kho' },
  { username: 'beptruong', role: 'CHEF', name: 'Bếp trưởng' },
];

async function runHeadedAudit() {
  console.log('================================================================');
  console.log('STARTING HEADED EXPERT AUDIT ACROSS ALL USER ROLES');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Artifacts Output: ${OUTPUT_DIR}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100, // slight delay so rendering and transitions are clearly visible and stable
  });

  const allFindings = [];

  for (const user of USERS) {
    console.log(`\n>>> [AUDIT] Running for Actor: ${user.name} (${user.username} / ${user.role})`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const consoleMessages = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMessages.push({ type, text: msg.text() });
      }
    });

    page.on('response', async (res) => {
      if (res.status() >= 400) {
        let body = '';
        try {
          body = (await res.text()).slice(0, 300);
        } catch {
          body = '<unreadable body>';
        }
        failedRequests.push({
          status: res.status(),
          method: res.request().method(),
          url: res.url(),
          body,
        });
      }
    });

    // 1. LOGIN
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', user.username);
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    const landingUrl = page.url();
    console.log(`  Landing URL after login: ${landingUrl}`);

    // Snapshot landing
    const landingShot = path.join(OUTPUT_DIR, `${user.username}-01-landing.png`);
    await page.screenshot({ path: landingShot });

    // 2. INSPECT SIDEBAR NAVIGATION
    const navLinks = await page.locator('aside nav a').all();
    const navItems = [];
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      const text = (await link.innerText()).trim();
      navItems.push({ href, text });
    }
    console.log(`  Visible Navigation Links (${navItems.length}):`, navItems.map(n => `${n.text} (${n.href})`).join(' | '));

    // 3. INTERACTIVE NAVIGATION THROUGH EVERY SIDEBAR LINK
    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      if (!item.href || item.href === '#' || item.href.startsWith('javascript:')) continue;

      consoleMessages.length = 0;
      failedRequests.length = 0;

      const clickTarget = page.locator(`aside nav a[href="${item.href}"]`).first();
      if (await clickTarget.isVisible()) {
        await clickTarget.click();
      } else {
        await page.goto(`${BASE_URL}${item.href}`);
      }
      await page.waitForTimeout(800);

      const currentUrl = page.url();
      const h1Text = await page.locator('h1').allTextContents().then(t => t.join(' ')).catch(() => '');
      const alerts = await page.locator('[role="alert"]').allTextContents().then(t => t.join(' | ')).catch(() => '');

      const finding = {
        user: user.username,
        role: user.role,
        navItem: item.text,
        requestedHref: item.href,
        resultUrl: currentUrl.replace(BASE_URL, ''),
        h1: h1Text.trim(),
        alerts: alerts.trim(),
        failedRequests: [...failedRequests],
        consoleMessages: [...consoleMessages],
      };

      allFindings.push(finding);

      const shotName = `${user.username}-nav-${i + 1}-${item.href.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.png`;
      await page.screenshot({ path: path.join(OUTPUT_DIR, shotName) });

      console.log(`  -> Nav: ${item.text.padEnd(25)} | URL: ${finding.resultUrl.padEnd(30)} | H1: "${h1Text.slice(0, 25)}" | Alerts: ${alerts ? alerts.slice(0, 40) : 'None'} | NetErr: ${failedRequests.length} | ConErr: ${consoleMessages.filter(c => c.type === 'error').length}`);
    }

    // 4. TEST DIRECT ACCESS TO ROOT ROUTES WITHOUT QUERY PARAMS
    const rootRoutesToTest = ['/', '/warehouse', '/chef', '/weekly-menu', '/reports'];
    for (const rootRoute of rootRoutesToTest) {
      consoleMessages.length = 0;
      failedRequests.length = 0;

      await page.goto(`${BASE_URL}${rootRoute}`);
      await page.waitForTimeout(800);

      const currentUrl = page.url();
      const h1Text = await page.locator('h1').allTextContents().then(t => t.join(' ')).catch(() => '');
      const alerts = await page.locator('[role="alert"]').allTextContents().then(t => t.join(' | ')).catch(() => '');

      allFindings.push({
        user: user.username,
        role: user.role,
        testType: 'DIRECT_ROOT_ACCESS',
        navItem: `Direct ${rootRoute}`,
        requestedHref: rootRoute,
        resultUrl: currentUrl.replace(BASE_URL, ''),
        h1: h1Text.trim(),
        alerts: alerts.trim(),
        failedRequests: [...failedRequests],
        consoleMessages: [...consoleMessages],
      });

      console.log(`  -> Direct Access: ${rootRoute.padEnd(15)} | Result URL: ${currentUrl.replace(BASE_URL, '').padEnd(25)} | H1: "${h1Text.slice(0, 25)}" | Alerts: ${alerts ? alerts.slice(0, 40) : 'None'} | NetErr: ${failedRequests.length}`);
    }

    await context.close();
  }

  await browser.close();

  // WRITE DETAILED AUDIT REPORT
  const reportPath = path.join(OUTPUT_DIR, 'HEADED-AUDIT-REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(allFindings, null, 2), 'utf-8');
  console.log(`\nAudit completed! Report written to ${reportPath}`);
}

runHeadedAudit().catch((err) => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
