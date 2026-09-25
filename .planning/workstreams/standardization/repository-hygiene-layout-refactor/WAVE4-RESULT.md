# Wave 4 root ownership result

Verdict: `PASS_BOUNDED / LEGACY_ARTIFACTS_BLOCKED`

## Canonical roots

| Root | Owner | Verdict |
|---|---|---|
| `backend/` | ASP.NET source, tests, backend tools and database assets | KEEP |
| `frontend/` | React/Vite source and frontend test surfaces | KEEP |
| `contracts/` | Checked-in cross-tier fixture used by frontend reconciliation contract test | KEEP |
| `scripts/` | Repository-level build, CI and operational orchestration | KEEP |
| `tools/` | Standalone reviewed database/E2E/performance utilities and indexed fixtures | KEEP |
| `shipyard/` | Tracked IPCManagement profile/manifest for the external Shipyard harness | KEEP |
| `docs/` | Canonical/reference/archive documentation | KEEP |
| `.planning/workstreams/standardization/` | Repository-governed refactor state | KEEP |
| `.artifacts/` | Generated workspace plus narrowly promoted evidence | KEEP_WITH_POLICY |
| `artifacts/` | Historical indexed performance evidence with unresolved hashes | BLOCKED |
| `.docs/` | Local/private workbook and reference-data owner | KEEP_LOCAL_ONLY |

## Completed consolidation

- Root `src/` is absent and protected by the root-ownership regression gate.
- The only tracked `.docs` file was moved to `docs/archive/runbooks/MVP_DEMO_RUNBOOK-legacy.md` and marked historical.
- `README.md` and `docs/MVP_WEB_FLOW.md` no longer point users to `.docs` for a current operational runbook or default credentials.
- `.docs` now contains only ignored local/private reference material and workbooks; `git ls-files .docs/**` is empty after the move is recorded.
- `docs/harness/ARTIFACTS.md` already exists and is the canonical retention policy; the earlier Wave 0 “missing pointer” observation was stale and required no replacement document.
- `scripts/check-ignore-policy.test.mjs` now locks root ownership, the absence of root `src`, zero tracked `.docs` files, and the exact indexed legacy `artifacts/` debt.

## Blocked legacy artifacts

All ten tracked files under root `artifacts/` are referenced by `docs/EVIDENCE-INDEX.md`, and all ten current bytes disagree with their indexed SHA-256 values. They are part of the existing 21 hash mismatches.

Therefore Wave 4 did not move, delete, rename, rewrite or re-hash root `artifacts/`. The 24 additional ignored files in that directory were also left untouched because several are indexed by path and lineage reconciliation is incomplete.

A dry run of `python tools/prune_artifacts.py` found three unreferenced `.artifacts/goal-ui-ux` candidates totaling 2.05 MiB. No `--apply` was used; the dry-run output is `wave-4-artifact-prune-dry-run.txt`.

## Ownership decisions

- `contracts/phase30/reconciliation-stale-request.json` remains at root because `frontend/src/features/reconciliation/reconciliationRequestContract.fixture.test.ts` consumes it as a cross-tier immutable fixture.
- `tools/` remains root-owned because scripts/tests/docs reference standalone DB, E2E, performance and browser contracts there; several tool fixtures are evidence-indexed.
- `shipyard/` remains root-owned because docs and runtime policy distinguish the tracked project profile from the external harness checkout.
- No broad rename was justified for these owners.

## Verification

- ignore/root-ownership contract: 4/4 PASS
- tracked `.docs` target after the move is recorded: zero
- root `src`: absent
- legacy root artifact tracked count: exactly 10, all indexed
- artifact prune: dry-run only, zero deletion
- no database, runtime, evidence, worktree metadata, commit or push action
