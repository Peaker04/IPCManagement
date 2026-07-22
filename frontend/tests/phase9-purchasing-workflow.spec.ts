import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';
import { PHASE09_STAGE_LABELS } from './phase9-test-fixture';

const realStackEnabled = process.env.PHASE09_REAL_STACK === '1';
const frontendUrl = process.env.PHASE09_FE_URL ?? 'http://127.0.0.1:5173';
const serviceDate = process.env.PHASE09_SERVICE_DATE ?? '2026-06-18';
const serviceDateValue = new Date(`${serviceDate}T00:00:00Z`);
serviceDateValue.setUTCDate(serviceDateValue.getUTCDate() - ((serviceDateValue.getUTCDay() + 6) % 7));
const week = serviceDateValue.toISOString().slice(0, 10);

const absoluteUrl = (path: string) => new URL(path, frontendUrl).toString();

async function loginToRealStack(page: Page) {
  await page.goto(absoluteUrl(ROUTES.LOGIN));
  await page.getByLabel('Tài khoản').fill(process.env.PHASE09_USERNAME ?? 'admin');
  await page.getByLabel('Mật khẩu').fill(process.env.PHASE09_PASSWORD ?? 'admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}

async function openProtectedRoute(page: Page, path: string) {
  await page.goto(absoluteUrl(path));
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(new URL(path, frontendUrl).pathname));
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test.describe('Phase 09 six-stage purchasing workflow', () => {
  test.skip(!realStackEnabled, 'Runs only through the restored Shipyard lane with PHASE09_REAL_STACK=1.');

  test.beforeEach(async ({ page }) => {
    await loginToRealStack(page);
  });

  test('stage 1: finalized servings remain on the weekly-menu route', async ({ page }) => {
    await openProtectedRoute(page, ROUTES.WEEKLY_MENU);
    await expect(page.getByRole('heading', { name: 'KHSX và định lượng' })).toBeVisible();
  });

  test('stage 2: date-specific material demand is visible in the purchasing workbench', async ({ page }) => {
    await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=demand`);
    await expect(page.getByRole('heading', { name: 'Thu mua theo nhu cầu đã duyệt' })).toBeVisible();
    await expect(page.getByText('Cả ngày (FULLDAY)')).toBeVisible();
  });

  test('stage 3: Manager approval route remains available', async ({ page }) => {
    await openProtectedRoute(page, ROUTES.APPROVALS);
    await expect(page.getByRole('heading', { name: 'Duyệt vận hành' })).toBeVisible();
  });

  test('stage 4: Purchasing exposes supplier, price, evidence, and exception stages', async ({ page }) => {
    await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=supplier-price`);
    const guide = page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
    for (const label of PHASE09_STAGE_LABELS) {
      await expect(guide.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByText('Bằng chứng hiện tại')).toBeVisible();
  });

  test('stage 5: Manager handoff keeps request approval and order stages visible', async ({ page }) => {
    await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=approved-order`);
    await expect(page.getByRole('button', { name: /Duyệt và tạo đơn/ })).toBeVisible();
  });

  test('stage 6: Warehouse exposes the physical receiving surface', async ({ page }) => {
    await openProtectedRoute(page, `${ROUTES.WAREHOUSE}?week=${week}`);
    await expect(page.getByRole('region', { name: 'Danh sách đơn mua và tiến độ nhập kho' })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test('preserves weekly-menu, approvals, purchasing, and warehouse routes', async ({ page }) => {
    for (const route of [ROUTES.WEEKLY_MENU, ROUTES.APPROVALS, ROUTES.PURCHASING, ROUTES.WAREHOUSE]) {
      await openProtectedRoute(page, route);
    }
  });
});
