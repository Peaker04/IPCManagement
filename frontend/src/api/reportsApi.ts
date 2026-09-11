import { apiSlice } from '@/api/apiSlice';
import type {
  WorkflowReportQuery, WorkflowReportPageQuery, IngredientDemandAggregatePageQuery, PurchasePlanPageQuery,
  DataQualityPageQuery,
  MaterialRequestCandidatePageQuery,
  CurrentStockPageQuery, StockMovementPageQuery,
  ReceiptPriceVariancePageQuery,
  PriceVarianceAggregatePageQuery,
  PageNumberPage,
  CursorPage,
  IngredientDemandReportDto,
  IngredientDemandPageResponseDto,
  MaterialRequestCandidate,
  IngredientDemandAggregatePageResponseDto,
  PurchasePlanRow,
  PurchasePlanReportDto,
  PurchasePlanPageResponseDto,
  StockMovementViewDto,
  StockLedgerReconciliationDto,
  ReceiptPriceVarianceReportDto,
  PriceVarianceBySupplierDto,
  PriceVarianceByPeriodDto,
  PriceVarianceByDishGroupDto,
  CurrentStockSummaryDto,
  KitchenIssueReportDto,
  IssueVsReturnUsageReportDto,
  SupplyLineReconciliationDto,
  AuditChangeReportDto,
  DataQualityReportDto,
  DataQualityPageDto,
  PriceVarianceRow,
  AuditLogRow,
  CurrentStockRow,
  StockLedgerReconciliationRow,
  KitchenIssueRow,
  UsageReportRow,
  DataQualityIssueRow,
  DataQualityReport,
  DataQualityPageReport,
  DataQualityIssueRemediationRequest,
  CursorPageDto,
  DataQualityIssueRemediationResult,
  LegacyLineageDispositionDto,
  LegacyLineageCandidateDto,
  CreateLegacyLineageDispositionRequest,
  ReviewLegacyLineageDispositionRequest,
  ApplyLegacyLineageDispositionRequest,
} from '@/api/workflowApiTypes';
import type {
  DemandLine,
  StockMovement,
} from '@/types/workflow';
import type { ApiResponse } from '@/types/api';
import { workflowAuditSourceTags, workflowCacheTags } from '@/api/workflowCacheTags';
import { useGetWorkflowDocumentsQuery } from '@/api/workflowDocumentsApi';
import { mapDemandAggregateLine, mapStockMovement } from './reportMappers';
import {
  getReportData as getData,
  mapAuditChange,
  mapCurrentStock,
  mapCursorPage,
  mapDataQualityIssue,
  mapDataQualityReport,
  mapDemandLine,
  mapKitchenIssue,
  mapPageNumberPage,
  mapPriceVariance,
  mapPurchasePlanRow,
  mapStockLedgerReconciliation,
  mapUsageReport,
  reportQueryWithLimit as queryWithLimit,
} from './reportsApiMappers';
import { buildRoleInbox, buildWorkflowLanes } from './workflowOverviewModel';

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getIngredientDemand: builder.query<DemandLine[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IngredientDemandReportDto[]>) => getData(response).map(mapDemandLine),
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getPurchasePlan: builder.query<PurchasePlanRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-plan',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PurchasePlanReportDto[]>) =>
        (response.data ?? []).map(mapPurchasePlanRow),
      providesTags: [
        'PurchaseOrders',
        'SupplierQuotations',
        workflowCacheTags.purchasePlan,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.purchaseRequests,
      ],
    }),
    getPurchasePlanPage: builder.query<PageNumberPage<PurchasePlanRow> & { totalShortageQty: number; totalEstimatedAmount: number }, PurchasePlanPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-plan/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PurchasePlanPageResponseDto>) => {
        const page = response.data;
        return {
          items: (page?.items ?? []).map(mapPurchasePlanRow),
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 8,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          totalShortageQty: page?.totalShortageQty ?? 0,
          totalEstimatedAmount: page?.totalEstimatedAmount ?? 0,
        };
      },
      providesTags: [
        'PurchaseOrders',
        'SupplierQuotations',
        workflowCacheTags.purchasePlan,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.purchaseRequests,
      ],
    }),
    getIngredientDemandPage: builder.query<PageNumberPage<DemandLine> & { shortageCount: number }, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<IngredientDemandPageResponseDto>) => {
        const page = response.data;
        return {
          items: page?.items?.map(mapDemandLine) ?? [],
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 8,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          shortageCount: page?.shortageCount ?? 0,
        };
      },
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getMaterialRequestCandidatePage: builder.query<PageNumberPage<MaterialRequestCandidate>, MaterialRequestCandidatePageQuery>({
      query: (query) => ({
        url: '/workflow-reports/material-request-candidates/page',
        params: {
          ...query,
          pageNumber: query.pageNumber ?? 1,
          pageSize: query.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<MaterialRequestCandidate>>) => response.data ?? {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 8,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      },
      providesTags: [workflowCacheTags.materialRequestCandidates],
    }),
    getIngredientDemandAggregatePage: builder.query<PageNumberPage<DemandLine> & { shortageCount: number }, IngredientDemandAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand/aggregate/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 20,
        },
      }),
      transformResponse: (response: ApiResponse<IngredientDemandAggregatePageResponseDto>) => {
        const page = response.data;
        return {
          items: page?.items?.map(mapDemandAggregateLine) ?? [],
          totalCount: page?.totalCount ?? 0,
          pageNumber: page?.pageNumber ?? 1,
          pageSize: page?.pageSize ?? 20,
          totalPages: page?.totalPages ?? 0,
          hasPrev: page?.hasPrev ?? false,
          hasNext: page?.hasNext ?? false,
          shortageCount: page?.shortageCount ?? 0,
        };
      },
      providesTags: [workflowCacheTags.ingredientDemand],
    }),
    getStockMovements: builder.query<StockMovement[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockMovementViewDto[]>) => getData(response).map(mapStockMovement),
      providesTags: [workflowCacheTags.stockMovements],
    }),
    getStockMovementPage: builder.query<CursorPage<StockMovement>, StockMovementPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<StockMovementViewDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false, nextCursorOffset: 0 }, mapStockMovement),
      providesTags: [workflowCacheTags.stockMovements],
    }),
    getPriceVariance: builder.query<PriceVarianceRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<ReceiptPriceVarianceReportDto[]>) => getData(response).map(mapPriceVariance),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceBySupplier: builder.query<PriceVarianceBySupplierDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceBySupplierDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceBySupplierPage: builder.query<PageNumberPage<PriceVarianceBySupplierDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-supplier/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceBySupplierDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByPeriod: builder.query<PriceVarianceByPeriodDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByPeriodDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByPeriodPage: builder.query<PageNumberPage<PriceVarianceByPeriodDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-period/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByPeriodDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByDishGroup: builder.query<PriceVarianceByDishGroupDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PriceVarianceByDishGroupDto[]>) => getData(response),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getPriceVarianceByDishGroupPage: builder.query<PageNumberPage<PriceVarianceByDishGroupDto>, PriceVarianceAggregatePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/price-variance/by-dish-group/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<PriceVarianceByDishGroupDto>>) => response.data ?? {
        items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
      },
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getCurrentStock: builder.query<CurrentStockRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<CurrentStockSummaryDto[]>) => getData(response).map(mapCurrentStock),
      providesTags: [workflowCacheTags.currentStock],
    }),
    getStockLedgerReconciliation: builder.query<StockLedgerReconciliationRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-ledger-reconciliation',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockLedgerReconciliationDto[]>) => getData(response).map(mapStockLedgerReconciliation),
      providesTags: [
        workflowCacheTags.stockLedger,
        workflowCacheTags.stockMovements,
        workflowCacheTags.currentStock,
      ],
    }),
    getKitchenIssues: builder.query<KitchenIssueRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<KitchenIssueReportDto[]>) => getData(response).map(mapKitchenIssue),
      providesTags: [workflowCacheTags.kitchenIssues],
    }),
    getKitchenIssuesPage: builder.query<PageNumberPage<KitchenIssueRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<KitchenIssueReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapKitchenIssue),
      providesTags: [workflowCacheTags.kitchenIssues],
    }),
    getIssueVsReturnUsage: builder.query<UsageReportRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IssueVsReturnUsageReportDto[]>) => getData(response).map(mapUsageReport),
      providesTags: [
        workflowCacheTags.issueUsage,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.inventoryReturns,
      ],
    }),
    getIssueVsReturnUsagePage: builder.query<PageNumberPage<UsageReportRow>, WorkflowReportPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<IssueVsReturnUsageReportDto>>) =>
        mapPageNumberPage(response.data ?? { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, mapUsageReport),
      providesTags: [
        workflowCacheTags.issueUsage,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.inventoryReturns,
      ],
    }),
    getSupplyLineReconciliation: builder.query<SupplyLineReconciliationDto[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/supply-line-reconciliation',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<SupplyLineReconciliationDto[]>) => getData(response),
      providesTags: [
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.kitchenIssues,
        workflowCacheTags.inventoryReturns,
        workflowCacheTags.currentStock,
      ],
    }),
    getLegacyLineageDispositions: builder.query<LegacyLineageDispositionDto[], string | void>({
      query: (status) => ({
        url: '/legacy-lineage-dispositions',
        params: status ? { status } : undefined,
      }),
      transformResponse: (response: ApiResponse<LegacyLineageDispositionDto[]>) => response.data ?? [],
      providesTags: [workflowCacheTags.ingredientDemand, workflowCacheTags.inventoryReturns],
    }),
    getLegacyLineageCandidates: builder.query<LegacyLineageCandidateDto[], { legacyLineType: string; legacyLineId: string }>({
      query: ({ legacyLineType, legacyLineId }) => ({
        url: '/legacy-lineage-dispositions/candidates',
        params: { legacyLineType, legacyLineId },
      }),
      transformResponse: (response: ApiResponse<LegacyLineageCandidateDto[]>) => response.data ?? [],
    }),
    createLegacyLineageDisposition: builder.mutation<LegacyLineageDispositionDto, CreateLegacyLineageDispositionRequest>({
      query: (body) => ({ url: '/legacy-lineage-dispositions', method: 'POST', body }),
      transformResponse: (response: ApiResponse<LegacyLineageDispositionDto>) => response.data as LegacyLineageDispositionDto,
      invalidatesTags: [workflowCacheTags.ingredientDemand, workflowCacheTags.inventoryReturns],
    }),
    reviewLegacyLineageDisposition: builder.mutation<LegacyLineageDispositionDto, { dispositionId: string; body: ReviewLegacyLineageDispositionRequest }>({
      query: ({ dispositionId, body }) => ({ url: `/legacy-lineage-dispositions/${dispositionId}/review`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<LegacyLineageDispositionDto>) => response.data as LegacyLineageDispositionDto,
      invalidatesTags: [workflowCacheTags.ingredientDemand, workflowCacheTags.inventoryReturns],
    }),
    applyLegacyLineageDisposition: builder.mutation<LegacyLineageDispositionDto, { dispositionId: string; body: ApplyLegacyLineageDispositionRequest }>({
      query: ({ dispositionId, body }) => ({ url: `/legacy-lineage-dispositions/${dispositionId}/apply`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<LegacyLineageDispositionDto>) => response.data as LegacyLineageDispositionDto,
      invalidatesTags: [workflowCacheTags.ingredientDemand, workflowCacheTags.inventoryReturns],
    }),
    getAuditChanges: builder.query<AuditLogRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<AuditChangeReportDto[]>) => getData(response).map(mapAuditChange),
      providesTags: [workflowCacheTags.auditChanges, ...workflowAuditSourceTags],
    }),
    getPriceVariancePage: builder.query<PageNumberPage<PriceVarianceRow>, ReceiptPriceVariancePageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 6,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<ReceiptPriceVarianceReportDto>>) =>
        mapPageNumberPage(response.data ?? {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 6,
          totalPages: 0,
          hasPrev: false,
          hasNext: false,
        }, mapPriceVariance),
      providesTags: [workflowCacheTags.priceVariance],
    }),
    getCurrentStockPage: builder.query<PageNumberPage<CurrentStockRow>, CurrentStockPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock/page',
        params: {
          ...query,
          pageNumber: query?.pageNumber ?? 1,
          pageSize: query?.pageSize ?? 8,
        },
      }),
      transformResponse: (response: ApiResponse<PageNumberPage<CurrentStockSummaryDto>>) =>
        mapPageNumberPage(response.data ?? {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 8,
          totalPages: 0,
          hasPrev: false,
          hasNext: false,
        }, mapCurrentStock),
      providesTags: [workflowCacheTags.currentStock],
    }),
    getAuditChangePage: builder.query<CursorPage<AuditLogRow>, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes/page',
        params: { ...queryWithLimit(query || undefined), limit: query?.limit ?? 20 },
      }),
      transformResponse: (response: ApiResponse<CursorPageDto<AuditChangeReportDto>>) =>
        mapCursorPage(response.data ?? { items: [], limit: 20, hasNext: false, nextCursorOffset: 0 }, mapAuditChange),
      providesTags: [workflowCacheTags.auditChanges, ...workflowAuditSourceTags],
    }),
    getDataQuality: builder.query<DataQualityReport, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/data-quality',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<DataQualityReportDto>) =>
        response.data ? mapDataQualityReport(response.data) : {
          generatedAt: '',
          totalIssues: 0,
          isTruncated: false,
          errorCount: 0,
          warningCount: 0,
          resolvedIssueCount: 0,
          reopenedIssueCount: 0,
          urgentIssueCount: 0,
          missingBomCount: 0,
          invalidUnitCount: 0,
          missingConversionCount: 0,
          negativeStockCount: 0,
          orphanDocumentCount: 0,
          issues: [],
        },
      providesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.stockLedger,
      ],
    }),
    getDataQualityPage: builder.query<DataQualityPageReport, DataQualityPageQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/data-quality/page',
        params: { ...query, pageNumber: query?.pageNumber ?? 1, pageSize: query?.pageSize ?? 8 },
      }),
      transformResponse: (response: ApiResponse<DataQualityPageDto>) => {
        const report = response.data;
        const emptyPage: PageNumberPage<DataQualityIssueRow> = {
          items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false,
        };
        if (!report) {
          return {
            ...mapDataQualityReport({
              generatedAt: '',
              totalIssues: 0,
              isTruncated: false,
              errorCount: 0,
              warningCount: 0,
              resolvedIssueCount: 0,
              reopenedIssueCount: 0,
              urgentIssueCount: 0,
              missingBomCount: 0,
              invalidUnitCount: 0,
              missingConversionCount: 0,
              negativeStockCount: 0,
              orphanDocumentCount: 0,
              issues: [],
            }),
            page: emptyPage,
          };
        }
        return {
          ...mapDataQualityReport(report),
          page: mapPageNumberPage(report.page ?? emptyPage, mapDataQualityIssue),
        };
      },
      providesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.currentStock,
        workflowCacheTags.stockLedger,
      ],
    }),
    updateDataQualityIssueRemediation: builder.mutation<ApiResponse<DataQualityIssueRemediationResult>, DataQualityIssueRemediationRequest>({
      query: (body) => ({
        url: '/workflow-reports/data-quality/issues/remediation',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.dataQuality,
        workflowCacheTags.operationalKpis,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetIngredientDemandQuery,
  useGetPurchasePlanQuery,
  useGetPurchasePlanPageQuery,
  useGetIngredientDemandPageQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetIngredientDemandAggregatePageQuery,
  useGetStockMovementsQuery,
  useGetStockMovementPageQuery,
  useGetPriceVarianceQuery,
  useGetPriceVarianceBySupplierQuery,
  useGetPriceVarianceBySupplierPageQuery,
  useGetPriceVarianceByPeriodQuery,
  useGetPriceVarianceByPeriodPageQuery,
  useGetPriceVarianceByDishGroupQuery,
  useGetPriceVarianceByDishGroupPageQuery,
  useGetCurrentStockQuery,
  useGetStockLedgerReconciliationQuery,
  useGetKitchenIssuesQuery,
  useGetKitchenIssuesPageQuery,
  useGetIssueVsReturnUsageQuery,
  useGetIssueVsReturnUsagePageQuery,
  useGetSupplyLineReconciliationQuery,
  useGetLegacyLineageDispositionsQuery,
  useGetLegacyLineageCandidatesQuery,
  useCreateLegacyLineageDispositionMutation,
  useReviewLegacyLineageDispositionMutation,
  useApplyLegacyLineageDispositionMutation,
  useGetAuditChangesQuery,
  useGetPriceVariancePageQuery,
  useGetCurrentStockPageQuery,
  useGetAuditChangePageQuery,
  useGetDataQualityQuery,
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
} = reportsApi;

export function useWorkflowOverview(options: { skip?: boolean } = {}) {
  const queryOptions = { skip: options.skip ?? false };
  const documentsResult = useGetWorkflowDocumentsQuery({ limit: 100 }, queryOptions);
  const demandResult = useGetIngredientDemandQuery({ limit: 100 }, queryOptions);
  const priceResult = useGetPriceVarianceQuery({ limit: 100 }, queryOptions);
  const movementsResult = useGetStockMovementsQuery({ limit: 100 }, queryOptions);
  const documents = documentsResult.data ?? [];
  const demandLines = demandResult.data ?? [];
  const priceRows = priceResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const roleInboxItems = buildRoleInbox(documents, demandLines, priceRows);
  const workflowLanes = buildWorkflowLanes(documents, roleInboxItems, movements);
  return {
    workflowLanes, roleInboxItems,
    blockedItems: roleInboxItems.filter((item) => item.tone === 'danger'),
    documents,
    demandLines,
    movements,
    isLoading: documentsResult.isLoading || demandResult.isLoading || priceResult.isLoading || movementsResult.isLoading,
    isFetching: documentsResult.isFetching || demandResult.isFetching || priceResult.isFetching || movementsResult.isFetching,
    isError: documentsResult.isError || demandResult.isError || priceResult.isError || movementsResult.isError,
    error: documentsResult.error ?? demandResult.error ?? priceResult.error ?? movementsResult.error,
    refetch: () => Promise.all([documentsResult.refetch(), demandResult.refetch(), priceResult.refetch(), movementsResult.refetch()]),
  };
}
