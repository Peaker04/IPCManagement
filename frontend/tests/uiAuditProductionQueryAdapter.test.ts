import { describe, expect, it } from 'vitest';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import {
  expandProductionQueryIdentities,
  needsProductionQueryEvidence,
  PRODUCTION_QUERY_ROUTES,
  PRODUCTION_QUERY_STATES,
  registerProductionQueryMeasurement,
  summarizeProductionQueryIdentities,
  validateProductionQueryIdentities,
} from './uiAuditProductionQueryAdapter';

describe('Phase 28 production-route non-mutation query adapter', () => {
  it('closes the exact four-route, thirteen-region, seven-state, seven-viewport matrix', () => {
    const rows = expandProductionQueryIdentities();
    expect(() => validateProductionQueryIdentities(rows)).not.toThrow();
    expect(PRODUCTION_QUERY_ROUTES).toEqual(['/', '/weekly-menu', '/reports', '/meal-orders']);
    expect(PRODUCTION_QUERY_STATES).toEqual([
      'initial-loading', 'populated', 'refreshing', 'truly-empty', 'no-results', 'error-no-data', 'partial-error-stale',
    ]);
    expect(UI_AUDIT_VIEWPORTS).toHaveLength(7);
    expect(rows).toHaveLength(13 * 7 * 7);
    expect(new Set(rows.map(identityKey)).size).toBe(rows.length);
    expect(rows.every(({ actor, lowestOwner }) => Boolean(actor) && Boolean(lowestOwner))).toBe(true);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 637,
      measuredIdentityCount: 0,
      unsupportedIdentityCount: 637,
      needsEvidenceReasons: { 'production-state-adapter-not-yet-implemented': 637 },
    });
  });

  it('keeps the adapter read-only and requires an explicit reason for an unmeasurable identity', () => {
    const rows = expandProductionQueryIdentities();
    expect(rows.every(({ state }) => !state.startsWith('mutation-'))).toBe(true);
    expect(rows.every(({ disposition }) => disposition.kind === 'needs-evidence' && disposition.reason === 'production-state-adapter-not-yet-implemented')).toBe(true);
    expect(new Set(rows.map(registerProductionQueryMeasurement).map(({ disposition }) => disposition.kind === 'measure' ? disposition.interception : 'needs-evidence'))).toEqual(new Set([
      'deferred-read', 'populated-read', 'refresh-read', 'empty-read', 'filtered-read', 'failed-read', 'stale-then-failed-read',
    ]));
    expect(() => needsProductionQueryEvidence(rows[0], ' ')).toThrow(/honest reason/);
    expect(needsProductionQueryEvidence(rows[0], 'production route exposes no safe retry control')).toMatchObject({
      disposition: { kind: 'needs-evidence', reason: 'production route exposes no safe retry control' },
    });
  });
});
