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
import { bomApi } from '../api/bomApi';
import { mrxApi } from '../api/mrxApi';
import { queryClient } from '../lib/scopedQuery';
import { serverStateCache } from '../store/serverStateCache';
import { apiClient } from '../api/client';
import { getDraftStorageKey } from '../hooks/useClientDraftPersistence';
import { clearSessionState } from '../store/clearSessionState';
import { offlineMutationQueue } from '../store/offlineMutationQueue';
import type { components } from '../shared/api/contracts/schema';

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

  it('loads supported BOM price tiers from the authorized catalog read endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([25000, 30000, 34000]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await bomApi.getSupportedPriceTiers()).toEqual([25000, 30000, 34000]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/Dishes\/bom-price-tiers$/), expect.any(Object));
    expect(fetchMock.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it('keeps durable MRX provision metadata on create and detail contracts', () => {
    const provision: components['schemas']['MrxStockProvisionDto'] = {
      stockMovementId: '11111111-1111-1111-1111-111111111111',
      ingredientId: '22222222-2222-2222-2222-222222222222',
      unitId: '33333333-3333-3333-3333-333333333333',
      unitName: 'kg',
      provisionedQuantity: 1.5,
    };
    const created: components['schemas']['InventoryIssueCreatedDto'] = {
      issueId: '44444444-4444-4444-4444-444444444444', issueCode: 'ISS-1', concurrencyVersion: 1,
      provisions: [provision],
    };
    const detail: components['schemas']['InventoryIssueDto'] = {
      issueId: created.issueId, sourceFamily: 'MATERIAL_RECONCILIATION', issueCode: created.issueCode,
      issueDate: '2026-11-01', warehouseId: '55555555-5555-5555-5555-555555555555',
      issuedBy: '66666666-6666-6666-6666-666666666666', createdAt: '2026-11-01T00:00:00Z',
      lines: [], provisions: [provision],
    };

    expect(detail.provisions).toEqual(created.provisions);
  });

  it('propagates logout transport failure instead of fabricating success', async () => {
    localStorage.setItem('ipc_v3_token', 'token');
    localStorage.setItem('ipc_v3_user', '{}');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(authApi.logout()).rejects.toThrow('offline');
    expect(localStorage.getItem('ipc_v3_token')).toBe('token');
  });

  it('shares one cookie refresh for parallel unauthorized requests, preserves drafts and retries only auth-rejected requests', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_token', 'refresh-old');
    const draftKey = getDraftStorageKey('mrx_initial_batch_day', user.userId);
    localStorage.setItem(draftKey, 'unsaved-work');
    let releaseRefresh!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(async (input: string, init: RequestInit) => {
      if (input.endsWith('/auth/refresh')) return new Promise<Response>(resolve => { releaseRefresh = resolve; });
      const authorization = new Headers(init.headers).get('Authorization');
      return authorization === 'Bearer refresh-new' ? jsonResponse({ accepted: true }) : new Response('', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = apiClient('/reconciliation/read');
    const second = apiClient('/reconciliation/command', { method: 'POST', body: JSON.stringify({ reason: 'Kiểm tra' }) });
    const outcome = Promise.all([first, second]).then(value => ({ value }), error => ({ error }));
    await vi.waitFor(() => expect(releaseRefresh).toBeTypeOf('function'));
    releaseRefresh(jsonResponse({ accessToken: 'refresh-new', tokenType: 'Bearer', expiresIn: 1800, user }));
    expect(await outcome).toEqual({ value: [{ accepted: true }, { accepted: true }] });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/refresh'))?.[1]).toMatchObject({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({ accessToken: 'refresh-old' }),
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/reconciliation/command'))).toHaveLength(2);
    expect(localStorage.getItem('ipc_v3_token')).toBe('refresh-new');
    expect(localStorage.getItem(draftKey)).toBe('unsaved-work');
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('does not restore a replaced session when an in-flight refresh completes', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_token', 'stale-refresh-old');
    let releaseRefresh!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.endsWith('/auth/refresh')
      ? new Promise<Response>(resolve => { releaseRefresh = resolve; }) : new Response('', { status: 401 })));
    const pending = apiClient('/reconciliation/read');
    const result = pending.then(() => null, error => error);
    await vi.waitFor(() => expect(releaseRefresh).toBeTypeOf('function'));
    localStorage.setItem('ipc_v3_token', 'new-login-session');
    releaseRefresh(jsonResponse({ accessToken: 'must-not-restore', tokenType: 'Bearer', expiresIn: 1800, user }));
    expect(await result).toMatchObject({ code: 'SESSION_CHANGED' });
    expect(localStorage.getItem('ipc_v3_token')).toBe('new-login-session');
  });

  it('retains credentials on refresh transport failure and never replays a network-failed write', async () => {
    localStorage.setItem('ipc_v3_token', 'transient-session');
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) throw new Error('refresh offline');
      return new Response('', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiClient('/reconciliation/read')).rejects.toThrow('refresh offline');
    expect(localStorage.getItem('ipc_v3_token')).toBe('transient-session');
    fetchMock.mockReset().mockRejectedValue(new Error('unknown outcome'));
    await expect(apiClient('/reconciliation/command', { method: 'POST', body: '{}' })).rejects.toThrow('unknown outcome');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ipc_v3_token')).toBe('transient-session');
  });

  it.each([
    { mode: 'MATERIAL_RECONCILIATION', identified: true, retain: true },
    { mode: 'DEFAULT', identified: true, retain: false },
    { mode: 'MATERIAL_RECONCILIATION', identified: false, retain: false },
  ])('expires credentials/caches but retains only identified MRX work: $mode/$identified', async ({ mode, identified, retain }) => {
    window.history.replaceState(null, '', '/login');
    localStorage.setItem('ipc_v3_token', 'expired-session');
    localStorage.setItem('ipc_v3_mode', mode);
    const userId = '11111111-1111-1111-1111-111111111111';
    localStorage.setItem('ipc_v3_user', JSON.stringify(identified ? { userId } : {}));
    const draftKey = getDraftStorageKey('mrx_initial_batch_day', userId);
    const unrelatedKeys = [getDraftStorageKey('mrx_initial_batch_day', '22222222-2222-2222-2222-222222222222'), getDraftStorageKey('purchase', userId)];
    const draft = JSON.stringify({ version: 1, quantities: { line: '2.75' }, reasons: {} });
    localStorage.setItem(draftKey, draft);
    for (const unrelated of unrelatedKeys) localStorage.setItem(unrelated, draft);
    offlineMutationQueue.enqueue({ url: '/auth/revoke', method: 'POST', payload: null, idempotencyKey: 'expired-session-revoke' });
    expect(localStorage.getItem(draftKey)).not.toBeNull();
    expect(offlineMutationQueue.getAll()).toHaveLength(1);
    const key = queryClient.normalizeKey(['reports']);
    queryClient.set(key, { items: [] }, 'DEFAULT');
    serverStateCache.set('mrx_report_expired', { completedReport: { rows: [], totalCount: 0 } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(apiClient('/workflow-reports/current-stock/page')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('ipc_v3_token')).toBeNull();
    expect(localStorage.getItem(draftKey)).toBe(retain ? draft : null);
    for (const unrelated of unrelatedKeys) expect(localStorage.getItem(unrelated)).toBeNull();
    expect(offlineMutationQueue.getAll()).toEqual([]);
    expect(serverStateCache.get('mrx_report_expired')).toBeNull();
    expect(sessionStorage.getItem('ipc_l2_cache:mrx_report_expired')).toBeNull();
    expect(queryClient.get(key)).toBeUndefined();
    await expect(apiClient('/workflow-reports/current-stock/page')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem(draftKey)).toBe(retain ? draft : null);
    clearSessionState(); // Explicit logout must purge even an expired-session draft.
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it('rejects a response from an old session without clearing the replacement session', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(r => { resolve = r; })));
    const pending = apiClient('/workflow-reports/current-stock/page');
    localStorage.setItem('ipc_v3_token', 'replacement-session');
    resolve(jsonResponse([]));
    await expect(pending).rejects.toMatchObject({ status: 401, code: 'SESSION_CHANGED' });
    expect(localStorage.getItem('ipc_v3_token')).toBe('replacement-session');

    let finishBody!: (body: unknown) => void;
    const response = jsonResponse([]);
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(resolve => { finishBody = resolve; }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const decoding = apiClient('/workflow-reports/current-stock/page');
    await vi.waitFor(() => expect(finishBody).toBeTypeOf('function'));
    localStorage.setItem('ipc_v3_token', 'next-session');
    finishBody({ success: true, data: [] });
    await expect(decoding).rejects.toMatchObject({ status: 401, code: 'SESSION_CHANGED' });
    expect(localStorage.getItem('ipc_v3_token')).toBe('next-session');
  });

  it('preserves session continuity across multi-step token renewals while a concurrent response is decoding', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_token', 'token-step-1');
    let finishFirstBody!: (body: unknown) => void;
    let refreshCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (input: string, init: RequestInit) => {
      const url = String(input);
      const auth = new Headers(init?.headers).get('Authorization');
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        const nextToken = refreshCount === 1 ? 'token-step-2' : 'token-step-3';
        return jsonResponse({ accessToken: nextToken, tokenType: 'Bearer', expiresIn: 1800, user });
      }
      if (url.endsWith('/reconciliation/first')) {
        if (auth === 'Bearer token-step-2') {
          const delayed = jsonResponse({ step: 1 });
          vi.spyOn(delayed, 'json').mockImplementation(() => new Promise(resolve => { finishFirstBody = resolve; }));
          return delayed;
        }
        return new Response('', { status: 401 });
      }
      if (url.endsWith('/reconciliation/second')) {
        return auth === 'Bearer token-step-3' ? jsonResponse({ step: 2 }) : new Response('', { status: 401 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstPromise = apiClient('/reconciliation/first');
    await vi.waitFor(() => expect(finishFirstBody).toBeTypeOf('function'));
    // While firstPromise is decoding its JSON body under token-step-2, a second request triggers another refresh to token-step-3.
    const secondResult = await apiClient('/reconciliation/second');
    expect(secondResult).toEqual({ step: 2 });
    expect(localStorage.getItem('ipc_v3_token')).toBe('token-step-3');

    finishFirstBody({ success: true, data: { step: 1 } });
    await expect(firstPromise).resolves.toEqual({ step: 1 });
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
    await mrxApi.applySourceChange(sourceChange);
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
      [expect.stringMatching(/\/api\/coordination\/weekly-menu\/amendments\/mrx-apply$/), expect.objectContaining({ method: 'POST', body: JSON.stringify(sourceChange) })],
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

  it('requests the exact server-filtered transaction page and preserves page metadata', async () => {
    const payload = { items: [], totalCount: 51, pageNumber: 2, pageSize: 25, totalPages: 3, hasPrev: true, hasNext: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await mrxApi.getTransactionsHistory({
      batchId: 'batch-1', fromDate: '2025-12-31', toDate: '2026-01-01', pageNumber: 2, pageSize: 25,
    });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/pageNumber=2&pageSize=25&batchId=batch-1&fromDate=2025-12-31&toDate=2026-01-01/),
      expect.any(Object)
    );
  });

  it('preserves unavailable completed-register totals as null', async () => {
    const payload = {
      rows: [{
        batchId: 'legacy-batch', customerName: 'Customer', weekStartDate: '2026-09-21', weekEndDate: '2026-09-27',
        completedBy: 'User', completedAt: '2026-09-28T00:00:00Z', version: 1, totalIngredientsCount: 2,
        totalRequired: 10, totalIssued: null, totalVariance: null,
      }],
      totalCount: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));

    const result = await mrxApi.getCompletedRegister();

    expect(result.rows[0].totalIssued).toBeNull();
    expect(result.rows[0].totalVariance).toBeNull();
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

  it('sends same-origin credentials on auth login and revoke endpoints so HttpOnly refresh cookies persist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      accessToken: 'login-token',
      tokenType: 'Bearer',
      expiresIn: 1800,
      user: {
        userId: '10000000-0000-0000-0000-000000000001',
        username: 'admin',
        fullName: 'Quản trị viên',
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isActive: true,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await authApi.login('admin', 'secret');
    await authApi.logout();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${window.location.origin}/api/auth/login`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${window.location.origin}/api/auth/revoke`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
  });

  it('F4: deduplicates concurrent identical GET requests in-flight and allows sequential calls after resolution', async () => {
    let resolveFirst!: (res: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    })).mockImplementationOnce(async () => jsonResponse({ round: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const p1 = apiClient<{ round: number }>('/reconciliation/dedup-test');
    const p2 = apiClient<{ round: number }>('/reconciliation/dedup-test');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFirst(jsonResponse({ round: 1 }));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ round: 1 });
    expect(r2).toEqual({ round: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const r3 = await apiClient<{ round: number }>('/reconciliation/dedup-test');
    expect(r3).toEqual({ round: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});