import { apiSlice } from '@/api/apiSlice';
import type { components, paths } from '@/shared/api/contracts/schema';
import type { ApiResponse } from '@/types/api';

export type AdminEmployee = components['schemas']['EmployeeDto'];

export type AdminRole = components['schemas']['AdminRoleDto'];

type AdminEmployeePage = components['schemas']['EmployeeDtoPagedResponseDto'];
type GeneratedAdminEmployeeQuery = NonNullable<
  paths['/api/admin/employees']['get']['parameters']['query']
>;

export type AdminEmployeeQuery = {
  [Key in keyof GeneratedAdminEmployeeQuery as Uncapitalize<Key & string>]: GeneratedAdminEmployeeQuery[Key];
};

export type CreateEmployeeRequest = components['schemas']['CreateEmployeeRequest'];

export type UpdateEmployeeRequest = components['schemas']['UpdateEmployeeRequest'];

export type UpdateEmployeeStatusRequest = components['schemas']['UpdateEmployeeStatusRequest'];

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminRoles: builder.query<ApiResponse<AdminRole[]>, void>({
      query: () => '/admin/employees/roles',
      providesTags: ['Employee'],
    }),
    getAdminEmployees: builder.query<ApiResponse<AdminEmployeePage>, AdminEmployeeQuery>({
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
        body: { isActive } satisfies UpdateEmployeeStatusRequest,
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
