import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173';

async function probe() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    if (res.url().includes('contract')) {
      console.log('Contract API response status:', res.status());
      console.log('Contract API response body:', await res.text());
    }
  });

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.goto(`${BASE_URL}/admin-data?view=customers`);
  await page.waitForTimeout(1000);

  const addCustBtn = page.locator('button:has-text("Thêm khách hàng mới")');
  await addCustBtn.click();
  await page.waitForTimeout(500);

  await page.fill('input[aria-label="Mã khách hàng"]', 'TESTCUST');
  await page.fill('input[aria-label="Tên khách hàng"]', 'Test Customer');

  const submitCustBtn = page.locator('div[role="dialog"] button:has-text("Tạo khách hàng & Hợp đồng")');
  await submitCustBtn.click();
  await page.waitForTimeout(2000);

  const errorText = await page.locator('div[role="dialog"]').innerText();
  console.log('Dialog innerText after submit:', errorText);

  await browser.close();
}

probe().catch(console.error);
