import { expect, type Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/lib/routeConfig';
import {
  PHASE09_DATE,
  PHASE09_WEEK,
  phase09PurchaseOrdersPage,
  phase09Workbench,
  stubPhase09Api,
} from './phase9-test-fixture';

const visualRoutes = [
  { path: ROUTES.LOGIN, name: 'login' },
  { path: ROUTES.DASHBOARD, name: 'dashboard' },
  { path: ROUTES.WEEKLY_MENU, name: 'weekly-menu' },
  { path: ROUTES.MEAL_ORDERS, name: 'meal-orders' },
  { path: ROUTES.CHEF_DASHBOARD, name: 'chef-dashboard' },
  { path: ROUTES.REPORTS, name: 'reports' },
  { path: ROUTES.APPROVALS, name: 'approvals' },
  { path: ROUTES.PURCHASING, name: 'purchasing' },
  { path: ROUTES.WAREHOUSE, name: 'warehouse' },
  { path: ROUTES.ADMIN_DATA, name: 'admin-data' },
] as const;

const visualViewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const phase09ClockInstant = new Date(`${PHASE09_DATE}T12:00:00+07:00`);
const phase09HeaderDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  .format(phase09ClockInstant);

async function installPhase09Clock(page: Page) {
  await page.clock.install({ time: phase09ClockInstant });
  await page.clock.setFixedTime(phase09ClockInstant);
  expect(await page.evaluate(() => new Date().toISOString()))
    .toBe(phase09ClockInstant.toISOString());
}

async function stubVisualApi(page: Page) {
  const fulfill = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data }),
    });

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.startsWith('/api/')) {
      if (requestUrl.pathname === '/api/inventory-returns' || requestUrl.pathname === '/api/supplemental-material-requests') {
        await fulfill(route, { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0 });
      } else if (requestUrl.pathname === '/api/workflow-reports/kitchen-issues/page') {
        await fulfill(route, { items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 });
      } else {
        await fulfill(route, []);
      }
      return;
    }

    await route.continue();
  });

  await page.route('**/api/approvals/inbox**', async (route) => fulfill(route, {
    items: [{
      inboxItemId: 'purchase-pr-visual',
      targetType: 'purchase-request',
      targetId: 'pr-visual',
      targetCode: 'PR-20260709-M',
      itemType: 'purchase',
      title: 'Duyệt đơn mua',
      source: 'PR-20260709-M',
      ownerRole: 'Thu mua / Quản lý',
      submittedBy: 'Điều phối ca sáng',
      dueDate: '2026-07-09',
      status: 'PENDING',
      reason: 'Đơn mua đã gửi, chờ duyệt trước khi mua hàng.',
      nextAction: 'Duyệt đơn mua',
      tone: 'warning',
      route: ROUTES.APPROVALS,
      materials: [{ name: 'Sườn heo', quantity: 15, unit: 'kg' }],
    }], limit: 20, hasNext: false, nextCursor: null,
  }));

  await page.route('**/api/purchase-workflow/workbench**', async (route) => fulfill(route, phase09Workbench));
  await page.route('**/api/purchase-orders/page**', async (route) => fulfill(route, phase09PurchaseOrdersPage));
  await page.route('**/api/warehouses/selector**', async (route) => fulfill(route, [{
    warehouseId: 'warehouse-main',
    warehouseCode: 'MAIN',
    warehouseName: 'Kho chính',
  }]));

  await page.route('**/api/workflow-reports/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';

    if (endpoint === 'operational-kpis') {
      await fulfill(route, {
        shortageCount: 1,
        lowStockCount: 2,
        overduePurchaseRequestCount: 1,
        lateReceiptCount: 0,
        pendingKitchenConfirmationCount: 1,
        failedWorkflowCount: 0,
        criticalDataQualityCount: 1,
        overdueApprovalCount: 1,
        generatedAt: '2026-07-09T05:30:00Z',
      });
      return;
    }

    if (endpoint === 'data-quality') {
      await fulfill(route, {
        generatedAt: '2026-07-09T05:30:00Z',
        totalIssues: 1,
        errorCount: 1,
        warningCount: 0,
        resolvedIssueCount: 0,
        reopenedIssueCount: 0,
        urgentIssueCount: 1,
        missingBomCount: 1,
        invalidUnitCount: 0,
        missingConversionCount: 0,
        negativeStockCount: 0,
        orphanDocumentCount: 0,
        issues: [],
      });
      return;
    }

    const rowsByEndpoint: Record<string, unknown[]> = {
      'workflow-documents': [
        {
          documentId: 'mr-visual',
          documentCode: 'MR-20260709-M',
          documentType: 'Nhu cầu nguyên liệu',
          documentDate: '2026-07-09',
          shiftName: 'MORNING',
          status: 'CONFIRMED',
          ownerLane: 'Điều phối',
          route: ROUTES.MEAL_ORDERS,
          summary: '120 suất ca sáng',
        },
      ],
      'ingredient-demand': [
        {
          materialRequestId: 'mr-visual',
          materialRequestCode: 'MR-20260709-M',
          requestDate: '2026-07-09',
          status: 'CONFIRMED',
          shiftName: 'MORNING',
          customerName: 'IPC Bắc Ninh',
          dishName: 'Bún bò',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          totalServings: 120,
          totalRequiredQty: 18,
          currentStockQty: 3,
          suggestedPurchaseQty: 15,
        },
      ],
      'purchase-plan': [
        {
          periodKey: '2026-07-09',
          groupBy: 'day',
          periodStart: '2026-07-09',
          periodEnd: '2026-07-09',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          requiredQty: 18,
          currentStockQty: 3,
          pendingReceiptQty: 0,
          shortageQty: 15,
          suggestedPurchaseQty: 15,
          estimatedUnitPrice: 134000,
          estimatedAmount: 2010000,
          supplierId: 'supplier-a',
          supplierName: 'Nhà cung cấp A',
          expectedDeliveryDate: '2026-07-09',
          warnings: ['price_variance'],
        },
      ],
      'current-stock': [
        {
          warehouseId: 'wh-main',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rice',
          ingredientName: 'Gạo tẻ',
          unitId: 'unit-kg',
          unitName: 'kg',
          currentQty: 240,
          lastUpdated: '2026-07-09T05:00:00Z',
        },
      ],
      'receipt-price-variance': [
        {
          receiptId: 'receipt-visual',
          receiptCode: 'PN-20260709-01',
          receiptDate: '2026-07-09',
          supplierId: 'supplier-a',
          supplierName: 'Nhà cung cấp A',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          quantity: 15,
          unitPrice: 134000,
          referencePrice: 115000,
          variancePercent: 16.5,
          isWarning: true,
        },
      ],
    };

    await fulfill(route, rowsByEndpoint[endpoint] ?? []);
  });
}

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
  await page.getByRole('textbox', { name: 'Mật khẩu', exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
}

async function stabilizeVisuals(page: Page, routeName?: string) {
  await page.waitForLoadState('networkidle');
  if (routeName === 'chef-dashboard') {
    await expect(page.getByRole('heading', { name: 'Kế hoạch điều phối trong ngày' })).toBeVisible();
  }
  if (routeName === 'purchasing') {
    await expect(page.getByText('Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' })).toBeVisible();
  }
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
  for (const viewport of visualViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of visualRoutes) {
        test(`${route.name} visual baseline`, async ({ page }) => {
          await installPhase09Clock(page);
          await stubVisualApi(page);
          if (route.path === ROUTES.LOGIN) {
            await page.goto(route.path);
          } else {
            await login(page);
            if (route.path !== ROUTES.DASHBOARD) {
              await page.goto(route.path);
            }
            await expect(page).toHaveURL(route.path);
            await expect(page.locator('.ipc-app-shell')).toBeVisible();
            await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
          }

          await stabilizeVisuals(page, route.name);
          await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
            fullPage: true,
          });
        });
      }
    });
  }
});

test.describe('full-system tab audit captures', () => {
  for (const viewport of [
    { name: 's-390', width: 390, height: 844 },
    { name: 'm-768', width: 768, height: 1024 },
    { name: 'l-1280', width: 1280, height: 900 },
    { name: 'xl-1440', width: 1440, height: 900 },
  ] as const) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of visualRoutes) {
        test(`${route.name} tab audit capture`, async ({ page }) => {
          await installPhase09Clock(page);
          await stubVisualApi(page);
          if (route.path === ROUTES.LOGIN) {
            await page.goto(route.path);
          } else {
            await login(page);
            if (route.path !== ROUTES.DASHBOARD) {
              await page.goto(route.path);
            }
            await expect(page.locator('.ipc-app-shell')).toBeVisible();
          }

          await stabilizeVisuals(page);
          const auditState = process.env.TAB_AUDIT_STATE ?? 'before';
          const screenshotPath = resolve(
            process.cwd(),
            '..',
            '.planning',
            'ui-reviews',
            'tabs',
            auditState,
            viewport.name,
            `${route.name}.png`,
          );
          mkdirSync(dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
        });
      }
    });
  }
});

test.describe('MainLayout responsive shell contract', () => {
  for (const viewport of [
    { name: '390x844', width: 390, height: 844, collapsed: true },
    { name: '768x1024', width: 768, height: 1024, collapsed: true },
    { name: '1280x900', width: 1280, height: 900, collapsed: false },
    { name: '1365x900', width: 1365, height: 900, collapsed: false },
  ] as const) {
    test(`${viewport.name} shell breakpoint`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installPhase09Clock(page);
      await stubVisualApi(page);
      await login(page);
      await page.goto(ROUTES.WAREHOUSE);

      const toggle = page.getByRole('button', { name: 'Mở menu điều hướng' });
      const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
      if (viewport.collapsed) {
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(navigation).toBeHidden();
      } else {
        await expect(toggle).toBeHidden();
        await expect(navigation).toBeVisible();
      }

      await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      )).toBe(true);
    });
  }
});

test.describe('Phase 09 deterministic visual seam', () => {
  for (const viewport of [
    { name: '1365x900', width: 1365, height: 900 },
    { name: '1280x900', width: 1280, height: 900 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '390x844', width: 390, height: 844 },
  ] as const) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of [
        {
          name: 'purchasing-phase09',
          path: `${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`,
        },
        {
          name: 'warehouse-phase09',
          path: `${ROUTES.WAREHOUSE}?week=${PHASE09_WEEK}&purchaseRequestId=pr-phase09`,
        },
      ] as const) {
        test(`${route.name} visual baseline`, async ({ page }) => {
          await installPhase09Clock(page);
          await stubVisualApi(page);
          await stubPhase09Api(page);
          await login(page);
          await page.goto(route.path);
          await expect(page.locator('.ipc-app-shell')).toBeVisible();
          await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
          await stabilizeVisuals(page);
          await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`);
        });
      }
    });
  }
});
