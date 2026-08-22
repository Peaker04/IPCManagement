import { describe, expect, it } from 'vitest';
import { validateCorrectionMarker, validateCorrectionResult } from './validatePhase271PlanResult';

const hash = 'a'.repeat(64);
const originalLineage = {
  marker: { path: '.planning/phases/x/evidence/terminal-markers/27.1-01.json', sha256: 'b2975e45e548896d7831a98083fc36d82f3e63a9d068c087482231e330fbcc02' },
  markerCommit: 'c52c80f8186b985d07619a7ad0ed7abc0572675c',
  matrix: { path: '.planning/phases/x/evidence/row-class-path-matrix.json', sha256: '15878b85b8a68d16df6582ed0ed279ab7fd1515e3cf8c3b285fed79837ae4ca2' },
};
const result = {
  schemaVersion: 1, phase: '27.1', planId: '27.1-01C', status: 'READY_TO_SEAL',
  summary: { path: '.planning/phases/x/27.1-01C-SUMMARY.md', sha256: hash }, mappingDeltaOnly: true,
  originalLineage, correctedMatrix: { path: '.planning/phases/x/evidence/corrected-authorization-matrix.json', sha256: hash },
  validator: { path: 'frontend/tests/validateVisualReconciliation.ts', sha256: hash, version: '27.1-01C' }, sourceSuiteRerun: false, blockers: [],
};
const marker = {
  schemaVersion: 1, phase: '27.1', planId: '27.1-01C', status: 'COMPLETE', summary: result.summary,
  payloadResult: { path: '.planning/phases/x/evidence/corrected-authorization-result.json', sha256: hash }, payloadCommit: 'b'.repeat(40),
  originalLineage, correctedMatrix: result.correctedMatrix, validator: result.validator,
};
const mutate = <T>(value: T): T => structuredClone(value);

describe('Phase 27.1 Plan 01C result validator', () => {
  it('accepts the closed mapping-only READY_TO_SEAL result', () => expect(() => validateCorrectionResult(result)).not.toThrow());
  it('rejects source rerun, relabeled plan, blockers and unknown fields', () => {
    for (const candidate of [
      Object.assign(mutate(result), { sourceSuiteRerun: true }),
      Object.assign(mutate(result), { planId: '27.1-01' }),
      Object.assign(mutate(result), { blockers: ['drift'] }),
      Object.assign(mutate(result), { commits: [] }),
    ]) expect(() => validateCorrectionResult(candidate)).toThrow();
  });
  it('accepts COMPLETE correction marker with dual lineage and payload commit', () => expect(() => validateCorrectionMarker(marker)).not.toThrow());
  it('rejects wrong old hash, lineage commit, validator pin and marker schema', () => {
    const cases = [mutate(marker), mutate(marker), mutate(marker), mutate(marker)];
    cases[0].originalLineage.marker.sha256 = hash;
    cases[1].originalLineage.markerCommit = 'd'.repeat(40);
    cases[2].validator.version = '27.1-01B';
    (cases[3] as unknown as Record<string, unknown>).markerCommit = 'self-reference-forbidden';
    for (const candidate of cases) expect(() => validateCorrectionMarker(candidate)).toThrow();
  });
});
