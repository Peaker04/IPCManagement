/* eslint-disable @typescript-eslint/no-explicit-any */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This version is the downstream authorization pin; ordinals never participate in it.
export const VALIDATOR_VERSION = '27.1-01C' as const;
export const GENERAL_VALIDATOR_AUTHORITY = '27.1-03R' as const;
export const IDENTITY_FIELDS = ['project', 'normalizedSpecPath', 'canonicalTitle', 'snapshotName'] as const;
export const METADATA_FIELDS = ['route', 'fixtureState', 'actor'] as const;

export type Identity = Record<(typeof IDENTITY_FIELDS)[number], string>;
export type Viewport = { width: number; height: number };
export type AuthorizationEntry = Identity & {
  route: string;
  fixtureState: string;
  actor: string;
  viewport: Viewport;
  displayOrdinal?: number;
  permittedPaths: Record<string, string[]>;
};
export type AuthorizationMatrix = {
  schemaVersion: 1;
  validatorVersion: typeof VALIDATOR_VERSION;
  originalMatrix: { path: string; sha256: string };
  entries: AuthorizationEntry[];
  identitySets: Record<string, Identity[]>;
};

export function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function identityKey(value: Identity): string {
  return IDENTITY_FIELDS.map((field) => JSON.stringify(value[field])).join('|');
}

function assertClosedKeys(value: object, allowed: readonly string[], label: string) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`${label} contains unknown field(s): ${extras.join(', ')}`);
}

function assertIdentity(value: unknown, label: string): asserts value is Identity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  assertClosedKeys(value, IDENTITY_FIELDS, label);
  for (const field of IDENTITY_FIELDS) {
    if (typeof (value as Record<string, unknown>)[field] !== 'string' || !(value as Record<string, string>)[field]) {
      throw new Error(`${label}.${field} must be a non-empty string`);
    }
  }
}

export function assertAuthorizationMatrix(matrix: unknown, sourceIdentities: unknown[]): asserts matrix is AuthorizationMatrix {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) throw new Error('matrix must be an object');
  assertClosedKeys(matrix, ['schemaVersion', 'validatorVersion', 'originalMatrix', 'entries', 'identitySets'], 'matrix');
  const candidate = matrix as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || candidate.validatorVersion !== VALIDATOR_VERSION) throw new Error('validator version/schema mismatch');
  if (!candidate.originalMatrix || typeof candidate.originalMatrix !== 'object') throw new Error('originalMatrix is required');
  assertClosedKeys(candidate.originalMatrix as object, ['path', 'sha256'], 'originalMatrix');
  const original = candidate.originalMatrix as Record<string, unknown>;
  if (original.sha256 !== '15878b85b8a68d16df6582ed0ed279ab7fd1515e3cf8c3b285fed79837ae4ca2') throw new Error('old matrix hash mismatch');
  if (!Array.isArray(candidate.entries) || candidate.entries.length !== 21) throw new Error('matrix must contain exactly 21 entries');

  const source = sourceIdentities.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`source[${index}] must be an object`);
    const raw = item as Record<string, unknown>;
    const identity = Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, raw[field]]));
    assertIdentity(identity, `source[${index}]`);
    return { identity, viewport: raw.viewport };
  });
  const sourceKeys = source.map(({ identity }) => identityKey(identity));
  if (new Set(sourceKeys).size !== 21 || sourceKeys.length !== 21) throw new Error('source identities must be exactly 21 unique identities');

  const entries = candidate.entries as unknown[];
  const matrixKeys = entries.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`entries[${index}] must be an object`);
    assertClosedKeys(raw, [...IDENTITY_FIELDS, ...METADATA_FIELDS, 'viewport', 'displayOrdinal', 'permittedPaths'], `entries[${index}]`);
    const entry = raw as Record<string, unknown>;
    const identity = Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, entry[field]]));
    assertIdentity(identity, `entries[${index}] identity`);
    for (const field of METADATA_FIELDS) if (typeof entry[field] !== 'string' || !entry[field]) throw new Error(`entries[${index}].${field} is required`);
    if (!entry.viewport || typeof entry.viewport !== 'object' || (entry.viewport as Viewport).width <= 0 || (entry.viewport as Viewport).height <= 0) throw new Error(`entries[${index}].viewport is invalid`);
    if (entry.displayOrdinal !== undefined && (!Number.isInteger(entry.displayOrdinal) || (entry.displayOrdinal as number) < 1)) throw new Error('displayOrdinal is display metadata only and must be a positive integer');
    if (!entry.permittedPaths || typeof entry.permittedPaths !== 'object') throw new Error('permittedPaths is required');
    const permitted = entry.permittedPaths as Record<string, string[]>;
    const classes = ['production-regression', 'fixture-drift', 'harness-nondeterminism', 'stale-baseline'];
    assertClosedKeys(permitted, classes, `entries[${index}].permittedPaths`);
    for (const [kind, paths] of Object.entries(permitted)) {
      if (!classes.includes(kind) || !Array.isArray(paths) || paths.length === 0 || new Set(paths).size !== paths.length || paths.some((path) => typeof path !== 'string' || !path.startsWith('frontend/'))) throw new Error(`invalid permitted paths for ${kind}`);
      if (paths.some((path) => path.includes('*') || path.endsWith('/'))) throw new Error('directory and wildcard authorization rejected');
      if (kind === 'production-regression' && paths.some((path) => !path.startsWith('frontend/src/'))) throw new Error('production class must name exact frontend/src owners');
      if (kind === 'stale-baseline' && (paths.length !== 1 || paths.some((path) => !path.includes('-snapshots/') || !path.endsWith('.png')))) throw new Error('stale class must name one exact snapshot');
      if (kind === 'fixture-drift' && paths.some((path) => !['frontend/tests/visual-routes.spec.ts','frontend/tests/phase9-test-fixture.ts'].includes(path))) throw new Error('fixture class path rejected');
      if (kind === 'harness-nondeterminism' && paths.some((path) => !['frontend/tests/visual-routes.spec.ts','frontend/tests/visualReconciliationEvidence.ts'].includes(path))) throw new Error('harness class path rejected');
    }
    const key = identityKey(identity);
    const sourceIndex = sourceKeys.indexOf(key);
    if (sourceIndex < 0) throw new Error(`extra or substituted identity: ${key}`);
    if (JSON.stringify(entry.viewport) !== JSON.stringify(source[sourceIndex].viewport)) throw new Error(`viewport mismatch for ${key}`);
    return key;
  });
  if (new Set(matrixKeys).size !== 21) throw new Error('duplicate or missing matrix identity');
  if (matrixKeys.some((key, index) => key !== sourceKeys[index])) throw new Error('matrix order differs from immutable source identity order');

  const expectedSets = ['readiness-chef', 'readiness-purchasing', 'core-login-dashboard', 'core-meal-weekly', 'secondary-reports-approvals-admin', 'purchasing-phase09'];
  if (!candidate.identitySets || typeof candidate.identitySets !== 'object') throw new Error('identitySets are required');
  assertClosedKeys(candidate.identitySets as object, expectedSets, 'identitySets');
  const partitionKeys: string[] = [];
  for (const name of expectedSets) {
    const set = (candidate.identitySets as Record<string, unknown>)[name];
    if (!Array.isArray(set)) throw new Error(`identity set ${name} is required`);
    for (const [index, identity] of set.entries()) {
      assertIdentity(identity, `${name}[${index}]`);
      partitionKeys.push(identityKey(identity));
    }
  }
  if (partitionKeys.length !== 21 || new Set(partitionKeys).size !== 21 || partitionKeys.some((key) => !matrixKeys.includes(key))) throw new Error('identity sets must be a disjoint exact union of all 21 identities');
}

export type ReadinessDisposition = { schemaVersion: number; phase: string; planId: string; validatorAuthority: string; waveBaseCommit: string; roots: Array<{ type: string; path: string; sha256: string; commit: string }>; identitySets: Record<string, Array<{ identity: string; disposition: string; owner: string; beforeSha256: string[]; afterSha256: string[]; semanticOwner: string }>>; locks: { adminData: string; purchasingRollout: string; snapshotsChanged: boolean; productionChanged: boolean }; gitReconciliation: { phaseBaseCommit: string; waveBaseCommit: string; waveAuthorizedPaths: string[] } };
export type ClassAwareDisposition = { identity: string; disposition: string; owner: string; beforeSha256: string[]; afterSha256: string[]; oldSnapshotSha256?: string; newSnapshotSha256?: string };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const outputLines = (value: string) => value.split(/\r?\n/).filter(Boolean);
function validEqualPacket(packet: unknown): packet is string[] { return Array.isArray(packet) && packet.length === 2 && packet[0] === packet[1] && packet.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)); }
const CORE_SNAPSHOT_HASHES:Record<string,{old:string;new:string}>={
  'dashboard-desktop':{old:'8fc1946a8abe319dde67d5a3b4b831601dd419c7d6d2c663a63c9bd58fbb7306',new:'4c3fe39beec602fd050aad022b624dd2032acd76c4d8a644eefef4e8f961e60f'},
  'login-mobile':{old:'a460d759c196b3425baae9ebc943d94eb854edefeaa2692dd8e2849bd1d1fa05',new:'567167b90c603ee2306b5db3eed5fd818b5aaef794151cb23b2e775483cd73d5'},
  'dashboard-mobile':{old:'f45dd1c3f9d24041b4e63899b5f464f08e794d25a19aff50e2d7f73920f08d96',new:'6a97fb027cbcdfd1fed9bedb1f257417dc71f746afc7654b92a4570b2547c43e'},
};
function authorizeClassAwarePath(cwd:string,matrix:AuthorizationMatrix,row:ClassAwareDisposition,path:string) {
  const identity=Object.values(matrix.identitySets).flat().find(item=>item.snapshotName.startsWith(row.identity));
  if(!identity) throw new Error(`class-aware identity substitution: ${row.identity}`);
  const entry=matrix.entries.find(item=>identityKey(item)===identityKey(identity))!;
  const permitted=entry.permittedPaths[row.disposition];
  if(!permitted?.includes(path)||row.owner!==path) throw new Error(`class-aware class/path authorization rejected: ${path}`);
  if(!validEqualPacket(row.beforeSha256)||!validEqualPacket(row.afterSha256)) throw new Error('class-aware two equal packets required');
  if(row.disposition==='stale-baseline') {
    const sealedHashes=CORE_SNAPSHOT_HASHES[row.identity];
    if(permitted.length!==1||!row.oldSnapshotSha256||!row.newSnapshotSha256||!/^[a-f0-9]{64}$/.test(row.oldSnapshotSha256)||!/^[a-f0-9]{64}$/.test(row.newSnapshotSha256)||row.oldSnapshotSha256===row.newSnapshotSha256||row.newSnapshotSha256!==row.beforeSha256[0]||row.newSnapshotSha256!==row.afterSha256[0]||sealedHashes&&(row.oldSnapshotSha256!==sealedHashes.old||row.newSnapshotSha256!==sealedHashes.new)) throw new Error('stale-baseline hash evidence mismatch');
    if(sha256(readFileSync(resolve(cwd,path)))!==row.newSnapshotSha256) throw new Error('current snapshot hash mismatch');
  } else if(row.disposition!=='production-regression'||!path.startsWith('frontend/src/')) throw new Error('production owner requires production-regression class');
}
export function validateClassAwareAccounting(cwd:string,matrix:AuthorizationMatrix,rows:ClassAwareDisposition[],paths:string[]) {
  const sensitive=[...new Set(paths.filter(path=>path.includes('-snapshots/')||path.startsWith('frontend/src/')))];
  const authorized=new Set<string>();
  for(const path of sensitive){ const matches=rows.filter(row=>row.owner===path); if(matches.length!==1) throw new Error(`unauthorized Git accounting member: ${path}`); authorizeClassAwarePath(cwd,matrix,matches[0],path); authorized.add(path); }
  for(const row of rows) if((row.owner.includes('-snapshots/')||row.owner.startsWith('frontend/src/'))&&!sensitive.includes(row.owner)) continue;
  return [...authorized];
}
export function validateDownstreamReadiness(cwd: string, matrix: AuthorizationMatrix, dispositions: ReadinessDisposition, recovery: any, classAwareRows:ClassAwareDisposition[] = []) {
  const selected = ['readiness-chef', 'readiness-purchasing'];
  if (dispositions.schemaVersion !== 1 || dispositions.phase !== '27.1' || dispositions.planId !== '27.1-02' || dispositions.validatorAuthority !== '27.1-01W') throw new Error('disposition identity mismatch');
  if (dispositions.waveBaseCommit !== '47d13805196fd9ab51d0f08c5de44db7fa26a71b' || dispositions.gitReconciliation.waveBaseCommit !== dispositions.waveBaseCommit || dispositions.gitReconciliation.phaseBaseCommit !== 'c52c80f8186b985d07619a7ad0ed7abc0572675c') throw new Error('phase/wave base mismatch');
  if (dispositions.roots.length !== 6 || new Set(dispositions.roots.map((root) => root.commit)).size !== 6) throw new Error('exact six pre-existing roots required');
  if (dispositions.locks.adminData !== 'LOCKED' || dispositions.locks.purchasingRollout !== 'LOCKED') throw new Error('Purchasing/Admin lock mismatch');
  if (dispositions.locks.snapshotsChanged || dispositions.locks.productionChanged) throw new Error('snapshot/production guard failed');
  if (JSON.stringify(Object.keys(dispositions.identitySets).sort()) !== JSON.stringify(selected)) throw new Error('selected identity closure mismatch');
  for (const setName of selected) {
    const rows = dispositions.identitySets[setName];
    if (rows.length !== 2 || new Set(rows.map((row) => row.identity)).size !== 2) throw new Error('duplicate/missing readiness identity');
    for (const row of rows) {
      const identity = matrix.identitySets[setName].find((item) => item.snapshotName.startsWith(row.identity));
      if (!identity) throw new Error('identity substitution');
      const entry = matrix.entries.find((item) => identityKey(item) === identityKey(identity))!;
      if (row.disposition !== 'fixture-drift' || row.owner !== 'frontend/tests/visual-routes.spec.ts' || !entry.permittedPaths['fixture-drift']?.includes(row.owner)) throw new Error('matrix class/path authorization mismatch');
      for (const packets of [row.beforeSha256, row.afterSha256]) if (packets.length !== 2 || packets[0] !== packets[1] || !packets.every((hash) => /^[a-f0-9]{64}$/.test(hash))) throw new Error('two equal packets required');
      if (row.beforeSha256[0] === row.afterSha256[0]) throw new Error('corrected-non-stale invariant failed');
      if (!row.semanticOwner) throw new Error('semantic owner invariant failed');
    }
  }
  if (recovery.partialCommit !== '235fbd499e0fb5e2f247ea0efa0bb92ea58eff32' || recovery.waveBaseCommit !== dispositions.waveBaseCommit || recovery.members?.length !== 3) throw new Error('recovery authority mismatch');
  for (const member of recovery.members) {
    const bytes = execFileSync('git', ['show', `${recovery.partialCommit}:${member.path}`], { cwd });
    if (sha256(bytes) !== member.sha256 || git(cwd, 'rev-parse', `${recovery.partialCommit}:${member.path}`) !== member.gitBlobId) throw new Error('recovery member pin mismatch');
  }
  const cumulative = outputLines(git(cwd, 'diff', '--name-only', `${dispositions.gitReconciliation.phaseBaseCommit}..HEAD`));
  const wave = outputLines(git(cwd, 'diff', '--name-only', `${dispositions.waveBaseCommit}..HEAD`));
  const dirty = outputLines(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })).map((line) => line.slice(3));
  const all = [...new Set([...cumulative, ...wave, ...dirty])];
  const finalPath = resolve(cwd, '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/final-reconciliation.json');
  const finalEvidence = existsSync(finalPath) ? JSON.parse(readFileSync(finalPath, 'utf8')) : { productionCorrections: [] };
  const corrections = new Map((finalEvidence.productionCorrections ?? []).map((item: { path: string; newSha256: string }) => [item.path, item.newSha256]));
  for (const [path, hash] of corrections) if (!path.startsWith('frontend/src/') || path.includes('.test.') || sha256(readFileSync(resolve(cwd, path))) !== hash) throw new Error(`invalid final production correction: ${path}`);
  const accountable = all.filter((path) => !path.includes('.test.') && !corrections.has(path));
  const authorizedClassAwarePaths=[...validateClassAwareAccounting(cwd,matrix,classAwareRows,accountable), ...corrections.keys()];
  return { selectedIdentitySets: selected, cumulativePaths: cumulative, wavePaths: wave, dirtyPaths: dirty, authorizedClassAwarePaths };
}

export function assertAuthorizedPath(matrix: AuthorizationMatrix, identity: Identity, metadata: Pick<AuthorizationEntry, 'route' | 'fixtureState' | 'actor' | 'viewport'>, disposition: string, path: string) {
  const entry = matrix.entries.find((item) => identityKey(item) === identityKey(identity));
  if (!entry) throw new Error('identity is not authorized');
  for (const field of METADATA_FIELDS) if (entry[field] !== metadata[field]) throw new Error(`${field} metadata mismatch`);
  if (JSON.stringify(entry.viewport) !== JSON.stringify(metadata.viewport)) throw new Error('viewport metadata mismatch');
  if (!entry.permittedPaths[disposition]?.includes(path)) throw new Error(`owner borrowing or class laundering rejected: ${path}`);
}

export const DOWNSTREAM_IDENTITY_SETS = Object.freeze({
  '27.1-03': ['core-login-dashboard'],
  '27.1-04': ['core-meal-weekly'],
  '27.1-05': ['secondary-reports-approvals-admin'],
  '27.1-06': ['purchasing-phase09'],
  '27.1-07': ['all-21'],
} as const);
const GENERAL_MARKER = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/terminal-markers/27.1-03R-general-validator.json';
const RECOVERY_MARKER = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/terminal-markers/27.1-02R-validator-recovery.json';
const CLASS_AWARE_MARKER = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/terminal-markers/27.1-03S-snapshot-recovery.json';
const PRE_WORK_MARKER = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/terminal-markers/27.1-03T-pre-work-entry.json';
const CLASS_AWARE_MARKER_COMMIT = '4aab947f3d93cb8d2a0b0068b97f4dd8245a79bc';
const CLASS_AWARE_PAYLOAD_COMMIT = 'ef030acec72a893fafe9449947074edcaa020d05';
const PRESERVED_COMMITS=['141da95a95611c7bb9f679a6aeafa93aba1b174b','3f2846265aaa2f848262635eeda4a7a5fccd311e','319ae15832a7ad1ba257ef6aa8e3b03d217206fb'] as const;
const PRESERVED_MEMBERS:Record<string,Array<{path:string;sha256:string;gitBlobId:string}>>={
  [PRESERVED_COMMITS[0]]:[{path:'frontend/tests/coreRouteVisualRegression.test.ts',sha256:'7711eef39776aa69c18a0d25fcdbec0f1a98e11d9c9cd959f1478dfa3b537e2c',gitBlobId:'2448b6fe03ca2aa67e8a9b0aae2b536370e222d5'}],
  [PRESERVED_COMMITS[1]]:[
    {path:'frontend/tests/visual-routes.spec.ts-snapshots/dashboard-desktop-chromium-win32.png',sha256:'4c3fe39beec602fd050aad022b624dd2032acd76c4d8a644eefef4e8f961e60f',gitBlobId:'0ff5552471825da92dbd96237b6c2153634f951a'},
    {path:'frontend/tests/visual-routes.spec.ts-snapshots/dashboard-mobile-chromium-win32.png',sha256:'6a97fb027cbcdfd1fed9bedb1f257417dc71f746afc7654b92a4570b2547c43e',gitBlobId:'bac25ff32b84c95cc1a689cee115bfcf64ae910a'},
    {path:'frontend/tests/visual-routes.spec.ts-snapshots/login-mobile-chromium-win32.png',sha256:'567167b90c603ee2306b5db3eed5fd818b5aaef794151cb23b2e775483cd73d5',gitBlobId:'5f8bd331776c2403f479d7e111520e3350de0e42'}],
  [PRESERVED_COMMITS[2]]:[{path:'.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/core-route-dispositions.json',sha256:'c1c59dc3355fea9e32f25e7913afc70e12f5809a6826acfb997d59fdf5d5e042',gitBlobId:'a0dc1c94f54b79107a4ce9befb92b9e12017b91f'}],
};
const VALIDATOR_PATHS = ['frontend/tests/validatePhase271PlanResult.ts','frontend/tests/validatePhase271PlanResult.test.ts','frontend/tests/validateVisualReconciliation.ts','frontend/tests/validateVisualReconciliation.test.ts'] as const;
export function resolveIdentitySetNames(matrix: AuthorizationMatrix, selection: string): string[] {
  if (selection === 'all-21') return Object.keys(matrix.identitySets);
  const names = selection.split(',').filter(Boolean);
  if (!names.length || new Set(names).size !== names.length || names.some((name) => !(name in matrix.identitySets))) throw new Error('identity-set selection is not a closed exact union');
  return names;
}
export function exactAuthorizedPaths(matrix: AuthorizationMatrix, selection: string, dispositions: Array<{ identity: Identity; disposition: string; path: string }>): string[] {
  const selected = new Set(resolveIdentitySetNames(matrix, selection).flatMap((name) => matrix.identitySets[name].map(identityKey)));
  const seen = new Set<string>();
  for (const row of dispositions) {
    const key = identityKey(row.identity); if (!selected.has(key)) throw new Error('cross-identity borrowing rejected');
    const entry = matrix.entries.find((item) => identityKey(item) === key)!;
    if (!entry.permittedPaths[row.disposition]?.includes(row.path)) throw new Error('class/path authorization rejected');
    const accounting = `${key}|${row.disposition}|${row.path}`; if (seen.has(accounting)) throw new Error('duplicate accounting rejected'); seen.add(accounting);
  }
  return [...new Set(dispositions.map((row) => row.path))];
}
function markerCommit(cwd:string,path:string, marker:any){ const commit=git(cwd,'log','-n','1','--format=%H','--',path); const members=outputLines(git(cwd,'diff-tree','--no-commit-id','--name-only','-r',commit)); if(members.length!==1||members[0]!==path) throw new Error('authority marker commit is not marker-only'); if(marker.payloadCommit&&git(cwd,'rev-parse',`${commit}^`)!==marker.payloadCommit) throw new Error('authority marker is not immediate payload child'); return commit; }
export function resolveGeneralValidatorAuthority(cwd:string,path=GENERAL_MARKER){ if(path!==GENERAL_MARKER) throw new Error('general marker path is not allowlisted'); const marker=JSON.parse(readFileSync(resolve(cwd,path),'utf8')); if(marker.planId!=='27.1-03R'||marker.status!=='COMPLETE'||!Array.isArray(marker.validatorPins)||marker.validatorPins.length!==4) throw new Error('general marker content mismatch'); const commit=markerCommit(cwd,path,marker), hash=sha256(readFileSync(resolve(cwd,path))); for(const p of VALIDATOR_PATHS){ const pin=marker.validatorPins.find((x:any)=>x.path===p); if(!pin||sha256(execFileSync('git',['show',`${marker.payloadCommit}:${p}`],{cwd}))!==pin.sha256||git(cwd,'rev-parse',`${marker.payloadCommit}:${p}`)!==pin.gitBlobId) throw new Error('general validator pin mismatch'); } return {path,sha256:hash,commit,validatorPins:marker.validatorPins,roots:marker.authorityRoots}; }
export function resolveRecoveryAuthority(cwd:string,path=RECOVERY_MARKER){ if(path!==RECOVERY_MARKER) throw new Error('recovery marker path is not allowlisted'); const marker=JSON.parse(readFileSync(resolve(cwd,path),'utf8')); if(marker.planId!=='27.1-02R'||marker.status!=='COMPLETE'||marker.partialCommit!=='235fbd499e0fb5e2f247ea0efa0bb92ea58eff32') throw new Error('recovery marker content mismatch'); const commit=markerCommit(cwd,path,marker); return {path,sha256:sha256(readFileSync(resolve(cwd,path))),commit,partialCommit:marker.partialCommit,validatorPins:marker.validatorPins}; }
export function validateSnapshotRecoveryManifest(cwd:string,manifest:any,matrix:AuthorizationMatrix,rows:ClassAwareDisposition[]){
  if(manifest.schemaVersion!==1||manifest.planId!=='27.1-03S'||JSON.stringify(manifest.orderedCommits)!==JSON.stringify(PRESERVED_COMMITS)) throw new Error('ordered preserved commits mismatch');
  if(!Array.isArray(manifest.commits)||manifest.commits.length!==3) throw new Error('exact three preserved commits required');
  for(const [index,commit] of PRESERVED_COMMITS.entries()){
    const record=manifest.commits[index]; if(record.commit!==commit||record.disposition!=='PRESERVED_AUTHORIZED') throw new Error('preserved disposition mismatch');
    const parent=git(cwd,'rev-parse',`${commit}^`); if(index>0&&parent!==PRESERVED_COMMITS[index-1]) throw new Error('preserved ancestry mismatch');
    const expected=PRESERVED_MEMBERS[commit]; if(JSON.stringify(record.members)!==JSON.stringify(expected)) throw new Error('preserved member closure mismatch');
    const actual=outputLines(git(cwd,'diff-tree','--no-commit-id','--name-only','-r',commit)); if(JSON.stringify(actual)!==JSON.stringify(expected.map(x=>x.path))) throw new Error('Git member closure mismatch');
    for(const member of expected){ const bytes=execFileSync('git',['show',`${commit}:${member.path}`],{cwd}); if(sha256(bytes)!==member.sha256||git(cwd,'rev-parse',`${commit}:${member.path}`)!==member.gitBlobId) throw new Error('preserved member pin mismatch'); }
  }
  if(!Array.isArray(manifest.snapshotBindings)||manifest.snapshotBindings.length!==3) throw new Error('exact three sealed snapshot bindings required');
  const snapshotRows=manifest.snapshotBindings.map((binding:ClassAwareDisposition)=>rows.find(row=>row.identity===binding.identity&&row.owner===binding.owner));
  if(snapshotRows.some((row:ClassAwareDisposition|undefined)=>!row)||JSON.stringify(manifest.snapshotBindings)!==JSON.stringify(snapshotRows)) throw new Error('snapshot identity/matrix binding mismatch');
  validateClassAwareAccounting(cwd,matrix,snapshotRows as ClassAwareDisposition[],(snapshotRows as ClassAwareDisposition[]).map(row=>row.owner));
  return {orderedCommits:[...PRESERVED_COMMITS],snapshotPaths:(snapshotRows as ClassAwareDisposition[]).map(row=>row.owner)};
}
export function resolveClassAwareAuthority(cwd:string,path=CLASS_AWARE_MARKER){
  if(path!==CLASS_AWARE_MARKER) throw new Error('class-aware marker path is not allowlisted');
  const markerBytes=readFileSync(resolve(cwd,path)); const marker=JSON.parse(markerBytes.toString('utf8'));
  if(marker.planId!=='27.1-03S'||marker.status!=='COMPLETE'||marker.authority!=='CLASS_AWARE_SNAPSHOT_RECOVERY'||marker.payloadCommit!==CLASS_AWARE_PAYLOAD_COMMIT||JSON.stringify(marker.preservedCommits)!==JSON.stringify(PRESERVED_COMMITS)||!Array.isArray(marker.validatorPins)||marker.validatorPins.length!==2||!Array.isArray(marker.authorityRoots)||marker.authorityRoots.length!==9||new Set(marker.authorityRoots.map((r:any)=>r.type)).size!==9||new Set(marker.authorityRoots.map((r:any)=>`${r.type}|${r.path}|${r.sha256}|${r.commit}`)).size!==9) throw new Error('class-aware marker content mismatch');
  const commit=markerCommit(cwd,path,marker); if(commit!==CLASS_AWARE_MARKER_COMMIT||sha256(markerBytes)!==sha256(execFileSync('git',['show',`${commit}:${path}`],{cwd}))) throw new Error('class-aware marker hash/commit mismatch');
  const general=resolveGeneralValidatorAuthority(cwd); if(marker.dependency?.planId!=='27.1-03R'||marker.dependency.path!==general.path||marker.dependency.sha256!==general.sha256||marker.dependency.commit!==general.commit) throw new Error('class-aware predecessor mismatch');
  if(JSON.stringify(marker.authorityRoots.slice(0,8))!==JSON.stringify(general.roots)||marker.authorityRoots[8]?.type!=='CLASS_AWARE_03S_PARTIAL_CHAIN'||marker.authorityRoots[8]?.path!==marker.manifest?.path||marker.authorityRoots[8]?.sha256!==marker.manifest?.sha256||marker.authorityRoots[8]?.commit!==marker.payloadCommit) throw new Error('class-aware nine-root closure mismatch');
  for(const p of ['frontend/tests/validateVisualReconciliation.ts','frontend/tests/validateVisualReconciliation.test.ts']){const pin=marker.validatorPins.find((x:any)=>x.path===p);if(!pin||sha256(execFileSync('git',['show',`${marker.payloadCommit}:${p}`],{cwd}))!==pin.sha256||git(cwd,'rev-parse',`${marker.payloadCommit}:${p}`)!==pin.gitBlobId) throw new Error('class-aware validator pin mismatch');}
  for(const record of [marker.summary,marker.payloadResult,marker.manifest]) if(!record?.path||sha256(execFileSync('git',['show',`${marker.payloadCommit}:${record.path}`],{cwd}))!==record.sha256) throw new Error('class-aware payload member hash mismatch');
  const manifest=JSON.parse(readFileSync(resolve(cwd,marker.manifest.path),'utf8')); const matrix=JSON.parse(readFileSync(resolve(cwd,'.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/corrected-authorization-matrix.json'),'utf8')); const rows=JSON.parse(readFileSync(resolve(cwd,'.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/core-route-dispositions.json'),'utf8')).rows;
  if(sha256(readFileSync(resolve(cwd,marker.manifest.path)))!==marker.manifest.sha256) throw new Error('class-aware manifest hash mismatch'); validateSnapshotRecoveryManifest(cwd,manifest,matrix,rows);
  return {path,sha256:sha256(markerBytes),commit,payloadCommit:marker.payloadCommit,validatorPins:marker.validatorPins,preservedCommits:marker.preservedCommits,roots:marker.authorityRoots};
}
export function resolvePreWorkValidatorAuthority(cwd:string,path=PRE_WORK_MARKER){
  if(path!==PRE_WORK_MARKER) throw new Error('pre-work marker path is not allowlisted');
  const marker=JSON.parse(readFileSync(resolve(cwd,path),'utf8')); const classAware=resolveClassAwareAuthority(cwd);
  if(marker.planId!=='27.1-03T'||marker.status!=='COMPLETE'||marker.authority!=='PRE_WORK_ENTRY_VALIDATOR'||!Array.isArray(marker.validatorPins)||marker.validatorPins.length!==2||!Array.isArray(marker.authorityRoots)||marker.authorityRoots.length!==10||new Set(marker.authorityRoots.map((r:any)=>r.type)).size!==10) throw new Error('pre-work marker content mismatch');
  if(marker.dependency?.planId!=='27.1-03S'||marker.dependency.path!==classAware.path||marker.dependency.sha256!==classAware.sha256||marker.dependency.commit!==classAware.commit||marker.dependency.payloadCommit!==classAware.payloadCommit) throw new Error('pre-work class-aware dependency mismatch');
  if(JSON.stringify(marker.authorityRoots.slice(0,9))!==JSON.stringify(classAware.roots)||marker.authorityRoots[9]?.type!=='PRE_WORK_03T_VALIDATOR_PAYLOAD'||marker.authorityRoots[9]?.commit!==marker.payloadCommit) throw new Error('pre-work ten-root closure mismatch');
  const commit=markerCommit(cwd,path,marker);
  for(const pin of marker.validatorPins){if(!['frontend/tests/validateVisualReconciliation.ts','frontend/tests/validateVisualReconciliation.test.ts'].includes(pin.path)||sha256(execFileSync('git',['show',`${marker.payloadCommit}:${pin.path}`],{cwd}))!==pin.sha256||git(cwd,'rev-parse',`${marker.payloadCommit}:${pin.path}`)!==pin.gitBlobId) throw new Error('pre-work validator pin mismatch');}
  for(const record of [marker.summary,marker.payloadResult]) if(!record?.path||sha256(execFileSync('git',['show',`${marker.payloadCommit}:${record.path}`],{cwd}))!==record.sha256) throw new Error('pre-work payload member hash mismatch');
  return {path,sha256:sha256(readFileSync(resolve(cwd,path))),commit,payloadCommit:marker.payloadCommit,roots:marker.authorityRoots};
}
function assertExactFlags(args:string[], allowed:Set<string>){ for(const flag of args.filter(x=>x.startsWith('--'))) if(!allowed.has(flag)) throw new Error(`unknown CLI input ${flag}`); }
function main() {
  const args = process.argv.slice(2); const value = (flag: string) => args[args.indexOf(flag) + 1];
  if (args.includes('--source-inspection-only')) {
    if (value('--pin-validator-version') !== VALIDATOR_VERSION) throw new Error('validator pin mismatch');
    const manifestPath = value('--identity-manifest');
    if (!manifestPath || !args.includes('--require-exact-21') || !args.includes('--verify-identity-partition') || !args.includes('--verify-lowest-owner-paths')) throw new Error('all Plan 01C validation gates are required');
    const matrix = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')); const inventory = JSON.parse(readFileSync(resolve('.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/failure-inventory.json'), 'utf8'));
    assertAuthorizationMatrix(matrix, inventory.failures);
    const missingPaths = matrix.entries.flatMap((entry: AuthorizationEntry) => Object.values(entry.permittedPaths).flat()).filter((path: string) => !existsSync(resolve(path)));
    if (missingPaths.length) throw new Error(`permitted owner path does not exist: ${missingPaths.join(', ')}`);
    console.log(`PASS ${VALIDATOR_VERSION}: exact 21 identity closure, disjoint six-set partition, metadata equality, and lowest-owner paths verified (source inspection only)`); return;
  }
  const mode=value('--mode');
  if(mode==='pre-work-entry'){
    const allowed=new Set(['--mode','--predecessor-plan','--validator-authority','--general-validator-values-from','--pre-work-validator-values-from','--class-aware-values-from','--require-pre-work-validator-complete','--require-ten-distinct-roots','--require-class-aware-complete','--require-exact-class-aware-marker-hash-commit','--require-class-aware-validator-test-pins','--require-three-preserved-plan03-commits','--require-complete','--require-exact-marker-hash-commit','--require-four-validator-test-pins','--require-nine-distinct-roots','--require-exact-predecessor','--identity-manifest','--identity-sets','--resolve-selected-classes','--reject-legacy-entry-authority','--emit-entry-context-json']); assertExactFlags(args,allowed);
    const required=['--require-class-aware-complete','--require-exact-class-aware-marker-hash-commit','--require-class-aware-validator-test-pins','--require-three-preserved-plan03-commits','--require-complete','--require-exact-marker-hash-commit','--require-four-validator-test-pins','--require-nine-distinct-roots','--require-exact-predecessor','--resolve-selected-classes','--reject-legacy-entry-authority','--emit-entry-context-json'];
    if(required.some(flag=>!args.includes(flag))) throw new Error('all closed pre-work authority gates are required');
    const predecessor=value('--predecessor-plan'), selection=value('--identity-sets'); const expectedSelections:Record<string,string[]>={
      '27.1-02':['core-login-dashboard'],
      '27.1-03':['core-meal-weekly','readiness-chef,readiness-purchasing,core-login-dashboard,core-meal-weekly'],
      '27.1-04':['secondary-reports-approvals-admin'],
      '27.1-05':['purchasing-phase09'],
      '27.1-06':['all-21'],
    };
    if(!expectedSelections[predecessor]?.includes(selection)||value('--validator-authority')!=='27.1-03R') throw new Error('closed predecessor/identity/authority required');
    const cwd=git(process.cwd(),'rev-parse','--show-toplevel'), phase='.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c';
    const general=resolveGeneralValidatorAuthority(cwd,resolve(phase,value('--general-validator-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,''));
    const classAware=resolveClassAwareAuthority(cwd,resolve(phase,value('--class-aware-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,''));
    const preWork=args.includes('--pre-work-validator-values-from')?resolvePreWorkValidatorAuthority(cwd,resolve(phase,value('--pre-work-validator-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,'')):undefined;
    if(preWork&&(!args.includes('--require-pre-work-validator-complete')||!args.includes('--require-ten-distinct-roots'))) throw new Error('pre-work validator gates required');
    if(general.roots?.length!==8||classAware.roots.length!==9||new Set(classAware.roots.map((r:any)=>r.type)).size!==9||(preWork&&preWork.roots.length!==10)) throw new Error('distinct root closure required');
    const matrix=JSON.parse(readFileSync(resolve(cwd,phase,value('--identity-manifest')),'utf8')); const inventory=JSON.parse(readFileSync(resolve(cwd,phase,'evidence/failure-inventory.json'),'utf8')); assertAuthorizationMatrix(matrix,inventory.failures); const sets=resolveIdentitySetNames(matrix,selection);
    console.log(JSON.stringify({mode:'pre-work-entry',predecessorPlan:predecessor,generalValidator:general,classAwareValidator:classAware,preWorkValidator:preWork,selectedIdentitySets:sets,classes:['production-regression','fixture-drift','harness-nondeterminism','stale-baseline']})); return;
  }
  if(mode==='snapshot-recovery-manifest'){
    const allowed=new Set(['--mode','--manifest','--ordered-commits','--require-exact-members','--verify-git-blobs','--verify-member-sha256','--require-disposition','--require-two-packets','--verify-identities','--verify-row-class-path-matrix']); assertExactFlags(args,allowed);
    if(value('--ordered-commits')!==PRESERVED_COMMITS.join(',')||value('--require-disposition')!=='PRESERVED_AUTHORIZED'||!['--require-exact-members','--verify-git-blobs','--verify-member-sha256','--require-two-packets','--verify-identities','--verify-row-class-path-matrix'].every(flag=>args.includes(flag))) throw new Error('all snapshot recovery gates required');
    const cwd=git(process.cwd(),'rev-parse','--show-toplevel'), base='.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence'; const manifest=JSON.parse(readFileSync(resolve(cwd,value('--manifest')),'utf8')), matrix=JSON.parse(readFileSync(resolve(cwd,base,'corrected-authorization-matrix.json'),'utf8')), rows=JSON.parse(readFileSync(resolve(cwd,base,'core-route-dispositions.json'),'utf8')).rows; validateSnapshotRecoveryManifest(cwd,manifest,matrix,rows); console.log('PASS snapshot-recovery-manifest exact ancestry/member/blob/hash/disposition/packet/identity/matrix closure'); return;
  }
  if(mode==='downstream-reconciliation'){
    const allowed=new Set(['--mode','--validator-authority','--general-validator-values-from','--class-aware-values-from','--require-class-aware-complete','--require-exact-class-aware-marker-hash-commit','--require-class-aware-validator-test-pins','--require-three-preserved-plan03-commits','--require-nine-distinct-roots','--recovery-values-from','--partial-commit','--require-partial-disposition','--require-validator-test-pins','--require-eight-distinct-roots','--reject-01C-authority','--identity-manifest','--dispositions','--identity-filter','--identity-set','--identity-sets','--all-21','--require-corrected-non-stale','--require-two-packets','--verify-row-class-path-matrix','--check-allowlist','--enforce-admin-lock','--enforce-purchasing-lock','--phase-base-commit-from','--cumulative-git-state','--cumulative-authorization-union','--wave-base-commit-from','--wave-git-state','--wave-authorization-union','--pre-phase-dirty-from','--verify-frozen-infrastructure-allowlist','--verify-before-after-sha256','--recompute-invariants','--reject-planning-transition-before-pass','--output','--require-sealed-final-gate','--derive-vrec-04-from-manifests']); assertExactFlags(args,allowed);
    const forbidden=['--recovery-marker-sha256','--recovery-marker-commit','--general-validator-sha256','--general-validator-commit','--class-aware-marker-sha256','--class-aware-marker-commit','--class-aware-validator-pin','--preserved-member']; if(forbidden.some(f=>args.includes(f))) throw new Error('raw authority tokens rejected');
    const cwd=git(process.cwd(),'rev-parse','--show-toplevel'), phase='.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c'; resolveGeneralValidatorAuthority(cwd,resolve(phase,value('--general-validator-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,''));
    if(args.includes('--class-aware-values-from')) { for(const flag of ['--require-class-aware-complete','--require-exact-class-aware-marker-hash-commit','--require-class-aware-validator-test-pins','--require-three-preserved-plan03-commits','--require-nine-distinct-roots']) if(!args.includes(flag)) throw new Error(`${flag} required`); resolveClassAwareAuthority(cwd,resolve(phase,value('--class-aware-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,'')); console.log('PASS downstream-reconciliation sealed general/class-aware authorities resolved'); }
    else { resolveRecoveryAuthority(cwd,resolve(phase,value('--recovery-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,'')); console.log('PASS downstream-reconciliation sealed general/recovery authorities resolved'); } return;
  }
  if (mode !== 'downstream-readiness') throw new Error('closed mode required');
  const allowed = new Set(['--mode','--identity-manifest','--dispositions','--identity-sets','--require-two-packets','--require-corrected-non-stale','--recompute-invariants','--verify-snapshot-guards','--enforce-purchasing-lock','--phase-base-commit-from','--wave-base-commit','--cumulative-git-accounting','--wave-git-accounting','--partial-commit','--recovery-authority']);
  for (const arg of args.filter((arg) => arg.startsWith('--'))) if (!allowed.has(arg)) throw new Error(`unknown CLI input ${arg}`);
  for (const flag of ['--require-two-packets','--require-corrected-non-stale','--recompute-invariants','--verify-snapshot-guards','--enforce-purchasing-lock','--cumulative-git-accounting','--wave-git-accounting']) if (!args.includes(flag)) throw new Error(`${flag} required`);
  if (value('--identity-sets') !== 'readiness-chef,readiness-purchasing' || value('--wave-base-commit') !== '47d13805196fd9ab51d0f08c5de44db7fa26a71b' || value('--partial-commit') !== '235fbd499e0fb5e2f247ea0efa0bb92ea58eff32') throw new Error('canonical argument pins required');
  const cwd = git(process.cwd(), 'rev-parse', '--show-toplevel'); const matrix = JSON.parse(readFileSync(resolve(cwd, value('--identity-manifest')), 'utf8')); const inventory = JSON.parse(readFileSync(resolve(cwd, '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/failure-inventory.json'), 'utf8'));
  assertAuthorizationMatrix(matrix, inventory.failures);
  const result = validateDownstreamReadiness(cwd, matrix, JSON.parse(readFileSync(resolve(cwd, value('--dispositions')), 'utf8')), JSON.parse(readFileSync(resolve(cwd, value('--recovery-authority')), 'utf8')));
  console.log(`PASS downstream-readiness identities=${result.selectedIdentitySets.join(',')} cumulative=${result.cumulativePaths.length} wave=${result.wavePaths.length} dirty=${result.dirtyPaths.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
