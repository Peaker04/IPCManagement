import { type Page } from '@playwright/test';
import { phase09Workbench } from '../../phase9-test-fixture';

// phase18-body-start
export async function stubPurchasingSubmitFailure(page: Page) {
  await page.route('**/api/supplemental-material-requests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false },
      }),
    });
  });
  await page.route('**/api/purchase-orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });
  await page.route('**/api/purchase-workflow/workbench**', async (route) => {
    const serviceDate = phase09Workbench.serviceDates[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: {
          ...phase09Workbench,
          selectedStage: 'submitted',
          serviceDates: [{
            ...serviceDate,
            currentStage: 'submitted',
            purchaseRequestId: 'pr-1',
            purchaseRequestCode: 'PR-20260615-FULLDAY',
            purchaseRequestStatus: 'DRAFT',
            orderCount: 0,
            receivingLineCount: 0,
            fullyReceivedLineCount: 0,
          }],
        },
      }),
    });
  });

  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: { items: [], limit: 20, hasNext: false, nextCursor: null } }),
    });
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/purchase-plan')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: [
            {
              periodKey: '2026-06-15',
              groupBy: 'day',
              periodStart: '2026-06-15',
              periodEnd: '2026-06-15',
              ingredientId: 'ing-1',
              ingredientName: 'Sườn heo',
              unitId: 'unit-1',
              unitName: 'kg',
              requiredQty: 10,
              currentStockQty: 0,
              pendingReceiptQty: 0,
              shortageQty: 10,
              suggestedPurchaseQty: 10,
              estimatedUnitPrice: 120000,
              estimatedAmount: 1200000,
              supplierId: 'sup-1',
              supplierName: 'Nhà cung cấp A',
              expectedDeliveryDate: '2026-06-15',
              warnings: ['price_variance'],
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

  await page.route('**/api/purchase-requests**', async (route) => {
    const request = {
      purchaseRequestId: 'pr-1',
      purchaseRequestCode: 'PR-20260615-FULLDAY',
      materialRequestId: 'mr-1',
      purchaseForDate: '2026-06-15',
      status: 'DRAFT',
      lines: [
        {
          purchaseRequestLineId: 'prl-1',
          materialRequestLineId: 'mrl-1',
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
          expectedDeliveryDate: '2026-06-15',
          note: null,
        },
      ],
    };
    const isPage = new URL(route.request().url()).pathname.endsWith('/page');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: isPage
          ? { items: [request], totalCount: 1, pageNumber: 1, pageSize: 8, totalPages: 1, hasPrev: false, hasNext: false }
          : [request],
      }),
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
