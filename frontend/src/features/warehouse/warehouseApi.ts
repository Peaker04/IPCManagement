import { apiSlice } from '@/api/apiSlice';
import type {
  PageNumberPage,
  CreateInventoryReceiptFromPurchaseRequest,
  WarehouseDto,
  WarehousePageQuery,
  InventoryReceiptCreatedResult,
  CreateInventoryIssueRequest,
  CreateSupplementalMaterialRequest,
  SupplementalMaterialRequestPageQuery,
  InventoryIssueCreatedResult,
  CreateInventoryReturnRequest,
  InventoryReturnCreatedResult,
  ConfirmInventoryIssueReceiptRequest,
  InventoryIssueResult,
  InventoryReturnResult,
  InventoryReturnPageQuery,
  ConfirmInventoryReturnReceiptRequest,
  WarehousePurchaseReceiptResult,
  RecordWarehousePurchaseReceiptRequest,
  InventoryReceipt,
  ReceiptQualityActionArgs,
  ReceiptPostActionArgs,
  ReceiptReworkActionArgs,
  ReceiptVoidActionArgs,
  ReceiptCorrectionActionArgs,
  ReceiptCorrectionResult,
  SupplementalMaterialRequestResult,
  FulfillSupplementalMaterialRequest,
  RejectSupplementalMaterialRequest,
} from '@/api/workflowApiTypes';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags } from '@/api/workflowCacheTags';

const getData = <T>(response: ApiResponse<T>): T => response.data as T;

export const warehouseApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWarehouses: builder.query<PageNumberPage<WarehouseDto>, WarehousePageQuery | void>({
      query: (query) => ({
        url: '/warehouses',
        params: { pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 100 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<WarehouseDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false,
      },
    }),
    getWarehouseSelector: builder.query<WarehouseDto[], void>({
      query: () => '/warehouses/selector',
      transformResponse: (response: ApiResponse<WarehouseDto[]>) => getData(response),
    }),
    recordWarehousePurchaseReceipt: builder.mutation<
      WarehousePurchaseReceiptResult,
      RecordWarehousePurchaseReceiptRequest
    >({
      query: ({ data }) => ({
        url: `/warehouse/purchase-orders/${data.purchaseOrderId}/receipts`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: (_result, _error, { data, week }) => [
        'PurchaseOrders',
        { type: 'PurchaseOrders', id: data.purchaseOrderId },
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
        ...(week
          ? [{ type: 'WorkflowReports' as const, id: `PurchaseWorkbench:${week}` }]
          : []),
      ],
    }),
    getInventoryReceipts: builder.query<PageNumberPage<InventoryReceipt>, { pageNumber?: number; pageSize?: number } | void>({
      query: (query) => ({
        url: '/inventory-receipts',
        params: { pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 20 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<InventoryReceipt>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.documents],
    }),
    getInventoryReceiptById: builder.query<InventoryReceipt | undefined, string>({
      query: (receiptId) => `/inventory-receipts/${receiptId}`,
      transformResponse: (response: ApiResponse<InventoryReceipt>) => response.data,
      providesTags: [workflowCacheTags.documents],
    }),
    acceptReceiptQuality: builder.mutation<WarehousePurchaseReceiptResult, ReceiptQualityActionArgs>({
      query: ({ purchaseOrderId, receiptId, data }) => ({
        url: `/warehouse/purchase-orders/${purchaseOrderId}/receipts/${receiptId}/quality`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders', workflowCacheTags.documents, workflowCacheTags.approvalInbox,
      ],
    }),
    postWarehousePurchaseReceipt: builder.mutation<WarehousePurchaseReceiptResult, ReceiptPostActionArgs>({
      query: ({ purchaseOrderId, receiptId, data }) => ({
        url: `/warehouse/purchase-orders/${purchaseOrderId}/receipts/${receiptId}/post`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders', workflowCacheTags.documents, workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock, workflowCacheTags.operationalKpis,
      ],
    }),
    reworkWarehousePurchaseReceipt: builder.mutation<WarehousePurchaseReceiptResult, ReceiptReworkActionArgs>({
      query: ({ purchaseOrderId, receiptId, data }) => ({
        url: `/warehouse/purchase-orders/${purchaseOrderId}/receipts/${receiptId}/rework`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders', workflowCacheTags.documents, workflowCacheTags.approvalInbox,
      ],
    }),
    voidWarehousePurchaseReceipt: builder.mutation<WarehousePurchaseReceiptResult, ReceiptVoidActionArgs>({
      query: ({ purchaseOrderId, receiptId, data }) => ({
        url: `/warehouse/purchase-orders/${purchaseOrderId}/receipts/${receiptId}/void`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<WarehousePurchaseReceiptResult>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders', workflowCacheTags.documents, workflowCacheTags.approvalInbox,
      ],
    }),
    createReceiptCorrection: builder.mutation<ReceiptCorrectionResult, ReceiptCorrectionActionArgs>({
      query: ({ purchaseOrderId, receiptId, data }) => ({
        url: `/warehouse/purchase-orders/${purchaseOrderId}/receipts/${receiptId}/corrections`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<ReceiptCorrectionResult>) => getData(response),
      invalidatesTags: [
        workflowCacheTags.documents, workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock, workflowCacheTags.operationalKpis,
      ],
    }),
    createInventoryReceiptFromPurchase: builder.mutation<ApiResponse<InventoryReceiptCreatedResult>, CreateInventoryReceiptFromPurchaseRequest>({
      query: (body) => ({
        url: '/inventory-receipts/from-purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
      ],
    }),
    createInventoryIssue: builder.mutation<ApiResponse<InventoryIssueCreatedResult>, CreateInventoryIssueRequest>({
      query: (body) => ({
        url: '/inventory-issues',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.operationalKpis,
      ],
    }),
    createSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, CreateSupplementalMaterialRequest>({
      query: (body) => ({
        url: '/supplemental-material-requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getSupplementalMaterialRequests: builder.query<PageNumberPage<SupplementalMaterialRequestResult>, SupplementalMaterialRequestPageQuery | void>({
      query: (query) => ({
        url: '/supplemental-material-requests',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<SupplementalMaterialRequestResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.supplementalRequests],
    }),
    fulfillSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, FulfillSupplementalMaterialRequest>({
      query: ({ requestId, quantity }) => ({
        url: `/supplemental-material-requests/${requestId}/fulfill`,
        method: 'POST',
        body: { quantity },
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.documents,
      ],
    }),
    routeSupplementalMaterialRequestToPurchasing: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, string>({
      query: (requestId) => ({
        url: `/supplemental-material-requests/${requestId}/route-to-purchasing`,
        method: 'POST',
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.documents,
      ],
    }),
    rejectSupplementalMaterialRequest: builder.mutation<ApiResponse<SupplementalMaterialRequestResult>, RejectSupplementalMaterialRequest>({
      query: ({ requestId, reason }) => ({
        url: `/supplemental-material-requests/${requestId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: [
        workflowCacheTags.supplementalRequests,
        workflowCacheTags.documents,
      ],
    }),
    createInventoryReturn: builder.mutation<ApiResponse<InventoryReturnCreatedResult>, CreateInventoryReturnRequest>({
      query: (body) => ({
        url: '/inventory-returns',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.inventoryReturns,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.issueUsage,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getInventoryReturns: builder.query<PageNumberPage<InventoryReturnResult>, InventoryReturnPageQuery | void>({
      query: (query) => ({
        url: '/inventory-returns',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<InventoryReturnResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.inventoryReturns],
    }),
    getInventoryReturnById: builder.query<InventoryReturnResult | undefined, string>({
      query: (returnId) => `/inventory-returns/${returnId}`,
      transformResponse: (response: ApiResponse<InventoryReturnResult>) => response.data,
      providesTags: [workflowCacheTags.inventoryReturns],
    }),
    confirmInventoryReturnReceipt: builder.mutation<ApiResponse<void>, ConfirmInventoryReturnReceiptRequest>({
      query: ({ returnId, ...body }) => ({
        url: `/inventory-returns/${returnId}/confirm-receipt`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.inventoryReturns,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.issueUsage,
        workflowCacheTags.documents,
      ],
    }),
    confirmInventoryIssueReceipt: builder.mutation<ApiResponse<InventoryIssueResult>, ConfirmInventoryIssueReceiptRequest>({
      query: ({ issueId, hasDiscrepancy = false, discrepancyNote }) => ({
        url: `/inventory-issues/${issueId}/confirm-receipt`,
        method: 'POST',
        body: {
          hasDiscrepancy,
          discrepancyNote,
        },
      }),
      invalidatesTags: [
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.documents,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWarehousesQuery,
  useGetWarehouseSelectorQuery,
  useRecordWarehousePurchaseReceiptMutation,
  useGetInventoryReceiptsQuery,
  useGetInventoryReceiptByIdQuery,
  useAcceptReceiptQualityMutation,
  usePostWarehousePurchaseReceiptMutation,
  useReworkWarehousePurchaseReceiptMutation,
  useVoidWarehousePurchaseReceiptMutation,
  useCreateReceiptCorrectionMutation,
  useCreateInventoryReceiptFromPurchaseMutation,
  useCreateInventoryIssueMutation,
  useCreateSupplementalMaterialRequestMutation,
  useGetSupplementalMaterialRequestsQuery,
  useFulfillSupplementalMaterialRequestMutation,
  useRouteSupplementalMaterialRequestToPurchasingMutation,
  useRejectSupplementalMaterialRequestMutation,
  useCreateInventoryReturnMutation,
  useGetInventoryReturnsQuery,
  useGetInventoryReturnByIdQuery,
  useConfirmInventoryReturnReceiptMutation,
  useConfirmInventoryIssueReceiptMutation,
} = warehouseApi;
