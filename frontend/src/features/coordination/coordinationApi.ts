import { apiSlice } from '../../api/apiSlice'
import type { ApiResponse } from '../../types/api'
import type { ApiShiftName, OrderRow, ShiftType } from './types'
import { toApiShiftName, toDisplayShift } from './types'

export interface CoordinationQuery {
  dayOfWeek: string
  shift: ShiftType
}

export interface LockOrderPlanRequest extends CoordinationQuery {
  scope?: 'FULLDAY' | ApiShiftName
  lines?: Array<{
    quantityPlanLineId: string
    actualQuantity: number
  }>
}

export interface LockOrderPlanResult {
  success: boolean
  lockedAt: string
  serviceDate: string
  scope: 'FULLDAY' | ApiShiftName
  lockedShiftNames: ApiShiftName[]
  lockedLineCount: number
}

export interface AdjustOrderAfterLockRequest {
  orderId: string
  field: string
  newValue: number
  reason: string
}

export interface AdjustOrderAfterLockResult {
  success: boolean
  timestamp: string
}

export interface ExportOrderReportRequest extends CoordinationQuery {
  format: 'excel' | 'pdf'
}

export interface ExportOrderReportResult {
  success: boolean
  downloadUrl: string
}

export const coordinationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCoordinationOrders: builder.query<ApiResponse<OrderRow[]>, CoordinationQuery>({
      query: ({ dayOfWeek, shift }) => ({
        url: '/coordination/orders',
        params: { dayOfWeek, shiftName: toApiShiftName(shift) },
      }),
      transformResponse: (response: ApiResponse<OrderRow[]>) => ({
        ...response,
        data: response.data?.map((order) => ({
          ...order,
          shiftName: order.shiftName,
          shift: order.shiftName ? toDisplayShift(order.shiftName) : order.shift,
          menuName: order.menuName || order.mealType,
          dishes: order.dishes ?? [],
          dishId: order.dishes?.[0]?.dishId || order.dishId || '',
        })),
      }),
      providesTags: ['Coordination'],
    }),
    lockCoordinationOrders: builder.mutation<ApiResponse<LockOrderPlanResult>, LockOrderPlanRequest>({
      query: ({ dayOfWeek, shift, scope = 'FULLDAY', lines }) => ({
        url: '/coordination/orders/lock',
        method: 'POST',
        body: {
          dayOfWeek,
          shiftName: toApiShiftName(shift),
          scope,
          lines,
        },
      }),
      invalidatesTags: ['Coordination'],
    }),
    adjustCoordinationOrder: builder.mutation<ApiResponse<AdjustOrderAfterLockResult>, AdjustOrderAfterLockRequest>({
      query: (body) => ({
        url: '/coordination/orders/adjust',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
    exportCoordinationOrders: builder.mutation<ApiResponse<ExportOrderReportResult>, ExportOrderReportRequest>({
      query: ({ dayOfWeek, shift, format }) => ({
        url: '/coordination/orders/export',
        method: 'POST',
        body: {
          dayOfWeek,
          shiftName: toApiShiftName(shift),
          format,
        },
      }),
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetCoordinationOrdersQuery,
  useLockCoordinationOrdersMutation,
  useAdjustCoordinationOrderMutation,
  useExportCoordinationOrdersMutation,
} = coordinationApi
