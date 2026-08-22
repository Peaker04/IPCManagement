import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAuthorizationMatrix, assertAuthorizedPath, type AuthorizationMatrix } from './validateVisualReconciliation';

const evidence = resolve('../.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence');
const load = <T>(name: string): T => JSON.parse(readFileSync(resolve(evidence, name), 'utf8'));
const inventory = load<{ failures: unknown[] }>('failure-inventory.json');
const matrix = load<AuthorizationMatrix>('corrected-authorization-matrix.json');
const clone = <T>(value: T): T => structuredClone(value);

function rejects(mutator: (candidate: AuthorizationMatrix) => void, message?: RegExp) {
  const candidate = clone(matrix);
  mutator(candidate);
  expect(() => assertAuthorizationMatrix(candidate, inventory.failures)).toThrow(message);
}

describe('Phase 27.1 corrected authorization matrix', () => {
  it('accepts exact 21 identity closure and its disjoint named partition', () => {
    expect(() => assertAuthorizationMatrix(matrix, inventory.failures)).not.toThrow();
    expect(matrix.entries).toHaveLength(21);
    expect(Object.values(matrix.identitySets).flat()).toHaveLength(21);
  });

  it('treats display ordinal as non-authoritative while rejecting source reorder', () => {
    const displayOnly = clone(matrix);
    displayOnly.entries.forEach((entry, index) => { entry.displayOrdinal = 100 - index; });
    expect(() => assertAuthorizationMatrix(displayOnly, inventory.failures)).not.toThrow();
    rejects((candidate) => { [candidate.entries[0], candidate.entries[1]] = [candidate.entries[1], candidate.entries[0]]; }, /order/);
  });

  it.each(['project', 'normalizedSpecPath', 'canonicalTitle', 'snapshotName'] as const)('rejects substituted %s identity', (field) => {
    rejects((candidate) => { candidate.entries[0][field] += '-substituted'; }, /substituted/);
  });

  it('rejects duplicate, missing, extra identities and viewport mismatch', () => {
    rejects((candidate) => { candidate.entries[1] = clone(candidate.entries[0]); }, /duplicate|substituted/);
    rejects((candidate) => { candidate.entries.pop(); }, /exactly 21/);
    rejects((candidate) => { candidate.entries.push(clone(candidate.entries[0])); }, /exactly 21/);
    rejects((candidate) => { candidate.entries[0].viewport.width += 1; }, /viewport mismatch/);
  });

  it('rejects route, state and actor metadata mismatch at authorization time', () => {
    const entry = matrix.entries[0];
    const identity = Object.fromEntries(['project', 'normalizedSpecPath', 'canonicalTitle', 'snapshotName'].map((field) => [field, entry[field as keyof typeof entry]])) as never;
    for (const field of ['route', 'fixtureState', 'actor'] as const) {
      const metadata = { route: entry.route, fixtureState: entry.fixtureState, actor: entry.actor, viewport: entry.viewport };
      metadata[field] += '-wrong';
      expect(() => assertAuthorizedPath(matrix, identity, metadata, 'production-regression', entry.permittedPaths['production-regression'][0])).toThrow(/metadata mismatch/);
    }
  });

  it('rejects cross-identity owner borrowing and class laundering', () => {
    const dashboard = matrix.entries.find((entry) => entry.snapshotName === 'dashboard-desktop-expected.png')!;
    const identity = { project: dashboard.project, normalizedSpecPath: dashboard.normalizedSpecPath, canonicalTitle: dashboard.canonicalTitle, snapshotName: dashboard.snapshotName };
    const metadata = { route: dashboard.route, fixtureState: dashboard.fixtureState, actor: dashboard.actor, viewport: dashboard.viewport };
    expect(() => assertAuthorizedPath(matrix, identity, metadata, 'production-regression', 'frontend/src/features/auth/pages/LoginPage.tsx')).toThrow(/owner borrowing/);
    expect(() => assertAuthorizedPath(matrix, identity, metadata, 'production-regression', dashboard.permittedPaths['stale-baseline'][0])).toThrow(/class laundering/);
  });

  it('pins each Phase-09 viewport to its independent owner', () => {
    const expected = new Map([[1365, 'PurchaseWorkflowGuide.tsx'], [1280, 'PurchaseServiceDateWorkbench.tsx'], [768, 'PurchaseDecisionPanel.tsx'], [390, 'PurchaseLineGroups.tsx']]);
    for (const entry of matrix.entries.filter((item) => item.snapshotName.includes('phase09'))) {
      expect(entry.permittedPaths['production-regression'][0].endsWith(expected.get(entry.viewport.width)!)).toBe(true);
    }
  });

  it('rejects partition overlap, omission and unknown fields', () => {
    rejects((candidate) => { candidate.identitySets['readiness-chef'].push(clone(candidate.identitySets['readiness-purchasing'][0])); }, /disjoint/);
    rejects((candidate) => { candidate.identitySets['readiness-chef'].pop(); }, /exact union/);
    rejects((candidate) => { (candidate as unknown as Record<string, unknown>).ordinalAuthority = true; }, /unknown field/);
  });
});
