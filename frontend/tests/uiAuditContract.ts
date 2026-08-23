export const UI_AUDIT_SCHEMA_VERSION = 'phase28-ui-audit/v1' as const;
export const UI_AUDIT_FIXTURE_VERSION = 'phase28-fixtures/v1' as const;

export const UI_AUDIT_VERDICTS = ['PASS', 'FAIL', 'NOT_APPLICABLE', 'NEEDS_EVIDENCE', 'UNRESOLVED'] as const;
export type UiAuditVerdict = typeof UI_AUDIT_VERDICTS[number];
export type UiAuditSeverity = 'blocker' | 'high' | 'medium' | 'low';
export type UiAuditFinding = {
  ruleId: string;
  verdict: UiAuditVerdict;
  identity: string;
  measured: Record<string, unknown>;
  expected?: string;
  actual?: string;
  severity?: UiAuditSeverity;
  lowestOwner?: string;
};
export type UiAuditNetworkEntry = { method: string; url: string; resourceType: string; classification: 'api' | 'non-static' };
export type UiAuditRecord = { schemaVersion: typeof UI_AUDIT_SCHEMA_VERSION; fixtureVersion: typeof UI_AUDIT_FIXTURE_VERSION; identity: string; fixtureKey: string; findings: UiAuditFinding[]; network: UiAuditNetworkEntry[] };
export type UiAuditManifest = { schemaVersion: typeof UI_AUDIT_SCHEMA_VERSION; sealStatus: 'OPEN' | 'SEALED'; runFingerprint: string; priorManifestHash?: string; identityCount: number; missingIdentityCount: number; duplicateIdentityCount: number; extraIdentityCount: number; regionFixtureMismatchCount: number; invalidRecordCount: number; nonGetObservedRequestCount: number; ownerlessFailCount: number; guessedPassCount: number; verdictTotals: Record<UiAuditVerdict, number>; recordHashes: Record<string, string> };

export function validateUiAuditFinding(value: unknown): asserts value is UiAuditFinding {
  const finding = value as Partial<UiAuditFinding>;
  if (!finding.ruleId || !finding.identity || !UI_AUDIT_VERDICTS.includes(finding.verdict as UiAuditVerdict) || !finding.measured || typeof finding.measured !== 'object') throw new Error('Invalid UI audit finding');
  if (finding.verdict === 'FAIL' && (!finding.expected || !finding.actual || !finding.severity || !finding.lowestOwner)) throw new Error('FAIL requires expected, actual, severity and lowestOwner');
  if (finding.verdict === 'PASS' && Object.keys(finding.measured).length === 0) throw new Error('PASS requires measured fields');
}

export function validateUiAuditRecord(value: unknown): asserts value is UiAuditRecord {
  const record = value as Partial<UiAuditRecord>;
  if (record.schemaVersion !== UI_AUDIT_SCHEMA_VERSION || record.fixtureVersion !== UI_AUDIT_FIXTURE_VERSION || !record.identity || !record.fixtureKey || !Array.isArray(record.findings) || !Array.isArray(record.network)) throw new Error('Invalid UI audit record');
  record.findings.forEach(validateUiAuditFinding);
}
