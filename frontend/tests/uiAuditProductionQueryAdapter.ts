import { CANONICAL_QUERY_STATES, REGION_INVENTORY, UI_AUDIT_VIEWPORTS, identityKey, type UiAuditIdentity } from './uiAuditInventory';

export const PRODUCTION_QUERY_ROUTES = ['/', '/weekly-menu', '/reports', '/meal-orders', '/chef-dashboard', '/approvals', '/purchasing', '/warehouse', '/admin-data', '/admin/rules'] as const;
export const PRODUCTION_QUERY_STATES = CANONICAL_QUERY_STATES.filter((state) => !state.startsWith('mutation-'));

export type ProductionQueryRoute = (typeof PRODUCTION_QUERY_ROUTES)[number];
export type ProductionQueryState = (typeof PRODUCTION_QUERY_STATES)[number];
export type ProductionQueryDisposition =
  | { kind: 'measure'; interception: 'deferred-read' | 'populated-read' | 'refresh-read' | 'empty-read' | 'filtered-read' | 'failed-read' | 'stale-then-failed-read' }
  | { kind: 'not-applicable'; reason: string }
  | { kind: 'needs-evidence'; reason: string };

const actors: Record<ProductionQueryRoute, string> = {
  '/': 'authenticated',
  '/weekly-menu': 'coordinator',
  '/reports': 'reporter',
  '/meal-orders': 'coordinator',
  '/chef-dashboard': 'chef',
  '/approvals': 'manager',
  '/purchasing': 'purchasing',
  '/warehouse': 'warehouse-keeper',
  '/admin-data': 'administrator',
  '/admin/rules': 'administrator',
};

const owners: Record<ProductionQueryRoute, string> = {
  '/': 'DashboardPage',
  '/weekly-menu': 'WeeklyMenuPage',
  '/reports': 'ReportsPage',
  '/meal-orders': 'CoordinationPage',
  '/chef-dashboard': 'ChefDashboardPage',
  '/approvals': 'ApprovalPage',
  '/purchasing': 'PurchasingPage',
  '/warehouse': 'WarehousePage',
  '/admin-data': 'AdminDataPage',
  '/admin/rules': 'ApprovalRulesPage',
};

const interceptions: Record<ProductionQueryState, Extract<ProductionQueryDisposition, { kind: 'measure' }>['interception']> = {
  'initial-loading': 'deferred-read',
  populated: 'populated-read',
  refreshing: 'refresh-read',
  'truly-empty': 'empty-read',
  'no-results': 'filtered-read',
  'error-no-data': 'failed-read',
  'partial-error-stale': 'stale-then-failed-read',
};

export type ProductionQueryIdentity = UiAuditIdentity & {
  route: ProductionQueryRoute;
  state: ProductionQueryState;
  disposition: ProductionQueryDisposition;
};

/** Exact Phase 28 read-only matrix. A runner may downgrade a row only with an identity-local honest reason. */
export function expandProductionQueryIdentities(): ProductionQueryIdentity[] {
  return PRODUCTION_QUERY_ROUTES.flatMap((route) => REGION_INVENTORY[route].flatMap((regionId) =>
    PRODUCTION_QUERY_STATES.flatMap((state) => UI_AUDIT_VIEWPORTS.map((viewport) => ({
      route,
      regionId,
      state,
      actor: actors[route],
      viewport: viewport.id,
      lowestOwner: owners[route],
      disposition: { kind: 'needs-evidence', reason: 'production-state-adapter-not-yet-implemented' } as const,
    }))),
  ));
}

export function registerProductionQueryMeasurement(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  return { ...identity, disposition: { kind: 'measure', interception: interceptions[identity.state] } };
}

export function needsProductionQueryEvidence(identity: ProductionQueryIdentity, reason: string): ProductionQueryIdentity {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error(`NEEDS_EVIDENCE requires an honest reason for ${identityKey(identity)}`);
  return { ...identity, disposition: { kind: 'needs-evidence', reason: normalizedReason } };
}

export function productionQueryNotApplicable(identity: ProductionQueryIdentity, reason: string): ProductionQueryIdentity {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error(`NOT_APPLICABLE requires an identity-local reason for ${identityKey(identity)}`);
  return { ...identity, disposition: { kind: 'not-applicable', reason: normalizedReason } };
}

export const REPORTS_QUERY_DISPOSITION_REASONS = {
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: ReportsPage exposes no read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: ReportsPage cannot safely trigger a failed refetch while retaining populated cache without cache manipulation',
} as const;

/** Reports-only Phase 28 disposition for its five registered, endpoint-owned regions. */
export function registerReportsQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/reports') throw new Error(`reports adapter received non-reports identity ${identityKey(identity)}`);
  if (identity.state === 'refreshing') {
    return needsProductionQueryEvidence(identity, REPORTS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  }
  if (identity.state === 'partial-error-stale') {
    return needsProductionQueryEvidence(identity, REPORTS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  }
  return registerProductionQueryMeasurement(identity);
}

export const WEEKLY_MENU_QUERY_DISPOSITION_REASONS = {
  scheduleNoResultsWithoutFilter: 'NOT_APPLICABLE: weekly-schedule has no result filter, so no-results cannot differ from truly-empty',
  demandNoResultsWithoutFilter: 'NOT_APPLICABLE: weekly-demand has no result filter; day selection changes business scope rather than filtering one result set',
  localCostProjection: 'NOT_APPLICABLE: weekly-cost is a client projection of the committed menu and catalog, not an independently owned query region',
  localDishMaterialsProjection: 'NOT_APPLICABLE: weekly-dish-materials is a client projection of the catalog and selected dish, not an independently owned query region',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: WeeklyMenuPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: WeeklyMenuPage cannot safely create a failed refetch with retained data without cache manipulation',
} as const;

/** Weekly Menu-only Phase 28 disposition for the five exact inventory regions. */
export function registerWeeklyMenuQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/weekly-menu') throw new Error(`weekly-menu adapter received non-weekly-menu identity ${identityKey(identity)}`);
  if (identity.regionId === 'weekly-cost') return productionQueryNotApplicable(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.localCostProjection);
  if (identity.regionId === 'weekly-dish-materials') return productionQueryNotApplicable(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.localDishMaterialsProjection);
  if (identity.state === 'no-results' && identity.regionId === 'weekly-schedule') return productionQueryNotApplicable(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.scheduleNoResultsWithoutFilter);
  if (identity.state === 'no-results' && identity.regionId === 'weekly-demand') return productionQueryNotApplicable(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.demandNoResultsWithoutFilter);
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, WEEKLY_MENU_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const MEAL_ORDERS_QUERY_DISPOSITION_REASONS = {
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: CoordinationPage exposes no read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: CoordinationPage cannot safely trigger a failed refetch while retaining populated cache without a mutation or production-only cache control',
} as const;

/** Meal Orders-only Phase 28 disposition. The five measurable states use the real CoordinationPage and OrderTable. */
export function registerMealOrdersQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/meal-orders') throw new Error(`meal-orders adapter received non-meal-orders identity ${identityKey(identity)}`);
  if (identity.state === 'refreshing') {
    return needsProductionQueryEvidence(identity, MEAL_ORDERS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  }
  if (identity.state === 'partial-error-stale') {
    return needsProductionQueryEvidence(identity, MEAL_ORDERS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  }
  return registerProductionQueryMeasurement(identity);
}

export const CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS = {
  noResultsWithoutFilter: 'NOT_APPLICABLE: ChefDashboardPage regions expose no result filter, so no-results cannot differ from truly-empty',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: ChefDashboardPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: ChefDashboardPage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Chef Dashboard-only Phase 28 disposition for its three registered production-route regions. */
export function registerChefDashboardQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/chef-dashboard') throw new Error(`chef-dashboard adapter received non-chef identity ${identityKey(identity)}`);
  if (identity.state === 'no-results') {
    return productionQueryNotApplicable(identity, CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS.noResultsWithoutFilter);
  }
  if (identity.state === 'refreshing') {
    return needsProductionQueryEvidence(identity, CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  }
  if (identity.state === 'partial-error-stale') {
    return needsProductionQueryEvidence(identity, CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  }
  return registerProductionQueryMeasurement(identity);
}

export const APPROVALS_QUERY_DISPOSITION_REASONS = {
  historyNoResultsWithoutFilter: 'NOT_APPLICABLE: approval-history has no result filter, so no-results cannot differ from truly-empty',
  purchaseRequestsNoResultsWithoutFilter: 'NOT_APPLICABLE: approval-purchase-requests has no result filter, so no-results cannot differ from truly-empty',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: ApprovalPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: ApprovalPage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Approvals-only Phase 28 disposition for the three exact ApprovalPage query regions. */
export function registerApprovalsQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/approvals') throw new Error(`approvals adapter received non-approvals identity ${identityKey(identity)}`);
  if (identity.state === 'no-results' && identity.regionId === 'approval-history') {
    return productionQueryNotApplicable(identity, APPROVALS_QUERY_DISPOSITION_REASONS.historyNoResultsWithoutFilter);
  }
  if (identity.state === 'no-results' && identity.regionId === 'approval-purchase-requests') {
    return productionQueryNotApplicable(identity, APPROVALS_QUERY_DISPOSITION_REASONS.purchaseRequestsNoResultsWithoutFilter);
  }
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, APPROVALS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, APPROVALS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const PURCHASING_QUERY_DISPOSITION_REASONS = {
  workflowNoResultsWithoutFilter: 'NOT_APPLICABLE: purchase-workflow has no result filter, so no-results cannot differ from truly-empty',
  supplementalNoResultsWithoutFilter: 'NOT_APPLICABLE: purchase-supplemental has no result filter, so no-results cannot differ from truly-empty',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: PurchasingPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: PurchasingPage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Purchasing-only Phase 28 disposition for its three registered production-route regions. */
export function registerPurchasingQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/purchasing') throw new Error(`purchasing adapter received non-purchasing identity ${identityKey(identity)}`);
  if (identity.state === 'no-results' && identity.regionId === 'purchase-workflow') {
    return productionQueryNotApplicable(identity, PURCHASING_QUERY_DISPOSITION_REASONS.workflowNoResultsWithoutFilter);
  }
  if (identity.state === 'no-results' && identity.regionId === 'purchase-supplemental') {
    return productionQueryNotApplicable(identity, PURCHASING_QUERY_DISPOSITION_REASONS.supplementalNoResultsWithoutFilter);
  }
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, PURCHASING_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, PURCHASING_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const WAREHOUSE_QUERY_DISPOSITION_REASONS = {
  noResultsWithoutRegionFilter: 'NOT_APPLICABLE: the registered Warehouse region has no distinct result-filter state; search-backed regions are measured as empty server results, not fabricated client filtering',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: WarehousePage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: WarehousePage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Warehouse-only Phase 28 disposition for its four exact, production-owned query regions. */
export function registerWarehouseQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/warehouse') throw new Error(`warehouse adapter received non-warehouse identity ${identityKey(identity)}`);
  if (identity.state === 'no-results') return productionQueryNotApplicable(identity, WAREHOUSE_QUERY_DISPOSITION_REASONS.noResultsWithoutRegionFilter);
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, WAREHOUSE_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, WAREHOUSE_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const ADMIN_DATA_QUERY_DISPOSITION_REASONS = {
  noResultsWithoutRegionFilter: 'NOT_APPLICABLE: the registered Admin Data GET regions expose no distinct result-filter state owned by the intercepted request',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: AdminDataPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: AdminDataPage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Admin Data-only Phase 28 disposition for its four exact production-owned GET regions. */
export function registerAdminDataQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/admin-data') throw new Error(`admin-data adapter received non-admin-data identity ${identityKey(identity)}`);
  if (identity.state === 'no-results') return productionQueryNotApplicable(identity, ADMIN_DATA_QUERY_DISPOSITION_REASONS.noResultsWithoutRegionFilter);
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, ADMIN_DATA_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, ADMIN_DATA_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const APPROVAL_RULES_QUERY_DISPOSITION_REASONS = {
  noResultsWithoutFilter: 'NOT_APPLICABLE: ApprovalRulesPage exposes no distinct client result filter, so no-results cannot differ from truly-empty',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: ApprovalRulesPage exposes no identity-local read-only refresh trigger after populated data',
  staleErrorWithoutReadTrigger: 'NEEDS_EVIDENCE: ApprovalRulesPage cannot safely trigger a failed refetch with retained data without a mutation or RTK cache manipulation',
} as const;

/** Approval Rules-only Phase 28 disposition for its exact production-owned GET region. */
export function registerApprovalRulesQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/admin/rules') throw new Error(`approval-rules adapter received non-approval-rules identity ${identityKey(identity)}`);
  if (identity.state === 'no-results') return productionQueryNotApplicable(identity, APPROVAL_RULES_QUERY_DISPOSITION_REASONS.noResultsWithoutFilter);
  if (identity.state === 'refreshing') return needsProductionQueryEvidence(identity, APPROVAL_RULES_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  if (identity.state === 'partial-error-stale') return needsProductionQueryEvidence(identity, APPROVAL_RULES_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger);
  return registerProductionQueryMeasurement(identity);
}

export const DASHBOARD_QUERY_DISPOSITION_REASONS = {
  noResultsWithoutFilter: 'NOT_APPLICABLE: dashboard-shift-status has no filter UI, so no-results cannot differ from truly-empty',
  refreshingWithoutReadTrigger: 'NEEDS_EVIDENCE: Dashboard exposes no read-only refresh trigger that can create an isFetching state from populated cache',
  staleErrorNotRendered: 'NEEDS_EVIDENCE: DashboardPage discards workflow data when isError, so production DOM exposes error-no-data rather than partial-error-stale',
} as const;

/** Dashboard-only Phase 28 disposition. Measurable rows still require production GET interception in Playwright. */
export function registerDashboardQueryIdentity(identity: ProductionQueryIdentity): ProductionQueryIdentity {
  if (identity.route !== '/') throw new Error(`dashboard adapter received non-dashboard identity ${identityKey(identity)}`);
  if (identity.state === 'no-results' && identity.regionId === 'dashboard-shift-status') {
    return needsProductionQueryEvidence(identity, DASHBOARD_QUERY_DISPOSITION_REASONS.noResultsWithoutFilter);
  }
  if (identity.state === 'refreshing') {
    return needsProductionQueryEvidence(identity, DASHBOARD_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger);
  }
  if (identity.state === 'partial-error-stale') {
    return needsProductionQueryEvidence(identity, DASHBOARD_QUERY_DISPOSITION_REASONS.staleErrorNotRendered);
  }
  return registerProductionQueryMeasurement(identity);
}

export function summarizeProductionQueryIdentities(rows: readonly ProductionQueryIdentity[]) {
  const measuredIdentityCount = rows.filter(({ disposition }) => disposition.kind === 'measure').length;
  const notApplicableIdentityCount = rows.filter(({ disposition }) => disposition.kind === 'not-applicable').length;
  const needsEvidenceIdentityCount = rows.filter(({ disposition }) => disposition.kind === 'needs-evidence').length;
  const needsEvidenceReasons = rows.reduce<Record<string, number>>((totals, { disposition }) => {
    if (disposition.kind === 'needs-evidence') totals[disposition.reason] = (totals[disposition.reason] ?? 0) + 1;
    return totals;
  }, {});
  return { applicableIdentityCount: rows.length, measuredIdentityCount, unsupportedIdentityCount: rows.length - measuredIdentityCount, notApplicableIdentityCount, needsEvidenceIdentityCount, needsEvidenceReasons };
}

export function validateProductionQueryIdentities(rows: readonly ProductionQueryIdentity[]) {
  const expected = PRODUCTION_QUERY_ROUTES.reduce((total, route) => total + REGION_INVENTORY[route].length, 0);
  const expectedCount = expected * PRODUCTION_QUERY_STATES.length * UI_AUDIT_VIEWPORTS.length;
  if (rows.length !== expectedCount) throw new Error(`production query matrix has ${rows.length} rows; expected ${expectedCount}`);
  const keys = rows.map(identityKey);
  if (new Set(keys).size !== keys.length) throw new Error('production query matrix contains duplicate six-part identities');
  for (const row of rows) {
    if (row.disposition.kind !== 'measure' && !row.disposition.reason.trim()) throw new Error(`missing disposition reason for ${identityKey(row)}`);
    if (row.state.startsWith('mutation-')) throw new Error(`mutation state escaped read-only adapter: ${identityKey(row)}`);
  }
}
