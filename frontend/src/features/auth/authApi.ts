import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../app/store';

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      role: string;
    };
  };
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      // Get token from auth slice state
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, any>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    getCurrentUser: builder.query<any, void>({
      query: () => '/auth/profile',
    }),
  }),
});

export const { useLoginMutation, useGetCurrentUserQuery } = authApi;
