import type { UiAuditFinding } from './uiAuditContract';

export const UI_AUDIT_RULE_IDS = ['INV-01','HIER-01','HIER-02','TOK-SP-01','TOK-TY-01','TOK-CO-01','CONT-01','CONT-02','TABLE-01','TABLE-02','TABLE-03','QUERY-01','QUERY-02','A11Y-01','A11Y-02','A11Y-03','RESP-01','RESP-02','RESP-WH-01','WH-01','WH-02','WH-03','ORDER-01','FILTER-01','SORT-01','COL-01','BADGE-01','PAGE-01','MUT-01','REFRESH-01','MOTION-01','PERF-01'] as const;
export type UiAuditRuleId = typeof UI_AUDIT_RULE_IDS[number];
export type OracleInput = { identity: string; values: Record<string, unknown> };
export type UiAuditOracle = { expected: Readonly<Record<string, unknown>>; evaluate(input: OracleInput): UiAuditFinding[] };

function pending(ruleId: UiAuditRuleId): UiAuditOracle { return { expected: { implemented: false }, evaluate: ({ identity }) => [{ ruleId, identity, verdict: 'NEEDS_EVIDENCE', measured: { implemented: false } }] }; }
export const uiAuditOracleRegistry = Object.fromEntries(UI_AUDIT_RULE_IDS.map((id) => [id, pending(id)])) as Record<UiAuditRuleId, UiAuditOracle>;
uiAuditOracleRegistry['INV-01'] = { expected: { routeCount: 13, protectedCount: 12, identityCount: 1 }, evaluate: ({ identity, values }) => {
  const actualCount = Number(values.actualCount); const routeCount = Number(values.routeCount); const protectedCount = Number(values.protectedCount);
  return actualCount === 1 && routeCount === 13 && protectedCount === 12 ? [] : [{ ruleId: 'INV-01', identity, verdict: 'FAIL', measured: { actualCount, routeCount, protectedCount }, expected: 'one identity, 13 routes and 12 protected routes', actual: JSON.stringify({ actualCount, routeCount, protectedCount }), severity: 'blocker', lowestOwner: 'uiAuditInventory' }];
} };
