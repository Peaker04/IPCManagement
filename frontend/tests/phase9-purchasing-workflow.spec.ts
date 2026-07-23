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

  test('traverses the restored Manager to Purchasing to Warehouse workflow', async ({ page }) => {
    await loginToRealStack(page);

    await test.step('stage 1 keeps finalized servings on weekly menu', async () => {
      await openProtectedRoute(page, ROUTES.WEEKLY_MENU);
      await expect(page.getByRole('heading', { name: 'KHSX và định lượng' })).toBeVisible();
    });

    await test.step('stage 2 exposes date-specific demand', async () => {
      await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=demand`);
      await expect(page.getByRole('heading', { name: 'Thu mua theo nhu cầu đã duyệt' })).toBeVisible();
      await expect(page.getByText('Cả ngày (FULLDAY)', { exact: true })).toBeVisible();
    });

    await test.step('stage 3 preserves the Manager approval surface', async () => {
      await openProtectedRoute(page, ROUTES.APPROVALS);
      await expect(page.getByRole('heading', { name: 'Duyệt vận hành' })).toBeVisible();
    });

    await test.step('stages 4 and 5 expose evidence, exception, approval, and order handoff', async () => {
      await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=supplier-price`);
      const guide = page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
      for (const label of PHASE09_STAGE_LABELS) {
        await expect(guide.getByRole('button', { name: new RegExp(label) })).toBeVisible();
      }
      await expect(page.getByText('Bằng chứng hiện tại')).toBeVisible();
      await openProtectedRoute(page, `${ROUTES.PURCHASING}?week=${week}&date=${serviceDate}&stage=approved-order`);
      await expect(page.getByRole('button', { name: /Duyệt và tạo đơn/ })).toBeVisible();
    });

    await test.step('stage 6 exposes the Warehouse receiving surface without page overflow', async () => {
      await openProtectedRoute(page, `${ROUTES.WAREHOUSE}?week=${week}`);
      await expect(page.getByRole('region', { name: 'Danh sách đơn mua và tiến độ nhập kho' })).toBeVisible();
      await expectNoPageOverflow(page);
    });
  });
});
