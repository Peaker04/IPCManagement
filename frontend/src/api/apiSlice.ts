import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryApi, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../app/store';
import { logOut, setCredentials } from '../features/auth/authSlice';
import type { ApiResponse, LoginData, RefreshTokenRequest } from '../types/api';
import { notifySessionExpired } from '../features/auth/sessionEvents';

const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

let refreshPromise: Promise<boolean> | null = null;

const isAuthEndpoint = (args: string | FetchArgs) => {
  const url = typeof args === 'string' ? args : args.url;

  return (
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/auth/logout')
  );
};

const refreshAccessToken = async (
  api: BaseQueryApi,
  extraOptions: Parameters<typeof baseQuery>[2]
) => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const state = api.getState() as RootState;
      const currentToken = state.auth.token;
      const currentRefreshToken = state.auth.refreshToken;

      if (!currentToken || !currentRefreshToken) {
        return false;
      }

      const refreshRequest: RefreshTokenRequest = {
        accessToken: currentToken,
        refreshToken: currentRefreshToken,
      };

      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: refreshRequest,
        },
        api,
        extraOptions
      );

      const refreshData = refreshResult.data as ApiResponse<LoginData> | undefined;

      if (refreshData?.success && refreshData.data) {
        api.dispatch(
          setCredentials({
            user: {
              id: refreshData.data.user.userId,
              username: refreshData.data.user.username,
              fullName: refreshData.data.user.fullName,
              role: refreshData.data.user.roleName.toLowerCase(),
            },
            token: refreshData.data.accessToken,
            refreshToken: refreshData.data.refreshToken,
          })
        );

        return true;
      }

      return false;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !isAuthEndpoint(args)) {
    const didRefresh = await refreshAccessToken(api, extraOptions);

    if (didRefresh) {
      return baseQuery(args, api, extraOptions);
    }

    api.dispatch(logOut());
    notifySessionExpired();
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  tagTypes: ['User', 'Employee', 'Project', 'Coordination'],
  endpoints: () => ({}),
});
