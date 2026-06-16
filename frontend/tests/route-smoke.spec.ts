import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, heading: 'Bàn điều hành hôm nay', nav: 'Tổng quan' },
  { path: ROUTES.WEEKLY_MENU, heading: 'KHSX và định lượng', nav: 'Thực đơn tuần' },
  { path: ROUTES.MEAL_ORDERS, heading: 'Điều phối suất ăn', nav: 'Điều phối đơn' },
  { path: ROUTES.CHEF_DASHBOARD, heading: 'Bếp sản xuất', nav: 'Bếp trưởng' },
  { path: ROUTES.REPORTS, heading: 'Phân tích biến động giá', nav: 'Biến động giá' },
  { path: ROUTES.APPROVALS, heading: 'Duyệt mua / duyệt xuất', nav: 'Duyệt vận hành' },
  { path: ROUTES.PURCHASING, heading: 'Thu mua', nav: 'Thu mua' },
  { path: ROUTES.WAREHOUSE, heading: 'Xuất kho', nav: 'Kho nguyên liệu' },
  { path: ROUTES.ADMIN_DATA, heading: 'Điều chỉnh / thông báo', nav: 'Quản trị dữ liệu' },
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

  await page.goto(ROUTES.LOGIN);
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
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
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      for (const route of protectedRoutes) {
        if (page.url() !== new URL(route.path, 'http://127.0.0.1:5173').toString()) {
          await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: route.nav }).click();
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
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Biến động giá' }).click();
    await expect(page).toHaveURL(ROUTES.REPORTS);

    await expect(page.getByText('Hiển thị 1-6 / 7')).toBeVisible();
    await page.getByLabel('Trang sau').click();
    await expect(page.getByText('Hiển thị 7-7 / 7')).toBeVisible();
  });
});
