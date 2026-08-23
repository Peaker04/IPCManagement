import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAuthorizationMatrix, assertAuthorizedPath, exactAuthorizedPaths, GENERAL_VALIDATOR_AUTHORITY, resolveClassAwareAuthority, resolveIdentitySetNames, resolveRecoveryAuthority, validateClassAwareAccounting, validateDownstreamReadiness, validateSnapshotRecoveryManifest, type AuthorizationMatrix, type ClassAwareDisposition, type ReadinessDisposition } from './validateVisualReconciliation';

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

// These are pure source-inspection tests and never launch Playwright.
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

describe('Phase 27.1 generic downstream authorization', () => {
  it('pins the sole general authority and all four closed classes',()=>{expect(GENERAL_VALIDATOR_AUTHORITY).toBe('27.1-03R');expect(Object.keys(matrix.entries[0].permittedPaths)).toHaveLength(4);});
  it.each(['core-login-dashboard','core-meal-weekly','secondary-reports-approvals-admin','purchasing-phase09','all-21'])('resolves closed identity union %s', (selection) => {
    const names=resolveIdentitySetNames(matrix,selection); const identities=names.flatMap(name=>matrix.identitySets[name]);
    expect(new Set(identities.map(x=>JSON.stringify(x))).size).toBe(identities.length);
    if(selection==='all-21') expect(identities).toHaveLength(21);
  });
  it('rejects unknown, duplicate and broad identity unions',()=>{
    for(const selection of ['core-login-dashboard,core-login-dashboard','core-*','', 'readiness-chef,unknown']) expect(()=>resolveIdentitySetNames(matrix,selection)).toThrow();
  });
  it.each(['production-regression','fixture-drift','harness-nondeterminism','stale-baseline'])('authorizes only exact selected row path for %s',(disposition)=>{
    const identity=matrix.identitySets['core-login-dashboard'][0], entry=matrix.entries.find(x=>JSON.stringify(x).includes(identity.snapshotName))!;
    const path=entry.permittedPaths[disposition][0]; expect(exactAuthorizedPaths(matrix,'core-login-dashboard',[{identity,disposition,path}])).toEqual([path]);
    expect(()=>exactAuthorizedPaths(matrix,'core-login-dashboard',[{identity,disposition,path:path+'/'}])).toThrow();
  });
  it('rejects cross-set borrowing, class mismatch and duplicate accounting',()=>{
    const identity=matrix.identitySets['core-login-dashboard'][0], entry=matrix.entries.find(x=>x.snapshotName===identity.snapshotName)!;
    const prod=entry.permittedPaths['production-regression'][0], snapshot=entry.permittedPaths['stale-baseline'][0];
    expect(()=>exactAuthorizedPaths(matrix,'core-meal-weekly',[{identity,disposition:'production-regression',path:prod}])).toThrow(/cross-identity/);
    expect(()=>exactAuthorizedPaths(matrix,'core-login-dashboard',[{identity,disposition:'production-regression',path:snapshot}])).toThrow(/class/);
    expect(()=>exactAuthorizedPaths(matrix,'core-login-dashboard',[{identity,disposition:'production-regression',path:prod},{identity,disposition:'production-regression',path:prod}])).toThrow(/duplicate/);
  });
  it('rejects broad prefixes/globs and production/snapshot class laundering in matrix schema',()=>{
    for(const [kind,path] of [['production-regression','frontend/src/'],['production-regression','frontend/src/**/*.tsx'],['production-regression','frontend/tests/visual-routes.spec.ts'],['stale-baseline','frontend/src/x.tsx']] as const){const m=clone(matrix);m.entries[0].permittedPaths[kind]=[path];expect(()=>assertAuthorizationMatrix(m,inventory.failures)).toThrow();}
  });
  it('resolves only the closed recovery marker and rejects wrong paths/content',()=>{
    const cwd=resolve(import.meta.dirname,'../..'); expect(resolveRecoveryAuthority(cwd)).toMatchObject({path:expect.stringContaining('27.1-02R-validator-recovery.json'),partialCommit:'235fbd499e0fb5e2f247ea0efa0bb92ea58eff32'});
    expect(()=>resolveRecoveryAuthority(cwd,'other.json')).toThrow(/not allowlisted/);
  });
});

describe('Phase 27.1 pre-work entry closure', () => {
  const cwd = resolve(import.meta.dirname, '../..');
  const script = resolve(import.meta.dirname, 'validateVisualReconciliation.ts');
  const canonical = [
    '--mode', 'pre-work-entry', '--predecessor-plan', '27.1-02', '--validator-authority', '27.1-03R',
    '--general-validator-values-from', 'evidence/terminal-markers/27.1-03R-general-validator.json',
    '--class-aware-values-from', 'evidence/terminal-markers/27.1-03S-snapshot-recovery.json',
    '--require-class-aware-complete', '--require-exact-class-aware-marker-hash-commit',
    '--require-class-aware-validator-test-pins', '--require-three-preserved-plan03-commits',
    '--require-complete', '--require-exact-marker-hash-commit', '--require-four-validator-test-pins',
    '--require-nine-distinct-roots', '--require-exact-predecessor',
    '--identity-manifest', 'evidence/corrected-authorization-matrix.json', '--identity-sets', 'core-login-dashboard',
    '--resolve-selected-classes', '--reject-legacy-entry-authority', '--emit-entry-context-json',
  ];
  const run = (args: string[]) => execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });

  it('accepts only the exact COMPLETE 03S class-aware authority', () => {
    expect(run(canonical)).toContain('"classAwareValidator"');
    expect(resolveClassAwareAuthority(cwd)).toMatchObject({ commit: expect.stringMatching(/^4aab947f/), payloadCommit: 'ef030acec72a893fafe9449947074edcaa020d05' });
  });

  it.each([
    ['legacy general-only entry', (args: string[]) => args.filter((value, index) => !['--class-aware-values-from', '--require-class-aware-complete', '--require-exact-class-aware-marker-hash-commit', '--require-class-aware-validator-test-pins', '--require-three-preserved-plan03-commits', '--require-nine-distinct-roots'].includes(value) && args[index - 1] !== '--class-aware-values-from')],
    ['substituted marker', (args: string[]) => args.map((value) => value === 'evidence/terminal-markers/27.1-03S-snapshot-recovery.json' ? 'evidence/terminal-markers/27.1-03R-general-validator.json' : value)],
    ['missing required flag', (args: string[]) => args.filter((value) => value !== '--require-class-aware-validator-test-pins')],
    ['wrong predecessor', (args: string[]) => args.map((value) => value === '27.1-02' ? '27.1-03' : value)],
    ['wrong identity set', (args: string[]) => args.map((value) => value === 'core-login-dashboard' ? 'core-meal-weekly' : value)],
    ['raw forged authority', (args: string[]) => [...args, '--class-aware-marker-commit', '4aab947f']],
    ['unknown class-aware flag', (args: string[]) => [...args, '--class-aware-bypass']],
  ])('rejects %s before output', (_label, mutate) => {
    expect(() => run(mutate([...canonical]))).toThrow();
  });
});

describe('Phase 27.1 downstream readiness closure', () => {
  const cwd = resolve(import.meta.dirname, '../..');
  const dispositions = load<ReadinessDisposition>('readiness-dispositions.json');
  const recovery = load<any>('attestations/27.1-02R-validator-recovery-manifest.json');
  const core = load<{rows:ClassAwareDisposition[]}>('core-route-dispositions.json');
  const validate = (d = dispositions, r = recovery, m = matrix, rows=core.rows) => validateDownstreamReadiness(cwd, m, d, r, rows);
  it('recomputes identities, packets, locks, recovery pins, and Git sets', () => expect(validate()).toMatchObject({ selectedIdentitySets: ['readiness-chef', 'readiness-purchasing'] }));
  it.each([
    ['identity substitution', (d: any) => { d.identitySets['readiness-chef'][0].identity = 'purchasing-desktop'; }],
    ['wrong disposition', (d: any) => { d.identitySets['readiness-chef'][0].disposition = 'production-regression'; }],
    ['missing packet', (d: any) => { d.identitySets['readiness-chef'][0].beforeSha256.pop(); }],
    ['unequal packet', (d: any) => { d.identitySets['readiness-chef'][0].afterSha256[1] = '0'.repeat(64); }],
    ['stale invariant', (d: any) => { d.identitySets['readiness-chef'][0].afterSha256 = [...d.identitySets['readiness-chef'][0].beforeSha256]; }],
    ['snapshot change', (d: any) => { d.locks.snapshotsChanged = true; }],
    ['Purchasing unlock', (d: any) => { d.locks.purchasingRollout = 'UNLOCKED'; }],
    ['wrong phase base', (d: any) => { d.gitReconciliation.phaseBaseCommit = '0'.repeat(40); }],
    ['wrong wave base', (d: any) => { d.waveBaseCommit = '0'.repeat(40); }],
    ['collapsed recovery root', (d: any) => { d.roots[1].commit = d.roots[0].commit; }],
  ])('rejects %s', (_label, mutate) => { const d = clone(dispositions); mutate(d); expect(() => validate(d)).toThrow(); });
  it('rejects omitted and forged partial member accounting', () => {
    const omitted = clone(recovery); omitted.members.pop(); expect(() => validate(dispositions, omitted)).toThrow(/authority/);
    const forged = clone(recovery); forged.members[0].sha256 = '0'.repeat(64); expect(() => validate(dispositions, forged)).toThrow(/pin/);
  });
  it('rejects matrix class/path borrowing', () => {
    const m = clone(matrix); m.entries.find((x) => x.snapshotName === 'chef-dashboard-desktop-expected.png')!.permittedPaths['fixture-drift'] = ['frontend/tests/other.ts'];
    expect(() => validate(dispositions, recovery, m)).toThrow(/class\/path/);
  });
  it('accepts exactly the three committed core snapshots and deduplicates cumulative/wave overlap',()=>{
    const paths=core.rows.map(row=>row.owner);
    expect(validateClassAwareAccounting(cwd,matrix,core.rows,[...paths,...paths])).toEqual(paths);
    expect(validate().authorizedClassAwarePaths).toEqual(expect.arrayContaining(paths));
  });
  it.each([
    ['path',(rows:any[])=>{rows[0].owner='frontend/tests/visual-routes.spec.ts-snapshots/weekly-menu-desktop-chromium-win32.png';}],
    ['identity',(rows:any[])=>{rows[0].identity='weekly-menu-desktop';}],
    ['class',(rows:any[])=>{rows[0].disposition='production-regression';}],
    ['old hash',(rows:any[])=>{rows[0].oldSnapshotSha256='0'.repeat(64);}],
    ['new hash',(rows:any[])=>{rows[0].newSnapshotSha256='0'.repeat(64);}],
    ['packet missing',(rows:any[])=>{rows[0].beforeSha256.pop();}],
    ['packet unequal',(rows:any[])=>{rows[0].afterSha256[1]='0'.repeat(64);}],
  ])('rejects class-aware %s mismatch',(_label,mutate)=>{const rows=clone(core.rows); mutate(rows); expect(()=>validateClassAwareAccounting(cwd,matrix,rows,[rows[0].owner])).toThrow();});
  it('validates exact preserved ancestry/member/blob/hash/disposition/packet/identity/matrix closure',()=>{
    const manifest=load<any>('attestations/27.1-03S-snapshot-recovery-manifest.json');
    expect(validateSnapshotRecoveryManifest(cwd,manifest,matrix,core.rows).orderedCommits).toHaveLength(3);
    for(const mutate of [(m:any)=>{m.orderedCommits.reverse();},(m:any)=>{m.commits[0].disposition='REVERTED';},(m:any)=>{m.commits[1].members.pop();},(m:any)=>{m.commits[2].members[0].sha256='0'.repeat(64);},(m:any)=>{m.snapshotBindings[0].identity='weekly-menu-desktop';}]){const candidate=clone(manifest);mutate(candidate);expect(()=>validateSnapshotRecoveryManifest(cwd,candidate,matrix,core.rows)).toThrow();}
  });
  it('rejects extra snapshots, broad paths, and production class laundering',()=>{
    expect(()=>validateClassAwareAccounting(cwd,matrix,core.rows,['frontend/tests/visual-routes.spec.ts-snapshots/weekly-menu-desktop-chromium-win32.png'])).toThrow(/unauthorized/);
    const dashboard=matrix.entries.find(x=>x.snapshotName==='dashboard-desktop-expected.png')!;
    const production={...clone(core.rows[0]),disposition:'production-regression',owner:dashboard.permittedPaths['production-regression'][0]};
    expect(()=>validateClassAwareAccounting(cwd,matrix,[production],[production.owner])).not.toThrow();
    production.disposition='fixture-drift'; expect(()=>validateClassAwareAccounting(cwd,matrix,[production],[production.owner])).toThrow();
    expect(()=>validateClassAwareAccounting(cwd,matrix,[],['frontend/src/'])).toThrow(/unauthorized/);
  });
});
