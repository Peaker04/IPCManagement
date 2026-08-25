import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { logOut, setCredentials } from '@/lib/auth/authSlice';
import type { AuthState } from '@/lib/auth/authTypes';
import { normalizeUserRole } from '@/lib/auth/roleUtils';
import type { ApiResponse, LoginData } from '../types/api';
import { notifySessionExpired } from '@/lib/auth/sessionEvents';

type AuthAwareState = { auth: AuthState };

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as AuthAwareState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

type BaseQueryResult = Awaited<ReturnType<typeof baseQuery>>;

const inFlightMutations = new Map<string, Promise<BaseQueryResult>>();

const stableRequestValue = (value: unknown): string => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
  }
  if (value instanceof Headers) {
    return stableRequestValue([...value.entries()].sort(([left], [right]) => left.localeCompare(right)));
  }
  if (value instanceof URLSearchParams) {
    return stableRequestValue([...value.entries()].sort(([left], [right]) => left.localeCompare(right)));
  }
  if (value instanceof FormData) {
    return stableRequestValue([...value.entries()].map(([key, entry]) => [
      key,
      typeof entry === 'string'
        ? entry
        : { name: entry.name, size: entry.size, type: entry.type, lastModified: entry.lastModified },
    ]));
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableRequestValue).join(',') + ']';
  }

  return '{' + Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => JSON.stringify(key) + ':' + stableRequestValue(entry))
    .join(',') + '}';
};

const executeRequest = (
  args: string | FetchArgs,
  api: Parameters<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>[1],
  extraOptions: Parameters<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>[2],
) => {
  const method = (typeof args === 'string' ? 'GET' : args.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return Promise.resolve(baseQuery(args, api, extraOptions));
  }

  const request = typeof args === 'string' ? { url: args } : args;
  const token = (api.getState() as AuthAwareState).auth.token;
  const key = stableRequestValue({
    token,
    method,
    url: request.url,
    params: request.params,
    headers: request.headers,
    body: request.body,
  });
  const existing = inFlightMutations.get(key);
  if (existing) return existing;

  const pending = Promise.resolve(baseQuery(args, api, extraOptions)) as Promise<BaseQueryResult>;
  inFlightMutations.set(key, pending);
  void pending.finally(() => {
    if (inFlightMutations.get(key) === pending) {
      inFlightMutations.delete(key);
    }
  }).catch(() => undefined);
  return pending;
};

let refreshPromise: Promise<void> | null = null;
let devFallbackLoginPromise: Promise<boolean> | null = null;

const isDevLoginFallbackEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true';

const getDevFallbackUsername = (token?: string | null) => {
  if (import.meta.env.PROD || !isDevLoginFallbackEnabled || !token) {
    return null;
  }

  const devFallbackTokenPrefix = 'dev-login-fallback-token-';
  return token.startsWith(devFallbackTokenPrefix)
    ? token.slice(devFallbackTokenPrefix.length)
    : null;
};

const isAuthEndpoint = (args: string | FetchArgs) => {
  const url = typeof args === 'string' ? args : args.url;

  return (
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/auth/logout') ||
    url.startsWith('/auth/revoke')
  );
};

const setLoginData = (
  api: Parameters<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>[1],
  data: LoginData
) => {
  const user = data.user;
  if (!data.accessToken || !user?.userId || !user.username || !user.fullName) {
    return false;
  }

  api.dispatch(
    setCredentials({
      user: {
        id: user.userId,
        username: user.username,
        fullName: user.fullName,
        role: normalizeUserRole(user.roleCode, user.roleName),
        roleCode: user.roleCode,
        roleName: user.roleName,
        isAdminFullAccess: user.isAdminFullAccess ?? false,
        permissions: [...(user.permissions ?? [])],
      },
      token: data.accessToken,
    })
  );

  return true;
};

const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  if (refreshPromise) {
    await refreshPromise;
  }

  const requestToken = (api.getState() as AuthAwareState).auth.token;
  let result = await executeRequest(args, api, extraOptions);

  const currentToken = (api.getState() as AuthAwareState).auth.token;
  const devFallbackUsername = getDevFallbackUsername(requestToken);

  if (result.error?.status === 401 && devFallbackUsername && !isAuthEndpoint(args)) {
    if (!devFallbackLoginPromise) {
      devFallbackLoginPromise = (async () => {
        try {
          const devLoginResult = await baseQuery(
            {
              url: '/auth/login',
              method: 'POST',
              body: {
                username: devFallbackUsername,
                password: devFallbackUsername,
              },
            },
            api,
            extraOptions
          );

          const data = (devLoginResult.data as ApiResponse<LoginData> | undefined)?.data;
          if (!data) {
            api.dispatch(logOut());
            notifySessionExpired();
            return false;
          }

          return setLoginData(api, data);
        } finally {
          devFallbackLoginPromise = null;
        }
      })();
    }

    const didUpgrade = await devFallbackLoginPromise;
    if (!didUpgrade) {
      return result;
    }

    return baseQuery(args, api, extraOptions);
  }

  if (result.error?.status === 401 && !isAuthEndpoint(args)) {
    if (requestToken && currentToken && requestToken !== currentToken) {
      const retriedResult = await executeRequest(args, api, extraOptions);
      if (retriedResult.error?.status === 401) {
        api.dispatch(logOut());
        notifySessionExpired();
      }
      return retriedResult;
    }

    if (!requestToken) {
      api.dispatch(logOut());
      notifySessionExpired();
      return result;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshResult = await baseQuery(
            {
              url: '/auth/refresh',
              method: 'POST',
              body: { accessToken: requestToken },
            },
            api,
            extraOptions
          );

          const data = (refreshResult.data as ApiResponse<LoginData> | undefined)?.data;
          if (!data) {
            api.dispatch(logOut());
            notifySessionExpired();
            return;
          }

          if (!setLoginData(api, data)) {
            api.dispatch(logOut());
            notifySessionExpired();
          }
        } finally {
          refreshPromise = null;
        }
      })();
    }

    await refreshPromise;
    result = await executeRequest(args, api, extraOptions);
    if (result.error?.status === 401) {
      api.dispatch(logOut());
      notifySessionExpired();
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  // Keep recently visited screens warm long enough for normal back-and-forth
  // navigation. Mutations still invalidate the tags below immediately.
  keepUnusedDataFor: 5 * 60,
  refetchOnMountOrArgChange: false,
  tagTypes: ['User', 'Employee', 'Project', 'Coordination', 'WorkflowReports', 'DishCatalog', 'Customers', 'Ingredients', 'MaterialDemandStaleness', 'SupplierQuotations', 'PurchaseOrders', 'SystemOperationMode', 'ReconciliationBatches'],
  endpoints: () => ({}),
});
