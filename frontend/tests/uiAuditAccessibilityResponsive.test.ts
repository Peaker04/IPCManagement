import { describe, expect, it } from 'vitest';
import { ruleFixtureRegistry } from './uiAuditFixtureRegistry';
import { uiAuditOracleRegistry, type UiAuditRuleId } from './uiAuditOracleRegistry';
const cohort: UiAuditRuleId[] = ['A11Y-01','A11Y-02','A11Y-03','RESP-01','RESP-02','RESP-WH-01','WH-01','WH-02','WH-03','MOTION-01','PERF-01'];
describe('Phase 28 accessibility responsive motion performance fixtures', () => {
  it.each(cohort)('%s has paired bad and clean proof', (ruleId) => {
    const pair = ruleFixtureRegistry.filter((fixture) => fixture.ruleId === ruleId);
    expect(uiAuditOracleRegistry[ruleId].evaluate(pair.find(({ kind }) => kind === 'known-bad')!.input)).toMatchObject([{ ruleId, verdict: 'FAIL' }]);
    expect(uiAuditOracleRegistry[ruleId].evaluate(pair.find(({ kind }) => kind === 'known-clean')!.input)).toEqual([]);
  });
  it('never upgrades absent performance or warehouse server evidence to PASS', () => {
    expect(uiAuditOracleRegistry['PERF-01'].expected).toMatchObject({ absentEvidenceVerdict: 'NEEDS_EVIDENCE' });
    expect(uiAuditOracleRegistry['WH-02'].expected).toMatchObject({ responseStatusForTamperedId: 403, firstRowInferenceCount: 0 });
  });
});
