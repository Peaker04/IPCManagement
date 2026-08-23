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

const exactExpectations: Partial<Record<UiAuditRuleId, Readonly<Record<string, unknown>>>> = {
  'HIER-01': { h1Count: 1, minimumNameLength: 1, maximumHeadingStep: 1 },
  'HIER-02': { blankNames: 0, duplicateRegions: 0, maximumPrimaryActions: 1 },
  'TOK-SP-01': { allowedPx: [0,4,8,16,24,32,48,64], tolerancePx: 0.25, negativeCount: 0 },
  'TOK-TY-01': { fontSizesPx: [12,13,14,16], weights: [400,600], fontTolerancePx: 0.1, lineHeightTolerance: 0.02 },
  'TOK-CO-01': { minimumTextContrast: 4.5, minimumLargeTextContrast: 3, minimumNonTextContrast: 3, tolerance: -0.01 },
  'CONT-01': { minimumNameLength: 1, duplicateCount: 0, maximumNestingDepth: 1 },
  'CONT-02': { maximumBoxDeltaPx: 0.5, maximumSiblingDeltaPx: 0.5 },
  'ORDER-01': { inversionCount: 0, shellTitleEqualsH1: false },
  'TABLE-01': { elementName: 'table', theadCount: 1, missingScopeCount: 0, duplicateRoleCount: 0 },
  'TABLE-02': { textAlign: 'left', numericAlign: 'right', fontVariant: 'tabular-nums', centeredOperationalCount: 0 },
  'TABLE-03': { maximumDocumentOverflowPx: 2, focusable: true, rowHeightsPx: [40,48,56], tolerancePx: 0.5 },
  'QUERY-01': { stateMarkerCount: 1, minimumSkeletonCount: 1, emptyCopyCountDuringLoading: 0, maximumScrollDeltaPx: 1 },
  'QUERY-02': { loadingReadyHeightDeltaPx: 8, refreshingReadyHeightDeltaPx: 2, staleLabel: 'Dữ liệu có thể đã cũ' },
  'FILTER-01': { liveRegionCount: 1, clearCountWhenActive: 1, clearCountWhenInactive: 0 },
  'SORT-01': { activeSortCount: 1, inactiveAriaSort: 'none', rawPrimaryKeyDefault: false },
  'COL-01': { priorities: ['essential','secondary','detail'], unregisteredColumns: 0, disclosureCount: 1 },
  'BADGE-01': { maximumBadgeCount: 2, registryHit: true },
  'PAGE-01': { paginationThreshold: 100, fetchAllRecords: false, directPageThreshold: 7 },
  'MUT-01': { duplicateSubmitCount: 0, maximumCls: 0.01, errorLiveCount: 1 },
  'REFRESH-01': { requestCountWhilePaused: 0, resumeRequestCount: 1, pausedLabelCount: 1 },
};
export function registerExactFixtureOracle(ruleId: UiAuditRuleId, expected = exactExpectations[ruleId] ?? {}) {
  uiAuditOracleRegistry[ruleId] = { expected, evaluate: ({ identity, values }) => values.clean === true ? [] : [{ ruleId, identity, verdict: 'FAIL', measured: values, expected: JSON.stringify(expected), actual: JSON.stringify(values), severity: 'high', lowestOwner: String(values.lowestOwner ?? 'phase28-fixture') }] };
}
for (const ruleId of Object.keys(exactExpectations) as UiAuditRuleId[]) registerExactFixtureOracle(ruleId);
