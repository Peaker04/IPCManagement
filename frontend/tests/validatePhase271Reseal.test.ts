import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAYLOAD_PATHS,
  MARKER_PATH,
  planningDeltaSha256,
  validateDownstream,
  validateSeal,
  validateTopologyDocument,
  type SealRequest,
} from './validatePhase271Reseal';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const commit = (cwd: string, message: string) => { git(cwd, 'add', '.'); git(cwd, 'commit', '-m', message); return git(cwd, 'rev-parse', 'HEAD'); };
const put = (cwd: string, path: string, value: string) => { const absolute = join(cwd, path); mkdirSync(join(absolute, '..'), { recursive: true }); writeFileSync(absolute, value); };
const sha = (cwd: string, path: string) => execFileSync('node', ['-e', `const{createHash}=require('crypto'),{readFileSync}=require('fs');process.stdout.write(createHash('sha256').update(readFileSync(${JSON.stringify(join(cwd, path))})).digest('hex'))`], { encoding: 'utf8' });

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'phase271-01w-'));
  git(cwd, 'init'); git(cwd, 'config', 'user.email', 'test@example.com'); git(cwd, 'config', 'user.name', 'Test');
  put(cwd, '.planning/ROADMAP.md', '# Project Roadmap\n');
  const roots = Array.from({ length: 6 }, (_, index) => { put(cwd, `root-${index}.json`, JSON.stringify({ index })); return commit(cwd, `root ${index}`); });
  put(cwd, '.planning/ROADMAP.md', '# Project Roadmap\nplanning\n');
  const planning = commit(cwd, 'planning predecessor');
  for (const path of PAYLOAD_PATHS) put(cwd, path, `${path}\n`);
  const payload = commit(cwd, 'payload');
  const pins = PAYLOAD_PATHS.filter((path) => path.startsWith('frontend/')).map((path) => ({ path, sha256: sha(cwd, path), gitBlobId: git(cwd, 'hash-object', path) }));
  const planningDelta = { base: roots[3], head: planning, commits: [{ commit: planning, parent: roots[5], paths: [{ status: 'M' as const, path: '.planning/ROADMAP.md' }] }] };
  const manifest = { schemaVersion: 1 as const, phase: '27.1' as const, planId: '27.1-01W' as const, status: 'READY_TO_SEAL' as const, authority: 'SOLE_TOPOLOGY_AUTHORITY' as const, invalid01VStatus: 'SUPERSEDED_PROTOCOL_INVALID' as const, planningHead: planning, planningDelta, planningDeltaSha256: planningDeltaSha256(planningDelta), historicalCommits: roots.slice(0, 5), artifactPins: pins, payloadMembers: PAYLOAD_PATHS, blockers: [] as [] };
  put(cwd, MARKER_PATH, JSON.stringify({ ...manifest, status: 'COMPLETE', payloadCommit: payload }));
  const marker = commit(cwd, 'marker');
  const request: SealRequest = { cwd, manifest, marker: JSON.parse(git(cwd, 'show', `${marker}:${MARKER_PATH}`)), original01Commit: roots[0], invalid01cCommit: roots[1], authority01rCommit: roots[2], focused01fCommit: roots[3], invalid01vCommit: roots[4], planningPredecessor: planning, payloadCommit: payload, markerCommit: marker };
  return { cwd, roots, planning, payload, marker, manifest, request };
}

const mutate = (request: SealRequest, change: (copy: SealRequest) => void) => { const copy = structuredClone(request); change(copy); return copy; };

describe('Phase 27.1 01W disjoint topology validator', () => {
  it('accepts exact planning predecessor -> payload -> immediate marker-only topology', () => {
    const value = fixture();
    expect(() => validateSeal(value.request)).not.toThrow();
  });

  it('seal remains valid when process current HEAD is unrelated', () => {
    const value = fixture();
    put(value.cwd, 'unrelated.txt', 'later'); commit(value.cwd, 'unrelated live head');
    expect(() => validateSeal(value.request)).not.toThrow();
  });

  it.each([
    ['expectedLiveHead', (x: any) => { x.marker.expectedLiveHead = x.markerCommit; }],
    ['selfCommit', (x: any) => { x.marker.selfCommit = x.markerCommit; }],
    ['selfHash', (x: any) => { x.marker.selfHash = 'a'.repeat(64); }],
    ['marker self-reference', (x: any) => { x.marker.note = x.markerCommit; }],
    ['payload self-reference', (x: any) => { x.marker.payloadCommit = x.markerCommit; }],
    ['payload-to-marker reference', (x: any) => { x.manifest.markerCommit = x.markerCommit; }],
    ['marker-to-payload cycle', (x: any) => { x.marker.references = [x.payloadCommit, x.markerCommit]; }],
  ])('rejects %s', (_label, change) => {
    const { request } = fixture();
    expect(() => validateSeal(mutate(request, change))).toThrow();
  });

  it.each([
    ['missing planning predecessor', (x: any) => { x.planningPredecessor = ''; }],
    ['wrong planning predecessor', (x: any) => { x.planningPredecessor = x.invalid01vCommit; }],
    ['wrong payload parent', (x: any) => { x.planningPredecessor = x.focused01fCommit; }],
    ['non-adjacent marker', (x: any) => { x.markerCommit = x.payloadCommit; }],
    ['wrong marker parent', (x: any) => { x.payloadCommit = x.planningPredecessor; }],
    ['missing payload member', (x: any) => { x.manifest.payloadMembers = x.manifest.payloadMembers.slice(1); }],
    ['extra payload member', (x: any) => { x.manifest.payloadMembers = [...x.manifest.payloadMembers, 'extra']; }],
    ['artifact hash mismatch', (x: any) => { x.manifest.artifactPins[0].sha256 = '0'.repeat(64); }],
    ['collapsed historical root', (x: any) => { x.invalid01vCommit = x.focused01fCommit; }],
  ])('rejects %s', (_label, change) => {
    const { request } = fixture();
    expect(() => validateSeal(mutate(request, change))).toThrow();
  });

  it('rejects live-head inputs in seal mode', () => {
    const { request } = fixture();
    expect(() => validateSeal({ ...request, expectedLiveHead: request.markerCommit } as SealRequest)).toThrow(/expectedLiveHead/);
  });

  it('downstream requires and compares caller expected live head', () => {
    const { cwd, marker } = fixture();
    expect(() => validateDownstream(cwd, marker)).not.toThrow();
    expect(() => validateDownstream(cwd, '')).toThrow(/required/);
    expect(() => validateDownstream(cwd, '0'.repeat(40))).toThrow(/mismatch/);
  });

  it('closed schemas reject unknown and forbidden live/self claims independently', () => {
    const { manifest } = fixture();
    expect(() => validateTopologyDocument(manifest, 'READY_TO_SEAL')).not.toThrow();
    for (const field of ['expectedLiveHead', 'selfCommit', 'selfHash']) {
      expect(() => validateTopologyDocument({ ...manifest, [field]: 'x' }, 'READY_TO_SEAL')).toThrow(/schema|forbidden/);
    }
  });
});
