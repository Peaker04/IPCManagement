import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

const protectedRoutes = [
  { path: ROUTES.DASHBOARD, heading: 'Bàn điều hành hôm nay' },
  { path: ROUTES.WEEKLY_MENU, heading: 'KHSX và định lượng' },
  { path: ROUTES.MEAL_ORDERS, heading: 'Điều phối suất ăn' },
  { path: ROUTES.CHEF_DASHBOARD, heading: 'Bếp sản xuất' },
  { path: ROUTES.REPORTS, heading: 'Phân tích biến động giá' },
  { path: ROUTES.APPROVALS, heading: 'Duyệt vận hành' },
  { path: ROUTES.PURCHASING, heading: 'Thu mua' },
  { path: ROUTES.WAREHOUSE, heading: 'Kho nguyên liệu' },
  { path: ROUTES.ADMIN_DATA, heading: 'Quản trị dữ liệu' },
] as const;

async function fulfillJson(route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

async function stubOperationalApis(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Playwright mock login fallback' }),
    });
  });
  await page.route('**/api/auth/profile', async (route) => {
    await fulfillJson(route, {
      userId: '1',
      username: 'admin',
      fullName: 'Admin User',
      roleName: 'Admin',
    });
  });
  await page.route('**/api/approvals/inbox**', async (route) => fulfillJson(route, []));
  await page.route('**/api/workflow-reports/**', async (route) => fulfillJson(route, []));
  await page.route('**/api/purchase-requests**', async (route) => fulfillJson(route, []));
  await page.route('**/api/dishes/catalog**', async (route) => fulfillJson(route, []));
  await page.route('**/api/suppliers**', async (route) => fulfillJson(route, []));
  await page.route('**/api/production-plans/daily**', async (route) => fulfillJson(route, []));
  await page.route('**/api/coordination/customers', async (route) =>
    fulfillJson(route, [{ customerId: 'customer-dav', customerCode: 'DAV', customerName: 'Draxlmaier' }]),
  );
  await page.route('**/api/coordination/customer-contracts', async (route) =>
    fulfillJson(route, [
      {
        contractId: 'contract-dav',
        customerId: 'customer-dav',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        isActive: true,
        contractStatus: 'ACTIVE',
        menuScheduleCount: 0,
        activeWeekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        shiftNames: ['MORNING', 'AFTERNOON'],
        defaultMenuPrice: 25000,
        defaultBomRatePercent: 100,
      },
    ]),
  );
  await page.route('**/api/coordination/weekly-menu**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await fulfillJson(route, pathname.endsWith('/import-history') ? [] : null);
  });
}

async function login(page: Page) {
  await page.goto(ROUTES.LOGIN);
  await page.getByLabel('Tài khoản').fill('admin');
  await page.getByLabel('Mật khẩu').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}

async function expectVisibleControlsAreNamed(page: Page) {
  const unnamedControls = await page.evaluate(() => {
    const selectors = 'button, [role="button"], a.ipc-button';
    return Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .map((element, index) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
        const label = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.textContent,
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          index,
          tag: element.tagName.toLowerCase(),
          className: element.className.toString(),
          isVisible,
          label,
        };
      })
      .filter((control) => control.isVisible && control.label.length === 0);
  });

  expect(unnamedControls).toEqual([]);
}

test.describe('operational control surface', () => {
  test.beforeEach(async ({ page }) => {
    await stubOperationalApis(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
  });

  test('all protected routes expose named visible controls', async ({ page }) => {
    for (const route of protectedRoutes) {
      await page.goto(route.path);
      await expect(page.locator('.ipc-page-title')).toHaveText(route.heading);
      await expectVisibleControlsAreNamed(page);
    }
  });

  test('weekly menu import and edit dialogs open, identify themselves, and close cleanly', async ({ page }) => {
    await page.goto(ROUTES.WEEKLY_MENU);

    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' });
    await expect(importDialog).toBeVisible();
    await expect(importDialog.getByLabel('Khách hàng')).toBeVisible();
    await expect(importDialog.getByLabel('Định mức BOM')).toBeVisible();
    await expect(importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' })).toBeVisible();
    await importDialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' }).click();
    await expect(importDialog).toBeHidden();

    await page.getByRole('button', { name: 'Chỉnh sửa thực đơn' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' })).toBeVisible();
    await editDialog.getByRole('button', { name: 'Đóng modal chỉnh sửa thực đơn' }).click();
    await expect(editDialog).toBeHidden();
  });
});
