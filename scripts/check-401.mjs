import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173';

async function check401() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', (res) => {
    if (res.status() === 401) {
      console.log('401 from URL:', res.url());
    }
  });

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  await page.goto(`${BASE_URL}/admin-data?view=bom`);
  await page.waitForTimeout(1000);

  await page.goto(`${BASE_URL}/weekly-menu?view=mrx-batch`);
  await page.waitForTimeout(1000);

  await browser.close();
}

check401().catch(console.error);
