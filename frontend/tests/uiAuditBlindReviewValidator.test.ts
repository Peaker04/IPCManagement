/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBlindRows, loadPinnedSelection, validateCanonical } from './uiAuditBlindReviewInput';
import { validateBlindReview } from './uiAuditBlindReviewValidator';

const root = resolve(__dirname, '../..');
const selectionPath = resolve(root, '.artifacts/phase28-ui-audit/remediation/selected-attempt.json');
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function fixture() {
  const loaded = loadPinnedSelection(selectionPath);
  validateCanonical(loaded.canonical, loaded.runManifest);
  const dir = mkdtempSync(resolve(tmpdir(), 'phase28-blind-'));
  const inputPath = resolve(dir, 'input.jsonl');
  const schemaPath = resolve(dir, 'schema.json');
  const manifestPath = resolve(dir, 'manifest.json');
  const reviewPath = resolve(dir, 'review.json');
  const rows = buildBlindRows(loaded.canonical, 'run-2', loaded.selection.sha256);
  writeFileSync(inputPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  writeFileSync(schemaPath, '{}\n');
  const reviewer = { identity: 'fresh-reviewer-fixture', tool: 'fixture', model: 'fixture-v1', invocationId: 'fixture-1', fresh: true, receivedOnlyInputAndSchema: true };
  const review = { schemaVersion: 'phase28-blind-review/v1', reviewer, inputSha256: hash(inputPath), selectedCanonicalSha256: loaded.selection.sha256, reviews: rows.map((row) => ({ identity: row.identity, verdict: 'NEEDS_EVIDENCE', rule: 'AI-QUAL-01', expected: 'Qualitative conclusion requires identity-local visual evidence.', actual: 'Only deterministic DOM/ARIA/geometry evidence was supplied.', severity: 'INFO', lowestOwner: row.identityParts.lowestOwner, confidence: 1, evidenceReference: row.evidenceReference })) };
  writeFileSync(reviewPath, `${JSON.stringify(review)}\n`);
  const manifest = { schemaVersion: 'phase28-blind-review-manifest/v1', sealStatus: 'SEALED', appendOnly: true, selection: { path: selectionPath, sha256: hash(selectionPath), selectedRun: 'run-2', selectedCanonicalPath: loaded.canonicalPath, selectedCanonicalSha256: loaded.selection.sha256 }, contract: { identityParts: 6, identityCount: 2142, rulesPerIdentity: 32, findingCount: 68544, exactRuleIds: ['INV-01','HIER-01','HIER-02','TOK-SP-01','TOK-TY-01','TOK-CO-01','CONT-01','CONT-02','TABLE-01','TABLE-02','TABLE-03','QUERY-01','QUERY-02','A11Y-01','A11Y-02','A11Y-03','RESP-01','RESP-02','RESP-WH-01','WH-01','WH-02','WH-03','ORDER-01','FILTER-01','SORT-01','COL-01','BADGE-01','PAGE-01','MUT-01','REFRESH-01','MOTION-01','PERF-01'], deterministicTotals: loaded.canonical.counts.verdictTotals, retainedRawAdminFailCount: 112, actionableFailCount: 0 }, members: { input: { path: inputPath, sha256: hash(inputPath) }, schema: { path: schemaPath, sha256: hash(schemaPath) }, selectedRunManifest: { path: loaded.runManifestPath, sha256: hash(loaded.runManifestPath) }, selectedMembers: loaded.runManifest.sourceArtifactHashes }, reviewer, review: { path: reviewPath, sha256: hash(reviewPath) } };
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  return { dir, inputPath, schemaPath, manifestPath, reviewPath };
}

const mutate = <T>(path: string, fn: (value: T) => void) => { const value = JSON.parse(readFileSync(path, 'utf8')) as T; fn(value); writeFileSync(path, `${JSON.stringify(value)}\n`); };
const reseal = (f: ReturnType<typeof fixture>) => mutate<any>(f.manifestPath, (manifest) => { manifest.members.input.sha256 = hash(f.inputPath); manifest.members.schema.sha256 = hash(f.schemaPath); manifest.review.sha256 = hash(f.reviewPath); });

describe('Phase 28 blind review fail-closed contract', () => {
  it('accepts the exact known-clean bijection and prints preserved authority totals', () => {
    const f = fixture();
    const result = validateBlindReview({ selectionPath, inputPath: f.inputPath, manifestPath: f.manifestPath, reviewPath: f.reviewPath, requireFresh: true });
    expect(result).toMatchObject({ identityCount: 2142, reviewCount: 2142, totals: { PASS: 6104, FAIL: 112, NEEDS_EVIDENCE: 47208, NOT_APPLICABLE: 15120, UNRESOLVED: 0, actionable: 0 }, reviewTotals: { PASS: 0, FAIL: 0, NEEDS_EVIDENCE: 2142, UNRESOLVED: 0, actionable: 0 } });
  });

  it.each([
    ['duplicate identity', (f: ReturnType<typeof fixture>) => { const lines = readFileSync(f.inputPath, 'utf8').trim().split('\n'); lines[1] = lines[0]; writeFileSync(f.inputPath, `${lines.join('\n')}\n`); reseal(f); }],
    ['input hash mismatch', (f: ReturnType<typeof fixture>) => writeFileSync(f.inputPath, `${readFileSync(f.inputPath, 'utf8')} `)],
    ['member hash mismatch', (f: ReturnType<typeof fixture>) => mutate<any>(f.manifestPath, (m) => { m.members.selectedMembers[Object.keys(m.members.selectedMembers)[0]] = '0'.repeat(64); })],
    ['six-part identity drift', (f: ReturnType<typeof fixture>) => { const lines = readFileSync(f.inputPath, 'utf8').trim().split('\n'); const first = JSON.parse(lines[0]); first.identity = 'five|part|identity|only|x'; lines[0] = JSON.stringify(first); writeFileSync(f.inputPath, `${lines.join('\n')}\n`); reseal(f); }],
    ['stale reviewer', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviewer.fresh = false; }); mutate<any>(f.manifestPath, (m) => { m.reviewer.fresh = false; m.review.sha256 = hash(f.reviewPath); }); }],
    ['missing review identity', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviews.pop(); }); reseal(f); }],
    ['UNRESOLVED', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviews[0].verdict = 'UNRESOLVED'; }); reseal(f); }],
    ['actionable FAIL', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviews[0].verdict = 'FAIL'; }); reseal(f); }],
    ['manufactured PASS', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviews[0].verdict = 'PASS'; }); reseal(f); }],
    ['owner mismatch', (f: ReturnType<typeof fixture>) => { mutate<any>(f.reviewPath, (r) => { r.reviews[0].lowestOwner = 'OtherOwner'; }); reseal(f); }],
  ] as const)('rejects %s', (_name, corrupt) => {
    const f = fixture(); corrupt(f);
    expect(() => validateBlindReview({ selectionPath, inputPath: f.inputPath, manifestPath: f.manifestPath, reviewPath: f.reviewPath, requireFresh: true })).toThrow();
  });

  it('rejects root/member reuse through exclusive creation semantics', () => {
    const f = fixture();
    expect(() => writeFileSync(f.inputPath, 'reuse', { flag: 'wx' })).toThrow();
  });
});
