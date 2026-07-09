import { expect, type Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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

async function stubProductionReportStages(page: Page) {
  const requests: Array<{ endpoint: string; url: URL }> = [];

  const fulfillJson = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data }),
    });

  await page.route('**/api/approvals/inbox**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/workflow-reports/')[1] ?? '';
    requests.push({ endpoint, url });

    if (endpoint === 'receipt-price-variance') {
      await fulfillJson(route, [
        {
          receiptId: 'receipt-1',
          receiptCode: 'PN-20260615-01',
          receiptDate: '2026-06-15',
          supplierId: 'supplier-a',
          supplierName: 'Nhà cung cấp A',
          ingredientId: 'ing-pork-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          quantity: 12,
          unitPrice: 134000,
          referencePrice: 115000,
          variancePercent: 16.5,
          isWarning: true,
        },
      ]);
      return;
    }

    if (endpoint === 'ingredient-demand') {
      await fulfillJson(route, [
        {
          materialRequestId: 'mr-1',
          materialRequestCode: 'MR-20260615-M',
          requestDate: '2026-06-15',
          status: 'GENERATED',
          shiftName: 'MORNING',
          customerName: 'IPC Bắc Ninh',
          dishName: 'Bún bò',
          ingredientId: 'ing-pork-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          totalServings: 120,
          totalRequiredQty: 18,
          currentStockQty: 3,
          suggestedPurchaseQty: 15,
        },
      ]);
      return;
    }

    if (endpoint === 'purchase-demand') {
      await fulfillJson(route, [
        {
          purchaseRequestId: 'pr-1',
          purchaseRequestLineId: 'prl-1',
          purchaseRequestCode: 'PR-20260615-M',
          purchaseForDate: '2026-06-15',
          shiftName: 'MORNING',
          status: 'SENTTOSUPPLIER',
          ingredientId: 'ing-pork-rib',
          ingredientName: 'Sườn heo',
          supplierId: 'supplier-a',
          supplierName: 'Nhà cung cấp A',
          unitId: 'unit-kg',
          unitName: 'kg',
          requiredQty: 18,
          currentStockQty: 3,
          purchaseQty: 15,
          estimatedUnitPrice: 134000,
          estimatedAmount: 2010000,
          referenceUnitPrice: 115000,
          priceVariancePercent: 16.5,
          isPriceWarning: true,
        },
      ]);
      return;
    }

    if (endpoint === 'current-stock') {
      await fulfillJson(route, [
        {
          warehouseId: 'wh-main',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rice',
          ingredientName: 'Gạo tẻ',
          unitId: 'unit-kg',
          unitName: 'kg',
          currentQty: 240,
          lastUpdated: '2026-06-15T07:00:00Z',
        },
      ]);
      return;
    }

    if (endpoint === 'stock-movements/page') {
      const isNextPage = url.searchParams.has('cursorDate');
      await fulfillJson(route, {
        items: [
          {
            movementId: isNextPage ? 'movement-2' : 'movement-1',
            movementDate: isNextPage ? '2026-06-14T07:30:00Z' : '2026-06-15T07:30:00Z',
            warehouseId: 'wh-main',
            warehouseName: 'Kho chính',
            ingredientId: isNextPage ? 'ing-pork-rib' : 'ing-rice',
            ingredientName: isNextPage ? 'Sườn heo trang 2' : 'Gạo tẻ trang 1',
            unitId: 'unit-kg',
            unitName: 'kg',
            movementType: isNextPage ? 'ISSUE' : 'RECEIPT',
            quantityIn: isNextPage ? 0 : 50,
            quantityOut: isNextPage ? 10 : 0,
            beforeQty: isNextPage ? 240 : 190,
            afterQty: isNextPage ? 230 : 240,
            refTable: isNextPage ? 'InventoryIssue' : 'InventoryReceipt',
            refId: isNextPage ? 'issue-2' : 'receipt-1',
          },
        ],
        limit: 20,
        hasNext: !isNextPage,
        nextCursorDate: isNextPage ? null : '2026-06-15T07:30:00Z',
        nextCursorId: isNextPage ? null : 'movement-1',
      });
      return;
    }

    if (endpoint === 'stock-movements') {
      await fulfillJson(route, [
        {
          movementId: 'movement-1',
          movementDate: '2026-06-15T07:30:00Z',
          warehouseId: 'wh-main',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rice',
          ingredientName: 'Gạo tẻ',
          unitId: 'unit-kg',
          unitName: 'kg',
          movementType: 'RECEIPT',
          quantityIn: 50,
          quantityOut: 0,
          beforeQty: 190,
          afterQty: 240,
          refTable: 'InventoryReceipt',
          refId: 'receipt-1',
        },
      ]);
      return;
    }

    if (endpoint === 'kitchen-issues') {
      await fulfillJson(route, [
        {
          issueId: 'issue-1',
          issueCode: 'PXB-20260615-M',
          issueDate: '2026-06-15',
          shiftName: 'MORNING',
          warehouseId: 'wh-main',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-pork-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          requestedQty: 18,
          issuedQty: 18,
          receivedBy: 'chef-1',
          receivedByName: 'Bếp trưởng Mai',
          receivedAt: '2026-06-15T08:00:00Z',
          isReceivedByKitchen: true,
          receiptStatus: 'RECEIVED',
        },
      ]);
      return;
    }

    if (endpoint === 'issue-vs-return') {
      await fulfillJson(route, [
        {
          issueId: 'issue-1',
          issueCode: 'PXB-20260615-M',
          issueDate: '2026-06-15',
          shiftName: 'MORNING',
          ingredientId: 'ing-pork-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          issuedQty: 18,
          returnedQty: 1,
          wastedQty: 0,
          usedQty: 17,
          varianceQty: 1,
        },
      ]);
      return;
    }

    if (endpoint === 'audit-changes/page') {
      await fulfillJson(route, {
        items: [
          {
            auditId: 'audit-import-1',
            changedAt: '2026-06-15T06:30:00Z',
            changedBy: 'admin',
            changedByName: 'Admin Import',
            businessArea: 'Import',
            entityName: 'ProductionPlan',
            entityId: 'plan-1',
            fieldName: 'servings',
            oldValue: '100',
            newValue: '120',
            reason: 'Import thực đơn ca sáng',
          },
          {
            auditId: 'audit-receipt-1',
            changedAt: '2026-06-15T07:30:00Z',
            changedBy: 'warehouse',
            changedByName: 'Thủ kho Lan',
            businessArea: 'Receipt',
            entityName: 'InventoryReceipt',
            entityId: 'receipt-1',
            fieldName: 'status',
            oldValue: 'Draft',
            newValue: 'Received',
            reason: 'Nhập kho từ PR-20260615-M',
          },
        ],
        limit: 20,
        hasNext: false,
        nextCursorDate: null,
        nextCursorId: null,
      });
      return;
    }

    if (endpoint === 'audit-changes') {
      await fulfillJson(route, [
        {
          auditId: 'audit-import-1',
          changedAt: '2026-06-15T06:30:00Z',
          changedBy: 'admin',
          changedByName: 'Admin Import',
          businessArea: 'Import',
          entityName: 'ProductionPlan',
          entityId: 'plan-1',
          fieldName: 'servings',
          oldValue: '100',
          newValue: '120',
          reason: 'Import thực đơn ca sáng',
        },
        {
          auditId: 'audit-receipt-1',
          changedAt: '2026-06-15T07:30:00Z',
          changedBy: 'warehouse',
          changedByName: 'Thủ kho Lan',
          businessArea: 'Receipt',
          entityName: 'InventoryReceipt',
          entityId: 'receipt-1',
          fieldName: 'status',
          oldValue: 'Draft',
          newValue: 'Received',
          reason: 'Nhập kho từ PR-20260615-M',
        },
      ]);
      return;
    }

    if (endpoint === 'data-quality') {
      await fulfillJson(route, {
        generatedAt: '2026-06-15T08:30:00Z',
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
        issues: [
          {
            issueId: 'dq-missing-bom-1',
            category: 'missing_bom',
            severity: 'error',
            owner: 'Kitchen Admin',
            priorityRank: 2,
            slaHours: 4,
            slaDueAt: '2026-06-15T12:30:00Z',
            slaLabel: 'P2 / 4h',
            entityName: 'Dish',
            entityId: 'dish-1',
            entityCode: 'DISH-BUN-BO',
            entityLabel: 'Bún bò',
            message: 'Món đang có trong KHSX nhưng chưa có định lượng BOM.',
            suggestedAction: 'Bổ sung BOM trước khi chạy demand.',
            route: ROUTES.WEEKLY_MENU,
          },
        ],
      });
      return;
    }

    await fulfillJson(route, []);
  });

  return {
    hasFilteredRequest(endpoint: string) {
      return requests.some(({ endpoint: requestEndpoint, url }) =>
        requestEndpoint === endpoint &&
        url.searchParams.get('dateFrom') === '2026-06-15' &&
        url.searchParams.get('dateTo') === '2026-06-15' &&
        url.searchParams.get('shiftName') === 'MORNING' &&
        url.searchParams.get('limit') === (endpoint.endsWith('/page') ? '20' : '100'),
      );
    },
  };
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
    const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: endpoint.endsWith('/page')
          ? { items: [], limit: 20, hasNext: false, nextCursorDate: null, nextCursorId: null }
          : [],
      }),
    });
  });

  await page.route('**/api/purchase-requests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/approvals/purchase-request/pr-1', async (route) => {
    const body = await route.request().postDataJSON();
    expect(body).toMatchObject({ status: 0, reason: 'Đồng ý mua' });
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

async function stubMobileOperationsSuccess(page: Page) {
  const fulfill = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown, message = 'OK') =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message, data }),
    });

  await page.route('**/api/approvals/inbox**', async (route) => fulfill(route, [
    {
      inboxItemId: 'purchase-pr-mobile',
      targetType: 'purchase-request',
      targetId: 'pr-mobile',
      targetCode: 'PR-20260709-MOBILE',
      itemType: 'purchase',
      title: 'Duyệt đơn mua',
      source: 'PR-20260709-MOBILE',
      ownerRole: 'Thu mua / Quản lý',
      submittedBy: 'Điều phối ca sáng',
      dueDate: '2026-07-09',
      status: 'PENDING',
      reason: 'Đơn mua chờ duyệt trên thiết bị vận hành.',
      nextAction: 'Duyệt đơn mua',
      tone: 'warning',
      route: ROUTES.APPROVALS,
      materials: [{ name: 'Sườn heo', quantity: 15, unit: 'kg' }],
    },
  ]));

  await page.route('**/api/workflow-reports/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';
    if (endpoint === 'ingredient-demand') {
      await fulfill(route, [
        {
          materialRequestId: 'mr-mobile',
          materialRequestCode: 'MR-20260709-MOBILE',
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
      ]);
      return;
    }

    if (endpoint === 'current-stock') {
      await fulfill(route, [
        {
          warehouseId: 'wh-mobile',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          currentQty: 20,
          lastUpdated: '2026-07-09T05:00:00Z',
        },
      ]);
      return;
    }

    if (endpoint === 'kitchen-issues') {
      await fulfill(route, [
        {
          issueId: 'issue-mobile',
          issueCode: 'PXB-20260709-MOBILE',
          issueDate: '2026-07-09',
          shiftName: 'MORNING',
          warehouseId: 'wh-mobile',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          requestedQty: 18,
          issuedQty: 18,
          isReceivedByKitchen: false,
          receiptStatus: 'PENDING',
        },
      ]);
      return;
    }

    await fulfill(route, []);
  });

  await page.route('**/api/purchase-requests**', async (route) => fulfill(route, []));
  await page.route('**/api/dishes/catalog**', async (route) => fulfill(route, []));

  await page.route('**/api/approvals/purchase-request/pr-mobile', async (route) => {
    expect(await route.request().postDataJSON()).toMatchObject({ status: 0, reason: 'Đồng ý trên thiết bị' });
    await fulfill(route, {
      targetType: 'purchase-request',
      targetId: 'pr-mobile',
      status: 'APPROVE',
      oldStatus: 'SENTTOSUPPLIER',
      newStatus: 'APPROVED',
      historyId: 'hist-mobile',
      actionAt: '2026-07-09T05:10:00Z',
    }, 'Thực hiện phê duyệt thành công.');
  });

  await page.route('**/api/inventory-issues', async (route) => {
    expect(await route.request().postDataJSON()).toMatchObject({
      warehouseId: 'wh-mobile',
      materialRequestId: 'mr-mobile',
    });
    await fulfill(route, { issueId: 'issue-mobile', issueCode: 'PXB-20260709-MOBILE' }, 'Đã tạo phiếu xuất kho.');
  });

  await page.route('**/api/inventory-issues/issue-mobile/confirm-receipt', async (route) => {
    expect(await route.request().postDataJSON()).toMatchObject({ hasDiscrepancy: false });
    await fulfill(route, { issueId: 'issue-mobile', issueCode: 'PXB-20260709-MOBILE' }, 'Bếp đã ký nhận phiếu xuất kho.');
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

  test('reports movement loads the next server cursor page', async ({ page }) => {
    await stubProductionReportStages(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.REPORTS);

    await page.getByRole('tab', { name: 'Nhập/xuất kho' }).click();
    const movementTable = page.getByLabel('Bảng biến động kho');
    await expect(movementTable.getByText('Gạo tẻ trang 1')).toBeVisible();

    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(movementTable.getByText('Sườn heo trang 2')).toBeVisible();
    await expect(page.getByText('Trang 2, tải theo cursor')).toBeVisible();
  });

  test('reports cover filters, export, and audit grouping with seeded workflow stages', async ({ page }) => {
    const reportRequests = await stubProductionReportStages(page);
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page);
    await page.goto(ROUTES.REPORTS);
    await expect(page).toHaveURL(ROUTES.REPORTS);

    await page.getByLabel('Từ ngày').fill('2026-06-15');
    await page.getByLabel('Đến ngày').fill('2026-06-15');
    await page.getByLabel('Ca').selectOption('MORNING');

    await expect.poll(() => reportRequests.hasFilteredRequest('ingredient-demand')).toBe(true);

    await expect(page.getByText('Sườn heo').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Nhu cầu NVL' }).click();
    await expect(page.getByText('Bún bò').first()).toBeVisible();
    await expect(page.getByLabel('Bảng nhu cầu nguyên liệu').getByText('Thiếu nguyên liệu')).toBeVisible();

    await page.getByRole('tab', { name: 'Nhu cầu mua' }).click();
    await expect(page.getByText('Nhà cung cấp A')).toBeVisible();
    await page.getByRole('tab', { name: 'Tồn kho' }).click();
    await expect(page.getByText('Kho chính').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Nhập/xuất kho' }).click();
    await expect(page.getByText('Nhập kho').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Xuất bếp' }).click();
    await expect(page.getByText('PXB-20260615-M').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Sử dụng thực tế' }).click();
    await expect(page.getByText('17 kg')).toBeVisible();

    await page.getByRole('tab', { name: 'Data quality' }).click();
    await expect(page.getByText('Kitchen Admin')).toBeVisible();
    await expect(page.getByText('P2 / 4h')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', ROUTES.WEEKLY_MENU);

    await page.getByRole('tab', { name: 'Audit' }).click();
    await expect.poll(() => reportRequests.hasFilteredRequest('audit-changes/page')).toBe(true);
    await expect(page.getByText('Mảng nghiệp vụ')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Import', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Receipt', exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(downloadPath).toBeTruthy();

    const csv = await readFile(downloadPath!, 'utf8');
    expect(csv).toContain('Mảng nghiệp vụ');
    expect(csv).toContain('Import');
    expect(csv).toContain('Receipt');
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
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Duyệt' }).first().click();
    await expect(page.getByRole('heading', { name: 'Xác nhận duyệt chứng từ' })).toBeVisible();
    await page.getByLabel('Ghi chú duyệt (tùy chọn)').fill('Đồng ý mua');
    await page.getByRole('button', { name: 'Duyệt' }).last().click();
    await expect.poll(() => dialogMessages).toContain('Đã duyệt thành công.');
  });

  for (const viewport of [
    { name: 'tablet', width: 768, height: 960 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`approve, warehouse issue, and kitchen signoff work at ${viewport.name}`, async ({ page }) => {
      await stubMobileOperationsSuccess(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      await page.goto(ROUTES.APPROVALS);
      const dialogMessages: string[] = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });
      await page.getByRole('button', { name: 'Duyệt' }).first().click();
      await page.getByLabel('Ghi chú duyệt (tùy chọn)').fill('Đồng ý trên thiết bị');
      await page.getByRole('button', { name: 'Duyệt' }).last().click();
      await expect.poll(() => dialogMessages).toContain('Đã duyệt thành công.');
      await expectNoPageOverflow(page);

      await page.goto(ROUTES.WAREHOUSE);
      await page.getByRole('button', { name: 'Tạo phiếu xuất kho' }).click();
      await expect(page.getByText('Đã tạo phiếu xuất kho').first()).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto(ROUTES.CHEF_DASHBOARD);
      await page.getByRole('checkbox', { name: 'Ký nhận Sườn heo' }).click();
      await expect(page.getByText('Đã ký nhận nguyên liệu')).toBeVisible();
      await expectNoPageOverflow(page);
    });
  }
});
