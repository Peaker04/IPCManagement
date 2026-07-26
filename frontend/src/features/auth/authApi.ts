import { apiSlice } from '../../api/apiSlice';
import type {
  ApiResponse,
  LoginData,
  LoginRequest,
  RefreshTokenRequest,
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
    refreshToken: builder.mutation<ApiResponse<LoginData>, RefreshTokenRequest>({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
    }),
    logout: builder.mutation<ApiResponse<undefined>, RevokeTokenRequest | void>({
      query: (body) => ({
        url: '/auth/logout',
        method: 'POST',
        body: body ?? {},
      }),
    }),
    revokeToken: builder.mutation<ApiResponse<undefined>, RevokeTokenRequest | void>({
      query: (body) => ({
        url: '/auth/revoke',
        method: 'POST',
        body: body ?? {},
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useGetCurrentUserQuery,
  useRefreshTokenMutation,
  useLogoutMutation,
  useRevokeTokenMutation,
} = authApi;
