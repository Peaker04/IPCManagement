import { describe, expect, it } from 'vitest';
import { ruleFixtureRegistry } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, type UiAuditRuleId } from './uiAuditOracleRegistry';
const cohort: UiAuditRuleId[] = ['TABLE-01','TABLE-02','TABLE-03','QUERY-01','QUERY-02','FILTER-01','SORT-01','COL-01','BADGE-01','PAGE-01','MUT-01','REFRESH-01'];
describe('Phase 28 table query interaction fixture oracles', () => {
  it.each(cohort)('%s has exact paired proof', (ruleId) => {
    const pair = ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId);
    expect(pair).toHaveLength(2);
    expect(uiAuditOracleRegistry[ruleId].evaluate(pair.find(({ kind }) => kind === 'known-bad')!.input)).toMatchObject([{ ruleId, verdict: 'FAIL' }]);
    expect(uiAuditOracleRegistry[ruleId].evaluate(pair.find(({ kind }) => kind === 'known-clean')!.input)).toEqual([]);
  });
  it('keeps mutation fixture traffic synthetic and non-persistent', () => {
    expect(uiAuditOracleRegistry['MUT-01'].expected).toMatchObject({ duplicateSubmitCount: 0, maximumCls: 0.01 });
    expect(uiAuditOracleRegistry['REFRESH-01'].expected).toMatchObject({ requestCountWhilePaused: 0, resumeRequestCount: 1 });
  });
});
