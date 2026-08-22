import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHASE_DIR = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c';
export const FROZEN_OPERATIONAL_BASE = '06f920e0f2c66f5f3d4810f1c0d6ddff14f0a98c';
export const HISTORICAL_ROOTS = [
  { id: '27.1-01', flag: '--original-01-commit', markerFlag: '--original-01-marker', commit: 'c52c80f8186b985d07619a7ad0ed7abc0572675c', marker: `${PHASE_DIR}/evidence/terminal-markers/27.1-01.json` },
  { id: '27.1-01C', flag: '--invalid-01c-commit', markerFlag: '--invalid-01c-marker', commit: 'ae129eaab0dde192f3dca17c7504b7b9aaef5d17', marker: `${PHASE_DIR}/evidence/terminal-markers/27.1-01C-correction.json` },
  { id: '27.1-01R', flag: '--authority-01r-commit', markerFlag: '--authority-marker', commit: 'fb93fd120d1f5ec81760070be67ed65429ae4c03', marker: `${PHASE_DIR}/evidence/terminal-markers/27.1-01R-reseal.json` },
  { id: '27.1-01F', flag: '--focused-01f-commit', markerFlag: '--focused-marker', commit: FROZEN_OPERATIONAL_BASE, marker: `${PHASE_DIR}/evidence/terminal-markers/27.1-01F-focused-launcher.json` },
] as const;
export const PAYLOAD_PATHS = [
  `${PHASE_DIR}/27.1-01V-SUMMARY.md`,
  `${PHASE_DIR}/evidence/attestations/27.1-01V-topology-validator-manifest.json`,
  `${PHASE_DIR}/evidence/plan-results/27.1-01V-topology-validator.json`,
  'frontend/tests/validatePhase271Reseal.test.ts',
  'frontend/tests/validatePhase271Reseal.ts',
].sort();
export const MARKER_PATH = `${PHASE_DIR}/evidence/terminal-markers/27.1-01V-topology-validator.json`;
export type PlanningDeltaEntry = { commit: string; parent: string; paths: Array<{ status: 'A' | 'M'; path: string }> };
export type PlanningDelta = { base: string; head: string; commits: PlanningDeltaEntry[] };
export type Pin = { path: string; sha256: string; gitBlobId: string };
export type TopologyDocument = { schemaVersion: 1; phase: '27.1'; planId: '27.1-01V'; status: 'READY_TO_SEAL' | 'COMPLETE'; authority: 'TOPOLOGY_VALIDATOR_ONLY'; frozenOperationalBase: string; planningHead: string; planningDelta: PlanningDelta; planningDeltaSha256: string; expectedLiveHead: string; validatorPins: Pin[]; payloadMembers: string[]; blockers: [] };

function runGit(cwd: string, ...args: string[]) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function lines(value: string) { return value.split(/\r?\n/).filter(Boolean); }
export function sha256(value: Buffer | string) { return createHash('sha256').update(value).digest('hex'); }
function validCommit(value: unknown) { return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value); }
function closed(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be object`);
  const actual = Object.keys(value); const missing = keys.filter((key) => !actual.includes(key)); const extra = actual.filter((key) => !keys.includes(key));
  if (missing.length || extra.length) throw new Error(`${label} schema mismatch missing=${missing} extra=${extra}`);
}
function exact(actual: string[], expected: string[], label: string) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} exact membership mismatch`); }
function objectAt(cwd: string, commit: string, path: string) { return runGit(cwd, 'show', `${commit}:${path}`); }
function commitPaths(cwd: string, commit: string) { return lines(runGit(cwd, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit)).sort(); }
function isAncestor(cwd: string, older: string, newer: string) { try { runGit(cwd, 'merge-base', '--is-ancestor', older, newer); return true; } catch { return false; } }
function canonicalPlanningPath(path: string) {
  if (path === '.planning/ROADMAP.md') return true;
  const prefix = `${PHASE_DIR}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return /^27\.1-(?:[A-Z0-9]+-)?PLAN\.md$/.test(name) || name === '27.1-RESEARCH.md' || name === '27.1-VALIDATION.md';
}
function validatePlanningDocument(cwd: string, commit: string, path: string) {
  const text = objectAt(cwd, commit, path);
  if (!text.trim() || /\0/.test(text)) throw new Error(`malformed planning document: ${path}`);
  if (path === '.planning/ROADMAP.md') { if (!/^#\s+.*Roadmap/im.test(text)) throw new Error(`malformed ROADMAP: ${path}`); return; }
  if (path.endsWith('-PLAN.md')) { if (!/^---\r?\n[\s\S]*?\r?\n---/m.test(text) || !/<(?:objective|tasks)>/.test(text)) throw new Error(`malformed PLAN: ${path}`); return; }
  if (!/^#\s+/m.test(text)) throw new Error(`malformed planning document: ${path}`);
}
export function canonicalPlanningDelta(cwd: string, base: string, head: string): PlanningDelta {
  if (!validCommit(runGit(cwd, 'rev-parse', base)) || !validCommit(runGit(cwd, 'rev-parse', head))) throw new Error('base/head must resolve to commits');
  if (!isAncestor(cwd, base, head)) throw new Error('frozen operational base must be an ancestor of planning head');
  const commits = lines(runGit(cwd, 'rev-list', '--reverse', '--ancestry-path', `${base}..${head}`)).map((commit) => {
    const parents = lines(runGit(cwd, 'show', '-s', '--format=%P', commit).replace(/ /g, '\n'));
    if (parents.length !== 1) throw new Error(`merge commit forbidden in planning delta: ${commit}`);
    const records = lines(runGit(cwd, 'diff-tree', '--no-commit-id', '--name-status', '-r', commit));
    if (!records.length) throw new Error(`empty planning commit forbidden: ${commit}`);
    const paths = records.map((record) => {
      const [status, ...pathParts] = record.split('\t'); const path = pathParts.join('\t');
      if (status !== 'A' && status !== 'M') throw new Error(`deletion/rename/type change forbidden: ${record}`);
      if (!canonicalPlanningPath(path)) throw new Error(`non-planning path forbidden: ${path}`);
      validatePlanningDocument(cwd, commit, path);
      return { status, path } as { status: 'A' | 'M'; path: string };
    }).sort((a, b) => a.path.localeCompare(b.path) || a.status.localeCompare(b.status));
    return { commit, parent: parents[0], paths };
  });
  return { base: runGit(cwd, 'rev-parse', base), head: runGit(cwd, 'rev-parse', head), commits };
}
export function planningDeltaSha256(delta: PlanningDelta) { return sha256(`${JSON.stringify(delta)}\n`); }
export function assertClean(cwd: string) { if (runGit(cwd, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('planning head requires clean staged, unstaged, and untracked state'); }
export function freezePlanningHead(cwd: string, base = FROZEN_OPERATIONAL_BASE) { assertClean(cwd); const head = runGit(cwd, 'rev-parse', 'HEAD'); const delta = canonicalPlanningDelta(cwd, base, head); return { planningHead: head, planningDelta: delta, planningDeltaSha256: planningDeltaSha256(delta) }; }

export function validateHistoricalRoots(cwd: string, roots: Array<{ commit: string; marker: string }>) {
  if (roots.length !== 4 || new Set(roots.map((root) => root.commit)).size !== 4) throw new Error('four distinct historical roots required');
  roots.forEach((root, index) => {
    const expected = HISTORICAL_ROOTS[index];
    if (root.commit !== expected.commit || root.marker !== expected.marker) throw new Error(`historical root ${expected.id} substituted`);
    exact(commitPaths(cwd, root.commit), [root.marker], `${expected.id} marker commit`);
    const marker = JSON.parse(objectAt(cwd, root.commit, root.marker));
    if (marker.planId !== expected.id || marker.status !== 'COMPLETE') throw new Error(`${expected.id} historical marker identity mismatch`);
    if (index && !isAncestor(cwd, roots[index - 1].commit, root.commit)) throw new Error(`historical roots reordered or unreachable at ${expected.id}`);
    if (!isAncestor(cwd, root.commit, FROZEN_OPERATIONAL_BASE)) throw new Error(`${expected.id} does not reach frozen operational base`);
  });
}
export function currentPin(cwd: string, path: string): Pin { const absolute = resolve(cwd, path); const bytes = readFileSync(absolute); return { path, sha256: sha256(bytes), gitBlobId: runGit(cwd, 'hash-object', '--', absolute) }; }
export function validateTopologyDocument(value: unknown, status: 'READY_TO_SEAL' | 'COMPLETE', cwd?: string): asserts value is TopologyDocument {
  const keys = ['schemaVersion','phase','planId','status','authority','frozenOperationalBase','planningHead','planningDelta','planningDeltaSha256','expectedLiveHead','validatorPins','payloadMembers','blockers'];
  if (status === 'COMPLETE') keys.push('payloadCommit');
  closed(value, keys, '01V document');
  if (value.schemaVersion !== 1 || value.phase !== '27.1' || value.planId !== '27.1-01V' || value.status !== status || value.authority !== 'TOPOLOGY_VALIDATOR_ONLY') throw new Error('01V identity/status/authority mismatch');
  if (value.frozenOperationalBase !== FROZEN_OPERATIONAL_BASE || !validCommit(value.planningHead) || !validCommit(value.expectedLiveHead)) throw new Error('invalid frozen base/planning/live head');
  if (!Array.isArray(value.blockers) || value.blockers.length) throw new Error('blockers forbidden');
  closed(value.planningDelta, ['base','head','commits'], 'planningDelta');
  if (value.planningDelta.base !== value.frozenOperationalBase || value.planningDelta.head !== value.planningHead || planningDeltaSha256(value.planningDelta as PlanningDelta) !== value.planningDeltaSha256) throw new Error('planning delta pins mismatch');
  if (!Array.isArray(value.validatorPins) || value.validatorPins.length !== 2) throw new Error('exactly two validator pins required');
  exact((value.validatorPins as Pin[]).map((pin) => pin.path).sort(), ['frontend/tests/validatePhase271Reseal.test.ts','frontend/tests/validatePhase271Reseal.ts'], 'validator pins');
  exact(value.payloadMembers as string[], PAYLOAD_PATHS, 'payload members');
  if (status === 'COMPLETE' && !validCommit(value.payloadCommit)) throw new Error('payload commit invalid');
  if (cwd) {
    const recomputed = canonicalPlanningDelta(cwd, value.frozenOperationalBase as string, value.planningHead as string);
    if (JSON.stringify(recomputed) !== JSON.stringify(value.planningDelta) || planningDeltaSha256(recomputed) !== value.planningDeltaSha256) throw new Error('historical planning delta mismatch');
    if (runGit(cwd, 'rev-parse', 'HEAD') !== value.expectedLiveHead) throw new Error('stage-local expected live head mismatch');
  }
}
export function validatePayloadTopology(cwd: string, payloadCommit: string, markerCommit: string, planningHead: string) {
  exact(commitPaths(cwd, payloadCommit), PAYLOAD_PATHS, '01V payload'); exact(commitPaths(cwd, markerCommit), [MARKER_PATH], '01V marker');
  exact(lines(runGit(cwd, 'show', '-s', '--format=%P', payloadCommit).replace(/ /g, '\n')), [planningHead], 'payload direct parent');
  exact(lines(runGit(cwd, 'show', '-s', '--format=%P', markerCommit).replace(/ /g, '\n')), [payloadCommit], 'marker direct parent');
}
function argsMap(argv: string[]) { const map = new Map<string,string>(); for (let i=0;i<argv.length;i++) if (argv[i].startsWith('--')) { if (argv[i + 1] && !argv[i + 1].startsWith('--')) map.set(argv[i], argv[++i]); else map.set(argv[i], 'true'); } return map; }
function requireArg(map: Map<string,string>, name: string) { const value = map.get(name); if (!value) throw new Error(`${name} required`); return value; }
function normalizeMarker(value: string) { return value.startsWith('.planning/') ? value : `${PHASE_DIR}/${value}`; }
function main() {
  const cwd = runGit(process.cwd(), 'rev-parse', '--show-toplevel'); const map = argsMap(process.argv.slice(2)); const stage = requireArg(map, '--stage');
  for (const flag of ['--require-exact-payload-members']) requireArg(map, flag);
  if (stage === 'preseal-01v') { const frozen = freezePlanningHead(cwd); console.log(JSON.stringify(frozen)); return; }
  if (stage === 'seal-01v') {
    const manifest = JSON.parse(readFileSync(resolve(cwd, normalizeMarker(requireArg(map, '--manifest'))), 'utf8')); validateTopologyDocument(manifest, 'READY_TO_SEAL');
    const marker = JSON.parse(readFileSync(resolve(cwd, MARKER_PATH), 'utf8')); validateTopologyDocument(marker, 'COMPLETE', cwd);
    validatePayloadTopology(cwd, marker.payloadCommit, runGit(cwd, 'rev-parse', 'HEAD'), marker.planningHead); console.log(`PASS 27.1-01V seal ${marker.payloadCommit}`); return;
  }
  if (stage !== 'downstream') throw new Error(`unknown stage ${stage}`);
  for (const flag of ['--original-01-commit','--invalid-01c-commit','--authority-01r-commit','--focused-01f-commit','--frozen-operational-base','--planning-head','--planning-delta-manifest-sha256','--expected-live-head','--topology-authority-marker','--require-four-distinct-roots','--require-seven-sealed-artifacts']) requireArg(map, flag);
  const roots = HISTORICAL_ROOTS.map((expected) => ({ commit: requireArg(map, expected.flag), marker: normalizeMarker(requireArg(map, expected.markerFlag)) })); validateHistoricalRoots(cwd, roots);
  if (requireArg(map, '--frozen-operational-base') !== FROZEN_OPERATIONAL_BASE || requireArg(map, '--focused-01f-commit') !== FROZEN_OPERATIONAL_BASE) throw new Error('frozen operational base mismatch');
  const markerPath = normalizeMarker(requireArg(map, '--topology-authority-marker')); const markerCommit = runGit(cwd, 'log', '-1', '--format=%H', '--', markerPath); const marker = JSON.parse(objectAt(cwd, markerCommit, markerPath));
  validateTopologyDocument(marker, 'COMPLETE');
  if (marker.planningHead !== requireArg(map, '--planning-head') || marker.planningDeltaSha256 !== requireArg(map, '--planning-delta-manifest-sha256')) throw new Error('caller planning pins mismatch');
  validateTopologyDocument({ ...marker, expectedLiveHead: requireArg(map, '--expected-live-head') }, 'COMPLETE', cwd);
  validatePayloadTopology(cwd, marker.payloadCommit, markerCommit, marker.planningHead); console.log(`PASS 27.1-01V downstream: historical roots at explicit commits; planning ${marker.planningHead}; live ${marker.expectedLiveHead}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
