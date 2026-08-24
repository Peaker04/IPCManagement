import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  UI_AUDIT_FIXTURE_VERSION,
  UI_AUDIT_SCHEMA_VERSION,
  UI_AUDIT_VERDICTS,
  validateUiAuditRecord,
  type UiAuditFinding,
  type UiAuditRecord,
  type UiAuditVerdict,
} from './uiAuditContract';
import { expandUiAuditInventory, identityKey } from './uiAuditInventory';
import { UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';

export const PHASE28_RECONCILIATION_ARTIFACTS = [
  'ui-audit-phase28-login-production-route.json',
  'ui-audit-phase28-protected-production-routes.json',
  'ui-audit-phase28-dashboard-query-states.json',
  'ui-audit-phase28-weekly-menu-query-states.json',
  'ui-audit-phase28-reports-query-states.json',
  'ui-audit-phase28-meal-orders-query-states.json',
  'ui-audit-phase28-chef-dashboard-query-states.json',
  'ui-audit-phase28-approvals-query-states.json',
  'ui-audit-phase28-purchasing-query-states.json',
  'ui-audit-phase28-warehouse-query-states.json',
  'ui-audit-phase28-admin-data-query-states.json',
  'ui-audit-phase28-approval-rules-query-states.json',
  'ui-audit-phase28-static-form-production-routes.json',
] as const;

const GENERIC_ADAPTER_REASON = 'production-state-adapter-not-yet-implemented';
const QUERY_ARTIFACT_ROUTE = new Map<string, string>([
  ['ui-audit-phase28-dashboard-query-states.json', '/'],
  ['ui-audit-phase28-weekly-menu-query-states.json', '/weekly-menu'],
  ['ui-audit-phase28-reports-query-states.json', '/reports'],
  ['ui-audit-phase28-meal-orders-query-states.json', '/meal-orders'],
  ['ui-audit-phase28-chef-dashboard-query-states.json', '/chef-dashboard'],
  ['ui-audit-phase28-approvals-query-states.json', '/approvals'],
  ['ui-audit-phase28-purchasing-query-states.json', '/purchasing'],
  ['ui-audit-phase28-warehouse-query-states.json', '/warehouse'],
  ['ui-audit-phase28-admin-data-query-states.json', '/admin-data'],
  ['ui-audit-phase28-approval-rules-query-states.json', '/admin/rules'],
]);

type SourceArtifact = { schemaVersion: string; identityCount?: number; records: UiAuditRecord[] };
export type ReconciliationInput = { name: string; bytes: Buffer; artifact: SourceArtifact };
export type ReconciliationCounts = {
  measuredIdentityCount: number;
  notApplicableIdentityCount: number;
  needsEvidenceIdentityCount: number;
  verdictTotals: Record<UiAuditVerdict, number>;
};
export type Phase28CombinedBaseline = {
  schemaVersion: typeof UI_AUDIT_SCHEMA_VERSION;
  inventoryIdentityCount: number;
  findingCountPerIdentity: 32;
  counts: ReconciliationCounts;
  records: UiAuditRecord[];
};
export type Phase28ReconciliationManifest = {
  schemaVersion: typeof UI_AUDIT_SCHEMA_VERSION;
  sealStatus: 'OPEN' | 'SEALED';
  identityCount: number;
  findingCountPerIdentity: 32;
  missingIdentityCount: number;
  duplicateIdentityCount: number;
  extraIdentityCount: number;
  nonGetOrHeadObservedRequestCount: number;
  ownerlessFailCount: number;
  guessedPassCount: number;
  syntheticProductionRouteMeasuredCount: number;
  genericAdapterReasonCount: number;
  counts: ReconciliationCounts;
  needsEvidenceReasonTotals: Record<string, number>;
  sourceArtifactHashes: Record<string, string>;
  combinedSha256: string;
  sourceCommit: string;
  sealFingerprint: string;
};

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const splitIdentity = (identity: string) => {
  const parts = identity.split('|');
  if (parts.length !== 6) throw new Error(`identity must have six parts: ${identity}`);
  return { route: parts[0], regionId: parts[1], state: parts[2], actor: parts[3], viewport: parts[4], lowestOwner: parts[5] };
};
const reasonFinding = (ruleId: string, identity: string, verdict: 'NOT_APPLICABLE' | 'NEEDS_EVIDENCE', reason: string): UiAuditFinding => ({
  ruleId,
  identity,
  verdict,
  measured: { productionRouteMeasured: false, reason },
});

function fallbackRecord(identity: ReturnType<typeof expandUiAuditInventory>[number]): UiAuditRecord {
  const key = identityKey(identity);
  const inventoryReason = identity.disposition?.match(/^N\/A\((.+)\)$/)?.[1];
  const mutationReason = `NEEDS_EVIDENCE: read-only Phase 28 baseline cannot execute ${identity.state} for ${identity.route} ${identity.regionId}`;
  const reason = inventoryReason ?? (identity.state.startsWith('mutation-')
    ? mutationReason
    : `NEEDS_EVIDENCE: no production measurement artifact covers exact identity ${key}`);
  const verdict = inventoryReason ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE';
  return {
    schemaVersion: UI_AUDIT_SCHEMA_VERSION,
    fixtureVersion: UI_AUDIT_FIXTURE_VERSION,
    identity: key,
    fixtureKey: key,
    findings: UI_AUDIT_RULE_IDS.map((ruleId) => reasonFinding(ruleId, key, verdict, reason)),
    network: [],
  };
}

function expectedArtifactIdentities(name: string, inventoryKeys: Set<string>): Set<string> | undefined {
  const route = QUERY_ARTIFACT_ROUTE.get(name);
  if (route) return new Set([...inventoryKeys].filter((key) => {
    const identity = splitIdentity(key);
    return identity.route === route && !identity.state.startsWith('mutation-');
  }));
  if (name === 'ui-audit-phase28-login-production-route.json') return new Set([...inventoryKeys].filter((key) => key.startsWith('/login|login-form|populated|')));
  if (name === 'ui-audit-phase28-static-form-production-routes.json') return new Set([...inventoryKeys].filter((key) => key.startsWith('/admin/advanced-settings|') || key.startsWith('/403|')));
  // This artifact uses the UI-SPEC ready-state vocabulary, complementary to the canonical query-state matrix.
  if (name === 'ui-audit-phase28-protected-production-routes.json') return undefined;
  throw new Error(`undeclared reconciliation artifact ${name}`);
}

function validateArtifact(input: ReconciliationInput, inventoryKeys: Set<string>): UiAuditRecord[] {
  if (input.artifact.schemaVersion !== UI_AUDIT_SCHEMA_VERSION || !Array.isArray(input.artifact.records)) throw new Error(`${input.name} has invalid artifact schema`);
  if (input.artifact.identityCount !== undefined && input.artifact.identityCount !== input.artifact.records.length) throw new Error(`${input.name} identityCount does not match records`);
  const identities = input.artifact.records.map(({ identity }) => identity);
  if (new Set(identities).size !== identities.length) throw new Error(`${input.name} contains duplicate identities`);
  input.artifact.records.forEach(validateUiAuditRecord);
  const expected = expectedArtifactIdentities(input.name, inventoryKeys);
  if (!expected) return [];
  const actual = new Set(identities);
  const missing = [...expected].filter((key) => !actual.has(key));
  const extra = [...actual].filter((key) => !expected.has(key));
  if (missing.length || extra.length) throw new Error(`${input.name} exact identity mismatch: missing=${missing.length} extra=${extra.length}; first=${missing[0] ?? extra[0]}`);
  return input.artifact.records;
}

function mergeMeasuredRecord(fallback: UiAuditRecord, measured: UiAuditRecord): UiAuditRecord {
  const measuredByRule = new Map(measured.findings.map((finding) => [finding.ruleId, finding]));
  if (measuredByRule.size !== measured.findings.length) throw new Error(`duplicate finding rule for ${measured.identity}`);
  const findings = fallback.findings.map((finding) => measuredByRule.get(finding.ruleId) ?? finding);
  const extras = [...measuredByRule.keys()].filter((ruleId) => !UI_AUDIT_RULE_IDS.includes(ruleId as never));
  if (extras.length) throw new Error(`extra finding rule ${extras[0]} for ${measured.identity}`);
  return { ...measured, findings };
}

export function validateCanonicalBaseline(records: readonly UiAuditRecord[], productionEvidenceIdentities: ReadonlySet<string>) {
  const expected = expandUiAuditInventory().map(identityKey);
  const expectedSet = new Set(expected);
  const identities = records.map(({ identity }) => identity);
  const actualSet = new Set(identities);
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = [...actualSet].filter((key) => !expectedSet.has(key));
  const duplicateCount = identities.length - actualSet.size;
  if (missing.length || extra.length || duplicateCount) throw new Error(`canonical identity closure failed: missing=${missing.length} duplicate=${duplicateCount} extra=${extra.length}`);
  for (const record of records) {
    validateUiAuditRecord(record);
    if (record.fixtureKey !== record.identity) throw new Error(`fixture identity mismatch for ${record.identity}`);
    if (record.findings.length !== UI_AUDIT_RULE_IDS.length || new Set(record.findings.map(({ ruleId }) => ruleId)).size !== UI_AUDIT_RULE_IDS.length) throw new Error(`record must contain exactly 32 unique findings for ${record.identity}`);
    if (record.findings.some(({ identity }) => identity !== record.identity)) throw new Error(`finding identity mismatch for ${record.identity}`);
    if (record.network.some(({ method }) => !['GET', 'HEAD'].includes(method))) throw new Error(`non-GET/HEAD request for ${record.identity}`);
    for (const finding of record.findings) {
      if (finding.verdict === 'FAIL' && !finding.lowestOwner) throw new Error(`ownerless FAIL for ${record.identity}`);
      if (finding.verdict === 'PASS' && (finding.measured.productionRouteMeasured !== true || Object.keys(finding.measured).length < 2)) throw new Error(`guessed PASS for ${record.identity}`);
      if (finding.measured.productionRouteMeasured === true && !productionEvidenceIdentities.has(record.identity)) throw new Error(`synthetic productionRouteMeasured for ${record.identity}`);
      if (JSON.stringify(finding.measured).includes(GENERIC_ADAPTER_REASON)) throw new Error(`generic adapter reason for ${record.identity}`);
    }
  }
}

export function reconcilePhase28Baseline(inputs: readonly ReconciliationInput[], sourceCommit = 'unknown') {
  const expectedNames = new Set(PHASE28_RECONCILIATION_ARTIFACTS);
  const inputNames = inputs.map(({ name }) => name);
  if (inputNames.length !== expectedNames.size || new Set(inputNames).size !== inputNames.length || inputNames.some((name) => !expectedNames.has(name as never))) throw new Error('source artifact set is missing, duplicate, or extra');
  const inventory = expandUiAuditInventory();
  if (inventory.length !== 2142) throw new Error(`inventory must contain exactly 2,142 identities; received ${inventory.length}`);
  const inventoryKeys = new Set(inventory.map(identityKey));
  const recordsByIdentity = new Map(inventory.map((identity) => [identityKey(identity), fallbackRecord(identity)]));
  const productionEvidenceIdentities = new Set<string>();
  for (const input of inputs) for (const record of validateArtifact(input, inventoryKeys)) {
    if (productionEvidenceIdentities.has(record.identity)) throw new Error(`duplicate production identity across artifacts: ${record.identity}`);
    productionEvidenceIdentities.add(record.identity);
    recordsByIdentity.set(record.identity, mergeMeasuredRecord(recordsByIdentity.get(record.identity)!, record));
  }
  const records = [...recordsByIdentity.values()].sort((a, b) => a.identity.localeCompare(b.identity));
  validateCanonicalBaseline(records, productionEvidenceIdentities);
  const verdictTotals = Object.fromEntries(UI_AUDIT_VERDICTS.map((verdict) => [verdict, 0])) as Record<UiAuditVerdict, number>;
  records.flatMap(({ findings }) => findings).forEach(({ verdict }) => verdictTotals[verdict]++);
  const classify = (record: UiAuditRecord) => record.findings.some(({ verdict }) => verdict === 'PASS' || verdict === 'FAIL') ? 'measured'
    : record.findings.every(({ verdict }) => verdict === 'NOT_APPLICABLE') ? 'not-applicable' : 'needs-evidence';
  const counts: ReconciliationCounts = {
    measuredIdentityCount: records.filter((record) => classify(record) === 'measured').length,
    notApplicableIdentityCount: records.filter((record) => classify(record) === 'not-applicable').length,
    needsEvidenceIdentityCount: records.filter((record) => classify(record) === 'needs-evidence').length,
    verdictTotals,
  };
  const needsEvidenceReasonTotals = records.reduce<Record<string, number>>((totals, record) => {
    if (classify(record) !== 'needs-evidence') return totals;
    const reason = String(record.findings.find(({ verdict }) => verdict === 'NEEDS_EVIDENCE')?.measured.reason ?? 'NEEDS_EVIDENCE: reason missing');
    totals[reason] = (totals[reason] ?? 0) + 1;
    return totals;
  }, {});
  const combined: Phase28CombinedBaseline = { schemaVersion: UI_AUDIT_SCHEMA_VERSION, inventoryIdentityCount: records.length, findingCountPerIdentity: 32, counts, records };
  const combinedBytes = `${JSON.stringify(combined, null, 2)}\n`;
  const sourceArtifactHashes = Object.fromEntries(inputs.map(({ name, bytes }) => [name, sha256(bytes)]).sort(([a], [b]) => a.localeCompare(b)));
  const combinedSha256 = sha256(combinedBytes);
  const manifest: Phase28ReconciliationManifest = {
    schemaVersion: UI_AUDIT_SCHEMA_VERSION,
    sealStatus: 'SEALED',
    identityCount: records.length,
    findingCountPerIdentity: 32,
    missingIdentityCount: 0,
    duplicateIdentityCount: 0,
    extraIdentityCount: 0,
    nonGetOrHeadObservedRequestCount: 0,
    ownerlessFailCount: 0,
    guessedPassCount: 0,
    syntheticProductionRouteMeasuredCount: 0,
    genericAdapterReasonCount: 0,
    counts,
    needsEvidenceReasonTotals,
    sourceArtifactHashes,
    combinedSha256,
    sourceCommit,
    sealFingerprint: sha256(JSON.stringify({ sourceCommit, sourceArtifactHashes, combinedSha256 })),
  };
  return { combined, combinedBytes, manifest, productionEvidenceIdentities };
}

function atomicWrite(path: string, bytes: string) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, path);
}

export function reconcilePhase28BaselineFromDisk(
  frontendRoot = process.cwd(),
  evidenceRoot = process.env.UI_AUDIT_OUTPUT_ROOT ?? resolve(frontendRoot, 'test-results'),
  outputRoot = process.env.UI_AUDIT_RECOVERY_OUTPUT_ROOT ?? resolve(evidenceRoot, 'ui-audit-phase28-baseline'),
) {
  const inputs = PHASE28_RECONCILIATION_ARTIFACTS.map((name) => {
    const bytes = readFileSync(resolve(evidenceRoot, name));
    return { name, bytes, artifact: JSON.parse(bytes.toString('utf8')) as SourceArtifact };
  });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(frontendRoot, '..'), encoding: 'utf8' }).trim();
  const result = reconcilePhase28Baseline(inputs, sourceCommit);
  atomicWrite(resolve(outputRoot, 'canonical-combined.json'), result.combinedBytes);
  atomicWrite(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(result.manifest, null, 2)}\n`);
  return result;
}
