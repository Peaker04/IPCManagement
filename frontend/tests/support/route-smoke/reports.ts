import { type Page } from '@playwright/test';
import { ROUTES } from '../../../src/lib/routeConfig';
import { phase09Workbench } from '../../phase9-test-fixture';

// phase18-body-start
export async function stubWorkflowReports(page: Page) {
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
  await page.route('**/api/approvals/inbox**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: { items: [], limit: 20, hasNext: false, nextCursor: null } }),
    });
  });

  await page.route('**/api/coordination/customer-contracts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    if (route.request().url().includes('/receipt-price-variance')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            items: [{
              receiptId: 'r1',
              receiptCode: 'PN-01',
              receiptDate: '2026-06-18',
              supplierId: 's1',
              supplierName: 'Nhà cung cấp A',
              ingredientId: 'i1',
              ingredientName: 'Sườn heo',
              unitId: 'u1',
              unitName: 'kg',
              quantity: 1,
              unitPrice: 134000,
              referencePrice: 115000,
              variancePercent: 16.5,
              isWarning: true,
            }],
            totalCount: 7,
            pageNumber: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1),
            pageSize: 6,
            totalPages: 2,
            hasPrev: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1) > 1,
            hasNext: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1) < 2,
          },
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

  await page.route('**/api/workflow-reports/receipt-price-variance**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OK',
        data: {
          items: [
          { receiptId: 'r1', receiptCode: 'PN-01', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i1', ingredientName: 'Sườn heo', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 134000, referencePrice: 115000, variancePercent: 16.5, isWarning: true },
          { receiptId: 'r2', receiptCode: 'PN-02', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i2', ingredientName: 'Thịt gà', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 85000, referencePrice: 83000, variancePercent: 2.4, isWarning: false },
          { receiptId: 'r3', receiptCode: 'PN-03', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i3', ingredientName: 'Cá lóc phi lê', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 110000, referencePrice: 110000, variancePercent: 0, isWarning: false },
          { receiptId: 'r4', receiptCode: 'PN-04', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i4', ingredientName: 'Gạo tẻ', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 18000, referencePrice: 17000, variancePercent: 5.8, isWarning: false },
          { receiptId: 'r5', receiptCode: 'PN-05', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i5', ingredientName: 'Rau cải xanh', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 15000, referencePrice: 12500, variancePercent: 20, isWarning: true },
          { receiptId: 'r6', receiptCode: 'PN-06', receiptDate: '2026-06-18', supplierId: 's2', supplierName: 'Nhà cung cấp B', ingredientId: 'i6', ingredientName: 'Tôm tươi', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 180000, referencePrice: 180000, variancePercent: 0, isWarning: false },
          { receiptId: 'r7', receiptCode: 'PN-07', receiptDate: '2026-06-18', supplierId: 's1', supplierName: 'Nhà cung cấp A', ingredientId: 'i7', ingredientName: 'Thịt ba chỉ', unitId: 'u1', unitName: 'kg', quantity: 1, unitPrice: 125000, referencePrice: 120000, variancePercent: 4.1, isWarning: false },
          ],
          totalCount: 7,
          pageNumber: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1),
          pageSize: 6,
          totalPages: 2,
          hasPrev: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1) > 1,
          hasNext: Number(new URL(route.request().url()).searchParams.get('pageNumber') ?? 1) < 2,
        },
      }),
    });
  });
}
export async function stubProductionReportStages(page: Page) {
  const requests: Array<{ endpoint: string; url: URL }> = [];

  const fulfillJson = (route: Parameters<Parameters<Page['route']>[1]>[0], data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data }),
    });

  await page.route('**/api/approvals/inbox**', async (route) => {
    await fulfillJson(route, { items: [], limit: 20, hasNext: false, nextCursor: null });
  });

  await page.route('**/api/supplemental-material-requests**', async (route) => {
    await fulfillJson(route, { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false });
  });

  await page.route('**/api/purchase-orders', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/purchase-workflow/workbench**', async (route) => {
    await fulfillJson(route, phase09Workbench);
  });

  await page.route('**/api/purchase-orders/page**', async (route) => {
    await fulfillJson(route, {
      page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false },
      orderCountByRequest: {},
    });
  });

  await page.route('**/api/warehouses/selector**', async (route) => {
    await fulfillJson(route, [{ warehouseId: 'wh-main', warehouseCode: 'MAIN', warehouseName: 'Kho chính' }]);
  });

  await page.route('**/api/workflow-reports/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/workflow-reports/')[1] ?? '';
    requests.push({ endpoint, url });

    if (endpoint === 'receipt-price-variance/page') {
      await fulfillJson(route, {
        items: [{
          receiptId: 'receipt-page-1',
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
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 6,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      });
      return;
    }

    if (endpoint === 'ingredient-demand/page') {
      await fulfillJson(route, {
        items: [{
          materialRequestId: 'mr-page-1',
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

    if (endpoint === 'purchase-plan/page') {
      const groupBy = url.searchParams.get('groupBy') === 'week' ? 'week' : 'day';
      await fulfillJson(route, {
        items: [{
          periodKey: groupBy === 'week' ? '2026-06-15/2026-06-21' : '2026-06-15',
          groupBy,
          periodStart: '2026-06-15',
          periodEnd: groupBy === 'week' ? '2026-06-21' : '2026-06-15',
          ingredientId: 'ing-pork-rib',
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
          supplierName: groupBy === 'week' ? 'Nhà cung cấp Tuần' : 'Nhà cung cấp A',
          expectedDeliveryDate: '2026-06-15',
          warnings: ['price_variance'],
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
        totalShortageQty: 15,
        totalEstimatedAmount: 2010000,
      });
      return;
    }

    if (endpoint === 'current-stock/page') {
      await fulfillJson(route, {
        items: [{
          warehouseId: 'wh-main',
          warehouseName: 'Kho chính',
          ingredientId: 'ing-rice',
          ingredientName: 'Gạo tẻ',
          unitId: 'unit-kg',
          unitName: 'kg',
          currentQty: 240,
          lastUpdated: '2026-06-15T07:00:00Z',
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

    if (endpoint === 'kitchen-issues/page') {
      await fulfillJson(route, {
        items: [{
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

    if (endpoint === 'issue-vs-return/page') {
      await fulfillJson(route, {
        items: [{
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

    if (endpoint === 'data-quality/page') {
      const issue = {
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
      };
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
        page: {
          items: [issue],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 8,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
        issues: [issue],
      });
      return;
    }

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

    if (endpoint === 'purchase-plan') {
      const isWeek = url.searchParams.get('groupBy') === 'week';
      await fulfillJson(route, [
        {
          periodKey: isWeek ? '2026-06-15/2026-06-21' : '2026-06-15',
          groupBy: isWeek ? 'week' : 'day',
          periodStart: '2026-06-15',
          periodEnd: isWeek ? '2026-06-21' : '2026-06-15',
          ingredientId: 'ing-pork-rib',
          ingredientName: isWeek ? 'Sườn heo tuần' : 'Sườn heo',
          unitId: 'unit-kg',
          unitName: 'kg',
          requiredQty: isWeek ? 54 : 18,
          currentStockQty: 3,
          pendingReceiptQty: isWeek ? 6 : 0,
          shortageQty: isWeek ? 45 : 15,
          suggestedPurchaseQty: isWeek ? 51 : 15,
          estimatedUnitPrice: 134000,
          estimatedAmount: isWeek ? 6030000 : 2010000,
          supplierId: 'supplier-a',
          supplierName: isWeek ? 'Nhà cung cấp Tuần' : 'Nhà cung cấp A',
          expectedDeliveryDate: '2026-06-15',
          warnings: ['price_variance'],
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
    hasEndpoint(endpoint: string) {
      return requests.some(({ endpoint: requestEndpoint }) => requestEndpoint === endpoint);
    },
    hasFilteredRequest(endpoint: string) {
      return requests.some(({ endpoint: requestEndpoint, url }) =>
        (requestEndpoint === endpoint || requestEndpoint === `${endpoint}/page`) &&
        url.searchParams.get('dateFrom') === '2026-06-15' &&
        url.searchParams.get('dateTo') === '2026-06-15' &&
        url.searchParams.get('shiftName') === 'MORNING' &&
        url.searchParams.has('limit'),
      );
    },
    hasPurchasePlanGroupRequest(groupBy: 'day' | 'week') {
      return requests.some(({ endpoint, url }) =>
        (endpoint === 'purchase-plan' || endpoint === 'purchase-plan/page') &&
        url.searchParams.get('groupBy') === groupBy &&
        url.searchParams.get('dateFrom') === '2026-06-15' &&
        url.searchParams.get('dateTo') === '2026-06-15' &&
        url.searchParams.get('shiftName') === 'MORNING',
      );
    },
  };
}
