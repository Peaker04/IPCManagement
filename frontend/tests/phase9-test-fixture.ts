import type { Page, Route } from '@playwright/test';

export const PHASE09_WEEK = '2026-07-20';
export const PHASE09_DATE = '2026-07-22';

export const PHASE09_STAGE_LABELS = [
  'Nhu cầu đã duyệt',
  'Chọn nhà cung cấp và giá',
  'Xử lý ngoại lệ giá',
  'Gửi đề xuất mua',
  'Duyệt và tạo đơn',
  'Theo dõi nhập kho',
] as const;

const purchaseLine = {
  purchaseRequestLineId: 'prl-phase09-rib',
  materialRequestLineId: 'mrl-phase09-rib',
  ingredientId: 'ingredient-rib',
  ingredientName: 'Sườn heo',
  supplierId: 'supplier-an-phat',
  supplierName: 'Thực phẩm An Phát',
  unitId: 'unit-kg',
  unitName: 'kg',
  requiredQty: 18,
  currentStockQty: 3,
  purchaseQty: 15,
  estimatedUnitPrice: 115_000,
  expectedDeliveryDate: PHASE09_DATE,
  note: 'Giao trước 06:00',
  supplierDecisionStatus: 'CONFIRMED',
  currentSupplierDecision: {
    purchaseLineSupplierDecisionId: 'decision-phase09-rib-v1',
    supplierId: 'supplier-an-phat',
    evidenceType: 'EffectiveQuotation',
    evidenceId: 'quotation-phase09-rib',
    evidenceDate: '2026-07-18',
    evidenceReferencePrice: 100_000,
    proposedUnitPrice: 115_000,
    proposedDeliveryDate: PHASE09_DATE,
    confirmedBy: 'purchasing-phase09',
    confirmedAt: '2026-07-20T02:00:00Z',
    decisionFingerprint: 'phase09-decision-v1',
    version: 1,
    status: 'CURRENT',
    supersededByDecisionId: null,
    concurrencyVersion: 1,
  },
  supplierDecisionHistory: [],
};

export const phase09Workbench = {
  weekStart: PHASE09_WEEK,
  weekEnd: '2026-07-26',
  selectedDate: PHASE09_DATE,
  selectedStage: 'receiving',
  page: 1,
  pageSize: 8,
  totalItems: 1,
  totalPages: 1,
  stageCounts: {
    demand: 1,
    supplierPrice: 1,
    exception: 0,
    submittedRequest: 1,
    approvedOrder: 1,
    receivingProgress: 1,
  },
  serviceDates: [{
    serviceDate: PHASE09_DATE,
    scope: 'FULLDAY',
    currentStage: 'receiving',
    approvedDemandCount: 1,
    shortageLineCount: 1,
    supplierReadyLineCount: 1,
    blockingExceptionCount: 0,
    purchaseRequestId: 'pr-phase09',
    purchaseRequestCode: 'PR-20260722-FULLDAY',
    purchaseRequestStatus: 'APPROVED',
    orderCount: 1,
    receivingLineCount: 1,
    fullyReceivedLineCount: 0,
    approvedDemands: [{
      materialRequestId: 'mr-phase09',
      requestCode: 'MR-20260722-FULLDAY',
      serviceDate: PHASE09_DATE,
      scope: 'FULLDAY',
      status: 'APPROVED',
      shortageLineCount: 1,
      currentStage: 'receiving',
      purchaseRequestId: 'pr-phase09',
      purchaseRequestCode: 'PR-20260722-FULLDAY',
      purchaseRequestStatus: 'APPROVED',
    }],
    purchaseLines: [purchaseLine],
  }],
};

export const phase09PurchaseOrdersPage = {
  page: {
    items: [{
      purchaseOrderId: 'po-phase09-an-phat',
      purchaseOrderCode: 'PO-20260722-ANPHAT',
      purchaseRequestId: 'pr-phase09',
      purchaseRequestCode: 'PR-20260722-FULLDAY',
      supplierId: 'supplier-an-phat',
      supplierName: 'Thực phẩm An Phát',
      orderDate: '2026-07-20',
      status: 'PARTIALLY_RECEIVED',
      lines: [{
        purchaseOrderLineId: 'pol-phase09-rib',
        purchaseRequestLineId: 'prl-phase09-rib',
        ingredientId: 'ingredient-rib',
        ingredientName: 'Sườn heo',
        unitId: 'unit-kg',
        unitName: 'kg',
        orderedQty: 15,
        receivedQty: 5,
        unitPrice: 115_000,
        lotNumberRequired: true,
        manufactureDateRequired: false,
        expiryDateRequired: true,
        blockerReason: null,
      }],
    }],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 8,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  },
  orderCountByRequest: { 'pr-phase09': 1 },
};

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: 'OK', data }),
  });
}

export async function stubPhase09Api(page: Page) {
  await page.route('**/api/purchase-workflow/workbench**', async (route) => {
    const requestUrl = new URL(route.request().url());
    await fulfill(route, {
      ...phase09Workbench,
      selectedDate: requestUrl.searchParams.get('date') ?? phase09Workbench.selectedDate,
      selectedStage: requestUrl.searchParams.get('stage') ?? phase09Workbench.selectedStage,
    });
  });
  await page.route('**/api/purchase-orders/page**', async (route) => fulfill(route, phase09PurchaseOrdersPage));
  await page.route('**/api/warehouses/selector**', async (route) => fulfill(route, [{
    warehouseId: 'warehouse-main',
    warehouseCode: 'MAIN',
    warehouseName: 'Kho chính',
  }]));
}
