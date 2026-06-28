import { apiSlice } from '../../api/apiSlice';
import type {
  ApiResponse,
  LoginData,
  LoginRequest,
  RevokeTokenRequest,
  UserInfo,
} from '../../types/api';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiResponse<LoginData>, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    getCurrentUser: builder.query<ApiResponse<UserInfo>, void>({
      query: () => '/auth/profile',
    }),
    revokeToken: builder.mutation<ApiResponse<undefined>, RevokeTokenRequest>({
      query: (body) => ({
        url: '/auth/revoke',
        method: 'POST',
        body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useLoginMutation, useGetCurrentUserQuery, useRevokeTokenMutation } = authApi;
