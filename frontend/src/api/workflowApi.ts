import { apiSlice } from '@/api/apiSlice';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import type { ApiResponse } from '@/types/api';
import {
  ownerToLaneId,
  routeByLaneId,
  toneFromStatus,
  workflowLaneDefinitions,
} from '@/lib/workflowConfig';
import type {
  ApprovalRecord,
  DemandLine,
  RoleInboxItem,
  StockMovement,
  WorkflowDocument,
  WorkflowLane,
  WorkflowTone,
} from '@/types/workflow';

import type {
  WorkflowReportQuery,
  ApprovalInboxQuery,
  ApprovalInboxPage,
  ApprovalHistoryItem,
  ProductionPlan,
  DailyProductionPlan,
  ProductionPlanDto,
  DailyProductionPlanDto,
  SendDailyProductionPlanRequest,
  ApprovalInboxItemDto,
  ApprovalRuleDto,
  ApprovalRuleRequestDto,
  ApprovalInboxPageDto,
  ApprovalDecisionRequest,
  ApprovalHistoryQuery,
  UpdateApprovalRuleArgs,
  PriceVarianceRow,
} from '@/api/workflowApiTypes';

export type {
  WorkflowReportQuery,
  WorkflowReportPageQuery,
  DataQualityPageQuery,
  MaterialRequestCandidatePageQuery,
  CurrentStockPageQuery,
  ReceiptPriceVariancePageQuery,
  PriceVarianceAggregatePageQuery,
  PageNumberPage,
  CursorPage,
  ReportCursor,
  ApprovalInboxQuery,
  ApprovalInboxPage,
  PurchaseRequestQuery,
  PurchaseRequestResult,
  PurchaseWorkbenchQuery,
  PurchaseWorkflowStageCounts,
  SupplierEvidenceType,
  SupplierEvidenceCandidate,
  SupplierEvidenceResult,
  PurchaseLineSupplierDecision,
  PurchaseRequestWorkflowLine,
  ApprovedDemandSummary,
  PurchaseWorkbenchServiceDate,
  PurchaseWorkbenchWeek,
  SupplierEvidenceQuery,
  ConfirmPurchaseLineSupplierData,
  ConfirmPurchaseLineSupplierRequest,
  ApprovalHistoryItem,
  CreateInventoryReceiptFromPurchaseLineRequest,
  CreateInventoryReceiptFromPurchaseRequest,
  WarehouseDto,
  GeneratePurchaseRequestFromDemandRequest,
  PurchaseRequestWorkflowResult,
  InventoryReceiptCreatedResult,
  CreateInventoryIssueLineRequest,
  CreateInventoryIssueRequest,
  CreateSupplementalMaterialRequest,
  SupplementalMaterialRequestResult,
  SupplementalMaterialRequestPageQuery,
  InventoryIssueCreatedResult,
  CreateInventoryReturnLineRequest,
  CreateInventoryReturnRequest,
  InventoryReturnCreatedResult,
  ConfirmInventoryIssueReceiptRequest,
  InventoryIssueResult,
  MaterialRequestCandidate,
  PurchasePlanRow,
  ProductionPlanLine,
  ProductionPlan,
  DailyProductionPlan,
  SendDailyProductionPlanRequest,
  ApprovalRuleDto,
  ApprovalAssignmentDto,
  ApprovalAssignmentRequestDto,
  ApprovalRuleRequestDto,
  SupplierDto,
  UpdatePurchaseRequestLineSupplierDto,
  SupplierQuotationDto,
  CreateSupplierQuotationDto,
  UpdateSupplierQuotationDto,
  PurchaseOrderLineDto,
  InventoryReturnLineResult,
  InventoryReturnResult,
  InventoryReturnPageQuery,
  ConfirmInventoryReturnReceiptData,
  ConfirmInventoryReturnReceiptRequest,
  PurchaseOrderDto,
  PurchaseReceiptEvidenceRequirements,
  WarehousePurchaseReceiptLineRequest,
  WarehousePurchaseReceiptRequest,
  WarehousePurchaseReceiptResult,
  RecordWarehousePurchaseReceiptRequest,
  PurchaseOrderPageResponse,
  RecordPurchaseOrderReceiptLineDto,
  RecordPurchaseOrderReceiptDto,
  PriceVarianceBySupplierDto,
  PriceVarianceByPeriodDto,
  PriceVarianceDishGroupIngredientDto,
  PriceVarianceByDishGroupDto,
  OperationalKpiSummaryDto,
  GenerateMaterialDemandRequest,
  MaterialDemandStalenessQuery,
  MaterialDemandStaleness,
  ApprovalDecisionRequest,
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
  DataQualityIssueRemediationResult,
} from '@/api/workflowApiTypes';

export { toNextReportCursor } from '@/api/workflowApiTypes';


const getData = <T>(response: ApiResponse<T>): T => response.data as T;
const emptyDailyProductionPlan = (): DailyProductionPlan => ({
  serviceDate: '',
  totalPlans: 0,
  sentPlans: 0,
  totalDishes: 0,
  totalServings: 0,
  totalRequiredQty: 0,
  suggestedPurchaseQty: 0,
  warnings: [],
  plans: [],
});

const mapProductionPlan = (plan: ProductionPlanDto): ProductionPlan => ({
  ...plan,
  customerId: plan.customerId ?? undefined,
  customerCode: plan.customerCode ?? undefined,
  customerName: plan.customerName ?? undefined,
  status: plan.status ?? undefined,
  sentToKitchenAt: plan.sentToKitchenAt ?? undefined,
  sentToKitchenByName: plan.sentToKitchenByName ?? undefined,
  lines: plan.lines.map((line) => ({ ...line })),
});

const normalizeDailyProductionPlan = (
  response: ApiResponse<DailyProductionPlanDto> | DailyProductionPlanDto | unknown,
): DailyProductionPlan => {
  const maybeData =
    response && typeof response === 'object' && 'data' in response
      ? (response as ApiResponse<DailyProductionPlanDto>).data
      : response;

  if (!maybeData || typeof maybeData !== 'object' || Array.isArray(maybeData)) {
    return emptyDailyProductionPlan();
  }

  const plan = maybeData as Partial<DailyProductionPlanDto>;
  return {
    ...emptyDailyProductionPlan(),
    ...plan,
    customerId: plan.customerId ?? undefined,
    customerCode: plan.customerCode ?? undefined,
    customerName: plan.customerName ?? undefined,
    shiftName: plan.shiftName ?? undefined,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    plans: Array.isArray(plan.plans) ? plan.plans.map(mapProductionPlan) : [],
  };
};







const normalizeWorkflowTone = (tone: string, status: string): WorkflowTone =>
  tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'neutral'
    ? tone
    : toneFromStatus(status);

const mapApprovalInboxItem = (item: ApprovalInboxItemDto): ApprovalRecord => ({
  id: item.inboxItemId || item.targetCode || item.targetId,
  targetType: item.targetType,
  targetId: item.targetId,
  targetCode: item.targetCode,
  type: item.itemType === 'price-alert' || item.itemType === 'price-exception' ? 'price-alert' : item.itemType === 'adjustment' ? 'adjustment' : item.itemType === 'issue' ? 'issue' : 'purchase',
  title: item.title,
  source: item.source || item.targetCode,
  owner: item.ownerRole,
  submittedBy: item.submittedBy,
  deadline: item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : 'Trong ca',
  status: item.status,
  reason: item.reason,
  nextAction: item.nextAction,
  tone: normalizeWorkflowTone(item.tone, item.status),
  slaDeadline: item.slaDeadline ?? undefined,
  slaHours: item.slaHours,
  route: item.route,
  weekStartDate: item.weekStartDate ?? undefined,
  serviceDate: item.serviceDate ?? undefined,
  scope: item.scope ?? undefined,
  lineCount: item.lineCount,
  totalQuantity: item.totalQuantity,
  totalValue: item.totalValue,
  submittedAt: item.submittedAt ?? undefined,
  referencePrice: item.referencePrice,
  proposedPrice: item.proposedPrice,
  variancePercent: item.variancePercent,
  evidenceType: item.evidenceType ?? undefined,
  evidenceId: item.evidenceId ?? undefined,
  evidenceDate: item.evidenceDate ?? undefined,
  proposalFingerprint: item.proposalFingerprint ?? undefined,
  proposalVersion: item.proposalVersion,
  supplierName: item.supplierName ?? undefined,
  sourceDocumentCode: item.sourceDocumentCode ?? undefined,
  materials: (item.materials ?? []).map((material) => ({ ...material })),
});












const buildRoleInbox = (
  documents: WorkflowDocument[],
  demandLines: DemandLine[],
  priceRows: PriceVarianceRow[],
): RoleInboxItem[] => {
  const documentItems: RoleInboxItem[] = documents
    .filter((document) => document.tone === 'warning' || document.tone === 'danger')
    .map((document) => {
      const laneId = ownerToLaneId(document.owner);
      return {
        id: `doc-${document.id}`,
        laneId,
        owner: document.owner,
        title: document.title,
        description: document.summary,
        due: document.lines.find((line) => line.label === 'Ca')?.value ?? 'Trong ca',
        nextAction: document.status,
        tone: document.tone,
        route: document.route || routeByLaneId[laneId],
      };
    });

  const demandItems: RoleInboxItem[] = demandLines
    .filter((line) => line.tone === 'danger')
    .map((line, index) => ({
      id: `demand-${line.id}-${index}`,
      laneId: 'planning',
      owner: 'KHSX',
      title: `Thiếu ${line.material}`,
      description: `Cần ${formatQuantityWithUnit(line.required, line.unit)}, hiện có ${formatQuantityWithUnit(line.available, line.unit)}.`,
      due: 'Sau kiểm tồn',
      nextAction: line.nextAction,
      tone: 'danger',
      route: routeByLaneId.planning,
    }));

  const priceItems: RoleInboxItem[] = priceRows
    .filter((row) => row.warning)
    .map((row) => ({
      id: `price-${row.id}`,
      laneId: 'purchasing',
      owner: 'Thu mua',
      title: `${row.name} vượt ngưỡng giá`,
      description: `Tăng ${formatPercent(row.change)} tại ${row.supplier}.`,
      due: 'Trước khi đặt hàng',
      nextAction: 'Gửi cảnh báo biến động giá',
      tone: 'danger',
      route: routeByLaneId.purchasing,
    }));

  return [...documentItems, ...demandItems, ...priceItems];
};

const buildWorkflowLanes = (
  documents: WorkflowDocument[],
  inbox: RoleInboxItem[],
  movements: StockMovement[],
): WorkflowLane[] =>
  workflowLaneDefinitions.map((lane) => {
    const laneInbox = inbox.filter((item) => item.laneId === lane.id);
    const laneDocuments = documents.filter((document) => ownerToLaneId(document.owner) === lane.id);
    const blocked = laneInbox.filter((item) => item.tone === 'danger').length;
    const waiting = laneInbox.length + laneDocuments.filter((document) => document.tone === 'warning').length;
    const done = laneDocuments.filter((document) => document.tone === 'success').length
      + (lane.id === 'warehouse' ? movements.filter((movement) => movement.tone === 'success').length : 0);
    const tone: WorkflowTone = blocked > 0 ? 'danger' : waiting > 0 ? 'warning' : done > 0 ? 'success' : 'neutral';

    return {
      ...lane,
      waiting,
      blocked,
      done,
      tone,
      status: blocked > 0 ? 'Có ngoại lệ' : waiting > 0 ? 'Đang chờ xử lí' : done > 0 ? 'Đã ghi nhận' : 'Chưa có dữ liệu',
    };
  });

export {
  useGetWorkflowDocumentsQuery,
} from '@/api/workflowDocumentsApi';
export {
  useGetOperationalKpisQuery,
} from '@/features/dashboard/dashboardApi';
export {
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
  useGetAuditChangesQuery,
  useGetPriceVariancePageQuery,
  useGetCurrentStockPageQuery,
  useGetAuditChangePageQuery,
  useGetDataQualityQuery,
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
} from '@/features/reports/reportsApi';

import {
  workflowDocumentsApi,
  useGetWorkflowDocumentsQuery,
} from '@/api/workflowDocumentsApi';
import { dashboardApi } from '@/features/dashboard/dashboardApi';
import {
  reportsApi,
  useGetIngredientDemandQuery,
  useGetPriceVarianceQuery,
  useGetStockMovementsQuery,
} from '@/features/reports/reportsApi';
import { purchasingApi } from '@/features/purchasing/purchasingApi';
import { warehouseApi } from '@/features/warehouse/warehouseApi';
export {
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
} from '@/features/purchasing/purchasingApi';
export {
  useGetWarehousesQuery,
  useGetWarehouseSelectorQuery,
  useRecordWarehousePurchaseReceiptMutation,
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
} from '@/features/warehouse/warehouseApi';

const remainingWorkflowApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDailyProductionPlan: builder.query<DailyProductionPlan, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/production-plans/daily',
        params: query || undefined,
      }),
      transformResponse: normalizeDailyProductionPlan,
      providesTags: [workflowCacheTags.productionPlans],
    }),
    sendDailyProductionPlanToKitchen: builder.mutation<DailyProductionPlan, SendDailyProductionPlanRequest>({
      query: (body) => ({
        url: '/production-plans/daily/send-to-kitchen',
        method: 'POST',
        body,
      }),
      transformResponse: normalizeDailyProductionPlan,
      invalidatesTags: [
        workflowCacheTags.productionPlans,
        workflowCacheTags.documents,
        workflowCacheTags.kitchenIssues,
      ],
    }),
    getApprovalRecords: builder.query<ApprovalInboxPage, ApprovalInboxQuery | void>({
      query: (query) => ({
        url: '/approvals/inbox',
        params: {
          limit: query?.limit ?? 20,
          ...(query?.cursor ? { cursor: query.cursor } : {}),
        },
      }),
      transformResponse: (response: ApiResponse<ApprovalInboxPageDto>): ApprovalInboxPage => {
        const page = getData(response);
        return {
          items: (page.items ?? []).map(mapApprovalInboxItem),
          limit: page.limit,
          hasNext: page.hasNext,
          nextCursor: page.nextCursor,
        };
      },
      providesTags: (result) => [
        workflowCacheTags.approvalInbox,
        ...(result?.items ?? []).map((item) => ({
          type: 'WorkflowReports' as const,
          id: `ApprovalTarget:${item.targetType}:${item.targetId}`,
        })),
      ],
    }),
    executeApprovalDecision: builder.mutation<ApiResponse<unknown>, ApprovalDecisionRequest>({
      query: ({ targetType, targetId, status, reason }) => ({
        url: `/approvals/${targetType}/${targetId}`,
        method: 'POST',
        body: { status, reason },
      }),
      invalidatesTags: (_result, _error, { targetType, targetId, week }) => [
        workflowCacheTags.approvalInbox,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
        workflowCacheTags.purchaseRequests,
        { type: 'WorkflowReports', id: `ApprovalTarget:${targetType}:${targetId}` },
        ...(week
          ? [{ type: 'WorkflowReports' as const, id: `PurchaseWorkbench:${week}` }]
          : []),
      ],
    }),
    getApprovalHistory: builder.query<ApiResponse<ApprovalHistoryItem[]>, ApprovalHistoryQuery>({
      query: ({ documentType, documentId }) => `/approval-history/${documentType}/${documentId}`,
      providesTags: [workflowCacheTags.approvalHistory],
    }),
    getApprovalRules: builder.query<ApiResponse<ApprovalRuleDto[]>, void>({
      query: () => '/approval-rules',
      providesTags: [workflowCacheTags.approvalRules],
    }),
    createApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, ApprovalRuleRequestDto>({
      query: (body) => ({
        url: '/approval-rules',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    updateApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, UpdateApprovalRuleArgs>({
      query: ({ id, body }) => ({
        url: `/approval-rules/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    deleteApprovalRule: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/approval-rules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
  }),
  overrideExisting: false,
});

export const workflowApi = remainingWorkflowApi as typeof remainingWorkflowApi
  & typeof workflowDocumentsApi
  & typeof dashboardApi
  & typeof reportsApi
  & typeof purchasingApi
  & typeof warehouseApi;

export const {
  useGetDailyProductionPlanQuery,
  useSendDailyProductionPlanToKitchenMutation,
  useGetApprovalRecordsQuery,
  useExecuteApprovalDecisionMutation,
  useGetApprovalHistoryQuery,
  useGetApprovalRulesQuery,
  useCreateApprovalRuleMutation,
  useUpdateApprovalRuleMutation,
  useDeleteApprovalRuleMutation,
} = remainingWorkflowApi;

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
    workflowLanes,
    roleInboxItems,
    blockedItems: roleInboxItems.filter((item) => item.tone === 'danger'),
    documents,
    demandLines,
    movements,
    isLoading: documentsResult.isLoading || demandResult.isLoading || priceResult.isLoading || movementsResult.isLoading,
    isError: documentsResult.isError || demandResult.isError || priceResult.isError || movementsResult.isError,
  };
}
