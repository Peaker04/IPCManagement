import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UiAuditRecord, UiAuditVerdict } from './uiAuditContract';

export type RemediationRun = { schemaVersion: string; inventoryIdentityCount: number; findingCountPerIdentity: number; records: UiAuditRecord[] };
type Authority = { status: string; restored: boolean; historicalExpectedArtifacts: Record<string, { sha256: string; status: string }>; immutableHistoricalAuthority: { planPath: string; planSha256: string; summaryPath: string; summarySha256: string }; selectedRecovery: { root: string; members: Record<string, string>; counts: { identityCount: number; ruleCount: number; findingCount: number; needsEvidenceIdentityCount: number; verdictTotals: Record<UiAuditVerdict, number> } } };
type Options = { allowLegacyAdminRaw: boolean };

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hashFile = (path: string) => sha256(readFileSync(path));

export function validateRecoveryAuthority(authority: Authority, repositoryRoot: string) {
  if (authority.status !== 'LOST_NO_BACKUP' || authority.restored !== false) throw new Error('historical loss authority drift');
  for (const [name, expected] of Object.entries({ 'manifest.json': 'a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51', 'canonical-combined.json': 'b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a' })) {
    const fact = authority.historicalExpectedArtifacts[name];
    if (fact?.status !== 'LOST_NO_BACKUP' || fact.sha256 !== expected) throw new Error(`historical ${name} truth drift`);
  }
  const immutable = authority.immutableHistoricalAuthority;
  for (const [path, expected] of [[immutable.planPath, immutable.planSha256], [immutable.summaryPath, immutable.summarySha256]] as const) {
    if (hashFile(resolve(repositoryRoot, path)) !== expected) throw new Error(`immutable historical document hash drift: ${path}`);
    if (execFileSync('git', ['diff', '--', path], { cwd: repositoryRoot, encoding: 'utf8' }).trim()) throw new Error(`immutable historical document has Git diff: ${path}`);
  }
  for (const [member, expected] of Object.entries(authority.selectedRecovery.members)) {
    const path = resolve(repositoryRoot, authority.selectedRecovery.root, member);
    if (!existsSync(path) || hashFile(path) !== expected) throw new Error(`selected recovery member drift: ${member}`);
  }
  const counts = authority.selectedRecovery.counts;
  if (counts.identityCount !== 2142 || counts.ruleCount !== 32 || counts.findingCount !== 68544 || counts.needsEvidenceIdentityCount !== 770 || counts.verdictTotals.NEEDS_EVIDENCE !== 47208 || counts.verdictTotals.UNRESOLVED !== 0) throw new Error('selected recovery count drift');
}

const legacyAdminRaw = (record: UiAuditRecord, ruleId: string) => record.identity.startsWith('/admin-data|') && record.identity.endsWith('|AdminDataPage') && (ruleId === 'HIER-02' || ruleId === 'A11Y-01');

export function reconcileRemediationRuns(run1: RemediationRun, run2: RemediationRun, options: Options) {
  for (const [name, run] of [['run-1', run1], ['run-2', run2]] as const) {
    if (run.inventoryIdentityCount !== 2142 || run.findingCountPerIdentity !== 32 || run.records.length !== 2142) throw new Error(`${name} identity/count drift`);
    const identities = run.records.map(({ identity }) => identity);
    if (new Set(identities).size !== 2142 || identities.some((identity) => identity.split('|').length !== 6)) throw new Error(`${name} six-part identity drift`);
    for (const record of run.records) {
      if (record.findings.length !== 32 || new Set(record.findings.map(({ ruleId }) => ruleId)).size !== 32) throw new Error(`${name} rule drift for ${record.identity}`);
      if (record.network.some(({ method }) => !['GET', 'HEAD'].includes(method))) throw new Error(`${name} non-read-only network request`);
    }
  }
  if (JSON.stringify(run1) !== JSON.stringify(run2)) throw new Error('run mismatch');
  const totals = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0, NEEDS_EVIDENCE: 0, UNRESOLVED: 0 } as Record<UiAuditVerdict, number>;
  let legacyRawCount = 0;
  for (const record of run2.records) for (const finding of record.findings) {
    totals[finding.verdict]++;
    if (finding.verdict === 'FAIL' && options.allowLegacyAdminRaw && legacyAdminRaw(record, finding.ruleId)) legacyRawCount++;
    else if (finding.verdict === 'FAIL') throw new Error(`actionable FAIL: ${finding.identity} ${finding.ruleId}`);
    if (finding.verdict === 'UNRESOLVED') throw new Error(`UNRESOLVED: ${finding.identity} ${finding.ruleId}`);
  }
  if (totals.NEEDS_EVIDENCE !== 47208) throw new Error('NEEDS_EVIDENCE promotion or drift');
  if (legacyRawCount !== (options.allowLegacyAdminRaw ? 112 : 0)) throw new Error(`legacy Admin raw disposition drift: ${legacyRawCount}`);
  return { identityCount: 2142, findingCount: 68544, totals, actionableFailCount: totals.FAIL - legacyRawCount, legacyAdminRawCount: legacyRawCount, canonicalSha256: sha256(`${JSON.stringify(run2, null, 2)}\n`) };
}

if (process.argv[1]?.endsWith('uiAuditRemediationReconciliation.ts') && process.argv.includes('--run1')) {
  const value = (flag: string) => { const index = process.argv.indexOf(flag); if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${flag}`); return process.argv[index + 1]; };
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const authority = JSON.parse(readFileSync(resolve(repositoryRoot, value('--recovery-authority')), 'utf8')) as Authority;
  validateRecoveryAuthority(authority, repositoryRoot);
  const run1 = JSON.parse(readFileSync(resolve(repositoryRoot, value('--run1'), 'canonical-combined.json'), 'utf8')) as RemediationRun;
  const run2 = JSON.parse(readFileSync(resolve(repositoryRoot, value('--run2'), 'canonical-combined.json'), 'utf8')) as RemediationRun;
  const result = reconcileRemediationRuns(run1, run2, { allowLegacyAdminRaw: true });
  const output = { schemaVersion: 'phase28-remediation-attempt/v1', selected: 'run-2', run1Sha256: sha256(`${JSON.stringify(run1, null, 2)}\n`), run2Sha256: result.canonicalSha256, ...result, legacyDisposition: { count: 112, status: 'NON_ACTIONABLE_RAW_RETAINED', authority: 'post-28-04 actionable-control and browser-computed contrast predicates' } };
  writeFileSync(resolve(repositoryRoot, value('--attempt-manifest')), `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(resolve(repositoryRoot, value('--write-selection')), `${JSON.stringify({ attemptManifest: value('--attempt-manifest'), selected: 'run-2', sha256: result.canonicalSha256 }, null, 2)}\n`);
  console.log(JSON.stringify(output));
}
