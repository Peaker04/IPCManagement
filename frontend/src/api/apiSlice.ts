import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { logOut, setCredentials } from '../features/auth/authSlice';
import type { AuthState } from '../features/auth/authTypes';
import { normalizeUserRole } from '../features/auth/roleUtils';
import type { ApiResponse, LoginData } from '../types/api';
import { notifySessionExpired } from '../features/auth/sessionEvents';

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

let refreshPromise: Promise<void> | null = null;
let devFallbackLoginPromise: Promise<boolean> | null = null;

const devFallbackTokenPrefix = 'dev-login-fallback-token-';

const getDevFallbackUsername = (token?: string | null) =>
  token?.startsWith(devFallbackTokenPrefix) ? token.slice(devFallbackTokenPrefix.length) : null;

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
  api.dispatch(
    setCredentials({
      user: {
        id: data.user.userId,
        username: data.user.username,
        fullName: data.user.fullName,
        role: normalizeUserRole(data.user.roleCode, data.user.roleName),
        roleCode: data.user.roleCode,
        roleName: data.user.roleName,
        isAdminFullAccess: data.user.isAdminFullAccess ?? false,
        permissions: data.user.permissions ?? [],
      },
      token: data.accessToken,
    })
  );
};

const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  if (refreshPromise) {
    await refreshPromise;
  }

  let result = await baseQuery(args, api, extraOptions);

  const token = (api.getState() as AuthAwareState).auth.token;
  const devFallbackUsername = getDevFallbackUsername(token);

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

          setLoginData(api, data);
          return true;
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
    if (!token) {
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
              body: { accessToken: token },
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

          setLoginData(api, data);
        } finally {
          refreshPromise = null;
        }
      })();
    }

    await refreshPromise;
    result = await baseQuery(args, api, extraOptions);
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
  tagTypes: ['User', 'Employee', 'Project', 'Coordination', 'WorkflowReports', 'DishCatalog', 'Customers', 'Ingredients', 'MaterialDemandStaleness', 'SupplierQuotations', 'PurchaseOrders'],
  endpoints: () => ({}),
});
