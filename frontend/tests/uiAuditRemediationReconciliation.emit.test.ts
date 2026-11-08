import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { reconcileRemediationRuns, validateRecoveryAuthority, type RemediationRun } from './uiAuditRemediationReconciliation';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const emissionEnvironment = ['PHASE28_RECOVERY_AUTHORITY', 'PHASE28_RUN1', 'PHASE28_RUN2', 'PHASE28_ATTEMPT_MANIFEST', 'PHASE28_SELECTION'];
const emissionConfigured = emissionEnvironment.every((name) => Boolean(process.env[name]));

test('validates selected recovery authority during ordinary aggregate invocation', () => {
  const repositoryRoot = resolve(process.cwd(), '..');
  const authorityPath = resolve(repositoryRoot, '.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json');
  const authority = JSON.parse(readFileSync(authorityPath, 'utf8'));
  expect(() => validateRecoveryAuthority(authority, repositoryRoot)).not.toThrow();
  expect(authority).toMatchObject({ status: 'LOST_NO_BACKUP', restored: false, byteEqualityToLostArtifacts: false });
});

test('emits only under the explicit environment contract', async () => {
  expect([0, emissionEnvironment.length]).toContain(emissionEnvironment.filter((name) => Boolean(process.env[name])).length);
  if (!emissionConfigured) return;
  const repositoryRoot = resolve(process.cwd(), '..');
  const authority = JSON.parse(readFileSync(resolve(repositoryRoot, required('PHASE28_RECOVERY_AUTHORITY')), 'utf8'));
  validateRecoveryAuthority(authority, repositoryRoot);
  const run1 = JSON.parse(readFileSync(resolve(repositoryRoot, required('PHASE28_RUN1'), 'canonical-combined.json'), 'utf8')) as RemediationRun;
  const run2 = JSON.parse(readFileSync(resolve(repositoryRoot, required('PHASE28_RUN2'), 'canonical-combined.json'), 'utf8')) as RemediationRun;
  const result = reconcileRemediationRuns(run1, run2, { allowLegacyAdminRaw: true });
  const run1Bytes = `${JSON.stringify(run1, null, 2)}\n`;
  const output = { schemaVersion: 'phase28-remediation-attempt/v1', selected: 'run-2', run1Sha256: await sha256(run1Bytes), run2Sha256: result.canonicalSha256, ...result, legacyDisposition: { count: 112, status: 'NON_ACTIONABLE_RAW_RETAINED', authority: 'post-28-04 actionable-control and browser-computed contrast predicates' } };
  writeFileSync(resolve(repositoryRoot, required('PHASE28_ATTEMPT_MANIFEST')), `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(resolve(repositoryRoot, required('PHASE28_SELECTION')), `${JSON.stringify({ attemptManifest: required('PHASE28_ATTEMPT_MANIFEST'), selected: 'run-2', sha256: result.canonicalSha256 }, null, 2)}\n`, { flag: 'wx' });
  expect(result).toMatchObject({ identityCount: 2142, findingCount: 68544, actionableFailCount: 0, legacyAdminRawCount: 112 });
});
