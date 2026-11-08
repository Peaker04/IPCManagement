import { apiSlice } from '@/api/apiSlice';
import type {
  PageNumberPage,
  PurchaseRequestQuery,
  PurchaseRequestResult,
  SupplierEvidenceResult,
  PurchaseLineSupplierDecision,
  PurchaseWorkbenchWeek,
  PurchaseWorkbenchQuery,
  SupplierEvidenceQuery,
  ConfirmPurchaseLineSupplierRequest,
  GeneratePurchaseRequestFromDemandRequest,
  PurchaseRequestWorkflowResult,
  SupplierDto,
  UpdatePurchaseRequestLineSupplierDto,
  SupplierQuotationDto,
  CreateSupplierQuotationDto,
  SupplierQuotationPageQuery,
  UpdateSupplierQuotationArgs,
  PurchaseOrderDto,
  PurchaseOrderQuery,
  PurchaseOrderPageQuery,
  PurchaseOrderPageResponse,
  RecordPurchaseOrderReceiptArgs,
  GenerateMaterialDemandRequest,
  MaterialDemandStalenessQuery,
  MaterialDemandStaleness,
  MaterialDemandResultDto,
  PurchaseRequestWorkflowResultDto,
} from '@/api/workflowApiTypes';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags } from '@/api/workflowCacheTags';

const getData = <T>(response: ApiResponse<T>): T => response.data as T;

export const purchasingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSuppliers: builder.query<SupplierDto[], void>({
      query: () => '/suppliers',
      transformResponse: (response: ApiResponse<SupplierDto[]>) => getData(response),
    }),
    getPurchaseWorkbench: builder.query<PurchaseWorkbenchWeek, PurchaseWorkbenchQuery>({
      query: ({ week, date, stage, page = 1, pageSize = 8 }) => ({
        url: '/purchase-workflow/workbench',
        params: {
          week,
          ...(date ? { date } : {}),
          ...(stage ? { stage } : {}),
          page,
          pageSize,
        },
      }),
      transformResponse: (response: ApiResponse<PurchaseWorkbenchWeek>) => getData(response),
      providesTags: (_result, _error, { week }) => [
        workflowCacheTags.purchaseWorkbench,
        { type: 'WorkflowReports', id: `PurchaseWorkbench:${week}` },
      ],
    }),
    getSupplierEvidence: builder.query<SupplierEvidenceResult, SupplierEvidenceQuery>({
      query: ({ purchaseRequestId, purchaseRequestLineId }) =>
        `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier-evidence`,
      transformResponse: (response: ApiResponse<SupplierEvidenceResult>) => getData(response),
      providesTags: (_result, _error, { purchaseRequestId, purchaseRequestLineId }) => [
        workflowCacheTags.supplierEvidence,
        {
          type: 'WorkflowReports',
          id: `SupplierEvidence:${purchaseRequestId}:${purchaseRequestLineId}`,
        },
      ],
    }),
    confirmLineSupplier: builder.mutation<PurchaseLineSupplierDecision, ConfirmPurchaseLineSupplierRequest>({
      query: ({ purchaseRequestId, purchaseRequestLineId, data }) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier-decision`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<PurchaseLineSupplierDecision>) => getData(response),
      invalidatesTags: (_result, _error, { purchaseRequestId, purchaseRequestLineId, week }) => [
        workflowCacheTags.purchaseRequests,
        {
          type: 'WorkflowReports',
          id: `SupplierEvidence:${purchaseRequestId}:${purchaseRequestLineId}`,
        },
        { type: 'WorkflowReports', id: `PurchaseWorkbench:${week}` },
        workflowCacheTags.approvalInbox,
      ],
    }),
    updatePurchaseRequestLineSupplier: builder.mutation<
      ApiResponse<void>,
      SupplierEvidenceQuery & { data: UpdatePurchaseRequestLineSupplierDto }
    >({
      query: ({ purchaseRequestId, purchaseRequestLineId, data }) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/lines/${purchaseRequestLineId}/supplier`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    getSupplierQuotationsByIngredient: builder.query<SupplierQuotationDto[], string>({
      query: (ingredientId) => `/supplier-quotations/ingredient/${ingredientId}`,
      transformResponse: (response: ApiResponse<SupplierQuotationDto[]>) => getData(response),
      providesTags: ['SupplierQuotations'],
    }),
    getSupplierQuotationsByIngredientPage: builder.query<PageNumberPage<SupplierQuotationDto>, SupplierQuotationPageQuery>({
      query: ({ ingredientId, pageNumber = 1, pageSize = 8 }) => ({
        url: `/supplier-quotations/ingredient/${ingredientId}/page`,
        params: { pageNumber, pageSize },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<SupplierQuotationDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: ['SupplierQuotations'],
    }),
    createSupplierQuotation: builder.mutation<SupplierQuotationDto, CreateSupplierQuotationDto>({
      query: (body) => ({
        url: '/supplier-quotations',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<SupplierQuotationDto>) => response.data!,
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    updateSupplierQuotation: builder.mutation<SupplierQuotationDto, UpdateSupplierQuotationArgs>({
      query: ({ quotationId, data }) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<SupplierQuotationDto>) => response.data!,
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    deactivateSupplierQuotation: builder.mutation<ApiResponse<void>, string>({
      query: (quotationId) => ({
        url: `/supplier-quotations/${quotationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        'SupplierQuotations',
        workflowCacheTags.priceVariance,
        workflowCacheTags.supplierEvidence,
        workflowCacheTags.purchaseWorkbench,
      ],
    }),
    getPurchaseOrders: builder.query<PurchaseOrderDto[], PurchaseOrderQuery | void>({
      query: (query) => ({
        url: '/purchase-orders',
        params: query?.status ? { status: query.status } : undefined,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto[]>) => getData(response),
      providesTags: ['PurchaseOrders'],
    }),
    getPurchaseOrdersPage: builder.query<PurchaseOrderPageResponse, PurchaseOrderPageQuery | void>({
      query: (query) => ({
        url: '/purchase-orders/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 6 },
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderPageResponse>) => response.data ?? {
        page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 6, totalPages: 0, hasPrev: false, hasNext: false },
        orderCountByRequest: {},
      },
      providesTags: ['PurchaseOrders'],
    }),
    createPurchaseOrdersFromRequest: builder.mutation<PurchaseOrderDto[], string>({
      query: (purchaseRequestId) => ({
        url: `/purchase-orders/from-request/${purchaseRequestId}`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto[]>) => getData(response),
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.documents,
      ],
    }),
    recordPurchaseOrderReceipt: builder.mutation<PurchaseOrderDto, RecordPurchaseOrderReceiptArgs>({
      query: ({ purchaseOrderId, data }) => ({
        url: `/purchase-orders/${purchaseOrderId}/receive`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto>) => response.data!,
      invalidatesTags: [
        'PurchaseOrders',
        workflowCacheTags.documents,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
        workflowCacheTags.priceVariance,
        workflowCacheTags.operationalKpis,
      ],
    }),
    cancelPurchaseOrder: builder.mutation<PurchaseOrderDto, string>({
      query: (purchaseOrderId) => ({
        url: `/purchase-orders/${purchaseOrderId}/cancel`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<PurchaseOrderDto>) => response.data!,
      invalidatesTags: ['PurchaseOrders'],
    }),
    generateMaterialDemand: builder.mutation<ApiResponse<MaterialDemandResultDto>, GenerateMaterialDemandRequest>({
      query: (body) => ({
        url: '/material-demand/generate',
        method: 'POST',
        body: {
          scope: 'FULLDAY',
          ...body,
        },
      }),
      invalidatesTags: [
        'MaterialDemandStaleness',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.operationalKpis,
      ],
    }),
    getMaterialDemandStaleness: builder.query<ApiResponse<MaterialDemandStaleness>, MaterialDemandStalenessQuery>({
      query: ({ serviceDate, customerId, scope }) => ({
        url: '/material-demand/staleness',
        params: { serviceDate, ...(customerId ? { customerId } : {}), ...(scope ? { scope } : {}) },
      }),
      providesTags: ['MaterialDemandStaleness'],
    }),
    createPurchaseRequestFromDemand: builder.mutation<ApiResponse<PurchaseRequestWorkflowResult>, GeneratePurchaseRequestFromDemandRequest>({
      query: (body) => ({
        url: '/purchase-workflow/from-demand',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.documents,
      ],
    }),
    submitPurchaseRequest: builder.mutation<ApiResponse<PurchaseRequestWorkflowResultDto>, string>({
      query: (purchaseRequestId) => ({
        url: `/purchase-workflow/requests/${purchaseRequestId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: [
        workflowCacheTags.purchaseRequests,
        workflowCacheTags.purchaseWorkbench,
        workflowCacheTags.approvalInbox,
        workflowCacheTags.documents,
      ],
    }),
    getPurchaseRequests: builder.query<ApiResponse<PurchaseRequestResult[]>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests',
        params: query || undefined,
      }),
      providesTags: [workflowCacheTags.purchaseRequests],
    }),
    getPurchaseRequestsPage: builder.query<PageNumberPage<PurchaseRequestResult>, PurchaseRequestQuery | void>({
      query: (query) => ({
        url: '/purchase-requests/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PurchaseRequestResult>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.purchaseRequests],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSuppliersQuery,
  useGetPurchaseWorkbenchQuery,
  useGetSupplierEvidenceQuery,
  useConfirmLineSupplierMutation,
  useUpdatePurchaseRequestLineSupplierMutation,
  useGetSupplierQuotationsByIngredientQuery,
  useGetSupplierQuotationsByIngredientPageQuery,
  useCreateSupplierQuotationMutation,
  useUpdateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrdersPageQuery,
  useCreatePurchaseOrdersFromRequestMutation,
  useRecordPurchaseOrderReceiptMutation,
  useCancelPurchaseOrderMutation,
  useGenerateMaterialDemandMutation,
  useGetMaterialDemandStalenessQuery,
  useCreatePurchaseRequestFromDemandMutation,
  useSubmitPurchaseRequestMutation,
  useGetPurchaseRequestsQuery,
  useGetPurchaseRequestsPageQuery,
} = purchasingApi;
