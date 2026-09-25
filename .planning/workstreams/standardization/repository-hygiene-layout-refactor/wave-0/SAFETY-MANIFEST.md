# Wave 0 safety manifest

Verdict: **PASS_INVENTORY / DESTRUCTIVE_ACTION_BLOCKED**
Branch: `refactor/large-refactor-20260924`
HEAD: `44124e091783765e3c52411d28cc5ee78c192986`

No file was deleted, moved, untracked, pruned, committed or pushed.

## Inventory counts

| Item | Count |
|---|---:|
| Tracked files | 2813 |
| Tracked files now matching ignore rules | 569 |
| Untracked Wave 0 files at final inventory | 18 |
| Inherited untracked files outside this task | 0 |
| Active ignore patterns | 107 |
| Generated-output roots discovered | 583 |
| Secret-risk detector hits | 32 |
| Evidence-index path references | 322 |

## Action ledgers

Exact path lists are stored in:

- `action-keep.txt`
- `action-move.txt`
- `action-untrack.txt`
- `action-delete-generated.txt`
- `action-needs-decision.txt`

Counts: KEEP 17, MOVE 102, UNTRACK 1, DELETE_GENERATED 273, NEEDS_DECISION 496.

`KEEP` lists canonical/high-risk roots rather than all 2813 tracked files; the complete tracked inventory is `tracked.txt`. All tracked files not explicitly classified MOVE/UNTRACK/NEEDS_DECISION remain KEEP for Wave 0.

## Generated output

Known generated roots total approximately 19913.3 MiB before adding top-level `.gitnexus`, `node_modules`, `.dotnet-tools`, `logs` and empty `src`. The largest owners are backend project-local `.artifacts`, recursive `backend/.../backend`, `bin`, `obj`, `.artifactslk*` and `.tmp-*`.

Deletion remains blocked until Wave 1 prevents recurrence and the owner reviews `action-delete-generated.txt`. `.claude` output is excluded from deletion because project runtime policy explicitly retains it.

## Ignore drift

Tracked-but-ignored distribution:

- `.planning`: 536
- `.artifacts`: 20
- `artifacts`: 10
- `.docs`: 1
- `AGENTS.md`: 1
- backend config: 1

The current policy is inconsistent: ignored paths continue to push because they are already tracked, while new sibling files can be silently omitted.

## Secret-risk review

No high-confidence private-key, AWS key or GitHub token detector fired. All 32 hits are review-level:

- CI ephemeral MySQL/JWT values;
- README/example configuration;
- synthetic test credentials;
- source validators and runtime scripts that name secret environment variables;
- tracked `appsettings.Development.json`, which currently contains logging/rate-limit settings only, but conflicts with the declared filename policy.

No secret values are copied into this manifest. The exact file/line/detector-only ledger is `secret-risk.json`.

## CI/CD dependency findings

- `backend/`, `frontend/`, `scripts/`, `tools/`, `.dotnet-tools/`, `docs/` and `.artifacts/` are referenced by root scripts/workflows/deploy configuration.
- `.artifacts/` is required as an output path in GitHub Actions; this does **not** require generated contents to be committed.
- Docker builds only the backend source tree.
- Vercel builds through the root npm workspace and publishes `frontend/dist`.
- Dependabot expects the current backend project locations.

Exact config/line/root references are in `ci-dependencies.json`. No root can be renamed before its references move in the same commit.

## Evidence lineage

- References checked: 322
- Existing files: 319
- Missing paths: 3
- Hash matches: 297
- Hash mismatches: 21
- Tracked referenced files: 17
- Would-be ignored referenced files: 3

The 21 hash mismatches and 3 missing paths block artifact deletion or evidence promotion. One indexed path is intentionally repeated with two historical hashes, but the remaining mismatches still require owner reconciliation. Exact expected/actual hashes and paths are in `evidence-lineage.json`; values are hashes only.

## Worktrees

The primary worktree is live. Three records are marked prunable and point to missing old-path locations. Wave 0 did not prune them. Their branch refs must be reviewed before Wave 3.

## Wave 0 gate

- Inventory: PASS
- Classification ledger: PASS
- Secret-risk scan: PASS_WITH_REVIEW, no high-confidence secret token detected
- CI/CD dependency map: PASS
- Evidence lineage: FAIL_RECONCILIATION (21 hash mismatches, 3 missing paths)
- Destructive cleanup authorization: BLOCKED pending Wave 1 and owner decisions

Next allowed step: Wave 1, stop .NET output recursion. Do not execute Wave 3 from this manifest until evidence mismatches and action ledgers are reviewed.
