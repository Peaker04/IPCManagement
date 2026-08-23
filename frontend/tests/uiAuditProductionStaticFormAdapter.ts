import { CANONICAL_QUERY_STATES, REGION_INVENTORY, UI_AUDIT_VIEWPORTS, identityKey, type UiAuditIdentity } from './uiAuditInventory';

export const PRODUCTION_STATIC_FORM_ROUTES = ['/admin/advanced-settings', '/403'] as const;
export type ProductionStaticFormRoute = (typeof PRODUCTION_STATIC_FORM_ROUTES)[number];
export type ProductionStaticFormDisposition =
  | { kind: 'measure'; reason: string }
  | { kind: 'not-applicable'; reason: string }
  | { kind: 'needs-evidence'; reason: string };

export type ProductionStaticFormIdentity = UiAuditIdentity & {
  route: ProductionStaticFormRoute;
  state: (typeof CANONICAL_QUERY_STATES)[number];
  disposition: ProductionStaticFormDisposition;
};

export const PRODUCTION_STATIC_FORM_REASONS = {
  advancedPopulated: 'MEASURE: localStorage-backed production form populated state',
  advancedNoCollectionQuery: 'NOT_APPLICABLE: local form has no collection query',
  advancedMutationReadOnly: 'NEEDS_EVIDENCE: read-only baseline does not click, save, toggle, or mutate localStorage after navigation',
  forbiddenPopulated: 'MEASURE: static production denial region populated state',
  forbiddenStatic: 'NOT_APPLICABLE: static denial region',
} as const;

export function expandProductionStaticFormIdentities(): ProductionStaticFormIdentity[] {
  return PRODUCTION_STATIC_FORM_ROUTES.flatMap((route) => REGION_INVENTORY[route].flatMap((regionId) =>
    CANONICAL_QUERY_STATES.flatMap((state) => UI_AUDIT_VIEWPORTS.map((viewport) => {
      let disposition: ProductionStaticFormDisposition;
      if (state === 'populated') {
        disposition = { kind: 'measure', reason: route === '/403' ? PRODUCTION_STATIC_FORM_REASONS.forbiddenPopulated : PRODUCTION_STATIC_FORM_REASONS.advancedPopulated };
      } else if (route === '/403') {
        disposition = { kind: 'not-applicable', reason: PRODUCTION_STATIC_FORM_REASONS.forbiddenStatic };
      } else if (state.startsWith('mutation-')) {
        disposition = { kind: 'needs-evidence', reason: PRODUCTION_STATIC_FORM_REASONS.advancedMutationReadOnly };
      } else {
        disposition = { kind: 'not-applicable', reason: PRODUCTION_STATIC_FORM_REASONS.advancedNoCollectionQuery };
      }
      return {
        route,
        regionId,
        state,
        actor: route === '/403' ? 'authenticated-but-forbidden' : 'administrator',
        viewport: viewport.id,
        lowestOwner: route === '/403' ? 'ForbiddenPage' : 'AdvancedDisplaySettings',
        disposition,
      };
    })),
  ));
}

export function validateProductionStaticFormIdentities(rows: readonly ProductionStaticFormIdentity[]) {
  const expectedCount = PRODUCTION_STATIC_FORM_ROUTES.reduce((count, route) => count + REGION_INVENTORY[route].length, 0)
    * CANONICAL_QUERY_STATES.length * UI_AUDIT_VIEWPORTS.length;
  if (rows.length !== expectedCount) throw new Error(`production static/form matrix has ${rows.length} rows; expected ${expectedCount}`);
  const keys = rows.map(identityKey);
  if (new Set(keys).size !== keys.length) throw new Error('production static/form matrix contains duplicate six-part identities');
  if (rows.some(({ disposition }) => !disposition.reason.trim())) throw new Error('production static/form matrix contains a blank disposition reason');
}

export function summarizeProductionStaticFormIdentities(rows: readonly ProductionStaticFormIdentity[]) {
  return {
    identityCount: rows.length,
    measuredIdentityCount: rows.filter(({ disposition }) => disposition.kind === 'measure').length,
    notApplicableIdentityCount: rows.filter(({ disposition }) => disposition.kind === 'not-applicable').length,
    needsEvidenceIdentityCount: rows.filter(({ disposition }) => disposition.kind === 'needs-evidence').length,
  };
}
