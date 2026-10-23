// scripts/inspect-ui-reality.mjs
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

const ROLES = [
  { username: 'admin', role: 'ADMIN' },
  { username: 'quanly', role: 'MANAGER' },
  { username: 'dieuphoi', role: 'COORDINATOR' },
  { username: 'thukho', role: 'WAREHOUSE' },
  { username: 'beptruong', role: 'CHEF' },
];

const ROUTES = [
  '/',
  '/weekly-menu',
  '/weekly-menu?view=mrx-batch',
  '/warehouse',
  '/warehouse?view=mrx-daily',
  '/warehouse?view=mrx-preparation',
  '/warehouse?view=mrx-issues',
  '/chef',
  '/chef?view=mrx-cooking',
  '/reconciliation',
  '/reconciliation?view=lines',
  '/reconciliation?view=variances',
  '/reconciliation?view=transactions',
  '/reconciliation?view=audit',
  '/reconciliation?view=completed',
  '/reports',
  '/reports?view=demand',
  '/reports?view=prices',
  '/reports?view=stock',
  '/admin-data',
  '/settings/advanced',
  '/settings/advanced?view=mode',
];

async function probeRole(roleInfo) {
  console.log(`\n======================================================`);
  console.log(`PROBING ROLE: ${roleInfo.username} (${roleInfo.role})`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[CONSOLE_ERR] ${msg.text()}`);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`[HTTP_${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  // Login
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="text"]', roleInfo.username);
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    console.log(`Login landing URL: ${page.url()}`);
  } catch (err) {
    console.log(`Login failed: ${err.message}`);
    await browser.close();
    return;
  }

  for (const route of ROUTES) {
    consoleErrors.length = 0;
    networkErrors.length = 0;

    const targetUrl = `${BASE_URL}${route}`;
    await page.goto(targetUrl);
    await page.waitForTimeout(800);

    const currentUrl = page.url();
    const isForbidden = currentUrl.includes('/forbidden');
    const heading = await page.locator('h1').allTextContents().then(t => t.join(' | ')).catch(() => 'No H1');
    const alerts = await page.locator('[role="alert"]').allTextContents().then(t => t.join(' | ')).catch(() => '');
    const hasEmpty = await page.locator('text=Không có').count() > 0 || await page.locator('text=Chưa có').count() > 0;

    let status = 'OK';
    if (isForbidden) status = 'FORBIDDEN (403)';
    else if (alerts) status = `ALERT: ${alerts.slice(0, 80)}...`;
    else if (networkErrors.length > 0) status = `NET_ERR: ${networkErrors.join('; ')}`;
    else if (consoleErrors.length > 0) status = `CONSOLE_ERR: ${consoleErrors.slice(0, 2).join('; ')}`;

    console.log(`Route: ${route.padEnd(35)} -> Current: ${currentUrl.replace(BASE_URL, '').padEnd(20)} | H1: "${heading.slice(0, 30)}" | Status: ${status}`);
  }

  await browser.close();
}

async function main() {
  for (const role of ROLES) {
    await probeRole(role);
  }
}

main().catch(console.error);
