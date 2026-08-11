import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowApi } from '@/api/workflowApi';

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

const emptyDataQualityReport = {
  generatedAt: '2026-07-27T00:00:00Z',
  totalIssues: 0,
  isTruncated: false,
  errorCount: 0,
  warningCount: 0,
  resolvedIssueCount: 0,
  reopenedIssueCount: 0,
  urgentIssueCount: 0,
  missingBomCount: 0,
  invalidUnitCount: 0,
  missingConversionCount: 0,
  negativeStockCount: 0,
  orphanDocumentCount: 0,
  issues: [],
};

describe('workflow cache invalidation fan-out', () => {
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

  it('refetches only the data-quality panel after remediation', async () => {
    const getRequests: string[] = [];
    const releaseRefetches: Array<() => void> = [];
    let holdGetResponses = false;
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      if (request.method === 'GET') {
        getRequests.push(new URL(request.url).pathname);
      }

      const response = request.url.includes('/workflow-reports/data-quality')
        ? jsonResponse(emptyDataQualityReport)
        : jsonResponse(request.method === 'GET' ? [] : {});

      if (request.method === 'GET' && holdGetResponses) {
        return new Promise<Response>((resolve) => {
          releaseRefetches.push(() => resolve(response));
        });
      }

      return response;
    }));
    const store = createWorkflowApiStore();

    await Promise.all([
      store.dispatch(workflowApi.endpoints.getWorkflowDocuments.initiate()),
      store.dispatch(workflowApi.endpoints.getIngredientDemand.initiate()),
      store.dispatch(workflowApi.endpoints.getPurchasePlan.initiate()),
      store.dispatch(workflowApi.endpoints.getStockMovements.initiate()),
      store.dispatch(workflowApi.endpoints.getPriceVariance.initiate()),
      store.dispatch(workflowApi.endpoints.getCurrentStock.initiate()),
      store.dispatch(workflowApi.endpoints.getKitchenIssues.initiate()),
      store.dispatch(workflowApi.endpoints.getIssueVsReturnUsage.initiate()),
      store.dispatch(workflowApi.endpoints.getAuditChanges.initiate()),
      store.dispatch(workflowApi.endpoints.getDataQuality.initiate()),
    ]);
    expect(getRequests).toHaveLength(10);
    getRequests.length = 0;
    holdGetResponses = true;

    await store.dispatch(workflowApi.endpoints.updateDataQualityIssueRemediation.initiate({
      issueId: 'issue-1',
      action: 'resolve',
      note: 'Đã xử lý',
    }));

    // Bước 9 baseline: tag trơn làm cả 10/10 query ở trên refetch sau cùng mutation này.
    await vi.waitFor(() => expect(releaseRefetches).toHaveLength(2));
    expect(getRequests.sort()).toEqual([
      '/api/workflow-reports/audit-changes',
      '/api/workflow-reports/data-quality',
    ]);
    const pendingQueries = Object.values(store.getState().api.queries)
      .filter((query) => query?.status === 'pending');
    expect(pendingQueries).toHaveLength(2);

    releaseRefetches.forEach((release) => release());
  });

  it('refetches the ServiceRun projection after a server-authorized variance declaration', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return jsonResponse({
        serviceRunId: 'run-1', planId: 'plan-1', planCode: 'KHSX-01', serviceDate: '2026-08-12', shiftName: 'MORNING', status: 'RECONCILIATION_REQUIRED',
        blockers: ['UNRESOLVED_VARIANCE'], canStartService: false, canRecordActualServings: false, canConfirmService: false,
        canWaiveServiceConfirmation: false, canResolveVariance: false, canResolveServingVariance: false, canClose: false, serviceConfirmationOutcome: 'PENDING',
        plannedServings: 40, actualServings: 39, materialRequestLineCount: 2, issueCount: 1, unreceivedIssueCount: 0, openSupplementalCount: 0,
        unreceivedReturnCount: 0, hasBomBlocker: false, adjustmentCount: 0,
      });
    }));
    const store = createWorkflowApiStore();

    await store.dispatch(workflowApi.endpoints.getServiceRunByPlan.initiate({ planId: 'plan-1', shiftName: 'MORNING' }));
    requests.length = 0;
    await store.dispatch(workflowApi.endpoints.declareServiceRunVariance.initiate({
      id: 'run-1', body: { track: 'RECONCILIATION', sourceLineIds: ['line-1'], reason: 'Cần đối soát' },
    }));

    await vi.waitFor(() => expect(requests).toContain('GET /api/service-runs/by-plan'));
    expect(requests).toContain('POST /api/service-runs/run-1/variance/declarations');
  });
});
