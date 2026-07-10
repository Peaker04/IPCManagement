import { expect, type Page, test } from '@playwright/test';
import { ROUTES } from '../src/routes/routeConfig';

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

async function stubVisualApi(page: Page) {
  const fulfill = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data }),
    });

  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).pathname.startsWith('/api/')) {
      await fulfill(route, []);
      return;
    }

    await route.continue();
  });

  await page.route('**/api/approvals/inbox**', async (route) => fulfill(route, [
    {
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
    },
  ]));

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
  await page.getByLabel('Mật khẩu').fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(ROUTES.DASHBOARD);
}

async function stabilizeVisuals(page: Page) {
  await page.waitForLoadState('networkidle');
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
  await page.waitForTimeout(500);
}

test.describe('visual routes', () => {
  for (const viewport of visualViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of visualRoutes) {
        test(`${route.name} visual baseline`, async ({ page }) => {
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
          }

          await stabilizeVisuals(page);
          await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
            fullPage: true,
          });
        });
      }
    });
  }
});
