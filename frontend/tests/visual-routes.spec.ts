import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

const visualRoutes = [
  { path: ROUTES.LOGIN, name: 'login' },
  { path: ROUTES.DASHBOARD, name: 'dashboard', nav: 'Tổng quan' },
  { path: ROUTES.WEEKLY_MENU, name: 'weekly-menu', nav: 'Thực đơn tuần' },
  { path: ROUTES.MEAL_ORDERS, name: 'meal-orders', nav: 'Điều phối đơn' },
  { path: ROUTES.CHEF_DASHBOARD, name: 'chef-dashboard', nav: 'Bếp trưởng' },
  { path: ROUTES.REPORTS, name: 'reports', nav: 'Biến động giá' },
  { path: ROUTES.APPROVALS, name: 'approvals', nav: 'Duyệt vận hành' },
  { path: ROUTES.PURCHASING, name: 'purchasing', nav: 'Thu mua' },
  { path: ROUTES.WAREHOUSE, name: 'warehouse', nav: 'Kho nguyên liệu' },
  { path: ROUTES.ADMIN_DATA, name: 'admin-data', nav: 'Quản trị dữ liệu' },
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
}

async function stabilizeVisuals(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0.001s !important;
        transition-delay: 0s !important;
        transition-duration: 0.001s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

test.describe('visual routes', () => {
  test.use({ viewport: { width: 1365, height: 900 } });

  for (const route of visualRoutes) {
    test(`${route.name} visual baseline`, async ({ page }) => {
      if (route.path === ROUTES.LOGIN) {
        await page.goto(route.path);
      } else {
        await login(page);
        if (route.path !== ROUTES.DASHBOARD) {
          await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: route.nav }).click();
          await expect(page).toHaveURL(route.path);
        }
        await expect(page.locator('.ipc-app-shell')).toBeVisible();
      }

      await stabilizeVisuals(page);
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
      });
    });
  }
});
