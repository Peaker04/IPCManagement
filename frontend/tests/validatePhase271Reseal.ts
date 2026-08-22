import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAuthorizationMatrix } from './validateVisualReconciliation.ts';

const PHASE_DIR = '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c';
export const SEALED_PATHS = [
  `${PHASE_DIR}/evidence/corrected-authorization-matrix.json`,
  'frontend/tests/validatePhase271PlanResult.test.ts',
  'frontend/tests/validatePhase271PlanResult.ts',
  'frontend/tests/validatePhase271Reseal.test.ts',
  'frontend/tests/validatePhase271Reseal.ts',
  'frontend/tests/validateVisualReconciliation.test.ts',
  'frontend/tests/validateVisualReconciliation.ts',
].sort();
export const PAYLOAD_PATHS = [
  `${PHASE_DIR}/27.1-01R-SUMMARY.md`,
  `${PHASE_DIR}/evidence/attestations/27.1-01R-byte-manifest.json`,
  `${PHASE_DIR}/evidence/attestations/27.1-01R-lineage-manifest.json`,
  `${PHASE_DIR}/evidence/plan-results/27.1-01R-reseal.json`,
  'frontend/tests/validatePhase271Reseal.test.ts',
  'frontend/tests/validatePhase271Reseal.ts',
].sort();
export const MARKER_PATH = `${PHASE_DIR}/evidence/terminal-markers/27.1-01R-reseal.json`;
export const ROOT_PATHS = {
  original: `${PHASE_DIR}/evidence/terminal-markers/27.1-01.json`,
  correction: `${PHASE_DIR}/evidence/terminal-markers/27.1-01C-correction.json`,
  reseal: MARKER_PATH,
} as const;
const ORIGINAL = { sha256: 'b2975e45e548896d7831a98083fc36d82f3e63a9d068c087482231e330fbcc02', commit: 'c52c80f8186b985d07619a7ad0ed7abc0572675c' };
const CORRECTION = { sha256: '22f1e4ff032acb6b87eb7148049be1a1707cda7bbfa1d82a61a1b80333c0d0e0', commit: 'ae129eaab0dde192f3dca17c7504b7b9aaef5d17' };

export type Pin = { path: string; sha256: string; gitBlobId: string };
type Root = { type: 'ORIGINAL_SOURCE' | 'HISTORICAL_CORRECTION_PROVENANCE' | 'AUTHORITATIVE_RESEAL'; path: string; sha256: string | null; commit: string | null; disposition: 'IMMUTABLE_SOURCE' | 'SUPERSEDED_PROTOCOL_INVALID' | 'AUTHORITATIVE' };
export type ResealDocument = { schemaVersion: 1; phase: '27.1'; planId: '27.1-01R'; status: 'READY_TO_SEAL' | 'COMPLETE'; roots: Root[]; sealedArtifacts: Pin[]; payloadMembers: string[]; sourceSuiteRerun: false; blockers: [] };

function closed(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value); const extra = actual.filter((key) => !keys.includes(key)); const missing = keys.filter((key) => !actual.includes(key));
  if (extra.length || missing.length) throw new Error(`${label} schema mismatch extra=${extra.join(',')} missing=${missing.join(',')}`);
}
function exact(actual: string[], expected: string[], label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} must equal exact sorted allowlist`);
}
function validHash(value: unknown, length: number) { return typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value); }
export function sha256(bytes: Buffer | string) { return createHash('sha256').update(bytes).digest('hex'); }
function git(...args: string[]) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
export function currentPin(path: string): Pin {
  const repoRoot = git('rev-parse', '--show-toplevel');
  const absolutePath = resolve(repoRoot, path);
  const bytes = readFileSync(absolutePath);
  return { path, sha256: sha256(bytes), gitBlobId: git('hash-object', '--', absolutePath) };
}

export function validateRoots(roots: unknown, final = false): asserts roots is Root[] {
  if (!Array.isArray(roots) || roots.length !== 3) throw new Error('exactly three roots are required');
  const expected = [
    { type: 'ORIGINAL_SOURCE', path: ROOT_PATHS.original, disposition: 'IMMUTABLE_SOURCE', ...ORIGINAL },
    { type: 'HISTORICAL_CORRECTION_PROVENANCE', path: ROOT_PATHS.correction, disposition: 'SUPERSEDED_PROTOCOL_INVALID', ...CORRECTION },
    { type: 'AUTHORITATIVE_RESEAL', path: ROOT_PATHS.reseal, disposition: 'AUTHORITATIVE', sha256: null, commit: null },
  ];
  roots.forEach((root, index) => {
    closed(root, ['type', 'path', 'sha256', 'commit', 'disposition'], `roots[${index}]`);
    if (Object.keys(expected[index]).some((key) => root[key] !== (expected[index] as Record<string, unknown>)[key])) throw new Error(`root ${index} mismatch or authority collapse`);
  });
  if (new Set(roots.map((root) => root.path)).size !== 3) throw new Error('roots must be distinct');
  if (final && roots[2].sha256 !== null) throw new Error('reseal marker must not self-claim a hash');
}

export function validatePins(pins: unknown, verifyCurrent = false): asserts pins is Pin[] {
  if (!Array.isArray(pins) || pins.length !== 7) throw new Error('exactly seven sealed artifact pins are required');
  const paths = pins.map((pin, index) => {
    closed(pin, ['path', 'sha256', 'gitBlobId'], `sealedArtifacts[${index}]`);
    if (typeof pin.path !== 'string' || !validHash(pin.sha256, 64) || !validHash(pin.gitBlobId, 40)) throw new Error(`invalid pin ${index}`);
    if (verifyCurrent) {
      const actual = currentPin(pin.path);
      if (actual.sha256 !== pin.sha256 || actual.gitBlobId !== pin.gitBlobId) throw new Error(`sealed artifact pin mismatch: ${pin.path}`);
    }
    return pin.path;
  });
  exact(paths, SEALED_PATHS, 'sealed artifacts');
}

export function validateResealDocument(value: unknown, expectedStatus: 'READY_TO_SEAL' | 'COMPLETE', verifyCurrent = false): asserts value is ResealDocument {
  const keys = ['schemaVersion', 'phase', 'planId', 'status', 'roots', 'sealedArtifacts', 'payloadMembers', 'sourceSuiteRerun', 'blockers'];
  if (expectedStatus === 'COMPLETE') keys.push('payloadCommit');
  closed(value, keys, 'reseal document');
  if (value.schemaVersion !== 1 || value.phase !== '27.1' || value.planId !== '27.1-01R' || value.status !== expectedStatus) throw new Error('reseal identity/status mismatch');
  if (value.sourceSuiteRerun !== false || !Array.isArray(value.blockers) || value.blockers.length) throw new Error('source rerun or blockers are forbidden');
  if (expectedStatus === 'COMPLETE' && !validHash(value.payloadCommit, 40)) throw new Error('marker payloadCommit invalid');
  validateRoots(value.roots, expectedStatus === 'COMPLETE'); validatePins(value.sealedArtifacts, verifyCurrent);
  if (!Array.isArray(value.payloadMembers)) throw new Error('payloadMembers required');
  exact(value.payloadMembers as string[], PAYLOAD_PATHS, 'payload members');
}

export function validateTopology(input: { payloadCommit: string; markerParents: string[]; payloadPaths: string[]; markerPaths: string[] }) {
  if (!validHash(input.payloadCommit, 40)) throw new Error('payload commit invalid');
  exact([...input.payloadPaths].sort(), PAYLOAD_PATHS, 'payload commit paths');
  exact([...input.markerPaths].sort(), [MARKER_PATH], 'marker commit paths');
  if (input.markerParents.length !== 1 || input.markerParents[0] !== input.payloadCommit) throw new Error('marker sole parent must equal immediate payload commit');
}

function readJson(path: string) { return JSON.parse(readFileSync(resolve(path), 'utf8')); }
function commitPaths(commit: string) { return git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).split(/\r?\n/).filter(Boolean); }
function verifyDownstream() {
  const paths = ['27.1-02-PLAN.md', '27.1-03-PLAN.md', '27.1-04-PLAN.md', '27.1-05-PLAN.md', '27.1-06-PLAN.md', '27.1-07-PLAN.md', '27.1-RESEARCH.md', '27.1-VALIDATION.md'].map((name) => `${PHASE_DIR}/${name}`).concat('.planning/ROADMAP.md');
  for (const path of paths) {
    const text = readFileSync(resolve(path), 'utf8');
    const required = [['27.1-01R', 'Plan 01R'], ['SUPERSEDED_PROTOCOL_INVALID'], ['01C-only', 'non-authoritative']];
    for (const alternatives of required) if (!alternatives.some((token) => text.includes(token))) throw new Error(`downstream three-root authority token missing from ${path}: ${alternatives.join('|')}`);
  }
}
function verifyMatrix() {
  const matrix = readJson(`${PHASE_DIR}/evidence/corrected-authorization-matrix.json`);
  const inventory = readJson(`${PHASE_DIR}/evidence/failure-inventory.json`);
  assertAuthorizationMatrix(matrix, inventory.failures);
}

function main() {
  const args = process.argv.slice(2); const arg = (name: string) => args[args.indexOf(name) + 1]; const stage = arg('--stage');
  for (const flag of ['--require-seven-sealed-artifacts', '--require-exact-payload-members']) if (!args.includes(flag)) throw new Error(`${flag} required`);
  const byteManifest = readJson(`${PHASE_DIR}/evidence/attestations/27.1-01R-byte-manifest.json`);
  const lineageManifest = readJson(`${PHASE_DIR}/evidence/attestations/27.1-01R-lineage-manifest.json`);
  const result = readJson(`${PHASE_DIR}/evidence/plan-results/27.1-01R-reseal.json`);
  validateResealDocument(byteManifest, 'READY_TO_SEAL', args.includes('--verify-current-byte-pins') || stage !== 'preseal');
  validateResealDocument(lineageManifest, 'READY_TO_SEAL', false);
  validateResealDocument(result, 'READY_TO_SEAL', false);
  if (JSON.stringify(byteManifest.sealedArtifacts) !== JSON.stringify(lineageManifest.sealedArtifacts) || JSON.stringify(byteManifest.sealedArtifacts) !== JSON.stringify(result.sealedArtifacts)) throw new Error('pin sets differ across payload artifacts');
  verifyMatrix(); if (args.includes('--verify-downstream-three-roots') || stage === 'downstream') verifyDownstream();
  if (stage === 'preseal') { console.log('PASS 27.1-01R preseal: seven pins, exact 21 partition, three roots, downstream authority, and six-member payload verified'); return; }
  const markerPath = arg('--marker') || arg('--authority-marker') || MARKER_PATH; const marker = readJson(markerPath);
  validateResealDocument(marker, 'COMPLETE', true);
  if (JSON.stringify(marker.sealedArtifacts) !== JSON.stringify(byteManifest.sealedArtifacts)) throw new Error('marker pin set differs');
  const payloadCommit = (marker as ResealDocument & { payloadCommit?: string }).payloadCommit;
  // Marker has one additional closed field, validated separately before the common projection.
  if (!payloadCommit) throw new Error('marker payloadCommit missing');
  const parents = git('show', '-s', '--format=%P', 'HEAD').split(/\s+/).filter(Boolean);
  validateTopology({ payloadCommit, markerParents: parents, payloadPaths: commitPaths(payloadCommit), markerPaths: commitPaths('HEAD') });
  console.log(`PASS 27.1-01R COMPLETE: payload ${payloadCommit} is the immediate sole parent of marker ${git('rev-parse', 'HEAD')}; seven pins verified`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
