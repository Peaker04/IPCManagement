import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const EXPECTED_RULE_IDS = [
  'INV-01','HIER-01','HIER-02','TOK-SP-01','TOK-TY-01','TOK-CO-01','CONT-01','CONT-02',
  'TABLE-01','TABLE-02','TABLE-03','QUERY-01','QUERY-02','A11Y-01','A11Y-02','A11Y-03',
  'RESP-01','RESP-02','RESP-WH-01','WH-01','WH-02','WH-03','ORDER-01','FILTER-01','SORT-01',
  'COL-01','BADGE-01','PAGE-01','MUT-01','REFRESH-01','MOTION-01','PERF-01',
] as const;

export const sha256Bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const parse = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const slash = (path: string) => path.replaceAll('\\', '/');

export type Selection = { attemptManifest: string; selected: string; sha256: string };
type Finding = { ruleId: string; identity: string; verdict: string; measured?: unknown; expected?: unknown; actual?: unknown; lowestOwner?: unknown };
type RecordRow = { identity: string; findings: Finding[] };
type Canonical = { schemaVersion: string; inventoryIdentityCount: number; findingCountPerIdentity: number; counts: { verdictTotals: Record<string, number> }; records: RecordRow[] };
type RunManifest = { schemaVersion: string; sealStatus: string; identityCount: number; findingCountPerIdentity: number; counts: { verdictTotals: Record<string, number> }; sourceArtifactHashes: Record<string, string>; combinedSha256: string; sourceCommit: string };
type AttemptManifest = { schemaVersion: string; selected: string; run1Sha256: string; run2Sha256: string; canonicalSha256: string; identityCount: number; findingCount: number; actionableFailCount: number; legacyAdminRawCount: number };

export type BlindInputRow = {
  identity: string;
  identityParts: { route: string; region: string; state: string; actor: string; viewport: string; lowestOwner: string };
  evidenceReference: { selectedRun: string; canonicalSha256: string; recordIndex: number };
  qualitativeEvidence: Array<{ rule: string; measured: unknown }>;
};

export function loadPinnedSelection(selectionPath: string) {
  const selection = parse<Selection>(selectionPath);
  if (selection.selected !== 'run-2' || !/^[a-f0-9]{64}$/.test(selection.sha256)) throw new Error('selection must hash-pin run-2');
  const repositoryRoot = resolve(dirname(selectionPath), '../../..');
  const attemptPath = resolve(repositoryRoot, selection.attemptManifest);
  const attempt = parse<AttemptManifest>(attemptPath);
  if (attempt.schemaVersion !== 'phase28-remediation-attempt/v1' || attempt.selected !== 'run-2' || attempt.run1Sha256 !== selection.sha256 || attempt.run2Sha256 !== selection.sha256 || attempt.canonicalSha256 !== selection.sha256 || attempt.identityCount !== 2142 || attempt.findingCount !== 68544 || attempt.actionableFailCount !== 0 || attempt.legacyAdminRawCount !== 112) throw new Error('attempt manifest authority mismatch');
  const runRoot = resolve(dirname(attemptPath), selection.selected);
  const canonicalPath = resolve(runRoot, 'canonical-combined.json');
  const runManifestPath = resolve(runRoot, 'manifest.json');
  const runManifest = parse<RunManifest>(runManifestPath);
  if (sha256Bytes(canonicalPath) !== selection.sha256 || runManifest.combinedSha256 !== selection.sha256) throw new Error('selected canonical hash mismatch');
  return { selection, attemptPath, runRoot, canonicalPath, runManifestPath, runManifest, canonical: parse<Canonical>(canonicalPath) };
}

export function validateCanonical(canonical: Canonical, runManifest: RunManifest) {
  if (canonical.inventoryIdentityCount !== 2142 || canonical.records.length !== 2142 || canonical.findingCountPerIdentity !== 32) throw new Error('identity/count drift');
  if (runManifest.identityCount !== 2142 || runManifest.findingCountPerIdentity !== 32 || runManifest.sealStatus !== 'SEALED') throw new Error('run manifest count/seal drift');
  const identities = new Set<string>();
  for (const row of canonical.records) {
    if (row.identity.split('|').length !== 6 || identities.has(row.identity)) throw new Error(`invalid or duplicate six-part identity: ${row.identity}`);
    identities.add(row.identity);
    const ids = row.findings.map(({ ruleId }) => ruleId);
    if (ids.length !== 32 || new Set(ids).size !== 32 || EXPECTED_RULE_IDS.some((id) => !ids.includes(id))) throw new Error(`32-rule contract drift: ${row.identity}`);
  }
  const expected = { PASS: 6104, FAIL: 112, NOT_APPLICABLE: 15120, NEEDS_EVIDENCE: 47208, UNRESOLVED: 0 };
  for (const [key, value] of Object.entries(expected)) if (canonical.counts.verdictTotals[key] !== value || runManifest.counts.verdictTotals[key] !== value) throw new Error(`${key} total drift`);
}

export function buildBlindRows(canonical: Canonical, selectedRun: string, canonicalSha256: string): BlindInputRow[] {
  return canonical.records.map((row, recordIndex) => {
    const [route, region, state, actor, viewport, lowestOwner] = row.identity.split('|');
    return {
      identity: row.identity,
      identityParts: { route, region, state, actor, viewport, lowestOwner },
      evidenceReference: { selectedRun, canonicalSha256, recordIndex },
      qualitativeEvidence: row.findings
        .filter(({ measured }) => measured !== undefined)
        .map(({ ruleId, measured }) => ({ rule: ruleId, measured })),
    };
  });
}

function arg(name: string, required = true) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`missing ${name}`);
  return value;
}

export function main() {
  const selectionPath = resolve(arg('--selection')!);
  const outputPath = resolve(arg('--output')!);
  const schemaPath = resolve(arg('--schema')!);
  const manifestPath = resolve(arg('--manifest')!);
  for (const path of [outputPath, schemaPath, manifestPath]) {
    if (existsSync(path)) throw new Error(`append-only member already exists: ${path}`);
    if (lstatSync(dirname(path)).isSymbolicLink()) throw new Error(`attempt root must not be a symlink: ${dirname(path)}`);
  }
  const loaded = loadPinnedSelection(selectionPath);
  validateCanonical(loaded.canonical, loaded.runManifest);
  for (const [name, hash] of Object.entries(loaded.runManifest.sourceArtifactHashes)) {
    const member = resolve(loaded.runRoot, name);
    if (!existsSync(member) || sha256Bytes(member) !== hash) throw new Error(`selected member hash mismatch: ${name}`);
  }
  const rows = buildBlindRows(loaded.canonical, loaded.selection.selected, loaded.selection.sha256);
  writeFileSync(outputPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, { flag: 'wx' });
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Phase 28 blind qualitative review output',
    type: 'object', additionalProperties: false,
    required: ['schemaVersion','reviewer','inputSha256','selectedCanonicalSha256','reviews'],
    properties: {
      schemaVersion: { const: 'phase28-blind-review/v1' },
      reviewer: { type: 'object', additionalProperties: false, required: ['identity','tool','model','invocationId','fresh','receivedOnlyInputAndSchema'], properties: {
        identity: { type: 'string', minLength: 1 }, tool: { type: 'string', minLength: 1 }, model: { type: 'string', minLength: 1 }, invocationId: { type: 'string', minLength: 1 }, fresh: { const: true }, receivedOnlyInputAndSchema: { const: true },
      } },
      inputSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, selectedCanonicalSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      reviews: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['identity','verdict','rule','expected','actual','severity','lowestOwner','confidence','evidenceReference'], properties: {
        identity: { type: 'string', minLength: 1 }, verdict: { enum: ['NEEDS_EVIDENCE','FAIL','UNRESOLVED'] }, rule: { const: 'AI-QUAL-01' }, expected: { type: 'string', minLength: 1 }, actual: { type: 'string', minLength: 1 }, severity: { enum: ['INFO','LOW','MEDIUM','HIGH','CRITICAL'] }, lowestOwner: { type: 'string', minLength: 1 }, confidence: { type: 'number', minimum: 0, maximum: 1 }, evidenceReference: { type: 'object' },
      } } },
    },
  };
  writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, { flag: 'wx' });
  const manifest = {
    schemaVersion: 'phase28-blind-review-manifest/v1', sealStatus: 'INPUT_SEALED_REVIEW_PENDING', appendOnly: true,
    selection: { path: slash(selectionPath), sha256: sha256Bytes(selectionPath), selectedRun: loaded.selection.selected, selectedCanonicalPath: slash(loaded.canonicalPath), selectedCanonicalSha256: loaded.selection.sha256 },
    contract: { identityParts: 6, identityCount: 2142, rulesPerIdentity: 32, findingCount: 68544, exactRuleIds: EXPECTED_RULE_IDS, deterministicTotals: loaded.canonical.counts.verdictTotals, retainedRawAdminFailCount: 112, actionableFailCount: 0 },
    members: { input: { path: slash(outputPath), sha256: sha256Bytes(outputPath) }, schema: { path: slash(schemaPath), sha256: sha256Bytes(schemaPath) }, selectedRunManifest: { path: slash(loaded.runManifestPath), sha256: sha256Bytes(loaded.runManifestPath) }, selectedMembers: loaded.runManifest.sourceArtifactHashes },
    reviewer: null, review: null,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`INPUT identities=${rows.length} rules=32 findings=68544 selectedSha256=${loaded.selection.sha256} inputSha256=${sha256Bytes(outputPath)}`);
}

if (process.argv[1]?.endsWith('uiAuditBlindReviewInput.ts')) main();
