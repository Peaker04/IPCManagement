import { expandUiAuditInventory, identityKey } from './uiAuditInventory';
import { UI_AUDIT_RULE_IDS, type OracleInput, type UiAuditRuleId } from './uiAuditOracleRegistry';

export type RuleFixture = { key: string; ruleId: UiAuditRuleId; kind: 'known-bad' | 'known-clean'; input: OracleInput };
export const ruleFixtureRegistry: RuleFixture[] = UI_AUDIT_RULE_IDS.flatMap((ruleId) => [
  { key: `bad-${ruleId.toLowerCase()}`, ruleId, kind: 'known-bad' as const, input: { identity: `fixture|${ruleId}|bad`, values: ruleId === 'INV-01' ? { actualCount: 2, routeCount: 13, protectedCount: 12 } : { clean: false } } },
  { key: `clean-${ruleId.toLowerCase()}`, ruleId, kind: 'known-clean' as const, input: { identity: `fixture|${ruleId}|clean`, values: ruleId === 'INV-01' ? { actualCount: 1, routeCount: 13, protectedCount: 12 } : { clean: true } } },
]);
export const regionFixtureRegistry = expandUiAuditInventory().map((identity) => ({ key: identityKey(identity), identity, disposition: identity.disposition }));

export function validateUiAuditRegistries() {
  const errors: string[] = [];
  const expected = new Set(UI_AUDIT_RULE_IDS);
  const actual = new Set(ruleFixtureRegistry.map(({ ruleId }) => ruleId));
  if (expected.size !== 32 || actual.size !== expected.size || [...expected].some((id) => !actual.has(id))) errors.push('Rule registry must equal exact 32-ID set');
  for (const id of expected) {
    const fixtures = ruleFixtureRegistry.filter(({ ruleId }) => ruleId === id);
    if (fixtures.filter(({ kind }) => kind === 'known-bad').length !== 1 || fixtures.filter(({ kind }) => kind === 'known-clean').length !== 1) errors.push(`${id} fixture pair is not bijective`);
  }
  const expectedIdentities = expandUiAuditInventory().map(identityKey);
  const counts = new Map<string, number>();
  for (const fixture of regionFixtureRegistry) counts.set(fixture.key, (counts.get(fixture.key) ?? 0) + 1);
  for (const key of expectedIdentities) if (counts.get(key) !== 1) errors.push(`Region fixture identity count is not one: ${key}`);
  for (const key of counts.keys()) if (!expectedIdentities.includes(key)) errors.push(`Orphan region fixture: ${key}`);
  if (errors.length) throw new Error(errors.join('\n'));
}
