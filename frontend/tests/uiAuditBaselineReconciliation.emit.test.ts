import { describe, expect, it } from 'vitest';
import { reconcilePhase28BaselineFromDisk } from './uiAuditBaselineReconciliation';

describe('Phase 28 baseline reconciliation artifact writer', () => {
  it('writes the canonical combined baseline and sealed manifest atomically', () => {
    const { manifest } = reconcilePhase28BaselineFromDisk();
    expect(manifest.sealStatus).toBe('SEALED');
    expect(manifest.identityCount).toBe(2142);
    console.log(JSON.stringify({ sealStatus: manifest.sealStatus, identityCount: manifest.identityCount, counts: manifest.counts, sealFingerprint: manifest.sealFingerprint }));
  });
});
