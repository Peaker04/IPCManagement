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

  it('requires an exact reconciliation scope and sends expectedVersion when completing a batch', async () => {
    const batches = [
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
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(batches))
      .mockResolvedValueOnce(jsonResponse(batches[0]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      reconciliationApi.getReconciliationSummary('2026-09-21', 'DAV')
    ).rejects.toThrow(/không có lô đối soát/i);

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
    expect((result.items[0] as Record<string, unknown>).categoryName).toBeUndefined();
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
