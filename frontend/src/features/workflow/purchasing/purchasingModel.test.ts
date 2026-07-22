import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  workflowApi,
  type ConfirmPurchaseLineSupplierRequest,
  type PurchaseRequestResult,
  type WarehouseDto,
  type WarehousePurchaseReceiptRequest,
} from '../workflowApi';
import {
  PURCHASING_STAGES,
  formatPurchaseRequestCandidate,
  getActionableDraftPurchaseRequests,
  getSelectedReceiptWarehouseId,
  mapPurchasePlanLines,
  mapPurchaseRequestLines,
  mapWarehouseOptions,
  resolveNextPurchasingAction,
  resolvePurchasingRouteState,
} from './purchasingModel';

const makePurchaseRequest = (status: string, id: string): PurchaseRequestResult => ({
  purchaseRequestId: id,
  purchaseRequestCode: `PR-${id}`,
  materialRequestId: `material-${id}`,
  purchaseForDate: '2026-07-20',
  status,
  lines: [{
    purchaseRequestLineId: `line-${id}`,
    materialRequestLineId: `material-line-${id}`,
    ingredientId: 'ingredient-1',
    ingredientName: 'Gạo',
    supplierId: '',
    supplierName: '',
    unitId: 'unit-1',
    unitName: 'kg',
    requiredQty: 100,
    currentStockQty: 40,
    purchaseQty: 60,
    estimatedUnitPrice: 20_000,
  }],
});

describe('purchasing model', () => {
  const serviceDates = [
    {
      serviceDate: '2026-07-20',
      scope: 'FULLDAY',
      currentStage: 'supplier-price',
      approvedDemandCount: 1,
      shortageLineCount: 2,
      supplierReadyLineCount: 0,
      blockingExceptionCount: 0,
      purchaseRequestStatus: 'DRAFT',
      orderCount: 0,
      receivingLineCount: 0,
      fullyReceivedLineCount: 0,
      approvedDemands: [],
      purchaseLines: [],
    },
    {
      serviceDate: '2026-07-22',
      scope: 'FULLDAY',
      currentStage: 'receiving',
      approvedDemandCount: 1,
      shortageLineCount: 1,
      supplierReadyLineCount: 1,
      blockingExceptionCount: 0,
      purchaseRequestStatus: 'APPROVED',
      orderCount: 1,
      receivingLineCount: 1,
      fullyReceivedLineCount: 0,
      approvedDemands: [],
      purchaseLines: [],
    },
  ];

  it('defines the exact six-stage operational sequence', () => {
    expect(PURCHASING_STAGES.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'demand', label: 'Nhu cầu đã duyệt' },
      { id: 'supplier-price', label: 'Chọn nhà cung cấp và giá' },
      { id: 'exception', label: 'Xử lý ngoại lệ giá' },
      { id: 'submitted', label: 'Gửi đề xuất mua' },
      { id: 'approved-order', label: 'Duyệt và tạo đơn' },
      { id: 'receiving', label: 'Theo dõi nhập kho' },
    ]);
  });

  it('restores valid week, date, and an inspectable completed stage from the URL', () => {
    expect(resolvePurchasingRouteState(
      { week: '2026-07-20', date: '2026-07-22', stage: 'exception' },
      serviceDates,
      new Date('2026-07-22T08:00:00+07:00'),
    )).toEqual({
      week: '2026-07-20',
      date: '2026-07-22',
      stage: 'exception',
      scope: 'FULLDAY',
    });
  });

  it('keeps a valid week while replacing cross-week dates and blocked future stages', () => {
    expect(resolvePurchasingRouteState(
      { week: '2026-07-20', date: '2026-07-29', stage: 'receiving' },
      serviceDates,
      new Date('2026-07-22T08:00:00+07:00'),
    )).toEqual({
      week: '2026-07-20',
      date: '2026-07-20',
      stage: 'supplier-price',
      scope: 'FULLDAY',
    });
  });

  it('resolves malformed URL state to the current Monday and an authoritative stage', () => {
    expect(resolvePurchasingRouteState(
      { week: 'not-a-date', date: 'also-invalid', stage: 'unknown' },
      serviceDates,
      new Date('2026-07-22T08:00:00+07:00'),
    )).toEqual({
      week: '2026-07-20',
      date: '2026-07-20',
      stage: 'supplier-price',
      scope: 'FULLDAY',
    });
  });

  it('keeps an empty week deterministic without inventing a service date', () => {
    expect(resolvePurchasingRouteState(
      { week: '2026-07-20' },
      [],
      new Date('2026-07-22T08:00:00+07:00'),
    )).toEqual({
      week: '2026-07-20',
      date: undefined,
      stage: 'demand',
      scope: 'FULLDAY',
    });
  });

  it.each([
    [undefined, 'blocked', undefined, 'Chưa có nhu cầu đã duyệt trong tuần này.'],
    [serviceDates[0], 'action', 'Xác nhận nhà cung cấp', undefined],
    [{ ...serviceDates[0], currentStage: 'exception', blockingExceptionCount: 1 }, 'action', 'Gửi duyệt ngoại lệ giá', undefined],
    [{ ...serviceDates[0], currentStage: 'submitted', purchaseRequestStatus: 'SENTTOSUPPLIER' }, 'action', 'Mở phê duyệt đề xuất', undefined],
    [{ ...serviceDates[0], currentStage: 'submitted', purchaseRequestStatus: 'REJECTED' }, 'recovery', 'Sửa đề xuất mua', 'Đề xuất mua đã bị từ chối.'],
    [{ ...serviceDates[0], currentStage: 'approved-order', purchaseRequestStatus: 'APPROVED' }, 'action', 'Tạo đơn đặt hàng', undefined],
    [serviceDates[1], 'action', 'Mở màn hình nhập kho', undefined],
    [{ ...serviceDates[1], fullyReceivedLineCount: 1 }, 'complete', undefined, 'Đã nhận đủ.'],
  ] as const)('maps authoritative state to one next action or blocker', (serviceDate, kind, label, message) => {
    expect(resolveNextPurchasingAction(serviceDate)).toMatchObject({ kind, label, message });
  });

  it('surfaces server blockers and stale/error recovery without losing route context', () => {
    expect(resolveNextPurchasingAction(serviceDates[0], {
      serverBlocker: 'Đơn vị chưa được chuẩn hóa. Không thể tiếp tục mua dòng này.',
    })).toEqual({
      kind: 'blocked',
      message: 'Đơn vị chưa được chuẩn hóa. Không thể tiếp tục mua dòng này.',
    });
    expect(resolveNextPurchasingAction(serviceDates[0], { conflict: true })).toEqual({
      kind: 'recovery',
      label: 'Tải lại dữ liệu',
      message: 'Dữ liệu đã thay đổi trên máy chủ. Tải lại trước khi tiếp tục.',
    });
    expect(resolveNextPurchasingAction(serviceDates[0], { loadError: true })).toEqual({
      kind: 'recovery',
      label: 'Thử lại',
      message: 'Không tải được quy trình thu mua. Kiểm tra kết nối và thử lại. Các lựa chọn chưa được lưu.',
    });
  });

  it('maps shortage plans without dropping stock already pending receipt', () => {
    const [line] = mapPurchasePlanLines([{
      periodKey: '2026-07-20',
      periodStart: '2026-07-20',
      ingredientId: 'ingredient-1',
      ingredientName: 'Gạo',
      requiredQty: 100,
      currentStockQty: 25,
      pendingReceiptQty: 15,
      unitName: 'kg',
      supplierName: null,
      estimatedUnitPrice: null,
      shortageQty: 60,
      warnings: [],
    }]);

    expect(line).toMatchObject({ available: 40, status: 'Thiếu hàng', nextAction: 'Đề xuất mua', tone: 'warning' });
    expect(line.estimatedUnitPrice).toBeUndefined();
  });

  it('keeps request identifiers and supplier action semantics for mutations', () => {
    const [line] = mapPurchaseRequestLines([{
      purchaseRequestId: 'request-1',
      purchaseRequestCode: 'PR-001',
      materialRequestId: 'material-1',
      purchaseForDate: '2026-07-20',
      status: 'DRAFT',
      lines: [{
        purchaseRequestLineId: 'line-1',
        materialRequestLineId: 'material-line-1',
        ingredientId: 'ingredient-1',
        ingredientName: 'Gạo',
        supplierId: '',
        supplierName: '',
        unitId: 'unit-1',
        unitName: 'kg',
        requiredQty: 100,
        currentStockQty: 40,
        purchaseQty: 60,
        estimatedUnitPrice: 20_000,
      }],
    }]);

    expect(line).toMatchObject({ purchaseRequestId: 'request-1', purchaseRequestLineId: 'line-1', nextAction: 'Chọn nhà cung cấp' });
  });

  it('labels an existing proposal in the material-request candidate', () => {
    expect(formatPurchaseRequestCandidate({ materialRequestCode: 'MR-001', requestDate: '2026-07-20', actionableLineCount: 3, hasExistingPurchaseRequest: true }))
      .toContain('Đã có đề xuất');
  });

  it('keeps only actionable DRAFT requests when backend pages contain mixed statuses', () => {
    const emptyDraft = { ...makePurchaseRequest('DRAFT', 'empty'), lines: [] };
    const requests = [
      makePurchaseRequest('SENTTOSUPPLIER', 'submitted'),
      makePurchaseRequest('DRAFT', 'draft'),
      makePurchaseRequest('APPROVED', 'approved'),
      emptyDraft,
    ];

    expect(getActionableDraftPurchaseRequests(requests).map((request) => request.purchaseRequestId))
      .toEqual(['draft']);
  });

  it('uses the dedicated warehouse catalog when it is empty or contains more than 20 warehouses', () => {
    expect(mapWarehouseOptions([])).toEqual([]);

    const warehouses: WarehouseDto[] = Array.from({ length: 205 }, (_, index) => ({
      warehouseId: `warehouse-${index + 1}`,
      warehouseCode: `WH-${index + 1}`,
      warehouseName: `Kho ${index + 1}`,
    }));
    const options = mapWarehouseOptions(warehouses);

    expect(options).toHaveLength(205);
    expect(options[204]).toEqual({ warehouseId: 'warehouse-205', warehouse: 'Kho 205' });
  });

  it('requires an explicit warehouse selection instead of silently using the first catalog item', () => {
    expect(getSelectedReceiptWarehouseId({}, 'order-1')).toBe('');
    expect(getSelectedReceiptWarehouseId({ 'order-1': 'warehouse-25' }, 'order-1')).toBe('warehouse-25');
  });
});

const createWorkflowApiStore = () => configureStore({
  reducer: {
    [workflowApi.reducerPath]: workflowApi.reducer,
    auth: (state = { token: null }) => state,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(workflowApi.middleware),
});

const jsonResponse = (data: unknown) => new Response(
  JSON.stringify({ success: true, data }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

describe('phase 09 purchasing API contract', () => {
  beforeEach(() => {
    const NativeRequest = globalThis.Request;
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === 'string' && input.startsWith('/')
            ? `http://localhost${input}`
            : input,
          init,
        );
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serializes the bounded Monday workbench query without inventing scope fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      weekStart: '2026-07-20',
      weekEnd: '2026-07-26',
      selectedDate: '2026-07-22',
      selectedStage: 'exception',
      page: 2,
      pageSize: 8,
      totalItems: 0,
      totalPages: 0,
      stageCounts: {
        demand: 0,
        supplierPrice: 0,
        exception: 0,
        submittedRequest: 0,
        approvedOrder: 0,
        receivingProgress: 0,
      },
      serviceDates: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = createWorkflowApiStore();

    await store.dispatch(workflowApi.endpoints.getPurchaseWorkbench.initiate({
      week: '2026-07-20',
      date: '2026-07-22',
      stage: 'exception',
      page: 2,
      pageSize: 8,
    }));

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.pathname).toBe('/api/purchase-workflow/workbench');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      week: '2026-07-20',
      date: '2026-07-22',
      stage: 'exception',
      page: '2',
      pageSize: '8',
    });
  });

  it('sends only authorized supplier and Warehouse receipt inputs', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request);
      return jsonResponse({});
    }));
    const store = createWorkflowApiStore();
    const supplierRequest: ConfirmPurchaseLineSupplierRequest = {
      purchaseRequestId: 'request-1',
      purchaseRequestLineId: 'line-1',
      week: '2026-07-20',
      data: {
        evidenceType: 'EffectiveQuotation',
        evidenceId: 'quotation-1',
        supplierId: 'supplier-1',
        proposedUnitPrice: 25_000,
        proposedDeliveryDate: '2026-07-22',
        expectedDecisionVersion: 3,
        note: 'Giao trước 06:00',
      },
    };
    const receiptRequest: WarehousePurchaseReceiptRequest = {
      purchaseOrderId: 'order-1',
      idempotencyKey: 'receipt-attempt-1',
      warehouseId: 'warehouse-1',
      receiptDate: '2026-07-22',
      lines: [{
        purchaseOrderLineId: 'order-line-1',
        actualQuantity: 10,
        actualUnitId: 'unit-kg',
        actualUnitPrice: 25_000,
        lotNumber: 'LOT-01',
      }],
    };

    await store.dispatch(workflowApi.endpoints.confirmLineSupplier.initiate(supplierRequest));
    await store.dispatch(workflowApi.endpoints.recordWarehousePurchaseReceipt.initiate({
      week: '2026-07-20',
      data: receiptRequest,
    }));

    const supplierBody = await requests[0].json();
    const receiptBody = await requests[1].json();
    expect(supplierBody).toEqual(supplierRequest.data);
    expect(receiptBody).toEqual(receiptRequest);
    expect(JSON.stringify([supplierBody, receiptBody])).not.toMatch(
      /actor|referencePrice|variancePercent|serverPath|ledgerId/i,
    );
  });

  it('invalidates only the workbench week touched by supplier confirmation', async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requestedUrls.push(request.url);
      if (request.method === 'GET') {
        const week = new URL(request.url).searchParams.get('week') ?? '';
        return jsonResponse({
          weekStart: week,
          weekEnd: week === '2026-07-20' ? '2026-07-26' : '2026-08-02',
          page: 1,
          pageSize: 8,
          totalItems: 0,
          totalPages: 0,
          stageCounts: {
            demand: 0,
            supplierPrice: 0,
            exception: 0,
            submittedRequest: 0,
            approvedOrder: 0,
            receivingProgress: 0,
          },
          serviceDates: [],
        });
      }
      return jsonResponse({});
    }));
    const store = createWorkflowApiStore();

    await store.dispatch(workflowApi.endpoints.getPurchaseWorkbench.initiate({ week: '2026-07-20' }));
    await store.dispatch(workflowApi.endpoints.getPurchaseWorkbench.initiate({ week: '2026-07-27' }));
    await store.dispatch(workflowApi.endpoints.confirmLineSupplier.initiate({
      purchaseRequestId: 'request-1',
      purchaseRequestLineId: 'line-1',
      week: '2026-07-20',
      data: {
        evidenceType: 'EffectiveQuotation',
        evidenceId: 'quotation-1',
        supplierId: 'supplier-1',
        proposedUnitPrice: 25_000,
        proposedDeliveryDate: '2026-07-22',
        expectedDecisionVersion: 0,
      },
    }));

    const workbenchWeeks = requestedUrls
      .filter((url) => url.includes('/purchase-workflow/workbench'))
      .map((url) => new URL(url).searchParams.get('week'));
    expect(workbenchWeeks.filter((week) => week === '2026-07-20')).toHaveLength(2);
    expect(workbenchWeeks.filter((week) => week === '2026-07-27')).toHaveLength(1);
  });
});
