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
  'src/routes/ProtectedRoute.tsx': {
    rationale: 'Authentication bootstrap is a route/session gate: failure clears credentials and redirects, so it has no authoritative empty-data state.',
    requiredMarkers: ['useGetCurrentUserQuery', 'selectIsAuthLoading', 'logOut()', '<Navigate'],
  },
  'src/features/reports/reportsApi.ts': {
    rationale: 'This non-rendering compatibility hook composes four query snapshots into one result consumed by an owning report boundary.',
    requiredMarkers: ['useGetWorkflowDocumentsQuery', 'useGetIngredientDemandQuery', 'refetch: () => Promise.all'],
  },
  'src/features/projects/pages/WeeklyMenuPage.tsx': {
    rationale: 'Six page datasets use labeled QueryView owners; the remaining aggregate request is a readiness probe surfaced as unknown/blocked state, never as empty menu data.',
    requiredMarkers: ['toLabeledQueryView', 'demandReadinessResult.isError', 'hasDemandIssue'],
  },
  'src/features/projects/weekly-menu/demand/useMaterialDemand.ts': {
    rationale: 'The authoritative demand/documents/aggregate sources form one composite QueryView; daily staleness and approval history are supporting action/status probes.',
    requiredMarkers: ['const demandView = toQueryView', 'getWeekStalenessState', 'isApprovalHistoryError'],
  },
  'src/features/warehouse/pages/WarehousePage.tsx': {
    rationale: 'Stock and movement are QueryView owners; remaining multi-source issue-dialog probes enforce action blocking and explicitly render unknown/error instead of authoritative empty.',
    requiredMarkers: ['const stockMovementView = toQueryView', 'const currentStockView = toQueryView', 'isAllocationSourceError', 'resolveIssueCreationAvailability'],
  },
}
