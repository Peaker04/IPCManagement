# Wave 7.5 — read-only tools lineage analysis

Date: 2026-09-24
Verdict: `5 INDEX_VALID_FALSE_POSITIVE / 2 RESOLVED_DETERMINISTIC_RESEAL`

No repository file, evidence hash or fixture was changed.

## Five reviewed SQL fixtures

The five SQL mismatches are not content drift. For each file:

- `docs/EVIDENCE-INDEX.md` hash equals the exact committed Git blob at `HEAD`;
- the introducing historical commit also contains that exact blob hash;
- Git reports no working-tree content diff;
- the Windows checkout contains CRLF line endings;
- replacing CRLF with LF reproduces the indexed SHA-256 exactly.

Affected paths:

- `tools/db/phase05/phase05-shared-shortage-fixture-ipc-lane7-reviewed.sql`
- `tools/db/phase05/phase05-ambiguous-lineage-fixture-ipc-lane7-reviewed.sql`
- `tools/db/phase05/phase05-retry-matrix-fixture-ipc-lane7-reviewed.sql`
- `tools/db/phase05/phase05-retry-matrix-continuation-ipc-lane7-reviewed.sql`
- `tools/db/phase05/phase05-retry-matrix-final-continuation-ipc-lane7-reviewed.sql`

Disposition: `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`.

The evidence scanner must compare committed Git bytes for tracked evidence, or canonicalize text according to Git attributes. It must not treat platform checkout line endings as evidence mutation. No restore or reseal is justified for these five files.

## Two Golden XLSX fixtures — resolved

Paths:

- `tools/e2e/fixtures/phase05/weekly-menu-golden-ANV.xlsx`
- `tools/e2e/fixtures/phase05/weekly-menu-golden-DAV.xlsx`

Findings:

1. Current working bytes equal `HEAD` exactly.
2. The workbook files and their evidence-index rows were introduced in commit `cb97d7dbdfb3d47a4c523c9af2d7a02f3bea24c8`.
3. The indexed hashes do not match the workbook blobs in that same commit.
4. The indexed hashes are absent from all XLSX blobs reachable from Git history.
5. Running the retained builder twice into OS temp produces different SHA-256 values on each run.
6. The generated workbooks and committed workbooks have identical ZIP entry names and identical uncompressed entry content; only ZIP timestamps differ.

This disproves the index description that these byte hashes are reproducible through the current builder. The logical workbook content is reproducible, but the archive bytes are not deterministic.

Original disposition was `BLOCKED_RESEAL_NEEDS_DETERMINISTIC_BUILDER`.

Resolved in [`WAVE7-W7.5-XLSX-DETERMINISM-RESULT.md`](WAVE7-W7.5-XLSX-DETERMINISM-RESULT.md): both production builder layers now set fixed ZIP entry timestamps, a generate-twice regression passes, the weekly-menu parser suite passes 28/28, fixtures were regenerated through the retained tool and the evidence index was atomically resealed. Current deterministic hashes are `CBBC430E...F57AD6` for ANV and `F83EC377...3D550` for DAV. Corrected evidence denominator is now 353 references, 0 mismatches and 0 missing.

## Machine evidence

- `wave-7-tools-lineage.json` — per-commit blob hashes.
- `wave-7-tools-lineage-disposition.json` — final read-only disposition for the seven paths.

Temporary builder outputs were created only under `D:/Temp` and removed after comparison.
