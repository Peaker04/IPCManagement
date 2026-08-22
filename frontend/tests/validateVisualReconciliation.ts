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
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const outputLines = (value: string) => value.split(/\r?\n/).filter(Boolean);
export function validateDownstreamReadiness(cwd: string, matrix: AuthorizationMatrix, dispositions: ReadinessDisposition, recovery: any) {
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
  const dirty = outputLines(git(cwd, 'status', '--porcelain')).map((line) => line.slice(3));
  const all = [...new Set([...cumulative, ...wave, ...dirty])];
  const forbidden = all.filter((path) => path.includes('-snapshots/') || path.startsWith('frontend/src/'));
  if (forbidden.length) throw new Error(`unauthorized Git accounting member: ${forbidden.join(',')}`);
  return { selectedIdentitySets: selected, cumulativePaths: cumulative, wavePaths: wave, dirtyPaths: dirty };
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
    const allowed=new Set(['--mode','--predecessor-plan','--validator-authority','--general-validator-values-from','--require-complete','--require-exact-marker-hash-commit','--require-four-validator-test-pins','--require-eight-distinct-roots','--require-exact-predecessor','--identity-manifest','--identity-sets','--resolve-selected-classes','--reject-legacy-entry-authority','--emit-entry-context-json']); assertExactFlags(args,allowed);
    const predecessor=value('--predecessor-plan'), selection=value('--identity-sets'); if(!['27.1-02','27.1-03','27.1-04','27.1-05','27.1-06'].includes(predecessor)||value('--validator-authority')!=='27.1-03R') throw new Error('closed predecessor/authority required');
    const cwd=git(process.cwd(),'rev-parse','--show-toplevel'), general=resolveGeneralValidatorAuthority(cwd,resolve('.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c',value('--general-validator-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,''));
    if(general.roots?.length!==8||new Set(general.roots.map((r:any)=>r.type)).size!==8) throw new Error('eight distinct roots required');
    const matrix=JSON.parse(readFileSync(resolve(cwd,'.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c',value('--identity-manifest')),'utf8')); const inventory=JSON.parse(readFileSync(resolve(cwd,'.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/failure-inventory.json'),'utf8')); assertAuthorizationMatrix(matrix,inventory.failures); const sets=resolveIdentitySetNames(matrix,selection);
    console.log(JSON.stringify({mode:'pre-work-entry',predecessorPlan:predecessor,generalValidator:general,selectedIdentitySets:sets,classes:['production-regression','fixture-drift','harness-nondeterminism','stale-baseline']})); return;
  }
  if(mode==='downstream-reconciliation'){
    const forbidden=['--recovery-marker-sha256','--recovery-marker-commit','--general-validator-sha256','--general-validator-commit']; if(forbidden.some(f=>args.includes(f))) throw new Error('raw authority tokens rejected');
    const cwd=git(process.cwd(),'rev-parse','--show-toplevel'); resolveGeneralValidatorAuthority(cwd,resolve('.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c',value('--general-validator-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,'')); resolveRecoveryAuthority(cwd,resolve('.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c',value('--recovery-values-from')).replaceAll('\\','/').replace(`${cwd.replaceAll('\\','/')}/`,'')); console.log('PASS downstream-reconciliation sealed general/recovery authorities resolved'); return;
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
