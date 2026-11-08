import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandUiAuditInventory, identityKey, UI_AUDIT_ROUTE_AUTHORITIES } from './uiAuditInventory';
import {
  PHASE28_RECONCILIATION_ARTIFACTS,
  reconcilePhase28Baseline,
  validateCanonicalBaseline,
  type ReconciliationInput,
} from './uiAuditBaselineReconciliation';

type Artifact = ReconciliationInput['artifact'];
const repositoryRoot = resolve(process.cwd(), '..');
const recoveryAuthorityPath = resolve(repositoryRoot, '.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json');
const recoveryAuthority = JSON.parse(readFileSync(recoveryAuthorityPath, 'utf8')) as {
  status: string;
  restored: boolean;
  byteEqualityToLostArtifacts: boolean;
  selectedRecovery: { root: string; members: Record<string, string> };
};
const selectedEvidenceRoot = resolve(repositoryRoot, recoveryAuthority.selectedRecovery.root, 'evidence');
const loadInputs = (): ReconciliationInput[] => {
  expect(recoveryAuthority).toMatchObject({ status: 'LOST_NO_BACKUP', restored: false, byteEqualityToLostArtifacts: false });
  return PHASE28_RECONCILIATION_ARTIFACTS.map((name) => {
    const bytes = readFileSync(resolve(selectedEvidenceRoot, name));
    const expectedHash = recoveryAuthority.selectedRecovery.members[`evidence/${name}`];
    expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(expectedHash);
    return { name, bytes, artifact: JSON.parse(bytes.toString('utf8')) as Artifact };
  });
};
const cloneInputs = () => structuredClone(loadInputs()) as ReconciliationInput[];
const dashboard = (inputs: ReconciliationInput[]) => inputs.find(({ name }) => name === 'ui-audit-phase28-dashboard-query-states.json')!;

describe('Phase 28 final baseline reconciliation', () => {
  it('uses canonical source-owned actor and owner fields for all exact 2,205 identities', () => {
    const rows = expandUiAuditInventory();
    expect(rows).toHaveLength(2205);
    expect(new Set(rows.map(identityKey)).size).toBe(2205);
    for (const row of rows) expect(row).toMatchObject(UI_AUDIT_ROUTE_AUTHORITIES[row.route]);
  });

  it('reconciles every artifact byte-exact and seals honest NEEDS_EVIDENCE separately from outcomes', () => {
    const { combined, manifest } = reconcilePhase28Baseline(loadInputs(), 'test-commit');
    expect(manifest).toMatchObject({ sealStatus: 'SEALED', identityCount: 2205, findingCountPerIdentity: 32, missingIdentityCount: 0, duplicateIdentityCount: 0, extraIdentityCount: 0, nonGetOrHeadObservedRequestCount: 0, ownerlessFailCount: 0, guessedPassCount: 0, syntheticProductionRouteMeasuredCount: 0, genericAdapterReasonCount: 0 });
    expect(combined.records).toHaveLength(2205);
    expect(combined.records.every(({ findings }) => findings.length === 32)).toBe(true);
    expect(manifest.counts.measuredIdentityCount + manifest.counts.notApplicableIdentityCount + manifest.counts.needsEvidenceIdentityCount).toBe(2205);
    expect(manifest.counts.needsEvidenceIdentityCount).toBeGreaterThan(0);
    expect(Object.values(manifest.needsEvidenceReasonTotals).reduce((sum, count) => sum + count, 0)).toBe(manifest.counts.needsEvidenceIdentityCount);
    expect(Object.keys(manifest.needsEvidenceReasonTotals)).not.toContain('production-state-adapter-not-yet-implemented');
    expect(Object.keys(manifest.sourceArtifactHashes)).toEqual([...PHASE28_RECONCILIATION_ARTIFACTS].sort());
    const readOnlyMutation = combined.records.find(({ identity }) => identity.startsWith('/|dashboard-shift-status|mutation-in-flight|'))!;
    expect(readOnlyMutation.findings.every(({ verdict, measured }) => verdict === 'NOT_APPLICABLE' && measured.reason === 'read-only regions')).toBe(true);
    const mutableMutation = combined.records.find(({ identity }) => identity.startsWith('/weekly-menu|weekly-schedule|mutation-in-flight|'))!;
    expect(mutableMutation.findings.every(({ verdict, measured }) => verdict === 'NEEDS_EVIDENCE' && String(measured.reason).includes('/weekly-menu weekly-schedule'))).toBe(true);
  });

  it.each([
    ['missing identity', (inputs: ReconciliationInput[]) => { const source = dashboard(inputs); source.artifact.records.pop(); source.artifact.identityCount = source.artifact.records.length; }, /identity mismatch: missing=1/],
    ['duplicate identity', (inputs: ReconciliationInput[]) => { const source = dashboard(inputs); source.artifact.records.push(structuredClone(source.artifact.records[0])); source.artifact.identityCount = source.artifact.records.length; }, /duplicate identities/],
    ['extra identity', (inputs: ReconciliationInput[]) => { const source = dashboard(inputs); const record = structuredClone(source.artifact.records[0]); record.identity = record.identity.replace('|authenticated|', '|intruder|'); record.fixtureKey = record.identity; record.findings.forEach((finding) => { finding.identity = record.identity; }); source.artifact.records.push(record); source.artifact.identityCount = source.artifact.records.length; }, /identity mismatch.*extra=1/],
    ['mutated actor', (inputs: ReconciliationInput[]) => { const source = dashboard(inputs); const record = source.artifact.records[0]; record.identity = record.identity.replace('|authenticated|', '|administrator|'); record.fixtureKey = record.identity; record.findings.forEach((finding) => { finding.identity = record.identity; }); }, /identity mismatch.*missing=1 extra=1/],
    ['mutated owner', (inputs: ReconciliationInput[]) => { const source = dashboard(inputs); const record = source.artifact.records[0]; record.identity = record.identity.replace('|DashboardPage', '|dashboard-shift-status'); record.fixtureKey = record.identity; record.findings.forEach((finding) => { finding.identity = record.identity; }); }, /identity mismatch.*missing=1 extra=1/],
    ['non-GET/HEAD request', (inputs: ReconciliationInput[]) => { dashboard(inputs).artifact.records[0].network.push({ method: 'POST', url: '/api/forbidden', resourceType: 'fetch', classification: 'api' }); }, /non-GET\/HEAD/],
    ['ownerless FAIL', (inputs: ReconciliationInput[]) => { const finding = inputs.flatMap(({ artifact }) => artifact.records).flatMap(({ findings }) => findings).find(({ verdict }) => verdict === 'FAIL')!; delete finding.lowestOwner; }, /FAIL requires|ownerless FAIL/],
    ['guessed PASS', (inputs: ReconciliationInput[]) => { const finding = dashboard(inputs).artifact.records[0].findings.find(({ verdict }) => verdict === 'NEEDS_EVIDENCE')!; finding.verdict = 'PASS'; finding.measured = { productionRouteMeasured: true }; }, /guessed PASS/],
    ['generic adapter reason', (inputs: ReconciliationInput[]) => { const finding = dashboard(inputs).artifact.records.find(({ findings }) => findings[0].verdict === 'NEEDS_EVIDENCE')!.findings[0]; finding.measured.reason = 'production-state-adapter-not-yet-implemented'; }, /generic adapter reason/],
  ])('rejects %s', (_name, mutate, message) => {
    const inputs = cloneInputs(); mutate(inputs);
    expect(() => reconcilePhase28Baseline(inputs, 'test-commit')).toThrow(message);
  });

  it('rejects synthetic productionRouteMeasured on structural fallback', () => {
    const result = reconcilePhase28Baseline(loadInputs(), 'test-commit');
    const fallback = result.combined.records.find(({ identity }) => identity.includes('|mutation-in-flight|') && !result.productionEvidenceIdentities.has(identity))!;
    fallback.findings[0].measured = { productionRouteMeasured: true, reason: 'fabricated' };
    expect(() => validateCanonicalBaseline(result.combined.records, result.productionEvidenceIdentities)).toThrow(/synthetic productionRouteMeasured/);
  });

  it('rejects missing and duplicate canonical output identities', () => {
    const result = reconcilePhase28Baseline(loadInputs(), 'test-commit');
    const missing = result.combined.records.slice(1);
    expect(() => validateCanonicalBaseline(missing, result.productionEvidenceIdentities)).toThrow(/missing=1/);
    const duplicate = [...result.combined.records, result.combined.records[0]];
    expect(() => validateCanonicalBaseline(duplicate, result.productionEvidenceIdentities)).toThrow(/duplicate=1/);
  });
});
