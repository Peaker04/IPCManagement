import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../app/store';
import { logOut } from '../features/auth/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

import { setCredentials } from '../features/auth/authSlice';
import type { ApiResponse, LoginData } from '../types/api';

let refreshPromise: Promise<void> | null = null;

const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  if (refreshPromise) {
    await refreshPromise;
  }

  let result = await baseQuery(args, api, extraOptions);

  const token = (api.getState() as RootState).auth.token;
  const isDevLoginFallback = token?.startsWith('dev-login-fallback-token');

  if (result.error?.status === 401 && !isDevLoginFallback) {
    if (!refreshPromise) {
      const refreshToken = (api.getState() as RootState).auth.refreshToken;
      if (refreshToken && token) {
        refreshPromise = baseQuery(
          {
            url: '/auth/refresh',
            method: 'POST',
            body: { accessToken: token, refreshToken },
          },
          api,
          extraOptions
        ).then((refreshResult) => {
          if (refreshResult.data) {
            const data = (refreshResult.data as ApiResponse<LoginData>).data;
            if (data) {
              api.dispatch(
                setCredentials({
                  user: {
                    id: data.user.userId,
                    username: data.user.username,
                    fullName: data.user.fullName,
                    role: data.user.roleName.toLowerCase(),
                    isAdminFullAccess: data.user.isAdminFullAccess,
                    permissions: data.user.permissions || [],
                  },
                  token: data.accessToken,
                  refreshToken: data.refreshToken,
                })
              );
            } else {
              api.dispatch(logOut());
            }
          } else {
            api.dispatch(logOut());
          }
        }).finally(() => {
          refreshPromise = null;
        });

        await refreshPromise;
        // Chạy lại request gốc sau khi có token mới
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logOut());
      }
    } else {
      await refreshPromise;
      // Chạy lại request gốc sau khi Promise khác đã xin xong token
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  tagTypes: ['User', 'Employee', 'Project', 'Coordination', 'WorkflowReports', 'DishCatalog'],
  endpoints: () => ({}),
});
