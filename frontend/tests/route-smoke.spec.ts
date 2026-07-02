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
  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

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

async function stubPurchasingSubmitFailure(page: Page) {
  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/purchase-demand')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: [
            {
              purchaseRequestId: 'pr-1',
              purchaseRequestLineId: 'prl-1',
              purchaseRequestCode: 'PR-20260615-FULLDAY',
              purchaseForDate: '2026-06-15',
              status: 'DRAFT',
              ingredientId: 'ing-1',
              ingredientName: 'Sườn heo',
              supplierId: 'sup-1',
              supplierName: 'Nhà cung cấp A',
              unitId: 'unit-1',
              unitName: 'kg',
              requiredQty: 10,
              currentStockQty: 0,
              purchaseQty: 10,
              estimatedUnitPrice: 120000,
              estimatedAmount: 1200000,
              referenceUnitPrice: 100000,
              priceVariancePercent: 20,
              isPriceWarning: true,
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/suppliers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: [{ supplierId: 'sup-1', supplierCode: 'SUP-A', supplierName: 'Nhà cung cấp A' }],
      }),
    });
  });

  await page.route('**/api/purchase-workflow/requests/pr-1/submit', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi gửi đơn mua.',
      }),
    });
  });
}

async function stubApprovalDecisionSuccess(page: Page) {
  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: [
          {
            inboxItemId: 'purchase-pr-1',
            targetType: 'purchase-request',
            targetId: 'pr-1',
            targetCode: 'PR-20260615-FULLDAY',
            itemType: 'purchase',
            title: 'Duyệt đơn mua',
            source: 'PR-20260615-FULLDAY',
            ownerRole: 'Thu mua / Quản lý',
            submittedBy: 'Đinh Thu Mua',
            dueDate: '2026-06-15',
            status: 'PENDING',
            reason: 'Đơn mua đã gửi, chờ duyệt trước khi mua hàng.',
            nextAction: 'Duyệt đơn mua',
            tone: 'warning',
            route: '/approvals',
            materials: [{ name: 'Sườn heo', quantity: 10, unit: 'kg' }],
          },
        ],
      }),
    });
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/approvals/purchase-request/pr-1', async (route) => {
    const body = await route.request().postDataJSON();
    expect(body).toMatchObject({ status: 'Approve', reason: 'Đồng ý mua' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Thực hiện phê duyệt thành công.',
        data: {
          targetType: 'purchase-request',
          targetId: 'pr-1',
          status: 'APPROVE',
          oldStatus: 'SENTTOSUPPLIER',
          newStatus: 'APPROVED',
          historyId: 'hist-1',
          actionAt: '2026-07-02T13:00:00Z',
        },
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

  test('purchasing submit surfaces API validation errors', async ({ page }) => {
    await stubPurchasingSubmitFailure(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.PURCHASING);

    await expect(page.getByRole('button', { name: 'Gửi đơn mua' })).toBeEnabled();
    const dialogPromise = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Gửi đơn mua' }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Có dòng mua vượt ngưỡng giá');
    await dialog.accept();
  });

  test('approval inbox executes approve decision with reason', async ({ page }) => {
    await stubApprovalDecisionSuccess(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.APPROVALS);

    await expect(page.getByText('PR-20260615-FULLDAY').first()).toBeVisible();
    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept(dialog.type() === 'prompt' ? 'Đồng ý mua' : undefined);
    });
    await page.getByRole('button', { name: 'Duyệt' }).first().click();
    await expect.poll(() => dialogMessages).toContain('Ghi chú duyệt');
    await expect.poll(() => dialogMessages).toContain('Đã duyệt.');
  });
});
