import { describe, expect, it } from 'vitest';
import { CANONICAL_QUERY_STATES, identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { PRODUCTION_QUERY_ROUTES } from './uiAuditProductionQueryAdapter';
import {
  expandProductionStaticFormIdentities,
  PRODUCTION_STATIC_FORM_REASONS,
  PRODUCTION_STATIC_FORM_ROUTES,
  summarizeProductionStaticFormIdentities,
  validateProductionStaticFormIdentities,
} from './uiAuditProductionStaticFormAdapter';

describe('Phase 28 production-route static/form baseline contract', () => {
  it('closes the two exact inventory routes without widening the production query route set', () => {
    const rows = expandProductionStaticFormIdentities();
    expect(() => validateProductionStaticFormIdentities(rows)).not.toThrow();
    expect(PRODUCTION_STATIC_FORM_ROUTES).toEqual(['/admin/advanced-settings', '/403']);
    expect(PRODUCTION_QUERY_ROUTES).toEqual(['/', '/weekly-menu', '/reports', '/meal-orders', '/chef-dashboard', '/approvals', '/purchasing', '/warehouse', '/admin-data', '/admin/rules']);
    expect(CANONICAL_QUERY_STATES).toHaveLength(9);
    expect(UI_AUDIT_VIEWPORTS).toHaveLength(7);
    expect(rows).toHaveLength(126);
    expect(new Set(rows.map(identityKey)).size).toBe(126);
    expect(summarizeProductionStaticFormIdentities(rows)).toEqual({ identityCount: 126, measuredIdentityCount: 14, notApplicableIdentityCount: 98, needsEvidenceIdentityCount: 14 });
  });

  it('keeps route-local state dispositions honest', () => {
    const rows = expandProductionStaticFormIdentities();
    const advanced = rows.filter(({ route }) => route === '/admin/advanced-settings');
    const forbidden = rows.filter(({ route }) => route === '/403');
    expect(advanced.filter(({ disposition }) => disposition.kind === 'measure')).toHaveLength(7);
    expect(advanced.filter(({ disposition }) => disposition.kind === 'not-applicable')).toHaveLength(42);
    expect(advanced.filter(({ disposition }) => disposition.kind === 'needs-evidence')).toHaveLength(14);
    expect(advanced.filter(({ disposition }) => disposition.kind === 'needs-evidence').every(({ disposition }) => disposition.reason === PRODUCTION_STATIC_FORM_REASONS.advancedMutationReadOnly)).toBe(true);
    expect(forbidden.filter(({ disposition }) => disposition.kind === 'measure')).toHaveLength(7);
    expect(forbidden.filter(({ disposition }) => disposition.kind === 'not-applicable')).toHaveLength(56);
    expect(forbidden.filter(({ disposition }) => disposition.kind === 'needs-evidence')).toHaveLength(0);
  });
});
