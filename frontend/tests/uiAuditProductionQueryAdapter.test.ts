import { describe, expect, it } from 'vitest';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import {
  APPROVALS_QUERY_DISPOSITION_REASONS,
  CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS,
  DASHBOARD_QUERY_DISPOSITION_REASONS,
  expandProductionQueryIdentities,
  MEAL_ORDERS_QUERY_DISPOSITION_REASONS,
  needsProductionQueryEvidence,
  PRODUCTION_QUERY_ROUTES,
  PRODUCTION_QUERY_STATES,
  PURCHASING_QUERY_DISPOSITION_REASONS,
  REPORTS_QUERY_DISPOSITION_REASONS,
  registerApprovalsQueryIdentity,
  registerChefDashboardQueryIdentity,
  registerDashboardQueryIdentity,
  registerReportsQueryIdentity,
  registerMealOrdersQueryIdentity,
  registerProductionQueryMeasurement,
  registerPurchasingQueryIdentity,
  registerWeeklyMenuQueryIdentity,
  registerWarehouseQueryIdentity,
  summarizeProductionQueryIdentities,
  WEEKLY_MENU_QUERY_DISPOSITION_REASONS,
  WAREHOUSE_QUERY_DISPOSITION_REASONS,
  validateProductionQueryIdentities,
} from './uiAuditProductionQueryAdapter';

describe('Phase 28 production-route non-mutation query adapter', () => {
  it('closes the exact eight-route, twenty-six-region, seven-state, seven-viewport matrix', () => {
    const rows = expandProductionQueryIdentities();
    expect(() => validateProductionQueryIdentities(rows)).not.toThrow();
    expect(PRODUCTION_QUERY_ROUTES).toEqual(['/', '/weekly-menu', '/reports', '/meal-orders', '/chef-dashboard', '/approvals', '/purchasing', '/warehouse']);
    expect(PRODUCTION_QUERY_STATES).toEqual([
      'initial-loading', 'populated', 'refreshing', 'truly-empty', 'no-results', 'error-no-data', 'partial-error-stale',
    ]);
    expect(UI_AUDIT_VIEWPORTS).toHaveLength(7);
    expect(rows).toHaveLength(26 * 7 * 7);
    expect(new Set(rows.map(identityKey)).size).toBe(rows.length);
    expect(rows.every(({ actor, lowestOwner }) => Boolean(actor) && Boolean(lowestOwner))).toBe(true);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 1274,
      measuredIdentityCount: 0,
      unsupportedIdentityCount: 1274,
      notApplicableIdentityCount: 0,
      needsEvidenceIdentityCount: 1274,
      needsEvidenceReasons: { 'production-state-adapter-not-yet-implemented': 1274 },
    });
  });

  it('registers the exact 98 dashboard identities without pretending unreachable states exist', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/').map(registerDashboardQueryIdentity);
    expect(rows).toHaveLength(98);
    expect(new Set(rows.map(identityKey)).size).toBe(98);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 98,
      measuredIdentityCount: 63,
      unsupportedIdentityCount: 35,
      notApplicableIdentityCount: 0,
      needsEvidenceIdentityCount: 35,
      needsEvidenceReasons: {
        [DASHBOARD_QUERY_DISPOSITION_REASONS.noResultsWithoutFilter]: 7,
        [DASHBOARD_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 14,
        [DASHBOARD_QUERY_DISPOSITION_REASONS.staleErrorNotRendered]: 14,
      },
    });
  });

  it('registers all 245 Reports identities and explicitly dispositions unsafe production states', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/reports').map(registerReportsQueryIdentity);
    expect(rows).toHaveLength(245);
    expect(new Set(rows.map(identityKey)).size).toBe(245);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 245,
      measuredIdentityCount: 175,
      unsupportedIdentityCount: 70,
      notApplicableIdentityCount: 0,
      needsEvidenceIdentityCount: 70,
      needsEvidenceReasons: {
        [REPORTS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 35,
        [REPORTS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 35,
      },
    });
    expect(() => registerReportsQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-reports/);
  });

  it('registers all 245 Weekly Menu identities with measured, inapplicable and unsafe states separated', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/weekly-menu').map(registerWeeklyMenuQueryIdentity);
    expect(rows).toHaveLength(245);
    expect(new Set(rows.map(identityKey)).size).toBe(245);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 245,
      measuredIdentityCount: 91,
      unsupportedIdentityCount: 154,
      notApplicableIdentityCount: 112,
      needsEvidenceIdentityCount: 42,
      needsEvidenceReasons: {
        [WEEKLY_MENU_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 21,
        [WEEKLY_MENU_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 21,
      },
    });
    expect(() => registerWeeklyMenuQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-weekly-menu/);
  });

  it('registers all 49 Meal Orders identities and explicitly dispositions unsafe production states', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/meal-orders').map(registerMealOrdersQueryIdentity);
    expect(rows).toHaveLength(49);
    expect(new Set(rows.map(identityKey)).size).toBe(49);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 49,
      measuredIdentityCount: 35,
      unsupportedIdentityCount: 14,
      notApplicableIdentityCount: 0,
      needsEvidenceIdentityCount: 14,
      needsEvidenceReasons: {
        [MEAL_ORDERS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 7,
        [MEAL_ORDERS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 7,
      },
    });
    expect(() => registerMealOrdersQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-meal-orders/);
  });

  it('registers all 147 Chef Dashboard identities with production-safe state dispositions', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/chef-dashboard').map(registerChefDashboardQueryIdentity);
    expect(rows).toHaveLength(147);
    expect(new Set(rows.map(identityKey)).size).toBe(147);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 147,
      measuredIdentityCount: 84,
      unsupportedIdentityCount: 63,
      notApplicableIdentityCount: 21,
      needsEvidenceIdentityCount: 42,
      needsEvidenceReasons: {
        [CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 21,
        [CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 21,
      },
    });
    expect(() => registerChefDashboardQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-chef/);
  });

  it('registers all 147 Approvals identities with query-owner-local dispositions', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/approvals').map(registerApprovalsQueryIdentity);
    expect(rows).toHaveLength(147);
    expect(new Set(rows.map(identityKey)).size).toBe(147);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 147,
      measuredIdentityCount: 91,
      unsupportedIdentityCount: 56,
      notApplicableIdentityCount: 14,
      needsEvidenceIdentityCount: 42,
      needsEvidenceReasons: {
        [APPROVALS_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 21,
        [APPROVALS_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 21,
      },
    });
    expect(() => registerApprovalsQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-approvals/);
  });

  it('registers all 147 Purchasing identities with active query-owner dispositions', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/purchasing').map(registerPurchasingQueryIdentity);
    expect(rows).toHaveLength(147);
    expect(new Set(rows.map(identityKey)).size).toBe(147);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 147,
      measuredIdentityCount: 91,
      unsupportedIdentityCount: 56,
      notApplicableIdentityCount: 14,
      needsEvidenceIdentityCount: 42,
      needsEvidenceReasons: {
        [PURCHASING_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 21,
        [PURCHASING_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 21,
      },
    });
    expect(() => registerPurchasingQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-purchasing/);
  });

  it('registers all 196 Warehouse identities with active-first production dispositions', () => {
    const rows = expandProductionQueryIdentities().filter(({ route }) => route === '/warehouse').map(registerWarehouseQueryIdentity);
    expect(rows).toHaveLength(196);
    expect(new Set(rows.map(identityKey)).size).toBe(196);
    expect(summarizeProductionQueryIdentities(rows)).toEqual({
      applicableIdentityCount: 196,
      measuredIdentityCount: 112,
      unsupportedIdentityCount: 84,
      notApplicableIdentityCount: 28,
      needsEvidenceIdentityCount: 56,
      needsEvidenceReasons: {
        [WAREHOUSE_QUERY_DISPOSITION_REASONS.refreshingWithoutReadTrigger]: 28,
        [WAREHOUSE_QUERY_DISPOSITION_REASONS.staleErrorWithoutReadTrigger]: 28,
      },
    });
    expect(() => registerWarehouseQueryIdentity(expandProductionQueryIdentities()[0])).toThrow(/non-warehouse/);
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
