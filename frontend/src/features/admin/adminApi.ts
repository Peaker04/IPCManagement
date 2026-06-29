import { apiSlice } from '@/api/apiSlice';
import type { ApiResponse } from '@/types/api';

export interface AdminEmployee {
  userId: string;
  fullName: string;
  username: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminRole {
  roleId: string;
  roleCode: string;
  roleName: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface AdminEmployeeQuery {
  pageNumber?: number;
  pageSize?: number;
  searchKeyword?: string;
}

export interface CreateEmployeeRequest {
  fullName: string;
  username: string;
  password: string;
  roleId: string;
  isActive: boolean;
}

export interface UpdateEmployeeRequest {
  fullName: string;
  username: string;
  password?: string;
  roleId: string;
  isActive: boolean;
}

export interface UpdateEmployeeStatusRequest {
  isActive: boolean;
}

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminRoles: builder.query<ApiResponse<AdminRole[]>, void>({
      query: () => '/admin/employees/roles',
      providesTags: ['Employee'],
    }),
    getAdminEmployees: builder.query<ApiResponse<PagedResult<AdminEmployee>>, AdminEmployeeQuery>({
      query: (params) => ({
        url: '/admin/employees',
        params,
      }),
      providesTags: ['Employee'],
    }),
    createAdminEmployee: builder.mutation<ApiResponse<AdminEmployee>, CreateEmployeeRequest>({
      query: (body) => ({
        url: '/admin/employees',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Employee'],
    }),
    updateAdminEmployee: builder.mutation<ApiResponse<AdminEmployee>, { id: string; body: UpdateEmployeeRequest }>({
      query: ({ id, body }) => ({
        url: `/admin/employees/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Employee'],
    }),
    updateAdminEmployeeStatus: builder.mutation<ApiResponse<AdminEmployee>, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/admin/employees/${id}/status`,
        method: 'PATCH',
        body: { isActive } as UpdateEmployeeStatusRequest,
      }),
      invalidatesTags: ['Employee'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAdminRolesQuery,
  useGetAdminEmployeesQuery,
  useCreateAdminEmployeeMutation,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} = adminApi;