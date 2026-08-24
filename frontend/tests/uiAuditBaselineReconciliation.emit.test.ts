import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reconcilePhase28BaselineFromDisk } from './uiAuditBaselineReconciliation';

describe('Phase 28 baseline reconciliation artifact writer', () => {
  it('writes the canonical combined baseline and sealed manifest atomically from selected recovered authority', () => {
    const repositoryRoot = resolve(process.cwd(), '..');
    const evidenceRoot = resolve(repositoryRoot, '.artifacts/phase28-ui-audit/baseline-recovery/attempt-3/evidence');
    const outputRoot = mkdtempSync(resolve(tmpdir(), 'phase28-baseline-emission-'));
    try {
      const { manifest } = reconcilePhase28BaselineFromDisk(process.cwd(), evidenceRoot, outputRoot);
      expect(manifest.sealStatus).toBe('SEALED');
      expect(manifest.identityCount).toBe(2142);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});
