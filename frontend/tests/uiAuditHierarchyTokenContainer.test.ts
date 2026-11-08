import { describe, expect, it } from 'vitest';
import { ruleFixtureRegistry } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, type UiAuditRuleId } from './uiAuditOracleRegistry';

const cohort: UiAuditRuleId[] = ['HIER-01','HIER-02','TOK-SP-01','TOK-TY-01','TOK-CO-01','CONT-01','CONT-02','ORDER-01'];
describe('Phase 28 hierarchy token container fixture oracles', () => {
  it.each(cohort)('%s rejects one bad and accepts one clean fixture', (ruleId) => {
    const fixtures = ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId);
    expect(fixtures).toHaveLength(2);
    expect(uiAuditOracleRegistry[ruleId].evaluate(fixtures.find(({ kind }) => kind === 'known-bad')!.input)).toMatchObject([{ ruleId, verdict: 'FAIL' }]);
    expect(uiAuditOracleRegistry[ruleId].evaluate(fixtures.find(({ kind }) => kind === 'known-clean')!.input)).toEqual([]);
    expect(Object.keys(uiAuditOracleRegistry[ruleId].expected).length).toBeGreaterThan(0);
  });
});
