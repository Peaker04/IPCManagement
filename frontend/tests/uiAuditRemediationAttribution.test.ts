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
const baselinePath = resolve(frontendRoot, 'test-results/ui-audit-phase28-baseline/canonical-combined.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;

export const remediationGroupKey = (finding: Finding) => {
  const [route, region, state, , viewport] = finding.identity.split('|');
  return [finding.ruleId, route, region, state, viewport, finding.lowestOwner, finding.actual].join('|');
};

export const sealedFailFindings = (source: Baseline = baseline) => source.records
  .flatMap(({ findings }) => findings)
  .filter((finding) => finding.verdict === 'FAIL');

describe('Phase 28 sealed remediation attribution', () => {
  it('groups every owner-bearing FAIL without admitting NEEDS_EVIDENCE', () => {
    const failures = sealedFailFindings();
    const groups = new Map<string, Finding[]>();

    for (const finding of failures) {
      expect(finding.lowestOwner).toBeTruthy();
      const key = remediationGroupKey(finding);
      groups.set(key, [...(groups.get(key) ?? []), finding]);
    }

    expect(baseline.inventoryIdentityCount).toBe(2_142);
    expect(baseline.findingCountPerIdentity).toBe(32);
    expect(baseline.counts.verdictTotals).toEqual({
      PASS: 4_763,
      FAIL: 1_453,
      NOT_APPLICABLE: 15_120,
      NEEDS_EVIDENCE: 47_208,
      UNRESOLVED: 0,
    });
    expect(failures).toHaveLength(1_453);
    expect([...groups.values()].flat()).toHaveLength(1_453);
    expect([...groups.values()].flat().every((finding) => finding.verdict === 'FAIL')).toBe(true);
  });

  it('preserves every authorization field in its exact group member', () => {
    for (const finding of sealedFailFindings()) {
      expect(finding).toMatchObject({
        ruleId: expect.any(String),
        identity: expect.stringMatching(/^([^|]+\|){5}[^|]+$/),
        expected: expect.any(String),
        actual: expect.any(String),
        severity: expect.any(String),
        lowestOwner: expect.any(String),
      });
    }
  });

  it('keeps the sealed files byte-identical before consuming findings', () => {
    const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    expect(sha256(resolve(frontendRoot, 'test-results/ui-audit-phase28-baseline/manifest.json')))
      .toBe('a0dcb1d2ea24a6ff562510d6f1dc1af3204480f1607e870ea2fa3214ac648c51');
    expect(sha256(baselinePath)).toBe('b72c9a17e783c11ce49d6ec5e232afd5d6be5440abac95972fb6711c7ae05a5a');
    expect(sha256(resolve(frontendRoot, '../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-PLAN.md')))
      .toBe('eef897ba23cb5be8ac3ee019c11acd9ebf9ce8ad3e1850f5f7b769cdc426200d');
    expect(sha256(resolve(frontendRoot, '../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-01-SUMMARY.md')))
      .toBe('fd7e45d65c1b503c121d0cba14bfee597181f4c7edd235c3b2341fa233a9d342');
  });
});
