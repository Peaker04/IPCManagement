# Repository hygiene and layout refactor

Status: proposed L2 controlled refactor
Baseline: `refactor/large-refactor-20260924` at `44124e09`
Date: 2026-09-24

## Goal

Make the monorepo obvious and reproducible without deleting CI/deployment inputs or evidence blindly:

- canonical roots remain `backend/` and `frontend/`;
- all generated output goes to one disposable root;
- Git tracks source/config/contracts/migrations/scripts and only selected small evidence;
- secrets, build output, browser profiles, temporary builds and raw evidence stay outside Git;
- every migration commit leaves build/test/CI runnable.

Git policy, disk cleanup, source layout and test layout are separate waves. Mixing them would make regressions impossible to attribute.

## Evidence from the current checkout

### Repository/worktrees

- Main worktree: `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement`.
- `frontend/` and `backend/` are already the product roots.
- Root `src/` is empty, untracked and misleading.
- Three stale worktree records point to missing paths under the old `D:/Kì 7/.../.claude/worktrees/...` location and are reported as `prunable`.

### Disk inflation

| Path | Approx. logical size | Finding |
|---|---:|---|
| `backend/` | 19.4 GiB | repeated .NET output trees and recursive copies |
| `.artifacts/` | 5.4 GiB | mixed durable evidence and disposable output |
| `node_modules/` | 639 MiB | expected local cache, ignored |
| `.claude/` | 536 MiB | ignored external-runtime assets; policy says retain |
| `frontend/` | 362 MiB | source plus generated/local files |
| `tools/` | 225 MiB | tooling plus local environments/output |
| `.planning/` | 126 MiB | old phases contain screenshots/traces/raw evidence |
| `.git/` | 229 MiB | not the main inflation source |

Large backend owners include:

- `backend/tests/IPCManagement.Api.Tests/.artifacts/` ≈ 4.3 GiB;
- `backend/src/IPCManagement.Api/.artifacts/` ≈ 2.5 GiB;
- recursive `backend/.../backend/...` trees;
- `.tmp-*`, `.artifactslk*`, `.phase*test`, `bin*`, `obj`, and `TestResults` trees;
- paths long enough for Git traversal to emit `Filename too long`.

Likely root cause: relative `BaseOutputPath`/custom output values are resolved in project context and copied content then reproduces repository-relative paths inside output. All .NET output should be routed to one repo-absolute `.artifacts/dotnet/<run-id>/` root, never below a project directory.

### Tracking/ignore drift

Tracked top-level counts include roughly 849 backend files, 805 frontend files, 575 `.planning` files, 234 `.codex` files, 130 tool files and 105 docs files.

Findings:

1. Many files are tracked but now match `.gitignore`. Git still pushes tracked files after an ignore rule is added. Examples include selected `.artifacts`, most historical `.planning`, `.docs/MVP_DEMO_RUNBOOK.md`, root `artifacts/*`, and `backend/src/IPCManagement.Api/appsettings.Development.json`.
2. `.planning/` is ignored, but only `workstreams/standardization/**` is re-included. Existing tracked files continue to push while new files elsewhere can silently disappear from Git.
3. Both `artifacts/` and `.artifacts/` exist. This splits evidence/output ownership.
4. A development appsettings file is tracked despite the sensitive-config ignore policy; it needs a secret-safe content review and an explicit keep/example/untrack decision.
5. `.git/info/exclude` locally ignores `.gitnexus/` and `.dotnet-tools/`; those rules do not travel to other clones. Shared disposable paths belong in `.gitignore`; personal preferences may remain local.
6. `.gitignore` mixes build output, secrets, agent state and promoted evidence with complex negations.
7. `docs/harness/DELIVERY.md` links `docs/harness/ARTIFACTS.md`, but that file is absent.

### Frontend tests

- 229 tracked unit/component tests are colocated under `frontend/src/**/*.test.{ts,tsx}`.
- 182 tracked files live under `frontend/tests/`.
- Vitest includes both locations; Playwright uses `frontend/tests/` as its test directory.
- ESLint, coverage and documentation explicitly support colocated tests.

The visual noise is real, but moving all colocated tests is not automatically an architectural improvement. Colocation preserves locality: production modules and behavior tests move together. The larger problem is taxonomy: `frontend/tests/` mixes Playwright, Vitest cross-module contracts, evidence validators, support code and snapshots.

Recommended policy:

- keep module unit/component tests colocated;
- use `frontend/tests/browser/` for Playwright;
- use `frontend/tests/contracts/` for cross-module architecture/source contracts;
- use `frontend/tests/evidence/` for local campaign/evidence validators;
- use `frontend/tests/support/` for browser/cross-module helpers;
- replace the long CI filename exclusion list with explicit suite/config boundaries;
- use VS Code file nesting/explorer settings if the main pain is visual clutter.

## Target layout

```text
IPCManagement/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── tools/
│   └── database/
├── frontend/
│   ├── src/                  # production + colocated module tests
│   ├── tests/
│   │   ├── browser/
│   │   ├── contracts/
│   │   ├── evidence/
│   │   └── support/
│   └── public/
├── contracts/                # checked-in cross-tier fixtures/contracts only
├── scripts/                  # repo-level build/CI/operations
├── tools/                    # repo-level standalone tooling only
├── docs/
├── .planning/                # GSD text/JSON state, no raw build/browser output
├── .artifacts/               # generated output, ignored by default
│   └── promoted/             # optional narrow allowlist for small manifests
├── .github/
└── package.json
```

Candidates to remove/consolidate only after reference review:

- empty root `src/`;
- root `artifacts/` after durable conclusions/hashes are promoted to canonical owners;
- generated `backend/**/backend/` trees;
- `.tmp-*`, `.artifactslk*`, `.phase*test`, `bin*`, `obj`, `TestResults`;
- stale worktree metadata after branch recoverability review.

Do not auto-delete migrations, database/recovery tooling, `.claude/` assets, indexed evidence, tracked planning history, or local config before lineage/secret/CI review.

## Tracking matrix

| Category | Git | Actions artifact | Local only |
|---|---|---|---|
| Product source/tests/migrations | yes | no | yes |
| Lockfiles/workflows/deploy config | yes | no | yes |
| Generated OpenAPI contract used for parity | yes | optional diff | yes |
| Secret appsettings/env | no | no | yes |
| Safe examples/defaults | yes | no | yes |
| `bin`, `obj`, `dist`, coverage, TestResults | no | short retention | disposable |
| Browser profiles/screenshots/traces/videos | no by default | short retention | disposable |
| Small final manifests with durable value | narrow allowlist | yes | yes |
| Active planning text/JSON | recommended yes | no | yes |
| Raw historical planning evidence | no | release/archive if needed | removable after promotion |
| dependency/tool caches | no | cache service | disposable |

## Execution waves

### Wave 0 — inventory and safety manifest

- Record tracked, ignored, tracked-and-ignored and untracked inventories.
- Record sizes/top recursive owners.
- Scan tracked config/candidate artifacts for secrets without printing values.
- Resolve retained evidence against `docs/EVIDENCE-INDEX.md`.
- Classify every root entry.

Gate: review only; no deletion.

#### Wave 0 checkpoint — 2026-09-24

Verdict: `PASS_INVENTORY / DESTRUCTIVE_ACTION_BLOCKED`.

- Baseline remained `refactor/large-refactor-20260924` at `44124e091783765e3c52411d28cc5ee78c192986`.
- Inventory recorded 2,813 tracked files, 569 tracked-but-ignored files, 107 active ignore patterns and 583 generated-output roots.
- Exact ledgers and reproducible inventory script are under [`wave-0/`](wave-0/); primary receipt is [`SAFETY-MANIFEST.md`](wave-0/SAFETY-MANIFEST.md).
- Action ledgers: KEEP 17 canonical/high-risk roots, MOVE 102 paths, UNTRACK 1 path, DELETE_GENERATED 273 reviewed candidates, NEEDS_DECISION 496 paths/records. The full 2,813-file tracked inventory remains authoritative for files not specially classified.
- Generated backend/project output accounts for approximately 20.2 GiB before adding top-level `.gitnexus`, `node_modules`, `.dotnet-tools` and logs. Nothing was deleted.
- Secret scan found no high-confidence private key, AWS key or GitHub token. Thirty-two review hits are CI ephemeral values, examples, synthetic tests, environment-variable owners, or the tracked development-settings filename; no values were copied into reports.
- CI/deployment paths prove `backend/`, `frontend/`, `scripts/`, `tools/`, `.dotnet-tools/`, `docs/` and `.artifacts/` have current references. Generated `.artifacts` content need not be committed merely because CI writes there.
- Evidence lineage checked 322 indexed paths: 319 exist, 297 hashes match, 21 hashes mismatch and 3 directory references are missing. These discrepancies block artifact deletion/promotion until reconciled.
- Three stale worktree records remain untouched and require branch-ref review before any later prune.
- No file was deleted, moved, untracked, pruned, committed or pushed.

Next allowed step: Wave 1 only. Wave 3 remains blocked until output recurrence is fixed and the owner approves the destructive ledger.

### Wave 1 — stop backend output recursion

- Replace relative `BaseOutputPath` and custom `bin-*` paths with a repo-absolute `.artifacts/dotnet/<run-id>/` owner.
- Evaluate the .NET SDK centralized artifacts output layout before retaining custom path logic.
- Ensure copied content cannot include/recurse through repository roots.
- Add a cleanup command limited to known generated roots.
- Add one regression gate rejecting generated `backend/**/backend/`, project-local `.tmp-*`, `.artifactslk*`, and output below source roots.

Gate: focused Phase 42 commands, backend build/test, output-tree assertion.

#### Wave 1 checkpoint — 2026-09-24

Verdict: `PASS_FOCUSED / CLEANUP_NOT_RUN`.

- Added root `Directory.Build.props` with .NET SDK `UseArtifactsOutput` and canonical `.artifacts/dotnet` ownership.
- Added `DefaultItemExcludes` for stale project-local `.artifacts`, `.artifactslk*`, `.tmp-*`, `.phase*test`, `bin-*` and recursive `backend/` trees. A pre-fix smoke proved centralized output alone still copied stale recursive content; the exclusion owner closed that root cause.
- Replaced every active Phase 42 relative `BaseOutputPath` with `--artifacts-path .artifacts/dotnet/<run-id>`; EF/root aggregate commands set repo-root `ArtifactsPath` through PowerShell because their outer command is not a direct `dotnet build/test/run` invocation.
- Phase 42 source contract now rejects `BaseOutputPath`, requires centralized artifacts ownership and locks the exclusion patterns.
- Red loop: two focused `Phase42AggregateVerificationTests` failed before production edits on the old relative paths. Green loop: 2/2 passed after the edit; full `Phase42AggregateVerificationTests` passed 64/64.
- Solution build to `.artifacts/dotnet/wave1-solution` passed with 0 errors and two inherited warnings. Output-tree assertion found zero nested `backend/tests`, `.tmp-*`, `.artifactslk*` or `bin-phase*` directories.
- Root `npm run build:be` passed with 0 warnings/errors and emitted to `.artifacts/dotnet/bin/IPCManagement.Api/debug`; the Phase 42 contract-only runner also passed.
- Normal focused build to `.artifacts/dotnet/wave1-smoke-clean` also passed 2/2 and produced zero nested generated directories, proving stale content is not recopied even without disabling default content items.
- Updated `docs/ARCHITECTURE.md` and `docs/TESTING.md` with the centralized output contract.
- No existing generated output was deleted; no cleanup, prune, commit or push occurred. Wave 3 remains separately authorized/destructive.

Residual: the plan originally mentioned adding a cleanup command in Wave 1. It was deliberately not added because Wave 0 already owns an exact reviewed deletion ledger and execution belongs to destructive Wave 3; a second cleanup owner would duplicate policy and increase risk.

Next allowed step: Wave 2 ignore-policy normalization, or owner review/authorization before Wave 3. Wave 3 must not run automatically.

### Wave 2 — normalize `.gitignore`/`.dockerignore`

- Use anchored root patterns and policy sections.
- Make `/.artifacts/**` ignored by default with only narrow promoted-file allowlists.
- Decide `.planning` policy explicitly; do not rely on already-tracked exceptions.
- Add missing temp/custom-output patterns.
- Keep secret configs ignored and examples tracked.
- Keep Docker exclusions specific to build context.
- Add a `git check-ignore -v`/`git ls-files -ci --exclude-standard` contract with a shrinking allowlist.

Gate: clean-clone/index simulation, Docker context review, CI path parity.

#### Wave 2 checkpoint — 2026-09-24

Verdict: `PASS_SOURCE_GATE / DOCKER_BUILD_NEEDS_EVIDENCE`.

- Anchored legacy root output at `/artifacts/`; canonical generated output remains `.artifacts/` ignored by default with the existing narrow promoted-evidence allowlists.
- Added shared ignore rules for `.artifactslk*`, `.tmp-*`, `.phase*test`, custom `bin-*`, and the three known recursive backend-output roots. Matching exclusions were added to `.dockerignore` without excluding `backend/` or `backend/src/`.
- Removed `AGENTS.md` from ignore policy because it is the tracked repository authority. Secret-bearing environment/appsettings names remain ignored; safe `*.example` paths remain trackable.
- Made `.planning` policy explicit: local-by-default, with only the repository-governed `workstreams/standardization` Markdown/JSON/CSV/HTML/CSS surface trackable. Raw PNG/ZIP/log/build evidence remains ignored. This avoids surfacing hundreds of historical local planning files as new source.
- Added `scripts/check-ignore-policy.test.mjs`, root `npm run test:ignore-policy`, the root `verify` rung, and a dedicated GitHub Actions step immediately after `npm ci`.
- Red loop failed 2/2 on the pre-fix policy: recursive backend output was not ignored and tracked `AGENTS.md` was an unreviewed tracked-ignore exception. Green loop passes 3/3, including Docker context assertions.
- Tracked-but-ignored debt fell from 569 to 568 and is now bounded to exact reviewed owners: `.planning` 536, `.artifacts` 20, legacy `artifacts` 10, `.docs` 1, and development appsettings 1. Unknown owner count is zero; ceilings can only shrink.
- CI/deploy source paths (`Directory.Build.props`, package/Docker/Vercel/workflow files, backend/frontend source, docs/scripts and standardization plans) are asserted trackable. JSON and GitHub YAML parse checks passed.
- Docker CLI is unavailable on this host, so an actual Docker build remains `NEEDS_EVIDENCE` for Wave 6. The `.dockerignore` source contract passed and no build was claimed.
- No file was deleted, moved, untracked, pruned, committed or pushed.

Next safe step: owner review, then Wave 3 only with explicit destructive authorization and the exact Wave 0 deletion ledger. Evidence-lineage mismatches remain blockers for deleting indexed artifacts.

### Wave 3 — reclaim generated disk

- Stop only owned processes that hold build files.
- Delete only reviewed generated paths.
- Prune stale worktree metadata after recoverability review.
- Re-measure disk use and verify Git status.

Expected reclaim: more than 20 GiB, subject to manifest review.

#### Wave 3 pre-execution review — 2026-09-24

Verdict: `TIER_A_REVIEWED / DELETION_NOT_STARTED`.

- Reviewed all 273 Wave 0 generated candidates and current Wave 1 output.
- Tier A ledger [`wave-3-reviewed-delete-generated.txt`](wave-3-reviewed-delete-generated.txt) contains 270 existing generated roots, approximately 20,472.7 MiB and 222,803 files. Evidence-index overlap is zero.
- Tier B (`.gitnexus`, `.dotnet-tools`, root `node_modules`, `frontend/node_modules`) totals approximately 2,195.5 MiB and requires separate owner approval; it is excluded from Tier A.
- Root `.artifacts` is not a deletion target. Only `.artifacts/dotnet` is in Tier A; all indexed evidence, including 21 hash mismatches and three missing references, remains blocked from deletion or movement.
- Stale worktree metadata is excluded from this execution; no prune authority is implied.
- Exact safeguards and authorization wording are in [`WAVE3-REVIEW.md`](WAVE3-REVIEW.md).
- No deletion, process stop, prune, commit or push occurred during review.

Wave 3 execution was authorized for Tier A only and completed without expanding scope.

#### Wave 3 execution checkpoint — 2026-09-24

Verdict: `PASS_DESTRUCTIVE_SCOPED`.

- Preflight passed 270/270 existing roots with zero tracked overlap, zero evidence-index overlap and zero outside-repository paths; ledger SHA-256 `B2FDABF715A92CF6F129677AFB10FFCDFE5BB766EE0D092BC2A60C44328006C3`.
- First long-path deletion pass removed 203 roots and captured 67 `ERROR_DIR_NOT_EMPTY` failures from deeply recursive Windows paths. A scoped Windows extended-path retry removed the same 67 authorized roots; no new path was added.
- Immediate post-delete receipt proved all 270 roots absent while `.gitnexus`, `.dotnet-tools`, root/workspace `node_modules`, root `.artifacts`, and `docs/EVIDENCE-INDEX.md` remained present.
- Verification regenerated only canonical `.artifacts/dotnet` output (232.4 MiB / 892 files). Zero nested `backend/tests`, `.tmp-*`, `.artifactslk*`, `bin-phase*` or nested `.artifacts` reappeared.
- Net reclaimed against the reviewed Tier A estimate: approximately 20,240.3 MiB (about 19.8 GiB). `backend` is now approximately 45.5 MiB and `frontend` 21.4 MiB.
- Gates: ignore policy 3/3 PASS; backend build PASS with 0 warnings/errors; focused Phase 42 2/2 PASS; `git diff --check` PASS.
- Receipts: [`WAVE3-RESULT.md`](WAVE3-RESULT.md), `wave-3-preflight.json`, `wave-3-deletion-receipt.json`, `wave-3-deletion-retry-receipt.json`, `wave-3-post-delete.json`, and `wave-3-final-verification.json`.
- No indexed evidence, Tier B cache/index, tracked/source/config/database file or stale worktree metadata was touched. No commit or push occurred.

Next safe step: Wave 4 root consolidation and evidence-owner review; evidence hash mismatches still block moving/deleting indexed artifacts.

### Wave 4 — consolidate roots

- Remove empty root `src/`.
- Promote durable conclusions from root `artifacts/` to existing docs/evidence owners and retire duplicate raw reports.
- Remove root `artifacts/` when no references remain.
- Reconcile `contracts/`, `tools/`, `scripts/`, and `shipyard/` ownership without broad renames.
- repair the missing artifact-retention documentation pointer.

Gate: reference scan, docs links, CI scripts, Docker and Vercel build paths.

#### Wave 4 checkpoint — 2026-09-24

Verdict: `PASS_BOUNDED / LEGACY_ARTIFACTS_BLOCKED`.

- Root `src/` was already removed in Wave 3 and is now locked absent by the root-ownership regression gate.
- Moved the sole tracked `.docs` file to `docs/archive/runbooks/MVP_DEMO_RUNBOOK-legacy.md`, marked it historical, and updated `README.md` plus `docs/MVP_WEB_FLOW.md` so current execution no longer points to obsolete seed/reset commands or default credentials. `.docs` is now local/private workbook/reference ownership only.
- `docs/harness/ARTIFACTS.md` already exists and is canonical; the Wave 0 missing-file observation was stale, so no duplicate retention document was created.
- Kept `contracts/`, `tools/`, `scripts/`, and `shipyard/` in place after source-reference review: each has an active cross-tier, CI/operations, indexed-fixture or project-profile owner. No broad rename was justified.
- All ten tracked root `artifacts/` files are evidence-indexed and all ten current hashes differ from their indexed hashes. They remain part of the unresolved 21 mismatches, so no root artifact was moved, deleted, rewritten or re-hashed. The ignored sibling files were also left untouched.
- `python tools/prune_artifacts.py` dry-run found three unreferenced `.artifacts/goal-ui-ux` candidates totaling 2.05 MiB; no `--apply` was used.
- Extended `npm run test:ignore-policy` with root ownership assertions; 4/4 PASS.
- Result: [`WAVE4-RESULT.md`](WAVE4-RESULT.md). No database/runtime/worktree metadata, commit or push action occurred.

Next safe step: Wave 5 frontend test taxonomy. Artifact relocation remains blocked until evidence lineage is reconciled.

### Wave 5 — frontend test taxonomy

- Do not move all colocated tests.
- Classify module, contract, browser and evidence tests.
- Move only cross-module/browser/evidence categories with `git mv`.
- Update Vitest, Playwright, ESLint, TypeScript, coverage and scripts in the same small commit as each move.
- Replace filename-by-filename exclusions with named/directory suites.
- Optionally add workspace-safe VS Code file nesting.

Gate after every batch: discovery count unchanged, focused tests/lint/build pass, Playwright lists the intended specs.

#### Wave 5 checkpoint — 2026-09-24

Verdict: `PASS_BOUNDED / HISTORICAL_PINNED_PATHS_REMAIN`.

- Kept all module unit/component tests colocated under `frontend/src`; no mass move.
- Added `frontend/tests/README.md` taxonomy: new contracts → `tests/contracts`, evidence validators → `tests/evidence`, new browser specs → `tests/browser`, helpers → `tests/support`, fixtures → `tests/fixtures`.
- Moved three Phase 28/35 evidence validators to `frontend/tests/evidence/`, corrected relative paths, and replaced their individual CI exclusions with `tests/evidence/**/*.test.{ts,tsx}`.
- Added `testMatch: '**/*.spec.ts'` to main/dialog-gap/field-geometry/recovery Playwright configs so Vitest `.test.*` files are not browser scenarios.
- Added shrinking-debt gate `scripts/check-frontend-test-taxonomy.test.mjs`, root `npm run test:frontend-test-taxonomy`, root `verify`, and GitHub Actions integration. Current ceilings: 32 root specs, 57 root `.test.ts`, 3 root `.test.tsx`; evidence directory is exact-three.
- Verification: taxonomy 1/1 PASS; two moved validators 32 tests PASS; CI-shaped product sample 2 files/25 tests PASS; route-smoke Playwright discovery 10 tests/1 spec PASS; TypeScript and frontend production build PASS; ignore 4/4 and architecture 6/6 PASS.
- The moved Phase 35 validator still fails its inherited stale geometry ledger (95 ledger rows vs 108 current production rows). Default CI continues to exclude the evidence directory; this is campaign evidence debt, not path-resolution regression.
- Whole Playwright `--list` remains blocked by inherited `phase31-convergence.spec.ts` importing four spec files. Bulk browser/contract moves remain unsafe because Phase 27/28 snapshots, validators, docs and parity tests pin exact paths/hashes.
- Full details: [`WAVE5-RESULT.md`](WAVE5-RESULT.md). No artifact/database/runtime/worktree metadata, commit or push action occurred.

Next safe step: Wave 6 clean-clone CI/deployment proof. Docker remains unavailable locally and must be reported separately.

### Wave 6 — clean-clone CI/deployment proof

From a clean clone/worktree with no ignored local dependencies:

1. `npm ci`;
2. backend restore/build;
3. OpenAPI parity;
4. migration/schema gates;
5. backend tests;
6. frontend lint/depcruise/build/unit tests;
7. Docker build;
8. Vercel output remains `frontend/dist`;
9. generated workflow output is uploaded with explicit retention.

A dirty developer machine passing is not acceptance for a tracking-policy change.

#### Wave 6 checkpoint — 2026-09-24

Verdict: `FAIL_CI / NEEDS_EVIDENCE_DOCKER`.

- Created a detached clean-baseline candidate at `44124e091783765e3c52411d28cc5ee78c192986` and overlaid the uncommitted candidate diff; the dirty source worktree was preserved. A normal clone was blocked by Git active-hooks-path protection, which was not disabled.
- PASS: `npm ci`; ignore 4/4; taxonomy 1/1; architecture self-tests 6/6; backend/frontend builds; OpenAPI parity; EF pending-model and schema generation; application tests 49/49; API non-integration/non-migration tests 1,287 PASS / 3 SKIP.
- Fixed clean-candidate issues caused by centralized .NET outputs: EF commands now pass `--msbuildprojectextensionspath`; four source-scanning backend tests resolve roots from working/binary directories and support repository/backend layouts plus worktree `.git` files.
- FAIL: strict architecture gate reports eight current-vs-baseline issues; CI-shaped frontend unit suite reports 1 FAIL / 1,607 PASS / 2 SKIP; Phase 42 reports 14 FAIL / 50 PASS because ignored `.artifacts/shipyard-live/phase-04.2-execution` evidence is absent.
- `NEEDS_EVIDENCE`: Docker is unavailable (`docker: command not found`); database integration and deployment runtime were not run without an authorized lane/credentials.
- `npm ci` reported 18 dependency findings (1 low, 8 moderate, 9 high); no automatic dependency mutation was performed.
- Temporary worktree metadata and directory were removed. No commit, push, database, evidence or deployment mutation occurred.
- Full details: [`WAVE6-RESULT.md`](WAVE6-RESULT.md).

Next safe step: Docker/deployment proof on a Docker-capable runner. The three source-level FAIL objectives from the initial Wave 6 run are resolved in [`WAVE6-OBJECTIVES-RESULT.md`](WAVE6-OBJECTIVES-RESULT.md): architecture current baseline PASS, Dashboard exact CI unit suite PASS, and Phase 42 split into 50 clean-hermetic plus 15 evidence-owned passing cases.

### Wave 7 — repository navigation and active-surface reduction

Execution checklist: [`WAVE7-CHECKLIST.md`](WAVE7-CHECKLIST.md).

W7.1 is implemented pending visual confirmation after VS Code reload: the ignored zero-reference project spreadsheet was moved intact to a sibling local-reference directory with SHA-256 receipt; shareable `.vscode/settings.json` now hides reproducible/local runtime owners and nests related root/frontend config files. Active-tree `.gitkeep` placeholders were removed, including four now-empty frontend directories; evidence snapshots and external worktrees were untouched.

W7.2 is `PASS_BOUNDED / EVIDENCE_MOVE_BLOCKED`: active specialized Playwright configs now live under `frontend/tests/config/` with one minimal shared geometry config; Phase 27.1 path-pinned configs remain at frontend root. Two unreferenced MVP guides moved to `docs/archive/frontend-integration/`; the canonical token index moved to `docs/ui-ux/`. `frontend/docs/` now contains only two hash-indexed historical performance reports and cannot be removed before W7.5 lineage reconciliation. Focused discovery (6 dialog, 4 field, 10 recovery), browser-support 2/2, taxonomy, ignore policy, TypeScript/ESLint, dependency-cruiser (0 errors/2 existing warnings) and frontend build pass.

W7.3 is `PASS_DELETE_AND_WIRE`: the 65 approved Phase 05 candidates (478,981 bytes) and 12 approved root standardization candidates (137,312 bytes) were deleted with exact CSV receipts; all reviewed keep paths remain. Post-delete scans found zero stale current-reference groups. The retained frontend-unit-launcher regression is now `npm run test:frontend-unit-launcher`, included in root `verify` and a dedicated GitHub Actions step; 2/2 policy tests pass alongside ignore 4/4, taxonomy 1/1, frontend launcher contracts 45/45, Playwright discovery 6/4/10, frontend build and fixture-builder build. The retained ANV/DAV workbook bytes still differ from their historical evidence-index hashes and remain W7.5 lineage debt. Details: [`WAVE7-W7.3-RESULT.md`](WAVE7-W7.3-RESULT.md), [`WAVE7-W7.3-ROOT-SCRIPTS-RESULT.md`](WAVE7-W7.3-ROOT-SCRIPTS-RESULT.md).

W7.5 preflight now precedes W7.4 physical archival. The original corrected raw scan found 336 indexed references, 33 working-tree hash mismatches and 3 apparent missing pointers; Wave 0's count of 21 omitted 10 root `artifacts` and 2 `frontend/docs` entries. Lineage closed five SQL, all ten root `artifacts`, both `frontend/docs/perf` files, one `.planning` receipt and five tracked `.artifacts` files as CRLF checkout false positives. The three apparent missing pointers are valid directories and all 23 section-relative child hashes match. The corrected scanner now uses committed bytes for tracked files, recognizes directories, resolves section-relative children and pairs only table path/hash columns; regression 3/3 PASS. Its first corrected denominator was 358 references, 9 mismatches and 0 missing: six overwritten untracked `.artifacts` paths, one stale duplicate row and two deterministic-XLSX blockers. Read-only semantic review then supported two explicit current-hash reseals and five stale-row retirements. The applied evidence-index-only batch changed no evidence bytes; its denominator became 353 references, 2 mismatches and 0 missing, both Golden XLSX blockers. Those final blockers are now resolved: fixed ZIP timestamps at both workbook builder layers make output byte-deterministic, the generate-twice regression and 28 weekly-menu parser tests pass, ANV/DAV fixtures were regenerated through the retained tool, and the evidence index was atomically resealed. Current evidence denominator is 353 references, 0 mismatches and 0 missing. Root `artifacts/` and `frontend/docs/` were retired after moving all 36 files to `.artifacts/performance/`; all 14 indexed moved hashes remain unchanged. W7.4 then enriched all 575 originally tracked planning rows from GSD state/roadmap, workstream status, MEMORY/evidence pointers and repository backlinks. The first explicitly safe planning batch moved 9 complete zero-backlink quick-task directories / 21 files to `.planning/archive/v1.4/quick/`. Follow-up lifecycle review resolved all four notes and five ambiguous quick owners: active/locked/referenced owners stayed in place, while completed zero-backlink `260820-whz` added 2 canonical-byte-identical files to the archive. W7.4 now has explicit dispositions for all 575 rows and 10 archived quick directories / 23 files; no phase tree moved. Details: [`WAVE7-W7.5-PREFLIGHT.md`](WAVE7-W7.5-PREFLIGHT.md), [`WAVE7-W7.5-TOOLS-LINEAGE.md`](WAVE7-W7.5-TOOLS-LINEAGE.md), [`WAVE7-W7.5-ROOT-ARTIFACTS-LINEAGE.md`](WAVE7-W7.5-ROOT-ARTIFACTS-LINEAGE.md), [`WAVE7-W7.5-FRONTEND-PLANNING-LINEAGE.md`](WAVE7-W7.5-FRONTEND-PLANNING-LINEAGE.md), [`WAVE7-W7.5-DOT-ARTIFACTS-SCANNER.md`](WAVE7-W7.5-DOT-ARTIFACTS-SCANNER.md), [`WAVE7-PERFORMANCE-EVIDENCE-MIGRATION.md`](WAVE7-PERFORMANCE-EVIDENCE-MIGRATION.md), [`WAVE7-W7.4-PLANNING-ACTIVE-HISTORY.md`](WAVE7-W7.4-PLANNING-ACTIVE-HISTORY.md).

W7.7 final clean-candidate verification is `PASS`: detached baseline `44124e09` plus the complete source candidate passes root `verify`, backend build/tests (49 Application plus 1,350 API PASS / 3 SKIP), frontend build/unit (2,334 modules; 1,608 PASS / 2 SKIP), OpenAPI parity, EF pending-model, architecture, ignore, taxonomy and deterministic-fixture gates. The run found and fixed linked-worktree root discovery, root-verify drift from clean CI, and a repeatable blank date-input lazy fallback. Evidence-bearing source remains 353/0/0; a clean checkout intentionally lacks 309 ignored retained-evidence references, so evidence validation remains its separate local-bearing lane. Seven logical commit boundaries are reviewed; nothing is staged, committed or pushed. Details: [`WAVE7-FINAL-CLEAN-CANDIDATE.md`](WAVE7-FINAL-CLEAN-CANDIDATE.md).

## Primary sources

- Git ignore applies to intentionally untracked files; already tracked files require an index decision: https://git-scm.com/docs/gitignore and https://git-scm.com/docs/git-rm
- Stale worktree administration records can be removed with Git worktree pruning: https://git-scm.com/docs/git-worktree
- Shared repository ignore vs personal global excludes: https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files
- npm root workspaces make the current `frontend` workspace arrangement valid: https://docs.npmjs.com/cli/v11/using-npm/workspaces
- Vitest supports explicit include patterns; physical separation is project policy: https://vitest.dev/config/include
- Microsoft test guidance prioritizes readability, isolation and public behavior rather than directory distance: https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
- .NET centralized artifacts output layout: https://learn.microsoft.com/en-us/dotnet/core/sdk/artifacts-output
- MSBuild output path properties: https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props#baseoutputpath and https://learn.microsoft.com/en-us/visualstudio/msbuild/common-msbuild-project-properties?view=vs-2022
- GitHub Actions artifacts support generated-output retention outside source control: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts

## Owner decisions required before destructive waves

1. Keep all `.planning` history on the main branch, or keep only active text/summaries and archive old raw evidence elsewhere?
2. Are tracked root `artifacts/perf-probe-*` files still required, or may conclusions/hashes be promoted and raw files removed?
3. Keep a verified safe `appsettings.Development.json`, or use examples plus environment variables only?
4. Keep unit/component tests colocated and solve visual noise through taxonomy/file nesting, or require physical separation for every test?

Recommended defaults: tracked active planning text only; raw artifacts outside Git; safe examples instead of environment-specific settings; colocated module tests plus clear browser/contract/evidence directories.
