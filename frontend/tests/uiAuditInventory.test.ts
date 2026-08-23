import { describe, expect, it } from 'vitest';
import { validateUiAuditFinding } from './uiAuditContract';
import { expandUiAuditInventory, identityKey, parseProductionRouteSet, UI_AUDIT_ROUTES, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { regionFixtureRegistry, ruleFixtureRegistry, validateUiAuditRegistries } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';

describe('Phase 28 closed UI audit inventory', () => {
  it('matches exactly 13 AppRouter page routes and excludes the wildcard', () => {
    expect(parseProductionRouteSet()).toEqual([...UI_AUDIT_ROUTES].sort());
    expect(UI_AUDIT_ROUTES).toHaveLength(13); expect(UI_AUDIT_VIEWPORTS).toHaveLength(7);
  });
  it('closes rule fixtures and every six-part region fixture exactly once', () => {
    expect(() => validateUiAuditRegistries()).not.toThrow();
    expect(UI_AUDIT_RULE_IDS).toHaveLength(32);
    expect(new Set(regionFixtureRegistry.map(({ key }) => key)).size).toBe(expandUiAuditInventory().length);
  });
  it('executes clean and bad INV-01 tracer through shared registries', () => {
    const fixtures = ruleFixtureRegistry.filter(({ ruleId }) => ruleId === 'INV-01');
    expect(uiAuditOracleRegistry['INV-01'].evaluate(fixtures.find(({ kind }) => kind === 'known-clean')!.input)).toEqual([]);
    expect(uiAuditOracleRegistry['INV-01'].evaluate(fixtures.find(({ kind }) => kind === 'known-bad')!.input)).toMatchObject([{ ruleId: 'INV-01', verdict: 'FAIL' }]);
  });
  it('fails closed for duplicate identities and incomplete verdict evidence', () => {
    const rows = expandUiAuditInventory(); expect(identityKey(rows[0])).toContain('|');
    expect(() => validateUiAuditFinding({ ruleId: 'INV-01', identity: 'x', verdict: 'FAIL', measured: {} })).toThrow(/requires/);
    expect(() => validateUiAuditFinding({ ruleId: 'INV-01', identity: 'x', verdict: 'PASS', measured: {} })).toThrow(/measured/);
  });
});
