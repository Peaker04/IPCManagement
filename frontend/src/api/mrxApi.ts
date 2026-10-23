import { apiClient } from './client';
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
  weekStartDate?: string;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}
export type MrxDraftSource = Schema['ReconciliationDraftSourceDto'];
export type MrxQuantityPreview = Schema['QuantityImportPreviewDto'];
export type MrxQuantityCommit = Schema['QuantityImportCommitDto'];
export type MrxWarehouseTransfer = Schema['ReconciliationWarehouseTransferDto'];
export type MrxWarehouseDaily = Schema['ReconciliationWarehouseDailyDto'];
export type MrxDispositionCategory = Schema['ReconciliationDispositionCategoryDto'];
export type MrxKitchenCooking = Schema['ReconciliationKitchenCookingExportDto'];
export type MrxWeeklySource = Pick<Schema['WeeklyMenuImportResultDto'],
  'customerId' | 'customerCode' | 'customerName' | 'weekStartDate' | 'weekEndDate' |
  'menuVersionId' | 'menuVersionNo' | 'menuVersionStatus' | 'warnings' | 'validation'>;
export type MrxIssue = Schema['InventoryIssueDto'];
export type MrxIssuePage = Schema['InventoryIssueDtoPagedResponseDto'];
export type MrxIssueCreated = Schema['InventoryIssueCreatedDto'];
export type MrxSourceDelta = Schema['ReconciliationSourceDeltaQueueItemDto'];
export type MrxSourceDeltaPage = Schema['ReconciliationSourceDeltaQueueItemDtoPagedResponseDto'];
export type CreateMrxReturnRequest = Schema['CreateInventoryReturnRequest'];
export type MrxReturnCreated = Schema['InventoryReturnCreatedDto'];
export type ConfirmMrxReturnRequest = Schema['ConfirmInventoryReturnReceiptRequest'];
export type MrxPreparation = Schema['ReconciliationPreparationDto'];
export type CreateCoordinatedPreparationIssueRequest = Schema['CoordinatedPreparationIssueRequest'];
export type CoordinatedPreparationIssueResult = Schema['CoordinatedPreparationIssueResultDto'];
export type MrxPreparationWorkbook = Schema['ReconciliationPreparationWorkbookDto'];
export type MrxOperationalSummary = Schema['MrxOperationalSummaryDto'];
export type MrxTransactionHistoryReport = Schema['MrxTransactionHistoryReportDto'];
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
}

export interface MrxMenuChangeLine {
  serviceDate: string;
  shiftName: string;
  dishSlot: string;
  newDishId?: string;
  newServings?: number;
}
export interface MrxMenuChangeRequest {
  customerId: string;
  weekStartDate: string;
  expectedBaseMenuVersionId: string;
  reason: string;
  lines: MrxMenuChangeLine[];
}
export interface MrxMenuChangeImpactLine {
  serviceDate: string;
  shiftName: string;
  dishSlot: string;
  oldDishId: string;
  newDishId: string;
  currentServings: number;
  newServings: number;
}
export interface MrxMenuChangeResult {
  menuAmendmentId: string;
  status: string;
  affectedReconciliationBatchIds: string[];
  impactLines: MrxMenuChangeImpactLine[];
}

export interface MrxMenuChangeInboxItem {
  menuAmendmentId: string;
  customerId: string;
  customerName: string;
  weekStartDate: string;
  status: string;
  reason: string;
  createdAt: string;
  affectedReconciliationBatchIds: string[];
  impactLines: MrxMenuChangeImpactLine[];
}

export type PreviewQuantityImportRequest = Schema['PreviewQuantityImportRequest'];
export type CommitQuantityImportRequest = Schema['CommitQuantityImportRequest'];
export type CreateReconciliationDraftRequest = Schema['CreateReconciliationDraftRequest'];
export type CreateMrxIssueRequest = Schema['CreateInventoryIssueRequest'];
export type SetMrxDispositionRequest = Schema['SetReconciliationDispositionRequest'];

function batchPath(batchId: string, suffix = ''): string {
  return `/reconciliation/batches/${encodeURIComponent(batchId)}${suffix}`;
}

export const mrxApi = {
  getBatchPage: (filters: MrxBatchPageQuery = {}) => {
    const query = new URLSearchParams();
    if (filters.customerId) query.set('CustomerId', filters.customerId);
    if (filters.weekStartDate) query.set('WeekStartDate', filters.weekStartDate);
    if (filters.status) query.set('Status', filters.status);
    query.set('PageNumber', String(filters.pageNumber ?? 1));
    query.set('PageSize', String(filters.pageSize ?? 20));
    return apiClient<MrxBatchPage>(`/reconciliation/batches?${query}`);
  },

  previewSourceChange: (request: MrxMenuChangeRequest) =>
    apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  submitSourceChange: (request: MrxMenuChangeRequest) =>
    apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/mrx-submit', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  confirmSourceChange: (request: MrxMenuChangeRequest) =>
    apiClient<MrxMenuChangeResult>('/coordination/weekly-menu/amendments/admin-confirm', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getSourceChangeInbox: () =>
    apiClient<MrxMenuChangeInboxItem[]>('/coordination/weekly-menu/amendments/mrx-inbox'),

  decideSourceChange: (amendmentId: string, approved: boolean, reason?: string) =>
    apiClient<MrxMenuChangeResult>(`/coordination/weekly-menu/amendments/${encodeURIComponent(amendmentId)}/mrx-decision`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    }),

  getDraftSources: () => apiClient<MrxDraftSource[]>('/reconciliation/batches/draft-sources'),

  getWeeklySource: (customerId: string, weekStartDate: string) => {
    const query = new URLSearchParams({ customerId, weekStartDate });
    return apiClient<MrxWeeklySource | null>(`/reconciliation/weekly-menu?${query}`);
  },

  previewQuantityImport: (request: PreviewQuantityImportRequest) =>
    apiClient<MrxQuantityPreview>('/reconciliation/batches/quantity-import/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  commitQuantityImport: (request: CommitQuantityImportRequest) =>
    apiClient<MrxQuantityCommit>('/reconciliation/batches/quantity-import/commit', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  createBatch: (request: CreateReconciliationDraftRequest) =>
    apiClient<MrxBatch>('/reconciliation/batches', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getBatch: (batchId: string) => apiClient<MrxBatch>(batchPath(batchId)),

  markReady: (batchId: string, expectedVersion: number) =>
    apiClient<MrxBatch>(batchPath(batchId, '/ready'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }),

  transferToWarehouse: (batchId: string, expectedVersion: number) =>
    apiClient<MrxWarehouseTransfer>(batchPath(batchId, '/transfer-to-warehouse'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }),

  getWarehouseDaily: (batchId: string) =>
    apiClient<MrxWarehouseDaily>(batchPath(batchId, '/warehouse-daily')),

  getIssues: (batchId: string, pageNumber = 1, pageSize = 25) => {
    const query = new URLSearchParams({
      SourceFamily: 'MATERIAL_RECONCILIATION',
      ReconciliationBatchId: batchId,
      PageNumber: String(pageNumber),
      PageSize: String(pageSize),
    });
    return apiClient<MrxIssuePage>(`/inventory-issues?${query}`);
  },

  createIssue: (request: CreateMrxIssueRequest) =>
    apiClient<MrxIssueCreated>('/inventory-issues', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getSourceDeltas: (pageNumber = 1, pageSize = 25) => {
    const query = new URLSearchParams({ PageNumber: String(pageNumber), PageSize: String(pageSize) });
    return apiClient<MrxSourceDeltaPage>(`/reconciliation/source-deltas?${query}`);
  },

  createReturn: (request: CreateMrxReturnRequest) =>
    apiClient<MrxReturnCreated>('/inventory-returns', { method: 'POST', body: JSON.stringify(request) }),

  confirmReturn: (returnId: string, request: ConfirmMrxReturnRequest) =>
    apiClient<void>(`/inventory-returns/${encodeURIComponent(returnId)}/confirm-receipt`, { method: 'POST', body: JSON.stringify(request) }),

  getDispositionCategories: () =>
    apiClient<MrxDispositionCategory[]>('/reconciliation/lines/disposition-categories'),

  setDailyDisposition: (dailyLineId: string, request: SetMrxDispositionRequest) =>
    apiClient<void>(`/reconciliation/daily-lines/${encodeURIComponent(dailyLineId)}/disposition`, {
      method: 'PUT',
      body: JSON.stringify(request),
    }),

  completeBatch: (batchId: string, expectedVersion: number) =>
    apiClient<MrxBatch>(batchPath(batchId, '/complete'), {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }),

  getKitchenCooking: (batchId: string) =>
    apiClient<MrxKitchenCooking>(batchPath(batchId, '/kitchen-cooking')),

  getPreparation: (serviceDate: string, batchIds?: string[]) => {
    const query = new URLSearchParams({ serviceDate });
    batchIds?.forEach((id) => query.append('batchIds', id));
    return apiClient<MrxPreparation>(`/reconciliation/preparation?${query}`);
  },

  issueCoordinated: (request: CreateCoordinatedPreparationIssueRequest) =>
    apiClient<CoordinatedPreparationIssueResult>('/reconciliation/preparation/issue', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getPreparationWorkbook: (query: MrxPreparationWorkbookQuery) => {
    const params = new URLSearchParams();
    if (query.serviceDate) params.set('serviceDate', query.serviceDate);
    if (query.weekStartDate) params.set('weekStartDate', query.weekStartDate);
    if (query.supplierName) params.set('supplierName', query.supplierName);
    if (query.isSupplemental !== undefined) params.set('isSupplemental', String(query.isSupplemental));
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
    query.customerIds?.forEach((c) => params.append('customerIds', c));
    query.batchIds?.forEach((b) => params.append('batchIds', b));
    return `/api/reconciliation/preparation/export-workbook?${params}`;
  },

  getOperationalSummary: () =>
    apiClient<MrxOperationalSummary>('/reconciliation/reports/operational-summary'),

  getTransactionsHistory: (batchId?: string, fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (batchId) params.set('batchId', batchId);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return apiClient<MrxTransactionHistoryReport>(`/reconciliation/reports/transactions-history?${params}`);
  },

  getVarianceRegister: (batchId?: string, weekStartDate?: string) => {
    const params = new URLSearchParams();
    if (batchId) params.set('batchId', batchId);
    if (weekStartDate) params.set('weekStartDate', weekStartDate);
    return apiClient<MrxVarianceRegisterReport>(`/reconciliation/reports/variance-register?${params}`);
  },

  getCompletedRegister: (pageNumber = 1, pageSize = 50) =>
    apiClient<MrxCompletedRegisterReport>(`/reconciliation/reports/completed-register?pageNumber=${pageNumber}&pageSize=${pageSize}`),

  getAuditTrail: (batchId?: string, pageNumber = 1, pageSize = 50) => {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    if (batchId) params.set('batchId', batchId);
    return apiClient<MrxAuditTrailReport>(`/reconciliation/reports/audit-trail?${params}`);
  },
};
