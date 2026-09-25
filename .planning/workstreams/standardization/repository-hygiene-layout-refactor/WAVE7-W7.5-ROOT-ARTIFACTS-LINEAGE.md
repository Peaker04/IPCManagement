# Wave 7.5 — read-only root artifacts lineage analysis

Date: 2026-09-24
Verdict: `10 INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`

No root artifact, evidence hash or Git attribute was changed.

## Result

All ten tracked files under root `artifacts/` are valid committed evidence. The apparent mismatch is caused entirely by Windows checkout line endings.

For every file:

- the evidence-index SHA-256 equals the exact `HEAD` Git blob;
- the evidence-index SHA-256 equals the blob in the file's introducing commit;
- the working tree has CRLF line endings;
- LF-normalizing the working bytes reproduces the indexed SHA-256 exactly;
- Git reports no content diff;
- no current working hash exists as a separate historical Git version.

Affected paths:

- `artifacts/perf-probe-wave7-all-load.json`
- `artifacts/perf-probe-wave7-all-load.md`
- `artifacts/perf-probe-warehouse-geometry.json`
- `artifacts/perf-probe-warehouse-geometry.md`
- `artifacts/perf-probe-warehouse-inp-smoke-v2.json`
- `artifacts/perf-probe-warehouse-inp-search.json`
- `artifacts/perf-probe-warehouse-inp-tab.json`
- `artifacts/perf-probe-admin-audit-pagination.json`
- `artifacts/perf-probe-coordination-export.json`
- `artifacts/perf-probe-purchasing-submit.json`

Disposition for all ten: `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`.

## Implication

These ten entries do not require restore or reseal. The evidence index is correct. The scanner must hash committed Git blobs for tracked files or use a canonical text-byte policy. After that scanner correction, this root no longer blocks a physical move on hash-integrity grounds.

A move/retirement of root `artifacts/` is still a separate path-lineage change: index references, docs and historical links must be updated atomically after the destination owner is chosen. This read-only analysis does not authorize that move.

## Machine evidence

- `wave-7-root-artifacts-lineage.json` — current/HEAD/history/LF/CRLF hashes.
- `wave-7-root-artifacts-lineage-disposition.json` — final dispositions.
