import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

type RemediationDelta = {
  identity: string;
  ruleId: string;
  sourceVerdict: string;
  beforeVerdict: string;
  afterVerdict: string;
  lowestOwner: string;
  productionPaths: string[];
};

type RecoveryAuthority = {
  status: string;
  deletionCause: string;
  restored: boolean;
  byteEqualityToLostArtifacts: boolean;
  historicalExpectedArtifacts: Record<string, { sha256: string; status: string }>;
  immutableHistoricalAuthority: {
    planPath: string;
    planSha256: string;
    summaryPath: string;
    summarySha256: string;
  };
  recoveryContract: {
    parent: string;
    configuredPlaywrightOutput: string;
    requiredIdentityParts: number;
    requiredRuleCount: number;
    requiredIdentityCount: number;
    requiredFindingCount: number;
    allowedNetworkMethods: string[];
  };
  selectedRecovery: {
    attempt: string;
    root: string;
    status: string;
    schemaVersion: string;
    counts: {
      identityCount: number;
      ruleCount: number;
      findingCount: number;
      verdictTotals: Record<string, number>;
    };
    networkProof: { allowed: string[]; observed: string[]; requestCount: number; sha256: string };
    members: Record<string, string>;
  } | null;
  redExecution: { commit: string; status: string };
};

const forbiddenPaths = [
  /ui-audit-phase28-baseline/,
  /(?:^|\/)__?snapshots?__?\//,
  /route-budgets\.json$/,
  /backend\//,
  /migrations?\//i,
  /shared\/api\/contracts\//,
];

const repositoryRoot = resolve(__dirname, '../..');
const authorityPath = resolve(repositoryRoot, '.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json');
const authority = JSON.parse(readFileSync(authorityPath, 'utf8')) as RecoveryAuthority;
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

const isWithin = (parent: string, child: string) => {
  const candidate = relative(parent, child);
  return candidate === '' || (!candidate.startsWith(`..${sep}`) && candidate !== '..' && !isAbsolute(candidate));
};

export function validateRecoveryAttemptRoot(input: {
  repositoryRoot: string;
  configuredOutput: string;
  recoveryParent: string;
  attemptName: string;
}) {
  if (!/^attempt-[1-9]\d*$/.test(input.attemptName)) throw new Error('attempt name must be attempt-N');
  const repository = realpathSync(input.repositoryRoot);
  const output = realpathSync(resolve(repository, input.configuredOutput));
  const parent = resolve(repository, input.recoveryParent);
  if (!existsSync(parent)) throw new Error('recovery parent must exist before canonicalization');
  if (lstatSync(parent).isSymbolicLink()) throw new Error('recovery parent cannot be a symlink');
  const canonicalParent = realpathSync(parent);
  if (!isWithin(repository, canonicalParent)) throw new Error('recovery parent escapes repository');
  if (isWithin(output, canonicalParent) || isWithin(canonicalParent, output)) throw new Error('recovery and Playwright output must be disjoint');
  const attemptRoot = resolve(canonicalParent, input.attemptName);
  if (!isWithin(canonicalParent, attemptRoot)) throw new Error('attempt path traversal is forbidden');
  if (existsSync(attemptRoot)) throw new Error('attempt root must be absent');
  return { repository, output, canonicalParent, attemptRoot };
}

export function validatePinnedRecovery(candidate: RecoveryAuthority) {
  const selected = candidate.selectedRecovery;
  if (!selected || selected.status !== 'IMMUTABLE_COMPLETE') throw new Error('selected immutable recovery is required');
  if (selected.attempt !== selected.root.split('/').at(-1) || !/^attempt-[1-9]\d*$/.test(selected.attempt)) throw new Error('selected recovery root mismatch');
  const root = resolve(repositoryRoot, selected.root);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) throw new Error('selected recovery root is missing or unsafe');
  if (selected.counts.identityCount !== candidate.recoveryContract.requiredIdentityCount
    || selected.counts.ruleCount !== candidate.recoveryContract.requiredRuleCount
    || selected.counts.findingCount !== candidate.recoveryContract.requiredFindingCount) throw new Error('selected recovery scope drift');
  for (const [member, expectedHash] of Object.entries(selected.members)) {
    const memberPath = resolve(root, member);
    if (!isWithin(root, memberPath) || !existsSync(memberPath) || sha256(memberPath) !== expectedHash) throw new Error(`selected recovery member drift: ${member}`);
  }
  const proof = JSON.parse(readFileSync(resolve(root, 'evidence/network-method-proof.json'), 'utf8')) as { allowed: string[]; observed: string[]; requestCount: number };
  if (sha256(resolve(root, 'evidence/network-method-proof.json')) !== selected.networkProof.sha256
    || proof.requestCount !== selected.networkProof.requestCount
    || proof.observed.some((method) => !candidate.recoveryContract.allowedNetworkMethods.includes(method))) throw new Error('network proof drift');
  return selected;
}

export function validateRemediationDelta(delta: RemediationDelta) {
  if (delta.identity.split('|').length !== 6) throw new Error('baseline identity must remain six-part');
  if (!delta.lowestOwner) throw new Error('remediation owner is required');
  if (delta.sourceVerdict !== 'FAIL' || delta.beforeVerdict !== 'FAIL') throw new Error('only sealed FAIL authorizes remediation');
  if (delta.afterVerdict !== 'PASS') throw new Error('remediation must record the fresh after verdict');
  if (!delta.productionPaths.length || delta.productionPaths.some((path) => forbiddenPaths.some((pattern) => pattern.test(path)))) {
    throw new Error('production path is outside the remediation boundary');
  }
  return delta;
}

describe('Phase 28 remediation delta contract', () => {
  const valid: RemediationDelta = {
    identity: '/login|login-form|populated|anonymous|1440x900|login-form',
    ruleId: 'HIER-01',
    sourceVerdict: 'FAIL',
    beforeVerdict: 'FAIL',
    afterVerdict: 'PASS',
    lowestOwner: 'LoginPage',
    productionPaths: ['frontend/src/features/auth/pages/LoginPage.tsx'],
  };

  it('accepts a separate owner-bearing FAIL-to-PASS record', () => {
    expect(validateRemediationDelta(valid)).toEqual(valid);
  });

  it.each(['NEEDS_EVIDENCE', 'PASS', 'NOT_APPLICABLE', 'UNRESOLVED'])(
    'rejects %s as remediation authority',
    (sourceVerdict) => expect(() => validateRemediationDelta({ ...valid, sourceVerdict })).toThrow(/only sealed FAIL/),
  );

  it.each([
    'frontend/test-results/ui-audit-phase28-baseline/manifest.json',
    'frontend/tests/__snapshots__/page.snap',
    'frontend/route-budgets.json',
    'backend/src/Api.cs',
    'backend/Migrations/20260824_Change.cs',
    'frontend/src/shared/api/contracts/schema.ts',
  ])('rejects forbidden production path %s', (path) => {
    expect(() => validateRemediationDelta({ ...valid, productionPaths: [path] })).toThrow(/outside/);
  });
});

describe('Phase 28 baseline recovery authority', () => {
  it('preserves loss truth and immutable historical bytes', () => {
    expect(authority).toMatchObject({
      status: 'LOST_NO_BACKUP',
      deletionCause: 'PLAYWRIGHT_CONFIGURED_OUTPUT_CLEANUP',
      restored: false,
      byteEqualityToLostArtifacts: false,
      historicalExpectedArtifacts: {
        'manifest.json': { sha256: 'a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51', status: 'LOST_NO_BACKUP' },
        'canonical-combined.json': { sha256: 'b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a', status: 'LOST_NO_BACKUP' },
      },
    });
    expect(sha256(resolve(repositoryRoot, authority.immutableHistoricalAuthority.planPath))).toBe(authority.immutableHistoricalAuthority.planSha256);
    expect(sha256(resolve(repositoryRoot, authority.immutableHistoricalAuthority.summaryPath))).toBe(authority.immutableHistoricalAuthority.summarySha256);
  });

  it('accepts only a new canonical attempt root disjoint from Playwright cleanup', () => {
    const result = validateRecoveryAttemptRoot({
      repositoryRoot,
      configuredOutput: authority.recoveryContract.configuredPlaywrightOutput,
      recoveryParent: authority.recoveryContract.parent,
      attemptName: 'attempt-4',
    });
    expect(result.attemptRoot).toBe(resolve(result.canonicalParent, 'attempt-4'));
  });

  it('consumes only the complete hash-pinned recovery while preserving RED history', () => {
    expect(validatePinnedRecovery(authority)).toBe(authority.selectedRecovery);
    expect(authority.redExecution).toEqual({ commit: 'a8a4a9dc', status: 'RED_RECONCILED_NOT_COMPLETE' });
  });

  it('rejects missing authority, unpinned scope, hash drift, and lost-byte substitution', () => {
    expect(() => validatePinnedRecovery({ ...authority, selectedRecovery: null })).toThrow(/required/);
    expect(() => validatePinnedRecovery({ ...authority, selectedRecovery: { ...authority.selectedRecovery!, counts: { ...authority.selectedRecovery!.counts, identityCount: 2141 } } })).toThrow(/scope drift/);
    expect(() => validatePinnedRecovery({ ...authority, selectedRecovery: { ...authority.selectedRecovery!, members: { ...authority.selectedRecovery!.members, 'evidence/manifest.json': '0'.repeat(64) } } })).toThrow(/member drift/);
    expect(() => validatePinnedRecovery({ ...authority, selectedRecovery: { ...authority.selectedRecovery!, members: { ...authority.selectedRecovery!.members, 'evidence/manifest.json': authority.historicalExpectedArtifacts['manifest.json'].sha256 } } })).toThrow(/member drift/);
  });

  it.each(['../attempt-1', 'attempt-0', 'attempt-current', 'attempt-1/child'])('rejects unsafe attempt name %s', (attemptName) => {
    expect(() => validateRecoveryAttemptRoot({ repositoryRoot, configuredOutput: 'frontend/test-results', recoveryParent: '.artifacts/phase28-ui-audit/baseline-recovery', attemptName })).toThrow();
  });
});
