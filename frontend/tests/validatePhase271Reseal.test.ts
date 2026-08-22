import { describe, expect, it } from 'vitest';
import { MARKER_PATH, PAYLOAD_PATHS, ROOT_PATHS, SEALED_PATHS, currentPin, validatePins, validateResealDocument, validateRoots, validateTopology, type Pin } from './validatePhase271Reseal';

const hash = 'a'.repeat(64); const blob = 'b'.repeat(40); const payloadCommit = 'c'.repeat(40);
const pins: Pin[] = SEALED_PATHS.map((path) => ({ path, sha256: hash, gitBlobId: blob }));
const roots = [
  { type: 'ORIGINAL_SOURCE', path: ROOT_PATHS.original, sha256: 'b2975e45e548896d7831a98083fc36d82f3e63a9d068c087482231e330fbcc02', commit: 'c52c80f8186b985d07619a7ad0ed7abc0572675c', disposition: 'IMMUTABLE_SOURCE' },
  { type: 'HISTORICAL_CORRECTION_PROVENANCE', path: ROOT_PATHS.correction, sha256: '22f1e4ff032acb6b87eb7148049be1a1707cda7bbfa1d82a61a1b80333c0d0e0', commit: 'ae129eaab0dde192f3dca17c7504b7b9aaef5d17', disposition: 'SUPERSEDED_PROTOCOL_INVALID' },
  { type: 'AUTHORITATIVE_RESEAL', path: ROOT_PATHS.reseal, sha256: null, commit: null, disposition: 'AUTHORITATIVE' },
] as const;
const result = { schemaVersion: 1, phase: '27.1', planId: '27.1-01R', status: 'READY_TO_SEAL', roots, sealedArtifacts: pins, payloadMembers: PAYLOAD_PATHS, sourceSuiteRerun: false, blockers: [] } as const;
const clone = <T>(value: T): T => structuredClone(value);

describe('Phase 27.1 additive reseal', () => {
  it('accepts the closed three-root, seven-pin, six-member preseal document', () => {
    expect(() => validateResealDocument(result, 'READY_TO_SEAL')).not.toThrow();
  });

  it.each(SEALED_PATHS)('rejects SHA-256 and Git blob mutation for %s', (path) => {
    for (const field of ['sha256', 'gitBlobId'] as const) {
      const candidate = SEALED_PATHS.map(currentPin); const pin = candidate.find((item) => item.path === path)!;
      pin[field] = field === 'sha256' ? 'd'.repeat(64) : 'e'.repeat(40);
      expect(() => validatePins(candidate, true)).toThrow(/pin mismatch/);
    }
  });

  it('rejects omitted reseal pins, duplicate/substituted paths and unknown pin fields', () => {
    for (const candidate of [clone(pins).slice(0, -1), [...clone(pins), clone(pins[0])]]) expect(() => validatePins(candidate)).toThrow(/seven/);
    const substituted = clone(pins); substituted[0].path = 'frontend/tests/substitute.ts'; expect(() => validatePins(substituted)).toThrow(/allowlist/);
    const widened = clone(pins) as unknown as Array<Record<string, unknown>>; widened[0].size = 1; expect(() => validatePins(widened)).toThrow(/schema/);
  });

  it('rejects 01C-only authority, missing 01R, collapsed/substituted roots and wrong 01C disposition', () => {
    expect(() => validateRoots(clone(roots).slice(0, 2))).toThrow(/three roots/);
    const collapsed = clone(roots); collapsed[2].path = collapsed[1].path; expect(() => validateRoots(collapsed)).toThrow();
    const wrongDisposition = clone(roots); wrongDisposition[1].disposition = 'AUTHORITATIVE' as never; expect(() => validateRoots(wrongDisposition)).toThrow(/mismatch/);
    const rewritten = clone(roots); rewritten[0].commit = 'f'.repeat(40); expect(() => validateRoots(rewritten)).toThrow(/mismatch/);
    const substituted = clone(roots); substituted[0].path += '.other'; expect(() => validateRoots(substituted)).toThrow(/mismatch/);
  });

  it('rejects schema widening and source-suite rerun claims', () => {
    const widened = clone(result) as unknown as Record<string, unknown>; widened.authority = '01C'; expect(() => validateResealDocument(widened, 'READY_TO_SEAL')).toThrow(/schema/);
    const rerun = clone(result); rerun.sourceSuiteRerun = true as never; expect(() => validateResealDocument(rerun, 'READY_TO_SEAL')).toThrow(/rerun/);
  });

  it('requires exact payload membership and marker-only immediate sole-parent topology', () => {
    expect(() => validateTopology({ payloadCommit, markerParents: [payloadCommit], payloadPaths: PAYLOAD_PATHS, markerPaths: [MARKER_PATH] })).not.toThrow();
    expect(() => validateTopology({ payloadCommit, markerParents: [payloadCommit], payloadPaths: PAYLOAD_PATHS.slice(1), markerPaths: [MARKER_PATH] })).toThrow(/payload/);
    expect(() => validateTopology({ payloadCommit, markerParents: [payloadCommit], payloadPaths: [...PAYLOAD_PATHS, 'extra'], markerPaths: [MARKER_PATH] })).toThrow(/payload/);
    expect(() => validateTopology({ payloadCommit, markerParents: [payloadCommit], payloadPaths: PAYLOAD_PATHS, markerPaths: [MARKER_PATH, 'extra'] })).toThrow(/marker/);
    expect(() => validateTopology({ payloadCommit, markerParents: ['d'.repeat(40)], payloadPaths: PAYLOAD_PATHS, markerPaths: [MARKER_PATH] })).toThrow(/sole parent/);
    expect(() => validateTopology({ payloadCommit, markerParents: [payloadCommit, 'd'.repeat(40)], payloadPaths: PAYLOAD_PATHS, markerPaths: [MARKER_PATH] })).toThrow(/sole parent/);
    expect(() => validateTopology({ payloadCommit, markerParents: [], payloadPaths: PAYLOAD_PATHS, markerPaths: [MARKER_PATH] })).toThrow(/sole parent/);
  });
});
