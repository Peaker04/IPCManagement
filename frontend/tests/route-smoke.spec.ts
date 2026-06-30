import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, heading: 'Bàn điều hành hôm nay', nav: 'Tổng quan' },
  { path: ROUTES.WEEKLY_MENU, heading: 'KHSX và định lượng', nav: 'Thực đơn tuần' },
  { path: ROUTES.MEAL_ORDERS, heading: 'Điều phối suất ăn', nav: 'Điều phối đơn' },
  { path: ROUTES.CHEF_DASHBOARD, heading: 'Bếp sản xuất', nav: 'Bếp trưởng' },
  { path: ROUTES.REPORTS, heading: 'Phân tích biến động giá', nav: 'Biến động giá' },
  { path: ROUTES.APPROVALS, heading: 'Duyệt vận hành', nav: 'Duyệt vận hành' },
  { path: ROUTES.PURCHASING, heading: 'Thu mua', nav: 'Thu mua' },
  { path: ROUTES.WAREHOUSE, heading: 'Kho nguyên liệu', nav: 'Kho nguyên liệu' },
  { path: ROUTES.ADMIN_DATA, heading: 'Quản trị dữ liệu', nav: 'Quản trị dữ liệu' },
] as const;

const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'tablet', width: 768, height: 960 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;

async function login(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Playwright mock login fallback' }),
    });
  });
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          userId: '1',
          username: 'admin',
          fullName: 'Trần Văn Giám Đốc',
          roleName: 'Admin',
        },
      }),
    });
  });

  await page.goto(ROUTES.LOGIN);
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}

async function stubWorkflowReports(page: Page) {
  await page.route('**/api/workflow-reports/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/workflow-reports/receipt-price-variance**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: [
          { receiptId: 'r1', receiptCode: 'PN-01', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i1', ingredientName: 'Sườn heo', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 134000, referencePrice: 115000, variancePercent: 16.5, isWarning: true },
          { receiptId: 'r2', receiptCode: 'PN-02', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i2', ingredientName: 'Thịt gà', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 85000, referencePrice: 83000, variancePercent: 2.4, isWarning: false },
          { receiptId: 'r3', receiptCode: 'PN-03', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i3', ingredientName: 'Cá lóc phi lê', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 110000, referencePrice: 110000, variancePercent: 0, isWarning: false },
          { receiptId: 'r4', receiptCode: 'PN-04', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i4', ingredientName: 'Gạo tẻ', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 18000, referencePrice: 17000, variancePercent: 5.8, isWarning: false },
          { receiptId: 'r5', receiptCode: 'PN-05', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i5', ingredientName: 'Rau cải xanh', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 15000, referencePrice: 12500, variancePercent: 20, isWarning: true },
          { receiptId: 'r6', receiptCode: 'PN-06', receiptDate: '2026-06-18', supplierId: 's2', supplierName: 'Nhà cung cấp B', ingredientId: 'i6', ingredientName: 'Tôm tươi', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 180000, referencePrice: 180000, variancePercent: 0, isWarning: false },
          { receiptId: 'r7', receiptCode: 'PN-07', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i7', ingredientName: 'Thịt ba chỉ', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 125000, referencePrice: 120000, variancePercent: 4.1, isWarning: false },
        ],
      }),
    });
  });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );

    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('route smoke', () => {
  for (const viewport of viewports) {
    test(`login route renders without app shell at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTES.LOGIN);

      await expect(page.getByRole('heading', { name: 'IPC Management System' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
      await expect(page.locator('.ipc-app-shell')).toHaveCount(0);
      await expectNoPageOverflow(page);
    });
  }

  for (const viewport of viewports) {
    test(`protected routes render at ${viewport.name}`, async ({ page }) => {
      await stubWorkflowReports(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      for (const route of protectedRoutes) {
        if (page.url() !== new URL(route.path, 'http://127.0.0.1:5173').toString()) {
          await page.goto(route.path);
          await expect(page).toHaveURL(route.path);
        }

        await expect(page.locator('.ipc-app-shell')).toBeVisible();
        await expect(page.locator('.ipc-page-title')).toHaveText(route.heading);
        await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Tổng quan' }).first()).toBeVisible();
        await expect(page.locator('main.ipc-main')).toBeVisible();
        await expectNoPageOverflow(page);
      }
    });
  }

  test('reports price table exposes paging for long-lived data', async ({ page }) => {
    await stubWorkflowReports(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Biến động giá' }).click();
    await expect(page).toHaveURL(ROUTES.REPORTS);

    await expect(page.getByText('Hiển thị 1-6 / 7')).toBeVisible();
    await page.getByLabel('Trang sau').click();
    await expect(page.getByText('Hiển thị 7-7 / 7')).toBeVisible();
  });
});
