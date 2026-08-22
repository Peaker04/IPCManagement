import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHASE_DIR = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c';
export const INVALID_01V_COMMIT = '8502ce701a4070f7be449681ffecbffc36b20056';
export const PAYLOAD_PATHS = [
  `${PHASE_DIR}/27.1-01W-SUMMARY.md`,
  `${PHASE_DIR}/evidence/attestations/27.1-01W-topology-validator-manifest.json`,
  `${PHASE_DIR}/evidence/plan-results/27.1-01W-topology-validator.json`,
  'frontend/tests/validatePhase271Reseal.test.ts',
  'frontend/tests/validatePhase271Reseal.ts',
].sort();
export const MARKER_PATH = `${PHASE_DIR}/evidence/terminal-markers/27.1-01W-topology-validator.json`;
export const WAVE_BASE = '47d13805196fd9ab51d0f08c5de44db7fa26a71b';
export const PARTIAL_COMMIT = '235fbd499e0fb5e2f247ea0efa0bb92ea58eff32';
export const PARTIAL_PATHS = [
  `${PHASE_DIR}/evidence/readiness-dispositions.json`,
  'frontend/tests/visual-routes.spec.ts',
  'frontend/tests/visualReconciliationEvidence.test.ts',
].sort();
export const RECOVERY_PAYLOAD_PATHS = [
  `${PHASE_DIR}/27.1-02R-SUMMARY.md`,
  `${PHASE_DIR}/evidence/attestations/27.1-02R-validator-recovery-manifest.json`,
  `${PHASE_DIR}/evidence/plan-results/27.1-02R-validator-recovery.json`,
  'frontend/tests/validatePhase271Reseal.test.ts',
  'frontend/tests/validatePhase271Reseal.ts',
  'frontend/tests/validateVisualReconciliation.test.ts',
  'frontend/tests/validateVisualReconciliation.ts',
].sort();
export const RECOVERY_MARKER_PATH = `${PHASE_DIR}/evidence/terminal-markers/27.1-02R-validator-recovery.json`;

export type PlanningDeltaEntry = { commit: string; parent: string; paths: Array<{ status: 'A' | 'M'; path: string }> };
export type PlanningDelta = { base: string; head: string; commits: PlanningDeltaEntry[] };
export type Pin = { path: string; sha256: string; gitBlobId: string };
export type TopologyDocument = {
  schemaVersion: 1; phase: '27.1'; planId: '27.1-01W'; status: 'READY_TO_SEAL' | 'COMPLETE';
  authority: 'SOLE_TOPOLOGY_AUTHORITY'; invalid01VStatus: 'SUPERSEDED_PROTOCOL_INVALID';
  planningHead: string; planningDelta: PlanningDelta; planningDeltaSha256: string;
  historicalCommits: string[]; artifactPins: Pin[]; payloadMembers: string[]; blockers: [];
  payloadCommit?: string;
};
export type SealRequest = {
  cwd: string; manifest: unknown; marker: unknown;
  original01Commit: string; invalid01cCommit: string; authority01rCommit: string;
  focused01fCommit: string; invalid01vCommit: string; planningPredecessor: string;
  payloadCommit: string; markerCommit: string;
};

function runGit(cwd: string, ...args: string[]) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
const lines = (value: string) => value.split(/\r?\n/).filter(Boolean);
export const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const validCommit = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function closed(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be object`);
  const actual = Object.keys(value); const missing = keys.filter((key) => !actual.includes(key)); const extra = actual.filter((key) => !keys.includes(key));
  if (missing.length || extra.length) throw new Error(`${label} schema mismatch missing=${missing} extra=${extra}`);
}
function exact<T>(actual: T[], expected: T[], label: string) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} exact membership mismatch`); }
function objectAt(cwd: string, commit: string, path: string, binary = false) {
  return execFileSync('git', ['show', `${commit}:${path}`], { cwd, encoding: binary ? 'buffer' : 'utf8' }) as unknown as string | Buffer;
}
function commitPaths(cwd: string, commit: string) { return lines(runGit(cwd, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit)).sort(); }
function soleParent(cwd: string, commit: string) { const parents = lines(runGit(cwd, 'show', '-s', '--format=%P', commit).replace(/ /g, '\n')); if (parents.length !== 1) throw new Error(`${commit} must have exactly one parent`); return parents[0]; }
export function planningDeltaSha256(delta: PlanningDelta) { return sha256(`${JSON.stringify(delta)}\n`); }

const BASE_KEYS = ['schemaVersion','phase','planId','status','authority','invalid01VStatus','planningHead','planningDelta','planningDeltaSha256','historicalCommits','artifactPins','payloadMembers','blockers'];
export function validateTopologyDocument(value: unknown, status: 'READY_TO_SEAL' | 'COMPLETE'): asserts value is TopologyDocument {
  const keys = status === 'COMPLETE' ? [...BASE_KEYS, 'payloadCommit'] : BASE_KEYS;
  closed(value, keys, '01W document');
  for (const forbidden of ['expectedLiveHead','selfCommit','selfHash']) if (forbidden in value) throw new Error(`${forbidden} forbidden`);
  if (value.schemaVersion !== 1 || value.phase !== '27.1' || value.planId !== '27.1-01W' || value.status !== status || value.authority !== 'SOLE_TOPOLOGY_AUTHORITY' || value.invalid01VStatus !== 'SUPERSEDED_PROTOCOL_INVALID') throw new Error('01W identity/status/authority mismatch');
  if (!validCommit(value.planningHead)) throw new Error('invalid planning head');
  if (!Array.isArray(value.blockers) || value.blockers.length) throw new Error('blockers forbidden');
  closed(value.planningDelta, ['base','head','commits'], 'planningDelta');
  if (value.planningDelta.head !== value.planningHead || planningDeltaSha256(value.planningDelta as PlanningDelta) !== value.planningDeltaSha256) throw new Error('planning delta pins mismatch');
  if (!Array.isArray(value.historicalCommits) || value.historicalCommits.length !== 5 || value.historicalCommits.some((x) => !validCommit(x)) || new Set(value.historicalCommits).size !== 5) throw new Error('five distinct predecessor roots required');
  if (!Array.isArray(value.artifactPins) || value.artifactPins.length !== 2) throw new Error('exact validator pins required');
  exact((value.artifactPins as Pin[]).map((pin) => pin.path).sort(), ['frontend/tests/validatePhase271Reseal.test.ts','frontend/tests/validatePhase271Reseal.ts'], 'validator pins');
  exact(value.payloadMembers as string[], PAYLOAD_PATHS, 'payload members');
  if (status === 'COMPLETE' && !validCommit(value.payloadCommit)) throw new Error('payload commit invalid');
}

export function validateSeal(request: SealRequest) {
  if ('expectedLiveHead' in request) throw new Error('expectedLiveHead forbidden in seal mode');
  const commits = [request.original01Commit, request.invalid01cCommit, request.authority01rCommit, request.focused01fCommit, request.invalid01vCommit, request.planningPredecessor];
  if (commits.some((value) => !validCommit(value)) || new Set(commits).size !== 6) throw new Error('six explicit distinct roots required');
  validateTopologyDocument(request.manifest, 'READY_TO_SEAL'); validateTopologyDocument(request.marker, 'COMPLETE');
  exact(request.manifest.historicalCommits, commits.slice(0, 5), 'historical commits'); exact(request.marker.historicalCommits, commits.slice(0, 5), 'marker historical commits');
  if (request.manifest.planningHead !== request.planningPredecessor || request.marker.planningHead !== request.planningPredecessor) throw new Error('planning predecessor mismatch');
  if (request.manifest.planningDeltaSha256 !== request.marker.planningDeltaSha256 || JSON.stringify(request.manifest.planningDelta) !== JSON.stringify(request.marker.planningDelta)) throw new Error('planning pins differ');
  if (request.marker.payloadCommit !== request.payloadCommit) throw new Error('marker payload reference mismatch');
  if (request.markerCommit === request.payloadCommit || JSON.stringify(request.manifest).includes(request.markerCommit)) throw new Error('self or cyclic commit reference forbidden');
  exact(commitPaths(request.cwd, request.payloadCommit), PAYLOAD_PATHS, '01W payload'); exact(commitPaths(request.cwd, request.markerCommit), [MARKER_PATH], '01W marker');
  if (soleParent(request.cwd, request.payloadCommit) !== request.planningPredecessor) throw new Error('payload direct parent mismatch');
  if (soleParent(request.cwd, request.markerCommit) !== request.payloadCommit) throw new Error('marker direct parent mismatch');
  for (const pin of request.manifest.artifactPins) {
    const bytes = objectAt(request.cwd, request.payloadCommit, pin.path, true) as Buffer;
    const blob = runGit(request.cwd, 'rev-parse', `${request.payloadCommit}:${pin.path}`);
    if (sha256(bytes) !== pin.sha256 || blob !== pin.gitBlobId) throw new Error(`artifact hash mismatch: ${pin.path}`);
  }
  return { payloadCommit: request.payloadCommit, markerCommit: request.markerCommit };
}

export type HistoricalEntryRequest = { cwd: string; markerPath: string; markerSha256: string; waveBaseCommit: string; partialCommit: string; partialSoleParent: string };
export function validateHistoricalEntry(request: HistoricalEntryRequest) {
  if (request.waveBaseCommit !== WAVE_BASE || request.partialCommit !== PARTIAL_COMMIT || request.partialSoleParent !== WAVE_BASE) throw new Error('historical commit pin mismatch');
  const markerBytes = readFileSync(resolve(request.cwd, request.markerPath));
  if (sha256(markerBytes) !== request.markerSha256) throw new Error('01W marker hash mismatch');
  const marker = JSON.parse(markerBytes.toString()) as TopologyDocument;
  validateTopologyDocument(marker, 'COMPLETE');
  if (runGit(request.cwd, 'rev-parse', `${WAVE_BASE}^{commit}`) !== WAVE_BASE || soleParent(request.cwd, PARTIAL_COMMIT) !== WAVE_BASE) throw new Error('partial sole-parent topology mismatch');
  if ((marker as TopologyDocument).payloadCommit !== runGit(request.cwd, 'rev-parse', `${WAVE_BASE}^`)) throw new Error('01W marker commit topology mismatch');
  return { waveBaseCommit: WAVE_BASE, partialCommit: PARTIAL_COMMIT };
}

export function validateRecoveryInspect(cwd: string, matrix: any) {
  if (soleParent(cwd, PARTIAL_COMMIT) !== WAVE_BASE) throw new Error('partial sole-parent topology mismatch');
  exact(commitPaths(cwd, PARTIAL_COMMIT), PARTIAL_PATHS, 'partial commit');
  const dispositionPath = PARTIAL_PATHS[0];
  const dispositionBytes = objectAt(cwd, PARTIAL_COMMIT, dispositionPath, true) as Buffer;
  const dispositions = JSON.parse(dispositionBytes.toString());
  const selected = ['readiness-chef', 'readiness-purchasing'];
  exact(Object.keys(dispositions.identitySets).sort(), selected, 'partial identities');
  for (const setName of selected) for (const row of dispositions.identitySets[setName]) {
    const matrixIdentity = matrix.identitySets[setName].find((x: any) => x.snapshotName.startsWith(row.identity));
    if (!matrixIdentity) throw new Error(`identity substitution: ${row.identity}`);
    const entry = matrix.entries.find((x: any) => x.snapshotName === matrixIdentity.snapshotName);
    if (row.disposition !== 'fixture-drift' || row.owner !== 'frontend/tests/visual-routes.spec.ts' || !entry.permittedPaths['fixture-drift'].includes(row.owner)) throw new Error('owner borrowing or class/path laundering');
    if (!Array.isArray(row.beforeSha256) || !Array.isArray(row.afterSha256) || row.beforeSha256.length !== 2 || row.afterSha256.length !== 2 || row.beforeSha256[0] !== row.beforeSha256[1] || row.afterSha256[0] !== row.afterSha256[1] || row.beforeSha256[0] === row.afterSha256[0]) throw new Error('packet hashes invalid');
  }
  return { schemaVersion: 1, phase: '27.1', planId: '27.1-02R', status: 'AUTHORIZED_PARTIAL', waveBaseCommit: WAVE_BASE, partialCommit: PARTIAL_COMMIT, partialParent: WAVE_BASE, identitySets: selected, members: PARTIAL_PATHS.map((path) => { const bytes = objectAt(cwd, PARTIAL_COMMIT, path, true) as Buffer; return { path, sha256: sha256(bytes), gitBlobId: runGit(cwd, 'rev-parse', `${PARTIAL_COMMIT}:${path}`) }; }) };
}

export function validateCloseout(cwd: string, head: string) {
  const actual = runGit(cwd, 'rev-parse', head);
  if (runGit(cwd, 'merge-base', WAVE_BASE, actual) !== WAVE_BASE) throw new Error('HEAD is not descendant');
  if (runGit(cwd, 'status', '--porcelain')) throw new Error('dirty state rejected');
  const commits = lines(runGit(cwd, 'rev-list', '--reverse', `${WAVE_BASE}..${actual}`));
  if (commits[0] !== PARTIAL_COMMIT) throw new Error('partial commit must be first descendant');
  for (const commit of commits) if (soleParent(cwd, commit) === '') throw new Error('merge rejected');
  return commits.map((commit) => ({ commit, parent: soleParent(cwd, commit), paths: commitPaths(cwd, commit), pathHashes: commitPaths(cwd, commit).map((path) => ({ path, sha256: sha256(objectAt(cwd, commit, path, true) as Buffer) })) }));
}

export function validateDownstream(cwd: string, expectedLiveHead: string) {
  if (!validCommit(expectedLiveHead)) throw new Error('--expected-live-head required');
  const actual = runGit(cwd, 'rev-parse', 'HEAD');
  if (actual !== expectedLiveHead) throw new Error(`live HEAD mismatch expected=${expectedLiveHead} actual=${actual}`);
  return actual;
}
function argsMap(argv: string[]) { const map = new Map<string,string>(); for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) map.set(argv[i], argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'); return map; }
function required(map: Map<string,string>, flag: string) { const value = map.get(flag); if (!value || value === 'true') throw new Error(`${flag} required`); return value; }
function phasePath(value: string) { return value.startsWith('.planning/') ? value : `${PHASE_DIR}/${value}`; }
function main() {
  const cwd = runGit(process.cwd(), 'rev-parse', '--show-toplevel'); const args = argsMap(process.argv.slice(2)); const stage = required(args, '--stage');
  if (stage === 'downstream') { console.log(`PASS downstream live ${validateDownstream(cwd, required(args, '--expected-live-head'))}`); return; }
  if (stage === 'historical-entry') {
    if (!args.has('--no-live-head')) throw new Error('--no-live-head required');
    const result = validateHistoricalEntry({ cwd, markerPath: required(args, '--topology-authority-marker'), markerSha256: required(args, '--topology-authority-marker-sha256'), waveBaseCommit: required(args, '--wave-base-commit'), partialCommit: required(args, '--partial-commit'), partialSoleParent: required(args, '--require-partial-sole-parent') });
    console.log(`PASS historical-entry ${result.partialCommit}`); return;
  }
  if (stage === 'recovery-inspect') {
    for (const flag of ['--require-exact-member-content','--reject-owner-borrowing']) if (!args.has(flag)) throw new Error(`${flag} required`);
    const matrix = JSON.parse(readFileSync(resolve(cwd, required(args, '--identity-manifest')), 'utf8'));
    const result = validateRecoveryInspect(cwd, matrix); writeFileSync(resolve(cwd, required(args, '--output')), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`PASS recovery-inspect ${result.partialCommit}`); return;
  }
  if (stage === 'closeout') { console.log(`PASS closeout ${JSON.stringify(validateCloseout(cwd, required(args, '--current-head')))}`); return; }
  if (stage !== 'seal-01w') throw new Error(`unknown stage ${stage}`);
  if (args.has('--expected-live-head')) throw new Error('--expected-live-head forbidden in seal mode');
  for (const flag of ['--require-six-distinct-roots','--require-exact-payload-members','--require-immediate-parent','--require-marker-only-commit']) if (!args.has(flag)) throw new Error(`${flag} required`);
  const manifest = JSON.parse(readFileSync(resolve(cwd, phasePath(required(args, '--manifest'))), 'utf8'));
  const markerCommit = required(args, '--marker-commit'); const marker = JSON.parse(objectAt(cwd, markerCommit, MARKER_PATH) as string);
  const result = validateSeal({ cwd, manifest, marker, original01Commit: required(args, '--original-01-commit'), invalid01cCommit: required(args, '--invalid-01c-commit'), authority01rCommit: required(args, '--authority-01r-commit'), focused01fCommit: required(args, '--focused-01f-commit'), invalid01vCommit: required(args, '--invalid-01v-commit'), planningPredecessor: required(args, '--planning-predecessor'), payloadCommit: required(args, '--payload-commit'), markerCommit });
  console.log(`PASS 27.1-01W seal payload=${result.payloadCommit} marker=${result.markerCommit}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
