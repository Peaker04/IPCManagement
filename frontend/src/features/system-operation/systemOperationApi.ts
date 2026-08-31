import { apiSlice } from '@/api/apiSlice'
import type { ApiResponse } from '@/types/api'
import type { SystemOperationMode } from './systemOperationEligibility'
import { publishSystemOperationAuthority } from './systemOperationAuthorityChannel'

export interface SystemOperationCapabilities {
  navigation: readonly string[]
  pageTabs: Readonly<Record<string, readonly string[]>>
}

export interface SystemOperationSnapshot {
  mode: SystemOperationMode
  label: string
  version: number
  updatedAt: string
  reasonRequired: boolean
  capabilities: SystemOperationCapabilities
}
export interface ChangeSystemOperationMode { mode: SystemOperationMode; expectedVersion: number; confirmed: boolean; reason?: string }

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
