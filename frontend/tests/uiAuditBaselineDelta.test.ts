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

const forbiddenPaths = [
  /ui-audit-phase28-baseline/,
  /(?:^|\/)__?snapshots?__?\//,
  /route-budgets\.json$/,
  /backend\//,
  /migrations?\//i,
  /shared\/api\/contracts\//,
];

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
