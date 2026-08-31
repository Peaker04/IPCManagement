export const queryBoundaryAdapterCalls = [
  'toQueryView',
  'toLabeledQueryView',
  'toAdminView',
  'toReportView',
  'toChefView',
] as const

export type QueryBoundaryException = {
  rationale: string
  requiredMarkers: readonly string[]
}

export const queryBoundaryExceptions: Readonly<Record<string, QueryBoundaryException>> = {
  'src/features/admin/components/SystemOperationModeSettings.tsx': {
    rationale: 'The Admin mode setting owns one singleton query and renders explicit loading/error/current authority before allowing mutation.',
    requiredMarkers: ['useGetSystemOperationModeQuery', 'Không tải được chế độ vận hành', 'useChangeSystemOperationModeMutation'],
  },
  'src/components/reconciliation/ClosedLoopTransferPanel.tsx': {
    rationale: 'The transfer card owns one batch collection and explicitly distinguishes loading, error, missing-scope and no-batch-for-scope states.',
    requiredMarkers: ['useListReconciliationBatchesQuery', 'Không tải được định lượng xuất kho', 'Phạm vi đang chọn chưa có lô định lượng'],
  },
  'src/features/reconciliation/ReconciliationWorkspace.tsx': {
    rationale: 'The retained-work-area reconciliation workspace owns one batch collection and preserves loading, error and genuinely empty states.',
    requiredMarkers: ['useListReconciliationBatchesQuery', 'Không tải được lô đối chiếu', 'Chưa có lô đối chiếu'],
  },
  'src/features/reconciliation/ReconciliationDispositionDrawer.tsx': {
    rationale: 'The drawer loads the server-owned category vocabulary and blocks submission with an explicit retryable error when that contract is unavailable.',
    requiredMarkers: ['useListReconciliationDispositionCategoriesQuery', 'Không tải được nhóm xử lý', 'refetchCategories'],
  },
  'src/app/providers/SystemOperationProvider.tsx': {
    rationale: 'The provider is the authenticated singleton bootstrap boundary; authority failure is exposed to route guards and never treated as DEFAULT or empty data.',
    requiredMarkers: ['useGetSystemOperationModeQuery', 'Không thể xác định chế độ vận hành', 'isLoading'],
  },
  'src/routes/ProtectedRoute.tsx': {
    rationale: 'Authentication bootstrap is a route/session gate: failure clears credentials and redirects, so it has no authoritative empty-data state.',
    requiredMarkers: ['useGetCurrentUserQuery', 'selectIsAuthLoading', 'logOut()', '<Navigate'],
  },
  'src/api/reportsApi.ts': {
    rationale: 'This non-rendering compatibility hook composes four query snapshots into one result consumed by an owning report boundary.',
    requiredMarkers: ['useGetWorkflowDocumentsQuery', 'useGetIngredientDemandQuery', 'refetch: () => Promise.all'],
  },
  'src/features/reports/pages/ReportsPage.tsx': {
    rationale: 'Supply-line reconciliation is an auxiliary usage projection inside the report boundary and renders an explicit error row instead of treating failure as an empty reconciliation result.',
    requiredMarkers: ['useGetSupplyLineReconciliationQuery', 'isError={reconciliationResult.isError}', 'LegacyLineageDispositionPanel'],
  },
  'src/features/reports/LegacyLineageDispositionPanel.tsx': {
    rationale: 'The panel owns separate pending, approved and candidate review projections; every failed query renders a retryable alert and blocks mutation that depends on missing candidates.',
    requiredMarkers: ['useGetLegacyLineageDispositionsQuery', 'useGetLegacyLineageCandidatesQuery', 'QueryErrorAlert'],
  },
  'src/features/projects/pages/WeeklyMenuPage.tsx': {
    rationale: 'Six page datasets use labeled QueryView owners; the remaining aggregate request is a readiness probe surfaced as unknown/blocked state, never as empty menu data.',
    requiredMarkers: ['toLabeledQueryView', 'demandReadinessResult.isError', 'hasDemandIssue'],
  },
  'src/features/approvals/components/MenuAmendmentReconciliation.tsx': {
    rationale: 'The reconciliation workbench owns customer and decision-page queries together; loading and failure states stay explicit and every correction remains bound to the selected decision row.',
    requiredMarkers: ['useGetCoordinationCustomersQuery', 'useGetMenuAmendmentDecisionPageQuery', 'QueryErrorAlert'],
  },
  'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx': {
    rationale: 'The receipt lifecycle panel owns only its receipt read model and presents explicit reload-safe errors; it cannot replace the warehouse purchase-order or stock-report query boundaries.',
    requiredMarkers: ['useGetInventoryReceiptsQuery', 'QueryErrorAlert', 'receipt-lifecycle-detail'],
  },
  'src/features/chef/production/ServiceRunSection.tsx': {
    rationale: 'The section queries a per-plan Service Run projection for its own action card; it does not replace the Chef production-plan owner or create an empty production-plan state.',
    requiredMarkers: ['useGetServiceRunByPlanQuery', 'function ServiceRunCard', 'Ca phục vụ thực tế'],
  },
  'src/features/reports/pages/ServiceRunReportPanel.tsx': {
    rationale: 'The report panel owns its Service Run table and renders explicit error and ready-empty states rather than delegating an authoritative report query to a page-level empty state.',
    requiredMarkers: ['useGetServiceRunPageQuery', 'Không tải được Ca phục vụ', 'Bảng Ca phục vụ'],
  },
  'src/components/common/ServiceRunBlockerPanel.tsx': {
    rationale: 'The blocker panel is a scoped operational exception projection and renders only blockers; absent rows intentionally mean no blocking document in this auxiliary panel.',
    requiredMarkers: ['useGetServiceRunPageQuery', 'Ca phục vụ đang bị chặn', 'OPEN_SUPPLEMENTAL'],
  },
  'src/features/projects/weekly-menu/demand/useMaterialDemand.ts': {
    rationale: 'The authoritative demand/documents/aggregate sources form one composite QueryView; daily staleness and approval history are supporting action/status probes.',
    requiredMarkers: ['const demandView = toQueryView', 'getWeekStalenessState', 'isApprovalHistoryError'],
  },
  'src/features/warehouse/pages/ReconciliationWarehousePage.tsx': {
    rationale: 'The closed-loop Warehouse page owns the selected batch, linked issue history and operational warehouse authority with explicit missing/error states.',
    requiredMarkers: ['useGetReconciliationBatchQuery', 'useListReconciliationIssueHistoryQuery', 'Không tải được lịch sử xuất kho'],
  },
  'src/features/warehouse/pages/WarehousePage.tsx': {
    rationale: 'Stock and movement are QueryView owners; remaining multi-source issue-dialog probes enforce action blocking and explicitly render unknown/error instead of authoritative empty.',
    requiredMarkers: ['const stockMovementView = toQueryView', 'const currentStockView = toQueryView', 'isAllocationSourceError', 'resolveIssueCreationAvailability'],
  },
}
