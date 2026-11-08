import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { warehouseApi } from '@/api/warehouseApi';

const createStore = () => configureStore({
  reducer: {
    [warehouseApi.reducerPath]: warehouseApi.reducer,
    auth: (state = { token: null }) => state,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(warehouseApi.middleware),
});

const jsonResponse = (data: unknown) => new Response(
  JSON.stringify({ success: true, data }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

describe('supplemental rejection wire format', () => {
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

  it('preserves command identity and expected version in the rejection request', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request);
      return jsonResponse({});
    }));
    const store = createStore();

    await store.dispatch(warehouseApi.endpoints.rejectSupplementalMaterialRequest.initiate({
      requestId: 'supplemental-1',
      commandId: 'reject-command-1',
      expectedVersion: 3,
      reason: 'Không đúng nhu cầu thực tế',
    }));

    expect(await requests[0].json()).toEqual({
      commandId: 'reject-command-1',
      expectedVersion: 3,
      reason: 'Không đúng nhu cầu thực tế',
    });
  });
});
