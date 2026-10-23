import { afterEach, describe, expect, it, vi } from 'vitest';
import { purchasingApi } from '../api/purchasingApi';
import { warehouseApi } from '../api/warehouseApi';
import { reconciliationApi } from '../api/reconciliationApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { reportsApi } from '../api/reportsApi';
import { chefApi } from '../api/chefApi';
import { systemApi } from '../api/systemApi';
import { authApi } from '../api/authApi';
import { adminApi } from '../api/adminApi';
import { mrxApi } from '../api/mrxApi';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Frontend API contracts against backend DTOs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('propagates logout transport failure instead of fabricating success', async () => {
    localStorage.setItem('ipc_v3_token', 'token');
    localStorage.setItem('ipc_v3_user', '{}');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(authApi.logout()).rejects.toThrow('offline');
    expect(localStorage.getItem('ipc_v3_token')).toBe('token');
  });

  it('changes operational mode with the latest version and no optimistic local write', async () => {
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    const response = { mode: 'MATERIAL_RECONCILIATION' as const, label: 'Đối chiếu nguyên liệu', version: 8, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);

    const result = await systemApi.setOperationalMode('MATERIAL_RECONCILIATION', 7, 'Hoàn tất công việc đang mở');

    expect(result).toEqual(response);
    expect(localStorage.getItem('ipc_v3_mode')).toBe('DEFAULT');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/system-operation-mode$/), expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ mode: 'MATERIAL_RECONCILIATION', expectedVersion: 7, confirmed: true, reason: 'Hoàn tất công việc đang mở' }),
    }));
  });

  it('creates purchase orders only through the approved purchase-request endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await purchasingApi.createPurchaseOrdersFromRequest('11111111-1111-1111-1111-111111111111');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/purchase-orders\/from-request\/11111111-1111-1111-1111-111111111111$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('maps inventory issue identity and receipt state without fabricated business defaults', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            issueId: '22222222-2222-2222-2222-222222222222',
            issueCode: 'PX-001',
            issueDate: '2026-09-21',
            shiftName: null,
            warehouseName: null,
            receivedAt: null,
            lines: [
              {
                issueLineId: '33333333-3333-3333-3333-333333333333',
                ingredientId: '44444444-4444-4444-4444-444444444444',
                ingredientName: null,
                unitId: '55555555-5555-5555-5555-555555555555',
                unitName: null,
                requestedQty: 4.5,
                issuedQty: 4.25,
              },
            ],
          },
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const [issue] = await warehouseApi.getIssues();

    expect(issue).toMatchObject({
      issueId: '22222222-2222-2222-2222-222222222222',
      shiftName: '—',
      warehouseName: '—',
      status: 'ISSUED',
    });
    expect(issue.lines[0]).toEqual({
      lineId: '33333333-3333-3333-3333-333333333333',
      ingredientCode: '44444444-4444-4444-4444-444444444444',
      ingredientName: '—',
      unit: '—',
      requestedQty: 4.5,
      issuedQty: 4.25,
    });
  });

  it('does not fall back to another customer when weekly-menu scope is unknown', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { customerId: 'customer-1', customerCode: 'KNOWN', customerName: 'Khách hàng đã biết' },
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      weeklyMenuApi.getWeeklyMenuData('UNKNOWN', '2026-09-21')
    ).rejects.toThrow(/không tìm thấy khách hàng/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves report page metadata and requests the selected server page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [], totalCount: 51, pageNumber: 2, pageSize: 25, totalPages: 3, hasPrev: true, hasNext: true,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const page = await reportsApi.getDemand('2026-10', 'customer-1', 2, 25);

    expect(page).toMatchObject({ totalCount: 51, pageNumber: 2, pageSize: 25, totalPages: 3, hasPrev: true, hasNext: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/pageNumber=2&pageSize=25/),
      expect.any(Object)
    );
  });

  it('loads every authoritative demand page instead of silently truncating a weekly workbench', async () => {
    const firstPage = { items: [{ ingredientId: 'i-1' }], totalCount: 2, pageNumber: 1, pageSize: 1, remainingToIssueCount: 2, pendingKitchenReceiptCount: 0 };
    const secondPage = { ...firstPage, items: [{ ingredientId: 'i-2' }], pageNumber: 2 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse(secondPage));
    vi.stubGlobal('fetch', fetchMock);

    const result = await weeklyMenuApi.getAllDemand('2026-10-05', '2026-10-11', 'customer-1', 1);

    expect(result.items.map((item) => item.ingredientId)).toEqual(['i-1', 'i-2']);
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/pageNumber=2&pageSize=1/), expect.any(Object));
  });

  it('preserves Chef issue pagination and requests the selected server page', async () => {
    const dailyPlan = { serviceDate: '2026-10-05', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', shiftName: 'MORNING', totalPlans: 0, sentPlans: 0, totalDishes: 0, totalServings: 0, warnings: [], plans: [] };
    const issuePage = { items: [], totalCount: 26, pageNumber: 2, pageSize: 25, totalPages: 2, hasPrev: true, hasNext: false };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(dailyPlan))
      .mockResolvedValueOnce(jsonResponse(issuePage));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chefApi.getChefDashboardData('2026-10-05', 'MORNING', 'customer-1', 2, 25);

    expect(result.issuePage).toEqual({ totalCount: 26, pageNumber: 2, pageSize: 25, totalPages: 2, hasPrev: true, hasNext: false });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/pageNumber=2&pageSize=25/), expect.any(Object));
  });

  it('loads reconciliation detail by exact batch identity and sends expectedVersion when completing it', async () => {
    const batch =
      {
        batchId: '66666666-6666-6666-6666-666666666666',
        menuVersionId: '77777777-7777-7777-7777-777777777777',
        quantityImportBatchId: '88888888-8888-8888-8888-888888888888',
        status: 'IN_PROGRESS',
        version: 7,
        createdAt: '2026-09-20T00:00:00Z',
        readyAt: '2026-09-20T01:00:00Z',
        completedAt: null,
        customerId: '99999999-9999-9999-9999-999999999999',
        customerCode: 'OTHER',
        customerName: 'Khách hàng khác',
        weekStartDate: '2026-09-21',
        weekEndDate: '2026-09-27',
        dailyReview: { weeklyStatus: 'IN_PROGRESS', lines: [] },
        lines: [],
      };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(batch))
      .mockResolvedValueOnce(jsonResponse(batch));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await reconciliationApi.getReconciliationSummary(
      '66666666-6666-6666-6666-666666666666',
      '2026-09-21'
    );
    expect(summary.batchId).toBe('66666666-6666-6666-6666-666666666666');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/api\/reconciliation\/batches\/66666666-6666-6666-6666-666666666666$/),
      expect.any(Object)
    );

    await reconciliationApi.completeReconciliation(
      '66666666-6666-6666-6666-666666666666',
      7
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/reconciliation\/batches\/66666666-6666-6666-6666-666666666666\/complete$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedVersion: 7 }),
      })
    );
  });

  it('sends exact MRX lifecycle and actor-handoff contracts', async () => {
    const batchId = '66666666-6666-6666-6666-666666666666';
    const dailyLineId = '77777777-7777-7777-7777-777777777777';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const sourceChange = {
      customerId: 'customer-1', weekStartDate: '2026-10-19', expectedBaseMenuVersionId: 'menu-v1', reason: 'Khách hàng điều chỉnh',
      lines: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', dishSlot: 'main', newServings: 120 }],
    };
    await mrxApi.previewSourceChange(sourceChange);
    await mrxApi.submitSourceChange(sourceChange);
    await mrxApi.confirmSourceChange(sourceChange);
    await mrxApi.decideSourceChange('amendment-1', false, 'Khách hàng hủy yêu cầu');
    await mrxApi.previewQuantityImport({ menuVersionId: 'menu-v1', sourceLabel: 'Tuần 43' });
    await mrxApi.commitQuantityImport({ token: 'preview-token', contentFingerprint: 'fingerprint-v2', sourceLabel: 'Tuần 43' });
    await mrxApi.createBatch({ menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1' });
    await mrxApi.markReady(batchId, 2);
    await mrxApi.transferToWarehouse(batchId, 3);
    await mrxApi.createIssue({
      commandId: 'issue-command-1', expectedVersion: 4, issueDate: '2026-10-19',
      reconciliationBatchId: batchId, isSupplemental: false,
      lines: [{
        reconciliationBatchLineId: 'line-1', reconciliationBatchDailyLineId: dailyLineId,
        ingredientId: 'ingredient-1', unitId: 'unit-1', requestedQty: 2, issuedQty: 2,
      }],
    });
    await mrxApi.setDailyDisposition(dailyLineId, { category: 'ACCEPTED_VARIANCE', reason: 'Chấp nhận chênh lệch thực tế', expectedVersion: 1 });
    await mrxApi.completeBatch(batchId, 5);

    const requests = fetchMock.mock.calls.map(([url, init]) => [String(url), init as RequestInit]);
    expect(requests).toEqual(expect.arrayContaining([
      [expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/preview$/), expect.objectContaining({ method: 'POST', body: JSON.stringify(sourceChange) })],
      [expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/mrx-submit$/), expect.objectContaining({ method: 'POST', body: JSON.stringify(sourceChange) })],
      [expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/admin-confirm$/), expect.objectContaining({ method: 'POST', body: JSON.stringify(sourceChange) })],
      [expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/amendment-1\/mrx-decision$/), expect.objectContaining({ method: 'POST', body: JSON.stringify({ approved: false, reason: 'Khách hàng hủy yêu cầu' }) })],
      [expect.stringMatching(/\/api\/reconciliation\/batches\/quantity-import\/preview$/), expect.objectContaining({ method: 'POST', body: JSON.stringify({ menuVersionId: 'menu-v1', sourceLabel: 'Tuần 43' }) })],
      [expect.stringMatching(/\/api\/reconciliation\/batches\/quantity-import\/commit$/), expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'preview-token', contentFingerprint: 'fingerprint-v2', sourceLabel: 'Tuần 43' }) })],
      [expect.stringMatching(/\/api\/reconciliation\/batches$/), expect.objectContaining({ method: 'POST', body: JSON.stringify({ menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1' }) })],
      [expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}/ready$`)), expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 2 }) })],
      [expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}/transfer-to-warehouse$`)), expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 3 }) })],
      [expect.stringMatching(/\/api\/inventory-issues$/), expect.objectContaining({ method: 'POST' })],
      [expect.stringMatching(new RegExp(`/api/reconciliation/daily-lines/${dailyLineId}/disposition$`)), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ category: 'ACCEPTED_VARIANCE', reason: 'Chấp nhận chênh lệch thực tế', expectedVersion: 1 }) })],
      [expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}/complete$`)), expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 5 }) })],
    ]));
  });

  it('uses batch identity and MRX source family for operational reads', async () => {
    const batchId = '66666666-6666-6666-6666-666666666666';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await mrxApi.getSourceChangeInbox();
    await mrxApi.getBatchPage({ customerId: 'customer-1', weekStartDate: '2026-10-19', status: 'READY', pageNumber: 2, pageSize: 25 });
    await mrxApi.getDraftSources();
    await mrxApi.getWeeklySource('customer-1', '2026-10-19');
    await mrxApi.getBatch(batchId);
    await mrxApi.getWarehouseDaily(batchId);
    await mrxApi.getIssues(batchId, 2, 25);
    await mrxApi.getDispositionCategories();
    await mrxApi.getKitchenCooking(batchId);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/mrx-inbox$/),
      expect.stringMatching(/\/api\/reconciliation\/batches\?CustomerId=customer-1&WeekStartDate=2026-10-19&Status=READY&PageNumber=2&PageSize=25$/),
      expect.stringMatching(/\/api\/reconciliation\/batches\/draft-sources$/),
      expect.stringMatching(/\/api\/reconciliation\/weekly-menu\?customerId=customer-1&weekStartDate=2026-10-19$/),
      expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}$`)),
      expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}/warehouse-daily$`)),
      expect.stringMatching(new RegExp(`/api/inventory-issues\\?.*SourceFamily=MATERIAL_RECONCILIATION.*ReconciliationBatchId=${batchId}.*PageNumber=2.*PageSize=25`)),
      expect.stringMatching(/\/api\/reconciliation\/lines\/disposition-categories$/),
      expect.stringMatching(new RegExp(`/api/reconciliation/batches/${batchId}/kitchen-cooking$`)),
    ]));
  });

  it('retrieves ingredients with server pagination metadata and without fabricated categoryName', async () => {
    const pagedPayload = {
      items: [
        {
          ingredientId: '00000000-0000-0000-0000-000000000001',
          ingredientCode: 'NL-01',
          ingredientName: 'Thịt bò tươi',
          isActive: true,
          isFreshDaily: true,
          referencePrice: 150000,
          unitId: '00000000-0000-0000-0000-000000000010',
          unitName: 'kg',
          warehouseId: '00000000-0000-0000-0000-000000000100',
          warehouseName: 'Kho Lạnh Tổng',
        },
      ],
      totalCount: 42,
      pageNumber: 2,
      pageSize: 25,
      totalPages: 2,
      hasPrev: true,
      hasNext: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pagedPayload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApi.getIngredients({ pageNumber: 2, pageSize: 25, searchKeyword: 'bò' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ingredients\?pageNumber=2&pageSize=25&searchKeyword=b%C3%B2/),
      expect.anything()
    );
    expect(result.totalCount).toBe(42);
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(25);
    expect(result.totalPages).toBe(2);
    expect(result.hasPrev).toBe(true);
    expect(result.hasNext).toBe(false);
    expect(result.items[0]).toEqual({
      ingredientId: '00000000-0000-0000-0000-000000000001',
      ingredientCode: 'NL-01',
      ingredientName: 'Thịt bò tươi',
      unitId: '00000000-0000-0000-0000-000000000010',
      unitName: 'kg',
      warehouseId: '00000000-0000-0000-0000-000000000100',
      warehouseName: 'Kho Lạnh Tổng',
      referencePrice: 150000,
      isFreshDaily: true,
      isActive: true,
    });
    expect((result.items[0] as unknown as Record<string, unknown>).categoryName).toBeUndefined();
  });

  it('retrieves dishes with server pagination metadata and exact DTO mapping', async () => {
    const pagedPayload = {
      items: [
        {
          dishId: '00000000-0000-0000-0000-000000000002',
          dishCode: 'M-01',
          dishName: 'Bò xào cần tỏi',
          dishType: 'Món chính',
          dishGroup: 'Nhóm thịt bò',
          isActive: true,
        },
      ],
      totalCount: 15,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pagedPayload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApi.getDishes({ pageNumber: 1, pageSize: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/Dishes\?pageNumber=1&pageSize=25/),
      expect.anything()
    );
    expect(result.totalCount).toBe(15);
    expect(result.pageNumber).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0]).toEqual({
      dishId: '00000000-0000-0000-0000-000000000002',
      dishCode: 'M-01',
      dishName: 'Bò xào cần tỏi',
      dishType: 'Món chính',
      dishGroup: 'Nhóm thịt bò',
      isActive: true,
    });
  });
});
