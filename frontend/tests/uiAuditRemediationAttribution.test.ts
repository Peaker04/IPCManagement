import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

type Verdict = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NEEDS_EVIDENCE' | 'UNRESOLVED';

type Finding = {
  ruleId: string;
  identity: string;
  verdict: Verdict;
  expected?: string;
  actual?: string;
  severity?: string;
  lowestOwner?: string;
};

type Baseline = {
  inventoryIdentityCount: number;
  findingCountPerIdentity: number;
  counts: { verdictTotals: Record<Verdict, number> };
  records: Array<{ identity: string; findings: Finding[] }>;
};

type RecoveryAuthority = {
  status: string;
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
    counts: {
      identityCount: number;
      ruleCount: number;
      findingCount: number;
      verdictTotals: Record<Verdict, number>;
    };
    networkProof: { allowed: string[]; observed: string[]; requestCount: number; sha256: string };
    members: Record<string, string>;
  };
};

const frontendRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(frontendRoot, '..');
const recoveryAuthorityPath = resolve(repositoryRoot, '.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json');
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const isWithin = (parent: string, child: string) => {
  const candidate = relative(parent, child);
  return candidate === '' || (!candidate.startsWith(`..${sep}`) && candidate !== '..' && !isAbsolute(candidate));
};

export const remediationGroupKey = (finding: Finding) => {
  const [route, region, state, , viewport] = finding.identity.split('|');
  return [finding.ruleId, route, region, state, viewport, finding.lowestOwner, finding.actual].join('|');
};

export const sealedFailFindings = (source: Baseline) => source.records
  .flatMap(({ findings }) => findings)
  .filter((finding) => finding.verdict === 'FAIL');

const loadPinnedRecovery = () => {
  const authority = JSON.parse(readFileSync(recoveryAuthorityPath, 'utf8')) as RecoveryAuthority;
  expect(authority).toMatchObject({ status: 'LOST_NO_BACKUP', restored: false, byteEqualityToLostArtifacts: false });
  expect(authority.historicalExpectedArtifacts['manifest.json']).toEqual({
    sha256: 'a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51',
    status: 'LOST_NO_BACKUP',
  });
  expect(authority.historicalExpectedArtifacts['canonical-combined.json']).toEqual({
    sha256: 'b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a',
    status: 'LOST_NO_BACKUP',
  });

  const selected = authority.selectedRecovery;
  expect(selected.status).toBe('IMMUTABLE_COMPLETE');
  expect(selected.attempt).toMatch(/^attempt-[1-9]\d*$/);
  const root = resolve(repositoryRoot, selected.root);
  const configuredOutput = realpathSync(resolve(repositoryRoot, authority.recoveryContract.configuredPlaywrightOutput));
  expect(existsSync(root)).toBe(true);
  expect(lstatSync(root).isSymbolicLink()).toBe(false);
  expect(isWithin(configuredOutput, root)).toBe(false);
  expect(isWithin(root, configuredOutput)).toBe(false);

  for (const [member, expectedHash] of Object.entries(selected.members)) {
    const memberPath = resolve(root, member);
    expect(isWithin(root, memberPath)).toBe(true);
    expect(sha256(memberPath), member).toBe(expectedHash);
  }

  const networkProofPath = resolve(root, 'evidence/network-method-proof.json');
  const networkProof = JSON.parse(readFileSync(networkProofPath, 'utf8')) as { observed: string[]; requestCount: number };
  expect(sha256(networkProofPath)).toBe(selected.networkProof.sha256);
  expect(networkProof.requestCount).toBe(selected.networkProof.requestCount);
  expect(networkProof.observed.every((method) => authority.recoveryContract.allowedNetworkMethods.includes(method))).toBe(true);

  const baseline = JSON.parse(readFileSync(resolve(root, 'evidence/canonical-combined.json'), 'utf8')) as Baseline;
  expect(selected.counts).toMatchObject({
    identityCount: authority.recoveryContract.requiredIdentityCount,
    ruleCount: authority.recoveryContract.requiredRuleCount,
    findingCount: authority.recoveryContract.requiredFindingCount,
  });
  expect(baseline.inventoryIdentityCount).toBe(selected.counts.identityCount);
  expect(baseline.findingCountPerIdentity).toBe(selected.counts.ruleCount);
  expect(baseline.counts.verdictTotals).toEqual(selected.counts.verdictTotals);

  return { authority, baseline };
};

const dashboardAuthorizedContrastIdentities = [
  '/|dashboard-shift-status|error-no-data|authenticated|320x900|DashboardPage',
  '/|dashboard-shift-status|populated|authenticated|1440x900|DashboardPage',
  '/|dashboard-shift-status|truly-empty|authenticated|320x900@200%|DashboardPage',
  '/|dashboard-shift-status|truly-empty|authenticated|320x900|DashboardPage',
  '/|dashboard-workflow-exceptions|no-results|authenticated|320x900|DashboardPage',
  '/|dashboard-workflow-exceptions|populated|authenticated|1440x900|DashboardPage',
] as const;

const dashboardPlanOnlyIdentity = '/|dashboard-workflow-exceptions|populated|authenticated|1920x1080|DashboardPage';

describe('Phase 28 sealed remediation attribution', () => {
  it('validates immutable attempt/member hashes and historical loss before consuming findings', () => {
    const { authority } = loadPinnedRecovery();
    expect(sha256(resolve(repositoryRoot, authority.immutableHistoricalAuthority.planPath))).toBe('eef897ba23cb5be8ac3ee019c11acd9ebf9ce8ad3e1850f5f7b769cdc426200d');
    expect(sha256(resolve(repositoryRoot, authority.immutableHistoricalAuthority.summaryPath))).toBe('fd7e45d65c1b503c121d0cba14bfee597181f4c7edd235c3b2341fa233a9d342');
  });

  it('losslessly groups every recovered owner-bearing FAIL and excludes NEEDS_EVIDENCE', () => {
    const { authority, baseline } = loadPinnedRecovery();
    const failures = sealedFailFindings(baseline);
    const needsEvidence = baseline.records.flatMap(({ findings }) => findings).filter(({ verdict }) => verdict === 'NEEDS_EVIDENCE');
    const groups = new Map<string, Finding[]>();

    for (const finding of failures) {
      expect(finding).toMatchObject({
        ruleId: expect.any(String),
        identity: expect.stringMatching(/^([^|]+\|){5}[^|]+$/),
        expected: expect.any(String),
        actual: expect.any(String),
        severity: expect.any(String),
        lowestOwner: expect.any(String),
      });
      const key = remediationGroupKey(finding);
      groups.set(key, [...(groups.get(key) ?? []), finding]);
    }

    expect(failures).toHaveLength(authority.selectedRecovery.counts.verdictTotals.FAIL);
    expect([...groups.values()].flat()).toHaveLength(failures.length);
    expect([...groups.values()].flat().every(({ verdict }) => verdict === 'FAIL')).toBe(true);
    expect(needsEvidence).toHaveLength(47_208);
    expect(needsEvidence.every(({ verdict }) => verdict === 'NEEDS_EVIDENCE')).toBe(true);
  });

  it('pins every declared Dashboard contrast identity to its route owner', () => {
    const { baseline } = loadPinnedRecovery();
    const dashboardContrastFailures = sealedFailFindings(baseline).filter(({ ruleId, identity }) =>
      ruleId === 'A11Y-01' && dashboardAuthorizedContrastIdentities.includes(identity as typeof dashboardAuthorizedContrastIdentities[number]));

    expect(dashboardContrastFailures.map(({ identity }) => identity).sort())
      .toEqual([...dashboardAuthorizedContrastIdentities].sort());
    expect(dashboardContrastFailures.every(({ lowestOwner, actual }) =>
      lowestOwner === 'DashboardPage' && actual?.includes('color-contrast'))).toBe(true);
    expect(sealedFailFindings(baseline).some(({ ruleId, identity }) =>
      ruleId === 'A11Y-01' && identity === dashboardPlanOnlyIdentity)).toBe(false);
  });

  it('keeps duplicate headings as owner-bearing measured HIER-01 failures', () => {
    const { baseline } = loadPinnedRecovery();
    const duplicateHeadingFailures = sealedFailFindings(baseline).filter((finding) => {
      if (finding.ruleId !== 'HIER-01') return false;
      try {
        return (JSON.parse(finding.actual ?? '{}') as { h1Count?: number }).h1Count !== 1;
      } catch {
        return false;
      }
    });
    expect(duplicateHeadingFailures.length).toBeGreaterThan(0);
    expect(duplicateHeadingFailures.every((finding) => finding.expected && finding.actual && finding.lowestOwner)).toBe(true);
  });
});
