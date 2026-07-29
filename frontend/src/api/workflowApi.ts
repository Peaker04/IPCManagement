import { apiSlice } from '@/api/apiSlice';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import {
  ownerToLaneId,
  routeByLaneId,
  workflowLaneDefinitions,
} from '@/lib/workflowConfig';
import type {
  DemandLine,
  RoleInboxItem,
  StockMovement,
  WorkflowDocument,
  WorkflowLane,
  WorkflowTone,
} from '@/types/workflow';

import type {
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
import { chefApi } from '@/features/chef/chefApi';
import { approvalsApi } from '@/features/approvals/approvalsApi';
import { adminWorkflowApi } from '@/features/admin/adminWorkflowApi';
export {
  useGetDailyProductionPlanQuery,
  useSendDailyProductionPlanToKitchenMutation,
} from '@/features/chef/chefApi';
export {
  useGetApprovalRecordsQuery,
  useExecuteApprovalDecisionMutation,
  useGetApprovalHistoryQuery,
} from '@/features/approvals/approvalsApi';
export {
  useGetApprovalRulesQuery,
  useCreateApprovalRuleMutation,
  useUpdateApprovalRuleMutation,
  useDeleteApprovalRuleMutation,
} from '@/features/admin/adminWorkflowApi';

const remainingWorkflowApi = apiSlice;

export const workflowApi = remainingWorkflowApi as typeof remainingWorkflowApi
  & typeof workflowDocumentsApi
  & typeof dashboardApi
  & typeof reportsApi
  & typeof purchasingApi
  & typeof warehouseApi
  & typeof chefApi
  & typeof approvalsApi
  & typeof adminWorkflowApi;


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
