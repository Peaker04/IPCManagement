import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Finding = {
  ruleId: string;
  identity: string;
  verdict: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NEEDS_EVIDENCE' | 'UNRESOLVED';
  expected?: string;
  actual?: string;
  severity?: string;
  lowestOwner?: string;
};

type Baseline = {
  inventoryIdentityCount: number;
  findingCountPerIdentity: number;
  counts: { verdictTotals: Record<string, number> };
  records: Array<{ identity: string; findings: Finding[] }>;
};

const frontendRoot = resolve(__dirname, '..');
const recoveryAuthorityPath = resolve(frontendRoot, '../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json');

export const remediationGroupKey = (finding: Finding) => {
  const [route, region, state, , viewport] = finding.identity.split('|');
  return [finding.ruleId, route, region, state, viewport, finding.lowestOwner, finding.actual].join('|');
};

export const sealedFailFindings = (source: Baseline) => source.records
  .flatMap(({ findings }) => findings)
  .filter((finding) => finding.verdict === 'FAIL');

describe('Phase 28 sealed remediation attribution', () => {
  it('records the old sealed bytes as lost rather than consuming them', () => {
    const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const recovery = JSON.parse(readFileSync(recoveryAuthorityPath, 'utf8')) as {
      status: string;
      restored: boolean;
      byteEqualityToLostArtifacts: boolean;
      historicalExpectedArtifacts: Record<string, { sha256: string; status: string }>;
    };
    expect(recovery).toMatchObject({ status: 'LOST_NO_BACKUP', restored: false, byteEqualityToLostArtifacts: false });
    expect(recovery.historicalExpectedArtifacts['manifest.json']).toEqual({ sha256: 'a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51', status: 'LOST_NO_BACKUP' });
    expect(recovery.historicalExpectedArtifacts['canonical-combined.json']).toEqual({ sha256: 'b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a', status: 'LOST_NO_BACKUP' });
    expect(sha256(resolve(frontendRoot, '../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-PLAN.md')))
      .toBe('eef897ba23cb5be8ac3ee019c11acd9ebf9ce8ad3e1850f5f7b769cdc426200d');
    expect(sha256(resolve(frontendRoot, '../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-SUMMARY.md')))
      .toBe('fd7e45d65c1b503c121d0cba14bfee597181f4c7edd235c3b2341fa233a9d342');
  });
});
