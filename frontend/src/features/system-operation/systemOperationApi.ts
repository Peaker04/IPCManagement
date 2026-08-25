import { apiSlice } from '@/api/apiSlice'
import type { ApiResponse } from '@/types/api'
import type { SystemOperationMode } from './systemOperationEligibility'

export interface SystemOperationSnapshot { mode: SystemOperationMode; label: string; version: number; updatedAt: string; reasonRequired: boolean }
export interface ChangeSystemOperationMode { mode: SystemOperationMode; expectedVersion: number; confirmed: boolean; reason?: string }

export const systemOperationApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  getSystemOperationMode: builder.query<SystemOperationSnapshot, void>({ query: () => '/system-operation-mode', transformResponse: (response: ApiResponse<SystemOperationSnapshot>) => response.data!, providesTags: ['SystemOperationMode'] }),
  changeSystemOperationMode: builder.mutation<SystemOperationSnapshot, ChangeSystemOperationMode>({ query: body => ({ url: '/system-operation-mode', method: 'PUT', body }), transformResponse: (response: ApiResponse<SystemOperationSnapshot>) => response.data!, invalidatesTags: ['SystemOperationMode'] }),
}) })
export const { useGetSystemOperationModeQuery, useChangeSystemOperationModeMutation } = systemOperationApi
