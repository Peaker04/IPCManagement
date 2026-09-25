# Wave 3 Tier A execution result

Verdict: `PASS_DESTRUCTIVE_SCOPED`
Date: 2026-09-24

## Authorization and preflight

Executed only the 270 roots in `wave-3-reviewed-delete-generated.txt`.

Preflight receipt: `wave-3-preflight.json`

- candidate count: 270
- existing before deletion: 270
- tracked overlap: 0
- evidence-index overlap: 0
- outside-repository paths: 0
- ledger SHA-256: `B2FDABF715A92CF6F129677AFB10FFCDFE5BB766EE0D092BC2A60C44328006C3`

## Deletion

The first Python long-path pass deleted 203 roots and left 67 roots because Windows returned `ERROR_DIR_NOT_EMPTY` on deeply recursive legacy paths. The failure was captured in `wave-3-deletion-receipt.json`; no scope expansion occurred.

A second Windows extended-path `rd /s /q` pass processed only the same remaining authorized roots:

- deleted on retry: 67
- already absent from first pass: 203
- failures: 0
- remaining before verification: 0

Receipt: `wave-3-deletion-retry-receipt.json`.

Immediately after deletion, `wave-3-post-delete.json` proved all 270 roots absent and protected paths still present:

- `.gitnexus`
- `.dotnet-tools`
- root `node_modules`
- `frontend/node_modules`
- root `.artifacts`
- `docs/EVIDENCE-INDEX.md`

No stale worktree metadata was pruned.

## Reclaim

Reviewed Tier A before deletion: approximately 20,472.7 MiB / 222,803 files.

After cleanup and before verification builds:

- `backend`: 45.5 MiB
- `frontend`: 21.4 MiB
- root evidence `.artifacts`: preserved

Verification regenerated only canonical `.artifacts/dotnet` output: 232.4 MiB / 892 files. Net reclaimed against the reviewed Tier A estimate is approximately **20,240.3 MiB** (about 19.8 GiB).

## Verification

- `npm run test:ignore-policy`: 3/3 PASS
- `npm run build:be`: PASS, 0 warnings / 0 errors
- focused Phase 42 output-contract tests: 2/2 PASS
- canonical output-tree assertion: zero nested `backend/tests`, `.tmp-*`, `.artifactslk*`, `bin-phase*` or nested `.artifacts`
- tracked-but-ignored debt remains 568; no unknown owner appeared
- `git diff --check`: PASS

Final receipt: `wave-3-final-verification.json`.

## Boundaries preserved

- no indexed evidence deleted or moved
- no Tier B cache/index deleted
- no tracked/source/config/database file deleted
- no `git clean`, reset, restore or `git rm`
- no worktree prune
- no commit or push
