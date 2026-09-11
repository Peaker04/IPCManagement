import { expect, type Page } from '@playwright/test';
import { ROUTES } from '../../../src/lib/routeConfig';

// phase18-body-start
export async function stubMobileOperationsSuccess(page: Page) {
  const fulfill = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown, message = 'OK') =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message, data }),
    });

  await page.route('**/api/approvals/inbox**', async (route) => fulfill(route, {
    items: [{
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
    }], limit: 20, hasNext: false, nextCursor: null,
  }));

  await page.route('**/api/workflow-reports/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/workflow-reports/')[1] ?? '';
    if (endpoint === 'ingredient-demand/page') {
      await fulfill(route, {
        items: [{
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
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
        shortageCount: 1,
      });
      return;
    }

    if (endpoint === 'material-request-candidates/page') {
      await fulfill(route, {
        items: [{
          materialRequestId: 'mr-mobile',
          materialRequestCode: 'MR-20260709-MOBILE',
          requestDate: '2026-07-09',
          requestScope: 'FULLDAY',
          status: 'CONFIRMED',
          actionableLineCount: 1,
          actionableQuantity: 18,
          hasExistingPurchaseRequest: false,
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      });
      return;
    }

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

    if (endpoint === 'current-stock/page') {
      await fulfill(route, {
        items: [{
          warehouseId: 'wh-mobile',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rib',
          ingredientName: 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          currentQty: 20,
          lastUpdated: '2026-07-09T05:00:00Z',
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      });
      return;
    }

    if (endpoint === 'kitchen-issues' || endpoint === 'kitchen-issues/page') {
      const requestedServiceDate = new URL(route.request().url()).searchParams.get('dateFrom') ?? '2026-07-09';
      const issue = {
          issueId: 'issue-mobile',
          issueCode: 'PXB-20260709-MOBILE',
          issueDate: requestedServiceDate,
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
      };
      await fulfill(route, endpoint.endsWith('/page')
        ? { items: [issue], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false }
        : [issue]);
      return;
    }

    await fulfill(route, []);
  });

  await page.route('**/api/production-plans/daily**', async (route) => {
    await fulfill(route, {
      serviceDate: '2026-07-09',
      customerId: 'customer-mobile',
      customerCode: 'IPC',
      customerName: 'IPC Bắc Ninh',
      shiftName: 'MORNING',
      totalPlans: 1,
      sentPlans: 1,
      totalDishes: 1,
      totalServings: 120,
      totalRequiredQty: 18,
      suggestedPurchaseQty: 0,
      warnings: [],
      plans: [
        {
          planId: 'plan-mobile',
          planCode: 'KHSX-20260709-MOBILE',
          planDate: '2026-07-09',
          customerId: 'customer-mobile',
          customerCode: 'IPC',
          customerName: 'IPC Bắc Ninh',
          status: 'SENT_TO_KITCHEN',
          sentToKitchenAt: '2026-07-09T05:00:00Z',
          sentToKitchenByName: 'Điều phối ca sáng',
          lines: [
            {
              planLineId: 'plan-line-mobile',
              dishId: 'dish-bun-bo',
              dishName: 'Bún bò',
              shiftName: 'MORNING',
              totalServings: 120,
              priceTierAmount: 30000,
              bomScope: 'global',
              totalRequiredQty: 18,
              suggestedPurchaseQty: 0,
              hasKitchenIssue: true,
              isReceivedByKitchen: false,
            },
          ],
        },
      ],
    });
  });

  await page.route('**/api/purchase-requests**', async (route) => fulfill(route, []));
  await page.route('**/api/supplemental-material-requests**', async (route) => fulfill(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 100,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));
  await page.route('**/api/purchase-orders', async (route) => fulfill(route, []));
  await page.route('**/api/purchase-orders/page**', async (route) => fulfill(route, {
    page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false },
    orderCountByRequest: {},
  }));
  await page.route('**/api/warehouses/selector**', async (route) => fulfill(route, [{
    warehouseId: 'wh-mobile',
    warehouseCode: 'MAIN',
    warehouseName: 'Kho chính',
  }]));
  await page.route('**/api/dishes/catalog**', async (route) => fulfill(route, []));
  await page.route('**/api/inventory-returns**', async (route) => fulfill(route, {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 100,
    totalPages: 0,
    hasPrev: false,
    hasNext: false,
  }));

  await page.route('**/api/approvals/purchase-request/pr-mobile', async (route) => {
    expect(await route.request().postDataJSON()).toMatchObject({ status: 'Approve', reason: 'Đồng ý trên thiết bị' });
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
