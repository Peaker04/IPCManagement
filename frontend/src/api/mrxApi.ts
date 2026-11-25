import { apiClient } from './client';
import { getMrxCacheRevision, invalidateMrxCaches, notifyMrxWriteAcknowledged } from './mrxCacheInvalidation';
import { serverStateCache } from '../store/serverStateCache';
import { isServiceDate, weekStartFor } from '../utils/dates';
import type { components } from '../shared/api/contracts/schema';

type Schema = components['schemas'];

export type MrxBatch = Schema['ReconciliationBatchDto'];
export interface MrxBatchSummary {
  batchId: string;
  status: string;
  version: number;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
  customerId: string;
  customerCode?: string;
  customerName?: string;
  weekStartDate: string;
  weekEndDate: string;
}
export interface MrxBatchPage {
  items: MrxBatchSummary[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}
export interface MrxBatchPageQuery {
  customerId?: string;
  customerCode?: string;
  batchId?: string;
  weekStartDate?: string;
  weekFrom?: string;
  weekTo?: string;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}
export type MrxDraftSource = Schema['ReconciliationDraftSourceDto'];
export type MrxQuantityPreview = Schema['QuantityImportPreviewDto'];
export type MrxMaterialInspectionPage = Schema['QuantityMaterialInspectionDtoQuantityInspectionPageDto'];
export type MrxPlanInspectionPage = Schema['QuantityPlanInspectionDtoQuantityInspectionPageDto'];
export type MrxMaterialInspection = Schema['QuantityMaterialInspectionDto'];
export type MrxPlanInspection = Schema['QuantityPlanInspectionDto'];
export interface MrxInspectionQuery { pageNumber: number; pageSize: number; searchKeyword: string }

function inspectionPath(view: 'materials' | 'plans', menuVersionId: string, query: MrxInspectionQuery) {
  const params = new URLSearchParams({ menuVersionId, PageNumber: String(query.pageNumber), PageSize: String(query.pageSize) });
  if (query.searchKeyword.trim()) params.set('SearchKeyword', query.searchKeyword.trim());
  return `/reconciliation/batches/quantity-import/${view}?${params}`;
}
export type MrxQuantityCommit = Schema['QuantityImportCommitDto'];
export type MrxWarehouseTransfer = Schema['ReconciliationWarehouseTransferDto'];
export type MrxWarehouseDaily = Schema['ReconciliationWarehouseDailyDto'];
export type MrxDispositionCategory = Schema['ReconciliationDispositionCategoryDto'];
export type MrxKitchenCooking = Schema['ReconciliationKitchenCookingExportDto'];
export type MrxInventoryIssueDetail = Schema['InventoryIssueDto'];
export type MrxBatchLine = Schema['ReconciliationLineDto'];
export type MrxDailyReview = Schema['ReconciliationDailyReviewDto'];
export type MrxDisposition = Schema['ReconciliationDispositionDto'];

export interface ReconciliationLineItem {
  id: string;
  dailyLineId?: string;
  serviceDate?: string;
  ingredientId: string;
  materialCode: string;
  materialName: string;
  unitId: string;
  unit: string;
  requiredQuantity: number;
  issuedQuantity?: number;
  issuedRequiredDifference?: number;
  status: string;
  version: number;
  triggers: string[];
  disposition?: MrxDisposition;
  notes: string[];
}

export interface ReconciliationBatchSummary {
  batchId: string;
  customerId?: string;
  customerCode: string;
  customerName: string;
  weekStartDate?: string;
  weekEndDate?: string;
  status: string;
  version: number;
  weeklyStatus?: string;
  canComplete?: boolean;
  completionBlocker?: string;
  lines: ReconciliationLineItem[];
}

export function mapBatchDtoToSummary(batch: MrxBatch, serviceDate?: string): ReconciliationBatchSummary {
  const sourceLines = batch.dailyReview?.lines || batch.lines || [];
  const hasDailyDate = sourceLines.some((line) => Boolean(line.serviceDate));
  let lines = serviceDate && hasDailyDate
    ? sourceLines.filter((line) => line.serviceDate === serviceDate)
    : sourceLines;
  if (serviceDate && hasDailyDate && lines.length === 0 && sourceLines.length > 0
      && (!isServiceDate(serviceDate) || (batch.weekStartDate && weekStartFor(serviceDate) !== batch.weekStartDate))) {
    const fallbackDate = batch.weekStartDate || sourceLines[0]?.serviceDate;
    if (fallbackDate) lines = sourceLines.filter((line) => line.serviceDate === fallbackDate);
  }

  return {
    batchId: batch.batchId,
    customerId: batch.customerId || undefined,
    customerCode: batch.customerCode || '—',
    customerName: batch.customerName || '—',
    weekStartDate: batch.weekStartDate || undefined,
    weekEndDate: batch.weekEndDate || undefined,
    status: batch.status,
    version: batch.version,
    weeklyStatus: batch.dailyReview?.weeklyStatus,
    canComplete: batch.canComplete ?? undefined,
    completionBlocker: batch.completionBlocker ?? undefined,
    lines: lines.map((line) => ({
      id: line.batchLineId,
      dailyLineId: line.dailyLineId || undefined,
      serviceDate: line.serviceDate || undefined,
      ingredientId: line.ingredientId,
      materialCode: line.ingredientCode || line.ingredientId,
      materialName: line.ingredientName || '—',
      unitId: line.canonicalUnitId,
      unit: line.canonicalUnitName || '—',
      requiredQuantity: line.requiredQuantity,
      issuedQuantity: line.issuedQuantity != null ? line.issuedQuantity : undefined,
      issuedRequiredDifference: line.issuedRequiredDifference != null ? line.issuedRequiredDifference : undefined,
      status: line.status,
      version: line.version,
      triggers: Array.from(line.triggers || []),
      disposition: line.disposition || undefined,
      notes: Array.from(line.issueNotes || []),
    })),
  };
}
export type MrxWeeklySource = Pick<Schema['WeeklyMenuImportResultDto'],
  'customerId' | 'customerCode' | 'customerName' | 'weekStartDate' | 'weekEndDate' |
  'menuVersionId' | 'menuVersionNo' | 'menuVersionStatus' | 'warnings' | 'validation'>;
export type MrxIssue = Schema['InventoryIssueDto'];
export type MrxIssuePage = Schema['InventoryIssueDtoPagedResponseDto'];
export type MrxIssueCreated = Schema['InventoryIssueCreatedDto'];
export type MrxSourceDelta = Schema['ReconciliationSourceDeltaQueueItemDto'];
export type MrxSourceDeltaPage = Schema['ReconciliationSourceDeltaQueueItemDtoPagedResponseDto'];
export type MrxSourceHistoryEvent = Schema['ReconciliationSourceHistoryEventDto'];
export type MrxSourceHistoryMaterial = Schema['ReconciliationSourceHistoryMaterialDto'];
export type MrxSourceHistoryDetail = Schema['ReconciliationSourceHistoryDetailDto'];
export type MrxSourceHistoryPage = Schema['ReconciliationSourceHistoryEventDtoPagedResponseDto'];
export type CreateMrxReturnRequest = Schema['CreateInventoryReturnRequest'];
export type MrxReturnCreated = Schema['InventoryReturnCreatedDto'];
export type ConfirmMrxReturnRequest = Schema['ConfirmInventoryReturnReceiptRequest'];
export type MrxPreparation = Schema['ReconciliationPreparationDto'];
export type CreateCoordinatedPreparationIssueRequest = Schema['CoordinatedPreparationIssueRequest'];
export type CoordinatedPreparationIssueResult = Schema['CoordinatedPreparationIssueResultDto'];
export type MrxPreparationWorkbook = Schema['ReconciliationPreparationWorkbookDto'];
export type MrxOperationalSummary = Schema['MrxOperationalSummaryDto'];
export type MrxTransactionHistoryReport = Schema['MrxTransactionHistoryRowDtoPagedResponseDto'];
export type MrxVarianceRegisterReport = Schema['MrxVarianceRegisterReportDto'];
export type MrxCompletedRegisterReport = Schema['MrxCompletedRegisterReportDto'];
export type MrxAuditTrailReport = Schema['MrxAuditTrailReportDto'];
export interface MrxPreparationWorkbookQuery {
  serviceDate?: string;
  weekStartDate?: string;
  customerIds?: string[];
  batchIds?: string[];
  supplierName?: string;
  isSupplemental?: boolean;
  includeMenus?: boolean;
  layout?: 'supplier-demand';
}

export type MrxEditScope = Schema['MrxEditScopeDto'];
export type MrxMenuChangeLine = Schema['CreateMenuAmendmentLineRequest'];
export type MrxMenuChangeRequest = Schema['CreateMenuAmendmentRequest'];
export type MrxMenuChangeImpactLine = Schema['MenuAmendmentImpactLineDto'];
export type MrxMenuChangeResult = Schema['MenuAmendmentResultDto'];

export interface MrxMenuChangeInboxItem {
  menuAmendmentId: string;
  customerId: string;
  customerName: string;
  weekStartDate: string;
  status: string;
  reason: string;
  createdAt: string;
  affectedReconciliationBatchIds: string[];
  impactLines: readonly MrxMenuChangeImpactLine[];
}

export type PreviewQuantityImportRequest = Schema['PreviewQuantityImportRequest'];
export type CommitQuantityImportRequest = Schema['CommitQuantityImportRequest'];
export type CreateReconciliationDraftRequest = Schema['CreateReconciliationDraftRequest'];
export type CreateMrxIssueRequest = Schema['CreateInventoryIssueRequest'];
export type MrxSupplementalDemand = Schema['ReconciliationSupplementalDemandDto'];
export type MrxSupplementalDemandWrite = Schema['ReconciliationSupplementalDemandWriteRequest'];
export type MrxSupplementalDemandCommand = Schema['ReconciliationSupplementalDemandCommand'];
export type MrxSupplementalDemandPage = Schema['ReconciliationSupplementalDemandSummaryDtoPagedResponseDto'];
export type MrxSupplementalFulfillment = Schema['ReconciliationSupplementalFulfillmentDto'];
export type MrxSupplementalDishOptions = Schema['ReconciliationSupplementalDishOptionsDto'];
export interface MrxSupplementalDemandPageQuery {
  batchId?: string;
  serviceDate?: string;
  status?: string;
  searchKeyword?: string;
  pageNumber?: number;
  pageSize?: number;
}
export type SetMrxDispositionRequest = Schema['SetReconciliationDispositionRequest'];

function batchPath(batchId: string, suffix = ''): string {
  return `/reconciliation/batches/${encodeURIComponent(batchId)}${suffix}`;
}

async function withMrxInvalidation<T>(operation: Promise<T>, refreshReads = false): Promise<T> {
  const result = await operation;
  if (refreshReads) notifyMrxWriteAcknowledged();
  else invalidateMrxCaches();
  return result;
}

export type MrxBatchDishSummary = Schema['ReconciliationBatchDishSummaryDto'];
export type MrxSourceChangeItem = Schema['ReconciliationSourceChangeDto'];
export interface MrxSourceChangePage {
  items: MrxSourceChangeItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export const mrxApi = {
  getSupplementalDishOptions: (batchId: string, serviceDate: string) =>
    apiClient<MrxSupplementalDishOptions>(`/reconciliation/supplemental-demands/batches/${encodeURIComponent(batchId)}/dish-options?${new URLSearchParams({ serviceDate })}`),
  getSupplementalDemandPage: (filters: MrxSupplementalDemandPageQuery = {}) => {
    const query = new URLSearchParams({ PageNumber: String(filters.pageNumber ?? 1), PageSize: String(filters.pageSize ?? 20) });
    if (filters.batchId) query.set('BatchId', filters.batchId);
    if (filters.serviceDate) query.set('ServiceDate', filters.serviceDate);
    if (filters.status) query.set('Status', filters.status);
    if (filters.searchKeyword) query.set('SearchKeyword', filters.searchKeyword);
    return apiClient<MrxSupplementalDemandPage>(`/reconciliation/supplemental-demands?${query}`);
  },
  getSupplementalDemand: (id: string) =>
    apiClient<MrxSupplementalDemand>(`/reconciliation/supplemental-demands/${encodeURIComponent(id)}`),
  getSupplementalFulfillment: (batchId: string, serviceDate: string) =>
    apiClient<MrxSupplementalFulfillment>(`/reconciliation/supplemental-demands/batches/${encodeURIComponent(batchId)}/fulfillment?${new URLSearchParams({ serviceDate })}`),
  createSupplementalDemand: (request: MrxSupplementalDemandWrite) =>
    withMrxInvalidation(apiClient<MrxSupplementalDemand>('/reconciliation/supplemental-demands', { method: 'POST', body: JSON.stringify(request) })),
  updateSupplementalDemand: (id: string, request: MrxSupplementalDemandWrite) =>
    withMrxInvalidation(apiClient<MrxSupplementalDemand>(`/reconciliation/supplemental-demands/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(request) })),
  submitSupplementalDemand: (id: string, request: MrxSupplementalDemandCommand) =>
    withMrxInvalidation(apiClient<MrxSupplementalDemand>(`/reconciliation/supplemental-demands/${encodeURIComponent(id)}/submit`, { method: 'POST', body: JSON.stringify(request) }), true),
  cancelSupplementalDemand: (id: string, request: MrxSupplementalDemandCommand) =>
    withMrxInvalidation(apiClient<MrxSupplementalDemand>(`/reconciliation/supplemental-demands/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify(request) }), true),
  getMaterialInspection: (menuVersionId: string, query: MrxInspectionQuery, signal?: AbortSignal) =>
    apiClient<MrxMaterialInspectionPage>(inspectionPath('materials', menuVersionId, query), { signal }),
  getPlanInspection: (menuVersionId: string, query: MrxInspectionQuery, signal?: AbortSignal) =>
    apiClient<MrxPlanInspectionPage>(inspectionPath('plans', menuVersionId, query), { signal }),
  getBatchPage: (filters: MrxBatchPageQuery = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (filters.customerId) query.set('CustomerId', filters.customerId);
    if (filters.customerCode) query.set('CustomerCode', filters.customerCode);
    if (filters.batchId) query.set('BatchId', filters.batchId);
    if (filters.weekStartDate) query.set('WeekStartDate', filters.weekStartDate);
    if (filters.weekFrom) query.set('WeekFrom', filters.weekFrom);
    if (filters.weekTo) query.set('WeekTo', filters.weekTo);
    if (filters.status) query.set('Status', filters.status);
    query.set('PageNumber', String(filters.pageNumber ?? 1));
    query.set('PageSize', String(filters.pageSize ?? 20));
    return apiClient<MrxBatchPage>(`/reconciliation/batches?${query}`, { signal });
  },

  previewSourceChange: (request: MrxMenuChangeRequest) =>
    apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  submitSourceChange: (request: MrxMenuChangeRequest) =>
    withMrxInvalidation(apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/mrx-submit', {
      method: 'POST',
      body: JSON.stringify(request),
    })),

  applySourceChange: (request: MrxMenuChangeRequest) =>
    withMrxInvalidation(apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/mrx-apply', {
      method: 'POST',
      body: JSON.stringify(request),
    })),

  getSourceChangeInbox: () =>
    apiClient<MrxMenuChangeInboxItem[]>('/coordination/weekly-menu/amendments/mrx-inbox'),

  decideSourceChange: (amendmentId: string, approved: boolean, reason?: string) =>
    withMrxInvalidation(apiClient<MrxMenuChangeResult>(`/coordination/weekly-menu/amendments/${encodeURIComponent(amendmentId)}/mrx-decision`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    })),

  getDraftSources: () => apiClient<MrxDraftSource[]>('/reconciliation/batches/draft-sources'),

  getWeeklySource: (customerId: string, weekStartDate: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ customerId, weekStartDate });
    return apiClient<MrxWeeklySource | null>(`/reconciliation/weekly-menu?${query}`, { signal });
  },

  getEditScope: (customerId: string, weekStartDate: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ customerId, weekStartDate });
    return apiClient<MrxEditScope>(`/reconciliation/weekly-menu/edit-scope?${query}`, { signal });
  },

  previewQuantityImport: (request: PreviewQuantityImportRequest, signal?: AbortSignal) =>
    apiClient<MrxQuantityPreview>('/reconciliation/batches/quantity-import/preview', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    }),

  commitQuantityImport: (request: CommitQuantityImportRequest) =>
    withMrxInvalidation(apiClient<MrxQuantityCommit>('/reconciliation/batches/quantity-import/commit', {
      method: 'POST',
      body: JSON.stringify(request),
    })),

  createBatch: (request: CreateReconciliationDraftRequest) =>
    withMrxInvalidation(apiClient<MrxBatch>('/reconciliation/batches', {
      method: 'POST',
      body: JSON.stringify(request),
    })),

  getBatch: async (batchId: string, signal?: AbortSignal) => {
    const revision = getMrxCacheRevision();
    const batch = await apiClient<MrxBatch>(batchPath(batchId), { signal });
    signal?.throwIfAborted();
    if (revision === getMrxCacheRevision()) serverStateCache.set(`mrx_raw_batch_${batchId}`, batch);
    return batch;
  },

  getBatchSummary: async (batchId: string, serviceDate?: string, forceRefresh = false): Promise<ReconciliationBatchSummary> => {
    const cacheKey = `mrx_raw_batch_${batchId}`;
    const cached = !forceRefresh ? serverStateCache.get<MrxBatch>(cacheKey) : null;
    let batch = cached && !cached.isStale ? cached.data : null;
    if (!batch) batch = await mrxApi.getBatch(batchId);
    return mapBatchDtoToSummary(batch, serviceDate);
  },

  markReady: (batchId: string, expectedVersion: number) =>
    withMrxInvalidation(apiClient<MrxBatch>(batchPath(batchId, '/ready'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    })),

  transferToWarehouse: (batchId: string, expectedVersion: number) =>
    withMrxInvalidation(apiClient<MrxWarehouseTransfer>(batchPath(batchId, '/transfer-to-warehouse'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    })),

  getWarehouseDaily: (batchId: string, signal?: AbortSignal) =>
    apiClient<MrxWarehouseDaily>(batchPath(batchId, '/warehouse-daily'), { signal }),

  getIssues: (batchId: string, pageNumber = 1, pageSize = 25, signal?: AbortSignal) => {
    const query = new URLSearchParams({
      SourceFamily: 'MATERIAL_RECONCILIATION',
      ReconciliationBatchId: batchId,
      PageNumber: String(pageNumber),
      PageSize: String(pageSize),
    });
    return apiClient<MrxIssuePage>(`/inventory-issues?${query}`, { signal });
  },

  getIssueById: (issueId: string, sourceFamily = 'MATERIAL_RECONCILIATION') =>
    apiClient<MrxInventoryIssueDetail>(`/inventory-issues/${encodeURIComponent(issueId)}?sourceFamily=${encodeURIComponent(sourceFamily)}`),

  createIssue: (request: CreateMrxIssueRequest) =>
    withMrxInvalidation(apiClient<MrxIssueCreated>('/inventory-issues', {
      method: 'POST',
      body: JSON.stringify(request),
    }), true),

  getSourceDeltas: (pageNumber = 1, pageSize = 25, status = 'PENDING', filters: { customerCode?: string; batchId?: string; serviceDate?: string } = {}) => {
    const query = new URLSearchParams({ PageNumber: String(pageNumber), PageSize: String(pageSize), Status: status });
    if (filters.customerCode) query.set('CustomerCode', filters.customerCode);
    if (filters.batchId) query.set('BatchId', filters.batchId);
    if (filters.serviceDate) query.set('ServiceDate', filters.serviceDate);
    return apiClient<MrxSourceDeltaPage>(`/reconciliation/source-deltas?${query}`);
  },

  getSourceHistory: (pageNumber = 1, pageSize = 25, filters: { customerCode?: string; batchId?: string; serviceDate?: string } = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams({ PageNumber: String(pageNumber), PageSize: String(pageSize) });
    if (filters.customerCode) query.set('CustomerCode', filters.customerCode);
    if (filters.batchId) query.set('BatchId', filters.batchId);
    if (filters.serviceDate) query.set('ServiceDate', filters.serviceDate);
    return apiClient<MrxSourceHistoryPage>(`/reconciliation/source-history?${query}`, { signal });
  },
  getSourceHistoryDetail: (eventId: string, pageNumber = 1, pageSize = 25, signal?: AbortSignal) =>
    apiClient<MrxSourceHistoryDetail>(`/reconciliation/source-history/${encodeURIComponent(eventId)}?PageNumber=${pageNumber}&PageSize=${pageSize}`, { signal }),

  createReturn: (request: CreateMrxReturnRequest) =>
    withMrxInvalidation(apiClient<MrxReturnCreated>('/inventory-returns', { method: 'POST', body: JSON.stringify(request) })),

  confirmReturn: (returnId: string, request: ConfirmMrxReturnRequest) =>
    withMrxInvalidation(apiClient<void>(`/inventory-returns/${encodeURIComponent(returnId)}/confirm-receipt`, { method: 'POST', body: JSON.stringify(request) }), true),

  getDispositionCategories: () =>
    apiClient<MrxDispositionCategory[]>('/reconciliation/lines/disposition-categories'),

  setDailyDisposition: (dailyLineId: string, request: SetMrxDispositionRequest) =>
    withMrxInvalidation(apiClient<void>(`/reconciliation/daily-lines/${encodeURIComponent(dailyLineId)}/disposition`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })),

  setLineDisposition: (lineId: string, request: SetMrxDispositionRequest) =>
    withMrxInvalidation(apiClient<void>(`/reconciliation/lines/${encodeURIComponent(lineId)}/disposition`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })),

  completeBatch: (batchId: string, expectedVersion: number) =>
    withMrxInvalidation(apiClient<MrxBatch>(batchPath(batchId, '/complete'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }), true),

  getKitchenCooking: (batchId: string, signal?: AbortSignal) =>
    apiClient<MrxKitchenCooking>(batchPath(batchId, '/kitchen-cooking'), { signal }),

  getScopedKitchenCookingExportUrl: ({ weekStartDate, batchIds, serviceDate, shift }: {
    weekStartDate: string;
    batchIds: string[];
    serviceDate?: string;
    shift: 'ALL' | 'MORNING' | 'AFTERNOON';
  }) => {
    const params = new URLSearchParams({ weekStartDate, shift });
    if (serviceDate) params.set('serviceDate', serviceDate);
    batchIds.forEach(id => params.append('batchIds', id));
    return `/api/reconciliation/kitchen-cooking/xlsx?${params}`;
  },

  getPreparation: (serviceDate: string, batchIds?: string[], wholeWeek = false, signal?: AbortSignal) => {
    const query = new URLSearchParams(wholeWeek ? { weekStartDate: serviceDate } : { serviceDate });
    batchIds?.forEach((id) => query.append('batchIds', id));
    return apiClient<MrxPreparation>(`/reconciliation/preparation?${query}`, { signal });
  },

  issueCoordinated: (request: CreateCoordinatedPreparationIssueRequest) =>
    withMrxInvalidation(apiClient<CoordinatedPreparationIssueResult>('/reconciliation/preparation/issue', {
      method: 'POST',
      body: JSON.stringify(request),
    })),

  getPreparationWorkbook: (query: MrxPreparationWorkbookQuery) => {
    const params = new URLSearchParams();
    if (query.serviceDate) params.set('serviceDate', query.serviceDate);
    if (query.weekStartDate) params.set('weekStartDate', query.weekStartDate);
    if (query.supplierName) params.set('supplierName', query.supplierName);
    if (query.isSupplemental !== undefined) params.set('isSupplemental', String(query.isSupplemental));
    if (query.includeMenus !== undefined) params.set('includeMenus', String(query.includeMenus));
    query.customerIds?.forEach((c) => params.append('customerIds', c));
    query.batchIds?.forEach((b) => params.append('batchIds', b));
    return apiClient<MrxPreparationWorkbook>(`/reconciliation/preparation/workbook-preview?${params}`);
  },

  getPreparationWorkbookExportUrl: (query: MrxPreparationWorkbookQuery) => {
    const params = new URLSearchParams();
    if (query.serviceDate) params.set('serviceDate', query.serviceDate);
    if (query.weekStartDate) params.set('weekStartDate', query.weekStartDate);
    if (query.supplierName) params.set('supplierName', query.supplierName);
    if (query.isSupplemental !== undefined) params.set('isSupplemental', String(query.isSupplemental));
    if (query.layout) params.set('layout', query.layout);
    if (query.includeMenus !== undefined) params.set('includeMenus', String(query.includeMenus));
    query.customerIds?.forEach((c) => params.append('customerIds', c));
    query.batchIds?.forEach((b) => params.append('batchIds', b));
    return `/api/reconciliation/preparation/export-workbook?${params}`;
  },

  getOperationalSummary: (filters: { customerId?: string; weekFrom?: string; weekTo?: string; queuePage?: number; queuePageSize?: number } = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (filters.customerId) query.set('customerId', filters.customerId);
    if (filters.weekFrom) query.set('weekFrom', filters.weekFrom);
    if (filters.weekTo) query.set('weekTo', filters.weekTo);
    if (filters.queuePage) query.set('queuePage', String(filters.queuePage));
    if (filters.queuePageSize) query.set('queuePageSize', String(filters.queuePageSize));
    return apiClient<MrxOperationalSummary>(`/reconciliation/reports/operational-summary${query.size ? `?${query}` : ''}`, { signal });
  },

  getTransactionsHistory: (query: { batchId?: string; fromDate?: string; toDate?: string; pageNumber?: number; pageSize?: number } = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      pageNumber: String(query.pageNumber ?? 1),
      pageSize: String(query.pageSize ?? 25),
    });
    if (query.batchId) params.set('batchId', query.batchId);
    if (query.fromDate) params.set('fromDate', query.fromDate);
    if (query.toDate) params.set('toDate', query.toDate);
    return apiClient<MrxTransactionHistoryReport>(`/reconciliation/reports/transactions-history?${params}`, { signal });
  },

  getVarianceRegister: (batchId?: string, weekStartDate?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (batchId) params.set('batchId', batchId);
    if (weekStartDate) params.set('weekStartDate', weekStartDate);
    return apiClient<MrxVarianceRegisterReport>(`/reconciliation/reports/variance-register?${params}`, { signal });
  },

  getCompletedRegister: (pageNumber = 1, pageSize = 50, scope: { customerId?: string; weekFrom?: string; weekTo?: string } = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize), ...scope });
    return apiClient<MrxCompletedRegisterReport>(`/reconciliation/reports/completed-register?${params}`, { signal });
  },

  getAuditTrail: (batchId?: string, pageNumber = 1, pageSize = 50, search = '', signal?: AbortSignal) => {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    if (batchId) params.set('batchId', batchId);
    if (search.trim()) params.set('search', search.trim());
    return apiClient<MrxAuditTrailReport>(`/reconciliation/reports/audit-trail?${params}`, { signal });
  },

  getBatchDishes: (batchId: string) =>
    apiClient<MrxBatchDishSummary[]>(`/reconciliation/batches/${encodeURIComponent(batchId)}/dishes`),

  getSourceChanges: (batchId: string) =>
    apiClient<MrxSourceChangeItem[]>(`/reconciliation/batches/${encodeURIComponent(batchId)}/source-changes`),

  getSourceChangesPage: (batchId: string, pageNumber = 1, pageSize = 50, search = '', signal?: AbortSignal) => {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    if (search.trim()) params.set('searchKeyword', search.trim());
    params.set('batchId', batchId);
    return apiClient<MrxSourceChangePage>(`/reconciliation/reports/source-changes?${params}`, { signal });
  },

  async downloadKitchenCookingBlob(batchId: string, format: 'csv' | 'xlsx'): Promise<Blob> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ipc_v3_token') : null;
    const res = await fetch(`/api/reconciliation/batches/${encodeURIComponent(batchId)}/kitchen-cooking/${format}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Tải file thất bại (HTTP ${res.status})`);
    }
    return res.blob();
  },
};
