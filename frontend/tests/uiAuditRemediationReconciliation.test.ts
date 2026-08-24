import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import authoritySource from '../../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json?raw';
import handoffSource from '../../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-05-ADMIN-RESIDUAL-HANDOFF.json?raw';
import adminHarnessSource from './admin-data-production-query.spec.ts?raw';
import axeSource from './uiAuditAxe.ts?raw';
import { reconcileRemediationRuns, validateRecoveryAuthority, type RemediationRun } from './uiAuditRemediationReconciliation';

const baseline = JSON.parse(readFileSync(resolve(process.cwd(), '../.artifacts/phase28-ui-audit/baseline-recovery/attempt-3/evidence/canonical-combined.json'), 'utf8')) as RemediationRun;
const clone = () => structuredClone(baseline);

describe('Phase 28 remediation reconciliation', () => {
  it('validates immutable recovery authority and source-aware legacy disposition authority', () => {
    expect(() => validateRecoveryAuthority(JSON.parse(authoritySource), resolve(process.cwd(), '..'))).not.toThrow();
    expect(JSON.parse(handoffSource)).toMatchObject({ count: 152, sha256: '55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3' });
    expect(adminHarnessSource).toContain("getAttribute('aria-hidden') !== 'true'");
    expect(adminHarnessSource).toMatch(/tabIndex\s*!==?\s*-1/);
    expect(adminHarnessSource).toContain('.labels');
    expect(adminHarnessSource).toContain('seriousViolationsWithBrowserPlaceholderEvidence');
    expect(axeSource).toContain("getComputedStyle(element, '::placeholder').color");
  });

  it('accepts exact stable closure and rejects promotion, drift, writes, and actionable failure', () => {
    const run1 = clone();
    const run2 = clone();
    for (const run of [run1, run2]) for (const record of run.records) for (const finding of record.findings) if (finding.verdict === 'FAIL') finding.verdict = 'PASS';
    const result = reconcileRemediationRuns(run1, run2, { allowLegacyAdminRaw: false });
    expect(result.totals).toEqual({ PASS: 6216, FAIL: 0, NOT_APPLICABLE: 15120, NEEDS_EVIDENCE: 47208, UNRESOLVED: 0 });
    expect(result.identityCount).toBe(2142);
    expect(result.findingCount).toBe(68544);

    const promoted = structuredClone(run2);
    promoted.records.flatMap(({ findings }) => findings).find(({ verdict }) => verdict === 'NEEDS_EVIDENCE')!.verdict = 'PASS';
    expect(() => reconcileRemediationRuns(run1, promoted, { allowLegacyAdminRaw: false })).toThrow(/NEEDS_EVIDENCE promotion|run mismatch/);

    const write = structuredClone(run2);
    write.records[0].network.push({ method: 'POST', url: '/api/write', resourceType: 'fetch', classification: 'api' });
    expect(() => reconcileRemediationRuns(run1, write, { allowLegacyAdminRaw: false })).toThrow(/non-read-only/);

    const failure = structuredClone(run2);
    failure.records[0].findings[0].verdict = 'FAIL';
    failure.records[0].findings[0].lowestOwner = 'ProductionOwner';
    expect(() => reconcileRemediationRuns(run1, failure, { allowLegacyAdminRaw: false })).toThrow(/actionable FAIL/);
  });
});
