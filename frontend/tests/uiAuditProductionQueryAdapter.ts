import { CANONICAL_QUERY_STATES, REGION_INVENTORY, UI_AUDIT_VIEWPORTS, identityKey, type UiAuditIdentity } from './uiAuditInventory';

export const PRODUCTION_QUERY_ROUTES = ['/', '/weekly-menu', '/reports', '/meal-orders'] as const;
export const PRODUCTION_QUERY_STATES = CANONICAL_QUERY_STATES.filter((state) => !state.startsWith('mutation-'));

export type ProductionQueryRoute = (typeof PRODUCTION_QUERY_ROUTES)[number];
export type ProductionQueryState = (typeof PRODUCTION_QUERY_STATES)[number];
export type ProductionQueryDisposition =
  | { kind: 'measure'; interception: 'deferred-read' | 'populated-read' | 'refresh-read' | 'empty-read' | 'filtered-read' | 'failed-read' | 'stale-then-failed-read' }
  | { kind: 'needs-evidence'; reason: string };

const actors: Record<ProductionQueryRoute, string> = {
  '/': 'authenticated',
  '/weekly-menu': 'coordinator',
  '/reports': 'reporter',
  '/meal-orders': 'coordinator',
};

const owners: Record<ProductionQueryRoute, string> = {
  '/': 'DashboardPage',
  '/weekly-menu': 'WeeklyMenuPage',
  '/reports': 'ReportsPage',
  '/meal-orders': 'CoordinationPage',
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

export function summarizeProductionQueryIdentities(rows: readonly ProductionQueryIdentity[]) {
  const measuredIdentityCount = rows.filter(({ disposition }) => disposition.kind === 'measure').length;
  const needsEvidenceReasons = rows.reduce<Record<string, number>>((totals, { disposition }) => {
    if (disposition.kind === 'needs-evidence') totals[disposition.reason] = (totals[disposition.reason] ?? 0) + 1;
    return totals;
  }, {});
  return { applicableIdentityCount: rows.length, measuredIdentityCount, unsupportedIdentityCount: rows.length - measuredIdentityCount, needsEvidenceReasons };
}

export function validateProductionQueryIdentities(rows: readonly ProductionQueryIdentity[]) {
  const expected = REGION_INVENTORY['/'].length + REGION_INVENTORY['/weekly-menu'].length + REGION_INVENTORY['/reports'].length + REGION_INVENTORY['/meal-orders'].length;
  const expectedCount = expected * PRODUCTION_QUERY_STATES.length * UI_AUDIT_VIEWPORTS.length;
  if (rows.length !== expectedCount) throw new Error(`production query matrix has ${rows.length} rows; expected ${expectedCount}`);
  const keys = rows.map(identityKey);
  if (new Set(keys).size !== keys.length) throw new Error('production query matrix contains duplicate six-part identities');
  for (const row of rows) {
    if (row.disposition.kind === 'needs-evidence' && !row.disposition.reason.trim()) throw new Error(`missing NEEDS_EVIDENCE reason for ${identityKey(row)}`);
    if (row.state.startsWith('mutation-')) throw new Error(`mutation state escaped read-only adapter: ${identityKey(row)}`);
  }
}
