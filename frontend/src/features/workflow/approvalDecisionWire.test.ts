import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowApi } from './workflowApi';

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

describe('approval decision wire format', () => {
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

  it('sends ApprovalDecision as its PascalCase member name, not an ordinal', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request);
      return jsonResponse({});
    }));
    const store = createWorkflowApiStore();

    await store.dispatch(workflowApi.endpoints.executeApprovalDecision.initiate({
      targetType: 'PurchaseRequest',
      targetId: 'request-1',
      status: 'Approve',
      reason: null,
    }));
    await store.dispatch(workflowApi.endpoints.executeApprovalDecision.initiate({
      targetType: 'PurchaseRequest',
      targetId: 'request-2',
      status: 'Reject',
      reason: 'Giá vượt ngưỡng',
    }));

    expect(await requests[0].json()).toEqual({ status: 'Approve', reason: null });
    expect(await requests[1].json()).toEqual({ status: 'Reject', reason: 'Giá vượt ngưỡng' });
  });
});
