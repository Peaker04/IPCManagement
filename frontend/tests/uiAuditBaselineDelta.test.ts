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
  };
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
      attemptName: 'attempt-1',
    });
    expect(result.attemptRoot).toBe(resolve(result.canonicalParent, 'attempt-1'));
  });

  it.each(['../attempt-1', 'attempt-0', 'attempt-current', 'attempt-1/child'])('rejects unsafe attempt name %s', (attemptName) => {
    expect(() => validateRecoveryAttemptRoot({ repositoryRoot, configuredOutput: 'frontend/test-results', recoveryParent: '.artifacts/phase28-ui-audit/baseline-recovery', attemptName })).toThrow();
  });
});
