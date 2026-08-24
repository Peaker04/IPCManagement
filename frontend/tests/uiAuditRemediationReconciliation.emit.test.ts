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

test('emits the immutable attempt manifest and selected run', async () => {
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
