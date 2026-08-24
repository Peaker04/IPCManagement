import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPECTED_RULE_IDS, loadPinnedSelection, sha256Bytes, validateCanonical, type BlindInputRow } from './uiAuditBlindReviewInput.ts';

type Manifest = {
  schemaVersion: string; sealStatus: string; appendOnly: boolean;
  selection: { path: string; sha256: string; selectedRun: string; selectedCanonicalPath: string; selectedCanonicalSha256: string };
  contract: { identityParts: number; identityCount: number; rulesPerIdentity: number; findingCount: number; exactRuleIds: string[]; deterministicTotals: Record<string, number>; retainedRawAdminFailCount: number; actionableFailCount: number };
  members: { input: { path: string; sha256: string }; schema: { path: string; sha256: string }; selectedRunManifest: { path: string; sha256: string }; selectedMembers: Record<string,string> };
  reviewer: null | { identity: string; tool: string; model: string; invocationId: string; fresh: boolean; receivedOnlyInputAndSchema: boolean };
  review: null | { path: string; sha256: string };
};
type ReviewRow = { identity: string; verdict: 'NEEDS_EVIDENCE'|'FAIL'|'UNRESOLVED'; rule: string; expected: string; actual: string; severity: string; lowestOwner: string; confidence: number; evidenceReference: Record<string, unknown>; actionable?: boolean };
type Review = { schemaVersion: string; reviewer: NonNullable<Manifest['reviewer']>; inputSha256: string; selectedCanonicalSha256: string; reviews: ReviewRow[] };

const parse = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const arg = (name: string, required = true) => { const index = process.argv.indexOf(name); const value = index >= 0 ? process.argv[index + 1] : undefined; if (required && !value) throw new Error(`missing ${name}`); return value; };
const expectEqual = (actual: unknown, expected: unknown, label: string) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch`); };

export function validateBlindReview(options: { selectionPath: string; inputPath: string; manifestPath: string; reviewPath?: string; requireFresh?: boolean }) {
  const loaded = loadPinnedSelection(options.selectionPath);
  validateCanonical(loaded.canonical, loaded.runManifest);
  const manifest = parse<Manifest>(options.manifestPath);
  if (manifest.schemaVersion !== 'phase28-blind-review-manifest/v1' || !manifest.appendOnly) throw new Error('invalid append-only manifest');
  if (!['INPUT_SEALED_REVIEW_PENDING','SEALED'].includes(manifest.sealStatus)) throw new Error('invalid manifest seal status');
  if (sha256Bytes(options.selectionPath) !== manifest.selection.sha256 || manifest.selection.selectedRun !== 'run-2' || manifest.selection.selectedCanonicalSha256 !== loaded.selection.sha256) throw new Error('selection provenance mismatch');
  if (sha256Bytes(options.inputPath) !== manifest.members.input.sha256) throw new Error('input hash mismatch');
  if (!existsSync(manifest.members.schema.path) || sha256Bytes(manifest.members.schema.path) !== manifest.members.schema.sha256) throw new Error('schema hash mismatch');
  if (sha256Bytes(loaded.runManifestPath) !== manifest.members.selectedRunManifest.sha256) throw new Error('run manifest hash mismatch');
  expectEqual(manifest.members.selectedMembers, loaded.runManifest.sourceArtifactHashes, 'selected member hashes');
  for (const [name, hash] of Object.entries(manifest.members.selectedMembers)) if (sha256Bytes(resolve(loaded.runRoot, name)) !== hash) throw new Error(`selected member hash mismatch: ${name}`);
  expectEqual(manifest.contract.exactRuleIds, [...EXPECTED_RULE_IDS], '32-rule contract');
  expectEqual(manifest.contract.deterministicTotals, loaded.canonical.counts.verdictTotals, 'deterministic totals');
  if (manifest.contract.identityParts !== 6 || manifest.contract.identityCount !== 2142 || manifest.contract.rulesPerIdentity !== 32 || manifest.contract.findingCount !== 68544 || manifest.contract.retainedRawAdminFailCount !== 112 || manifest.contract.actionableFailCount !== 0) throw new Error('manifest count contract drift');

  const lines = readFileSync(options.inputPath, 'utf8').trim().split('\n');
  if (lines.length !== 2142) throw new Error('blind input identity count drift');
  const rows = lines.map((line) => JSON.parse(line) as BlindInputRow);
  const expectedIdentities = loaded.canonical.records.map(({ identity }) => identity);
  const actualIdentities = rows.map(({ identity }) => identity);
  if (new Set(actualIdentities).size !== 2142) throw new Error('duplicate blind identity');
  expectEqual(actualIdentities, expectedIdentities, 'input identity bijection/order');
  for (const [index, row] of rows.entries()) {
    if (row.identity.split('|').length !== 6 || Object.values(row.identityParts).join('|') !== row.identity) throw new Error(`six-part identity mismatch: ${row.identity}`);
    if (row.evidenceReference.selectedRun !== 'run-2' || row.evidenceReference.canonicalSha256 !== loaded.selection.sha256 || row.evidenceReference.recordIndex !== index) throw new Error(`input provenance mismatch: ${row.identity}`);
    const serialized = JSON.stringify(row);
    if (/\b(diff|implementation rationale|prior conclusion|remediation verdict)\b/i.test(serialized)) throw new Error(`forbidden hidden context in input: ${row.identity}`);
  }

  const totals = { PASS: 6104, FAIL: 112, NEEDS_EVIDENCE: 47208, NOT_APPLICABLE: 15120, UNRESOLVED: 0, actionable: 0 };
  if (!options.reviewPath) return { identityCount: rows.length, reviewCount: 0, totals };
  const review = parse<Review>(options.reviewPath);
  if (review.schemaVersion !== 'phase28-blind-review/v1' || review.inputSha256 !== manifest.members.input.sha256 || review.selectedCanonicalSha256 !== loaded.selection.sha256) throw new Error('review schema/hash provenance mismatch');
  if (manifest.sealStatus !== 'SEALED' || !manifest.review || sha256Bytes(options.reviewPath) !== manifest.review.sha256) throw new Error('review is not sealed by manifest');
  expectEqual(manifest.reviewer, review.reviewer, 'reviewer provenance');
  if (options.requireFresh && (!review.reviewer.fresh || !review.reviewer.receivedOnlyInputAndSchema || !review.reviewer.identity || !review.reviewer.tool || !review.reviewer.model || !review.reviewer.invocationId)) throw new Error('reviewer provenance is not fresh/isolated');
  if (review.reviews.length !== 2142 || new Set(review.reviews.map(({ identity }) => identity)).size !== 2142) throw new Error('review identity count/duplicate drift');
  expectEqual(review.reviews.map(({ identity }) => identity), expectedIdentities, 'review identity bijection/order');
  let unresolved = 0; let actionable = 0; let reviewFail = 0; let reviewNeedsEvidence = 0;
  for (const [index, item] of review.reviews.entries()) {
    if (item.rule !== 'AI-QUAL-01' || !item.expected || !item.actual || !item.lowestOwner || !item.severity || typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1 || !item.evidenceReference) throw new Error(`invalid review schema: ${item.identity}`);
    if (item.lowestOwner !== rows[index].identityParts.lowestOwner) throw new Error(`review owner mismatch: ${item.identity}`);
    if (item.verdict === 'UNRESOLVED') unresolved++;
    if (item.verdict === 'FAIL') { reviewFail++; if (item.actionable !== false) actionable++; }
    if (item.verdict === 'NEEDS_EVIDENCE') reviewNeedsEvidence++;
    if ((item as { verdict: string }).verdict === 'PASS') throw new Error(`review cannot manufacture PASS: ${item.identity}`);
  }
  if (unresolved > 0) throw new Error(`UNRESOLVED=${unresolved}`);
  if (actionable > 0) throw new Error(`actionable FAIL=${actionable}`);
  return { identityCount: rows.length, reviewCount: review.reviews.length, totals, reviewTotals: { PASS: 0, FAIL: reviewFail, NEEDS_EVIDENCE: reviewNeedsEvidence, UNRESOLVED: unresolved, actionable } };
}

export function main() {
  const result = validateBlindReview({ selectionPath: resolve(arg('--selection')!), inputPath: resolve(arg('--input')!), manifestPath: resolve(arg('--manifest', false) ?? resolve(arg('--input')!, '..', 'manifest.json')), reviewPath: arg('--review', false) ? resolve(arg('--review', false)!) : undefined, requireFresh: process.argv.includes('--require-fresh-provenance') });
  console.log(`PASS=${result.totals.PASS} FAIL=${result.totals.FAIL} NEEDS_EVIDENCE=${result.totals.NEEDS_EVIDENCE} NOT_APPLICABLE=${result.totals.NOT_APPLICABLE} UNRESOLVED=${result.totals.UNRESOLVED} actionable=${result.totals.actionable} identities=${result.identityCount} findings=68544`);
  if (result.reviewTotals) console.log(`REVIEW PASS=${result.reviewTotals.PASS} FAIL=${result.reviewTotals.FAIL} NEEDS_EVIDENCE=${result.reviewTotals.NEEDS_EVIDENCE} UNRESOLVED=${result.reviewTotals.UNRESOLVED} actionable=${result.reviewTotals.actionable}`);
}
if (process.argv[1]?.endsWith('uiAuditBlindReviewValidator.ts')) main();
