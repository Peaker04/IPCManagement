import { apiSlice } from '@/api/apiSlice'
import type { ApiResponse } from '@/types/api'
import { publishSystemOperationAuthority } from '@/lib/systemOperationAuthorityChannel'
import type { ChangeSystemOperationMode, SystemOperationSnapshot } from '@/lib/systemOperationTypes'

export type { ChangeSystemOperationMode, SystemOperationCapabilities, SystemOperationSnapshot } from '@/lib/systemOperationTypes'

const publishAuthoritySnapshot = async (queryFulfilled: Promise<{ data: SystemOperationSnapshot }>, dispatch: (action: unknown) => unknown) => {
  try {
    const { data } = await queryFulfilled
    dispatch(systemOperationApi.util.upsertQueryData('getSystemOperationMode', undefined, data))
    publishSystemOperationAuthority(data)
  } catch {
    // Failed or aborted requests never publish authority hints.
  }
}

export const systemOperationApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  getSystemOperationMode: builder.query<SystemOperationSnapshot, void>({
    query: () => '/system-operation-mode',
    transformResponse: (response: ApiResponse<SystemOperationSnapshot>) => response.data!,
    providesTags: ['SystemOperationMode'],
    onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
      await publishAuthoritySnapshot(queryFulfilled, dispatch)
    },
  }),
  changeSystemOperationMode: builder.mutation<SystemOperationSnapshot, ChangeSystemOperationMode>({
    query: body => ({ url: '/system-operation-mode', method: 'PUT', body }),
    transformResponse: (response: ApiResponse<SystemOperationSnapshot>) => response.data!,
    invalidatesTags: ['SystemOperationMode'],
    onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
      await publishAuthoritySnapshot(queryFulfilled, dispatch)
    },
  }),
}) })
export const { useGetSystemOperationModeQuery, useChangeSystemOperationModeMutation } = systemOperationApi
