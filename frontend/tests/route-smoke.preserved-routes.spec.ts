import { expect, test } from '@playwright/test';
import { ROUTES } from '../src/lib/routeConfig';
import { PHASE09_DATE, PHASE09_STAGE_LABELS, PHASE09_WEEK, stubPhase09Api } from './phase9-test-fixture';

// phase18-body-start
test.describe('Phase 09 preserved-route seam', () => {
  test('preserves four routes, six stages, and purchasing deep-link state', async ({ page }) => {
    await page.route('**/*', async (route) => {
      if (!new URL(route.request().url()).pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: [] }),
      });
    });
    await stubPhase09Api(page);
    await page.route('**/api/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            userId: 'phase09-admin',
            username: 'admin',
            fullName: 'Phase 09 Admin',
            roleCode: 'ADMIN',
            roleName: 'Admin',
            isAdminFullAccess: true,
            permissions: ['*'],
          },
        }),
      });
    });
    await page.addInitScript(() => {
      window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'phase09-admin',
        username: 'admin',
        fullName: 'Phase 09 Admin',
        role: 'admin',
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isAdminFullAccess: true,
        permissions: ['*'],
      }));
    });
    await page.goto(ROUTES.DASHBOARD);
    await expect(page.locator('.ipc-app-shell')).toBeVisible();

    for (const route of [ROUTES.WEEKLY_MENU, ROUTES.APPROVALS]) {
      await page.goto(route);
      await expect(page).toHaveURL(route);
      await expect(page.locator('.ipc-app-shell')).toBeVisible();
    }

    const purchasingRoute = `${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`;
    await page.goto(purchasingRoute);
    await expect(page).toHaveURL(new RegExp(`week=${PHASE09_WEEK}.*date=${PHASE09_DATE}.*stage=receiving`));
    const guide = page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
    for (const label of PHASE09_STAGE_LABELS) {
      await expect(guide.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }

    await page.goto(`${ROUTES.WAREHOUSE}?week=${PHASE09_WEEK}&purchaseRequestId=pr-phase09`);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.WAREHOUSE}\\?`));
    await expect(page.getByRole('region', { name: 'Danh sách đơn mua và tiến độ nhập kho' })).toBeVisible();
  });
});
