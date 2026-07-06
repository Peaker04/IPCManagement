import { apiSlice } from '@/api/apiSlice';
import { formatPercent, formatQuantityWithUnit } from '@/lib/formatters';
import type { ApiResponse } from '@/types/api';
import {
  ownerToLaneId,
  routeByLaneId,
  toneFromStatus,
  workflowLaneDefinitions,
} from './workflowConfig';
import type {
  ApprovalRecord,
  ApprovalType,
  DemandLine,
  RoleInboxItem,
  StockMovement,
  StockMovementType,
  WorkflowDocument,
  WorkflowDocumentType,
  WorkflowLane,
  WorkflowTone,
} from './types';

export interface SupplierDto {
  supplierId: string;
  supplierCode?: string;
  supplierName?: string;
}

export interface WorkflowReportQuery {

  serviceDate?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
  ingredientId?: string;
  supplierId?: string;
  shiftName?: string;
  limit?: number;
}

interface WorkflowDocumentDto {
  documentId: string;
  documentCode: string;
  documentType: string;
  documentDate: string;
  shiftName?: string;
  status: string;
  ownerLane: string;
  route: string;
  summary: string;
}

interface IngredientDemandReportDto {
  materialRequestId: string;
  materialRequestCode: string;
  requestDate: string;
  status: string;
  shiftName?: string;
  customerName?: string;
  dishName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  totalServings: number;
  totalRequiredQty: number;
  currentStockQty: number;
  suggestedPurchaseQty: number;
}

interface PurchaseDemandReportDto {
  purchaseRequestLineId: string;
  purchaseRequestId: string;
  purchaseRequestCode: string;
  purchaseForDate: string;
  shiftName?: string;
  status: string;
  ingredientId: string;
  ingredientName?: string;
  supplierId: string;
  supplierName?: string;
  unitId: string;
  unitName?: string;
  requiredQty: number;
  currentStockQty: number;
  purchaseQty: number;
  estimatedUnitPrice: number;
  estimatedAmount: number;
}


interface StockMovementViewDto {
  movementId: string;
  movementDate: string;
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  movementType: string;
  quantityIn: number;
  quantityOut: number;
  refTable?: string;
  refId?: string;
  reason?: string;
  note?: string;
}

interface ReceiptPriceVarianceReportDto {
  receiptId: string;
  receiptCode: string;
  receiptDate: string;
  supplierId: string;
  supplierName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  quantity: number;
  unitPrice: number;
  referencePrice: number;
  variancePercent: number;
  isWarning: boolean;
}

interface CurrentStockSummaryDto {
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  currentQty: number;
  lastUpdated: string;
}

interface KitchenIssueReportDto {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  warehouseName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  requestedQty: number;
  issuedQty: number;
}

export interface WarehouseDto {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType?: string;
  note?: string;
}

export interface PagedResponseDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface CreateInventoryReceiptLineDto {
  ingredientId: string;
  quantity: number;
  unitId: string;
  unitPrice: number;
  lotNumber?: string;
  manufactureDate?: string;
  expiredDate?: string;
}

export interface CreateInventoryReceiptDto {
  receiptDate: string;
  supplierId: string;
  warehouseId: string;
  purchaseRequestId?: string;
  lines: CreateInventoryReceiptLineDto[];
}

export interface InventoryReceiptCreatedDto {
  receiptId: string;
  receiptCode: string;
}

export interface CreateInventoryIssueLineDto {
  ingredientId: string;
  requestedQty: number;
  issuedQty: number;
  unitId: string;
}

export interface CreateInventoryIssueDto {
  issueDate: string;
  shiftName?: string;
  warehouseId: string;
  materialRequestId: string;
  receivedBy?: string;
  lines: CreateInventoryIssueLineDto[];
}

export interface InventoryIssueCreatedDto {
  issueId: string;
  issueCode: string;
}

export interface CreateInventoryReturnLineDto {
  ingredientId: string;
  quantity: number;
  unitId: string;
}

export interface CreateInventoryReturnDto {
  returnDate: string;
  shiftName?: string;
  warehouseId: string;
  issueId: string;
  reason?: string;
  lines: CreateInventoryReturnLineDto[];
}

export interface InventoryReturnCreatedDto {
  returnId: string;
  returnCode: string;
}


interface IssueVsReturnUsageReportDto {
  issueId: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  issuedQty: number;
  returnedQty: number;
  usedQty: number;
}

interface AuditChangeReportDto {
  auditId: string;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
  businessArea: string;
  entityName: string;
  entityId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}

interface DataQualityIssueDto {
  issueId: string;
  category: string;
  severity: 'error' | 'warning' | string;
  entityName: string;
  entityId?: string;
  entityCode: string;
  entityLabel: string;
  message: string;
  suggestedAction: string;
  route: string;
}

interface DataQualityReportDto {
  generatedAt: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  missingBomCount: number;
  invalidUnitCount: number;
  negativeStockCount: number;
  orphanDocumentCount: number;
  issues: DataQualityIssueDto[];
}

interface MissingBomDishDto {
  dishId: string;
  dishCode: string;
  dishName: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  menuId: string;
  menuName: string;
  shiftName: string;
  totalServings: number;
  message: string;
}

interface MaterialDemandResultDto {
  materialRequestId: string;
  requestCode: string;
  serviceDate: string;
  scope: string;
  status: string;
  productionPlanLineCount: number;
  lines: Array<{
    materialRequestLineId: string;
    ingredientId: string;
    ingredientName: string;
    unitId: string;
    unitName: string;
    dishId: string;
    dishName: string;
    shiftName: string;
    totalServings: number;
    grossQtyPerServing: number;
    bomRatePercent: number;
    totalRequiredQty: number;
    currentStockQty: number;
    suggestedPurchaseQty: number;
  }>;
  missingBomDishes: MissingBomDishDto[];
}

export interface GenerateMaterialDemandRequest {
  serviceDate: string;
  shiftName?: string;
  scope?: 'FULLDAY' | 'MORNING' | 'AFTERNOON';
}

interface PurchaseRequestWorkflowResultDto {
  purchaseRequestId: string;
  purchaseRequestCode: string;
  materialRequestId: string;
  purchaseForDate: string;
  shiftName?: string;
  status: string;
  lines: Array<{
    purchaseRequestLineId: string;
    materialRequestLineId: string;
    ingredientId: string;
    ingredientName: string;
    supplierId: string;
    supplierName: string;
    unitId: string;
    unitName: string;
    requiredQty: number;
    currentStockQty: number;
    purchaseQty: number;
    estimatedUnitPrice: number;
  }>;
}

export interface GeneratePurchaseRequestFromDemandRequest {
  materialRequestId: string;
}

export interface PriceVarianceRow {
  id: string;
  name: string;
  unit: string;
  pricePrev: number;
  priceCurrent: number;
  supplier: string;
  change: number;
  warning: boolean;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  fieldAffected: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface CurrentStockRow {
  id: string;
  warehouse: string;
  ingredient: string;
  unit: string;
  currentQty: number;
  lastUpdated: string;
  ingredientId?: string;
  unitId?: string;
}

export interface KitchenIssueRow {
  id: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  warehouse: string;
  ingredient: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
}

export interface UsageReportRow {
  id: string;
  issueCode: string;
  issueDate: string;
  shiftName?: string;
  ingredient: string;
  unit: string;
  issuedQty: number;
  returnedQty: number;
  usedQty: number;
}

export interface DataQualityIssueRow {
  id: string;
  category: string;
  severity: 'error' | 'warning';
  entityName: string;
  entityId?: string;
  entityCode: string;
  entityLabel: string;
  message: string;
  suggestedAction: string;
  route: string;
}

export interface DataQualityReport {
  generatedAt: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  missingBomCount: number;
  invalidUnitCount: number;
  negativeStockCount: number;
  orphanDocumentCount: number;
  issues: DataQualityIssueRow[];
}

const getData = <T>(response: ApiResponse<T[]>): T[] => response.data ?? [];

const queryWithLimit = (query?: WorkflowReportQuery) => ({
  limit: 100,
  ...query,
});

const normalizeDocumentType = (type: string): WorkflowDocumentType => {
  if (type.includes('mua')) return 'Danh sách mua thêm';
  if (type.includes('Đề nghị')) return 'Đơn mua';
  if (type.includes('nhập')) return 'Phiếu nhập';
  if (type.includes('xuất')) return 'Phiếu xuất';
  if (type.includes('hoàn')) return 'Phiếu trả';
  if (type.includes('Điều chỉnh')) return 'Điều chỉnh';
  if (type.includes('Yêu cầu')) return 'KHSX';
  return 'KHSX';
};

const mapDocument = (item: WorkflowDocumentDto): WorkflowDocument => {
  const laneId = ownerToLaneId(item.ownerLane);
  const type = normalizeDocumentType(item.documentType);
  const tone = toneFromStatus(item.status);

  return {
    id: item.documentCode || item.documentId,
    documentId: item.documentId,
    type,
    title: item.documentType,
    status: item.status,
    owner: item.ownerLane,
    summary: item.summary,
    route: item.route || routeByLaneId[laneId],
    tone,
    lines: [
      { label: 'Ngày', value: new Date(item.documentDate).toLocaleDateString('vi-VN') },
      ...(item.shiftName ? [{ label: 'Ca', value: item.shiftName }] : []),
    ],
  };
};

const mapDemandLine = (item: IngredientDemandReportDto): DemandLine => {
  const shortage = Math.max(item.suggestedPurchaseQty, 0);
  const tone: WorkflowTone = shortage > 0 ? 'danger' : 'success';

  return {
    id: `${item.materialRequestId}-${item.ingredientId}`,
    materialRequestId: item.materialRequestId,
    sourceDocumentCode: item.materialRequestCode,
    material: item.ingredientName ?? item.ingredientId,
    required: item.totalRequiredQty,
    available: item.currentStockQty,
    reserved: 0,
    unit: item.unitName ?? '',
    source: item.dishName || item.customerName || item.materialRequestCode,
    status: shortage > 0 ? 'Thiếu nguyên liệu' : 'Tồn kho đủ',
    nextAction: shortage > 0 ? 'Đề xuất mua thêm' : 'Tạo phiếu xuất kho',
    tone,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
  };
};

const mapPurchaseDemandLine = (item: PurchaseDemandReportDto): DemandLine => {
  const tone = item.purchaseQty > 0 ? toneFromStatus(item.status) : 'success';

  return {
    id: `${item.purchaseRequestId}-${item.ingredientId}`,
    sourceDocumentCode: item.purchaseRequestCode,
    material: item.ingredientName ?? item.ingredientId,
    required: item.requiredQty,
    available: item.currentStockQty,
    reserved: Math.max(item.purchaseQty, 0),
    unit: item.unitName ?? '',
    source: item.supplierName || item.purchaseRequestCode,
    status: item.status,
    nextAction: item.purchaseQty > 0 ? 'Chọn nhà cung cấp / đặt mua' : 'Không cần mua thêm',
    tone,
    purchaseRequestId: item.purchaseRequestId,
    purchaseRequestLineId: item.purchaseRequestLineId,
    supplierId: item.supplierId,
    estimatedUnitPrice: item.estimatedUnitPrice,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
  };
};


const mapApprovalRecord = (item: PurchaseDemandReportDto): ApprovalRecord => {
  const type: ApprovalType = item.purchaseQty > 0 ? 'purchase' : 'issue';
  const tone = toneFromStatus(item.status);

  return {
    id: item.purchaseRequestCode || item.purchaseRequestId,
    type,
    title: item.purchaseQty > 0 ? 'Duyệt danh sách mua thêm' : 'Duyệt nhu cầu xuất kho',
    source: item.purchaseRequestCode,
    owner: 'Quản lí vận hành',
    submittedBy: 'KHSX',
    deadline: item.shiftName ?? 'Trong ca',
    status: item.status,
    reason: item.purchaseQty > 0 ? 'Có thiếu hụt sau kiểm tồn kho.' : 'Tồn kho đã đủ để xuất.',
    nextAction: item.purchaseQty > 0 ? 'Duyệt danh sách mua thêm' : 'Duyệt nhu cầu xuất',
    tone,
    materials: [
      {
        name: item.ingredientName ?? item.ingredientId,
        quantity: item.purchaseQty || item.requiredQty,
        unit: item.unitName ?? '',
      },
    ],
  };
};

const mapStockMovement = (item: StockMovementViewDto): StockMovement => {
  const movementType = item.movementType.toUpperCase();
  const type: StockMovementType =
    movementType === 'RECEIPT'
      ? 'receipt'
      : movementType === 'ISSUE'
        ? 'issue'
        : movementType === 'RETURN'
          ? 'return'
          : 'adjustment';
  const quantity = type === 'issue' ? item.quantityOut : item.quantityIn;
  const tone = type === 'adjustment' || type === 'return' ? 'success' : 'warning';

  return {
    id: item.movementId,
    type,
    documentNo: item.refTable ? `${item.refTable}${item.refId ? `-${item.refId.slice(0, 8)}` : ''}` : item.movementId.slice(0, 8),
    material: item.ingredientName ?? item.ingredientId,
    quantity,
    unit: item.unitName ?? '',
    owner: item.warehouseName ?? 'Kho',
    status: type === 'receipt' ? 'Đã nhập kho' : type === 'issue' ? 'Đã xuất kho' : type === 'return' ? 'Đã hoàn kho' : 'Đã điều chỉnh tồn',
    nextAction: type === 'issue' ? 'Bếp xác nhận nhận nguyên liệu' : 'Cập nhật tồn kho',
    tone,
  };
};

const mapPriceVariance = (item: ReceiptPriceVarianceReportDto): PriceVarianceRow => ({
  id: `${item.receiptId}-${item.ingredientId}`,
  name: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  pricePrev: item.referencePrice,
  priceCurrent: item.unitPrice,
  supplier: item.supplierName ?? item.supplierId,
  change: item.variancePercent,
  warning: item.isWarning,
});

const mapCurrentStock = (item: CurrentStockSummaryDto): CurrentStockRow => ({
  id: `${item.warehouseId}-${item.ingredientId}`,
  warehouse: item.warehouseName ?? item.warehouseId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  currentQty: item.currentQty,
  lastUpdated: item.lastUpdated,
  ingredientId: item.ingredientId,
  unitId: item.unitId,
});

const mapKitchenIssue = (item: KitchenIssueReportDto): KitchenIssueRow => ({
  id: `${item.issueId}-${item.ingredientId}`,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName,
  warehouse: item.warehouseName ?? item.warehouseId,
  ingredient: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  requestedQty: item.requestedQty,
  issuedQty: item.issuedQty,
});

const mapUsageReport = (item: IssueVsReturnUsageReportDto): UsageReportRow => ({
  id: `${item.issueId}-${item.ingredientId}`,
  issueCode: item.issueCode,
  issueDate: item.issueDate,
  shiftName: item.shiftName,
  ingredient: item.ingredientName ?? item.ingredientId,
  unit: item.unitName ?? '',
  issuedQty: item.issuedQty,
  returnedQty: item.returnedQty,
  usedQty: item.usedQty,
});

const mapAuditChange = (item: AuditChangeReportDto): AuditLogRow => ({
  id: item.auditId,
  timestamp: item.changedAt,
  actor: item.changedByName || item.changedBy,
  fieldAffected: [item.entityName, item.fieldName].filter(Boolean).join(' / '),
  oldValue: item.oldValue ?? '',
  newValue: item.newValue ?? '',
  reason: item.reason ?? item.businessArea,
});

const mapDataQualityReport = (item: DataQualityReportDto): DataQualityReport => ({
  generatedAt: item.generatedAt,
  totalIssues: item.totalIssues,
  errorCount: item.errorCount,
  warningCount: item.warningCount,
  missingBomCount: item.missingBomCount,
  invalidUnitCount: item.invalidUnitCount,
  negativeStockCount: item.negativeStockCount,
  orphanDocumentCount: item.orphanDocumentCount,
  issues: (item.issues ?? []).map((issue) => ({
    id: issue.issueId,
    category: issue.category,
    severity: issue.severity === 'error' ? 'error' : 'warning',
    entityName: issue.entityName,
    entityId: issue.entityId,
    entityCode: issue.entityCode,
    entityLabel: issue.entityLabel,
    message: issue.message,
    suggestedAction: issue.suggestedAction,
    route: issue.route,
  })),
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

export const workflowApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWorkflowDocuments: builder.query<WorkflowDocument[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/workflow-documents',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<WorkflowDocumentDto[]>) => getData(response).map(mapDocument),
      providesTags: ['WorkflowReports'],
    }),
    getIngredientDemand: builder.query<DemandLine[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/ingredient-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IngredientDemandReportDto[]>) => getData(response).map(mapDemandLine),
      providesTags: ['WorkflowReports'],
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
      invalidatesTags: ['WorkflowReports'],
    }),
    generatePurchaseRequestFromDemand: builder.mutation<ApiResponse<PurchaseRequestWorkflowResultDto>, GeneratePurchaseRequestFromDemandRequest>({
      query: (body) => ({
        url: '/purchase-workflow/from-demand',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    getPurchaseDemand: builder.query<DemandLine[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PurchaseDemandReportDto[]>) => getData(response).map(mapPurchaseDemandLine),
      providesTags: ['WorkflowReports'],
    }),
    getApprovalRecords: builder.query<ApprovalRecord[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/purchase-demand',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<PurchaseDemandReportDto[]>) => getData(response).map(mapApprovalRecord),
      providesTags: ['WorkflowReports'],
    }),
    getStockMovements: builder.query<StockMovement[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/stock-movements',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<StockMovementViewDto[]>) => getData(response).map(mapStockMovement),
      providesTags: ['WorkflowReports'],
    }),
    getPriceVariance: builder.query<PriceVarianceRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/receipt-price-variance',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<ReceiptPriceVarianceReportDto[]>) => getData(response).map(mapPriceVariance),
      providesTags: ['WorkflowReports'],
    }),
    getCurrentStock: builder.query<CurrentStockRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/current-stock',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<CurrentStockSummaryDto[]>) => getData(response).map(mapCurrentStock),
      providesTags: ['WorkflowReports'],
    }),
    getKitchenIssues: builder.query<KitchenIssueRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/kitchen-issues',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<KitchenIssueReportDto[]>) => getData(response).map(mapKitchenIssue),
      providesTags: ['WorkflowReports'],
    }),
    getIssueVsReturnUsage: builder.query<UsageReportRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/issue-vs-return',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<IssueVsReturnUsageReportDto[]>) => getData(response).map(mapUsageReport),
      providesTags: ['WorkflowReports'],
    }),
    getAuditChanges: builder.query<AuditLogRow[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/audit-changes',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<AuditChangeReportDto[]>) => getData(response).map(mapAuditChange),
      providesTags: ['WorkflowReports'],
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
          errorCount: 0,
          warningCount: 0,
          missingBomCount: 0,
          invalidUnitCount: 0,
          negativeStockCount: 0,
          orphanDocumentCount: 0,
          issues: [],
        },
      providesTags: ['WorkflowReports'],
    }),
    getSuppliers: builder.query<SupplierDto[], void>({
      query: () => '/suppliers',
    }),
    updateLineSupplier: builder.mutation<ApiResponse<void>, { requestId: string; lineId: string; body: { supplierId: string; estimatedUnitPrice: number } }>({
      query: ({ requestId, lineId, body }) => ({
        url: `/purchase-workflow/requests/${requestId}/lines/${lineId}/supplier`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    submitPurchaseRequest: builder.mutation<ApiResponse<void>, string>({
      query: (requestId) => ({
        url: `/purchase-workflow/requests/${requestId}/submit`,
        method: 'POST',
      }),
      invalidatesTags: ['WorkflowReports'],
    }),
    getWarehouses: builder.query<ApiResponse<PagedResponseDto<WarehouseDto>>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: '/Warehouses',
        params: params || { page: 1, limit: 100 }
      })
    }),
    createInventoryReceipt: builder.mutation<ApiResponse<InventoryReceiptCreatedDto>, CreateInventoryReceiptDto>({
      query: (body) => ({
        url: '/inventory-receipts',
        method: 'POST',
        body
      }),
      invalidatesTags: ['WorkflowReports']
    }),
    createInventoryIssue: builder.mutation<ApiResponse<InventoryIssueCreatedDto>, CreateInventoryIssueDto>({
      query: (body) => ({
        url: '/inventory-issues',
        method: 'POST',
        body
      }),
      invalidatesTags: ['WorkflowReports']
    }),
    createInventoryReturn: builder.mutation<ApiResponse<InventoryReturnCreatedDto>, CreateInventoryReturnDto>({
      query: (body) => ({
        url: '/inventory-returns',
        method: 'POST',
        body
      }),
      invalidatesTags: ['WorkflowReports']
    }),
  }),
  overrideExisting: false,
});


export const {
  useGetWorkflowDocumentsQuery,
  useGetIngredientDemandQuery,
  useGenerateMaterialDemandMutation,
  useGeneratePurchaseRequestFromDemandMutation,
  useGetPurchaseDemandQuery,
  useGetApprovalRecordsQuery,
  useGetStockMovementsQuery,
  useGetPriceVarianceQuery,
  useGetCurrentStockQuery,
  useGetKitchenIssuesQuery,
  useGetIssueVsReturnUsageQuery,
  useGetAuditChangesQuery,
  useGetDataQualityQuery,
  useGetSuppliersQuery,
  useUpdateLineSupplierMutation,
  useSubmitPurchaseRequestMutation,
  useGetWarehousesQuery,
  useCreateInventoryReceiptMutation,
  useCreateInventoryIssueMutation,
  useCreateInventoryReturnMutation,
} = workflowApi;


export function useWorkflowOverview() {
  const documentsResult = useGetWorkflowDocumentsQuery({ limit: 100 });
  const demandResult = useGetIngredientDemandQuery({ limit: 100 });
  const priceResult = useGetPriceVarianceQuery({ limit: 100 });
  const movementsResult = useGetStockMovementsQuery({ limit: 100 });

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
