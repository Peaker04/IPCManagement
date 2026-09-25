# Wave 7 — repository navigation and active-surface reduction

Status: ACTIVE
Branch baseline: `refactor/large-refactor-20260924` at `44124e091783765e3c52411d28cc5ee78c192986`
Owner: repository-hygiene-layout-refactor

## Goal

Reduce the active Explorer surface without hiding ownership mistakes or deleting evidence blindly. Prefer, in order:

1. delete proven empty/dead local files;
2. move personal files outside the repository;
3. hide reproducible caches/runtime state;
4. nest related configuration files;
5. consolidate active owners only after consumer/path/hash verification.

## Safety rules

- No evidence file or indexed hash changes before lineage reconciliation.
- No broad move of `.agents`, `.codex`, `.pi`, `.planning`, `artifacts`, or `.artifacts`.
- No deletion of database fixtures, migrations, browser evidence, or historical scripts based only on zero text references.
- Every physical move must record source, destination, tracking state, references and verification.
- Keep `backend/` and `frontend/` as canonical product roots.

## Checklist

### W7.1 — local junk and Explorer hygiene

- [x] Inventory root and `frontend/` immediate children by tracked/ignored state.
- [x] Confirm `.vscode/settings.json` was empty and ignored.
- [x] Confirm `Project_Tracking (1).xlsx` was ignored, untracked and had zero repository references.
- [x] Move the spreadsheet intact to a sibling local-reference directory outside the repository.
- [x] Remove active-tree `.gitkeep` files; delete four directories whose only content was `.gitkeep`.
- [x] Leave `.artifacts` evidence snapshots and ignored external `.claude` worktrees untouched.
- [x] Add shareable VS Code exclusions for reproducible/local runtime owners.
- [x] Add file nesting for root and frontend configuration families.
- [x] Keep unresolved `artifacts/`, `.artifacts/`, `.planning/`, `.codex/`, `.agents/`, `.pi/`, `scripts/`, `tools/` visible.
- [ ] Verify Explorer after VS Code reload and capture owner feedback.

Gate: moved file exists outside repo with identical SHA-256; source is absent; `.vscode/settings.json` is valid JSON and trackable; ignore-policy and `git diff --check` pass.

### W7.2 — frontend config and docs consolidation

- [x] Inventory every `frontend/playwright*.config.ts` consumer.
- [x] Extract only a minimal shared Playwright geometry config; no config framework added.
- [x] Move active specialized browser-support/dialog-gap/field-geometry/recovery configs under `frontend/tests/config/` and update consumers.
- [x] Keep Phase 27.1 exact-path configs at root until historical launcher/path contracts are reconciled.
- [x] Archive the two unreferenced MVP integration guides under `docs/archive/frontend-integration/` and mark them historical.
- [x] Move canonical `ipc-design-tokens.md` to `docs/ui-ux/` and update links.
- [x] Move `frontend/docs/perf/probe-h1-preview-report.*` to `.artifacts/performance/probe-h1-preview/` after lineage reconciliation; indexed hashes remain unchanged.
- [x] Remove empty `frontend/docs/` after the indexed performance evidence migration.

Gate: focused Playwright discovery counts unchanged; browser-support contract, frontend TypeScript/ESLint, taxonomy, ignore policy and `git diff --check` pass; no stale config/token references.

### W7.3 — historical tools and scripts audit

- [x] Inventory package/CI/docs/source consumers for root `scripts/`, `tools/e2e`, `frontend/scripts`, `backend/tools`, and `shipyard`.
- [x] Classify all 76 tracked `tools/e2e` items: 5 `KEEP_ACTIVE`, 4 `KEEP_EVIDENCE`, 2 `KEEP_FIXTURE_BUILDER`, 65 `DELETE_CANDIDATE`.
- [x] Prioritize and fully inventory the `tools/e2e/phase05-*` family with SHA-256, references, hard-coded lane/date/port and mutation-term signals.
- [x] Confirm `frontend/scripts` 7/7 have active consumers; compiled backend tools and Shipyard hooks are convention-owned and cannot be judged by filename references alone.
- [x] Delete exactly the 65 approved candidates in `wave-7-e2e-disposition.csv`; all 11 `KEEP_*` paths remain.
- [x] Run post-delete current-reference scan: zero stale reference groups.
- [x] Verify launcher contracts, Playwright discovery, frontend build and retained fixture-builder build.
- [x] Audit the 13 zero-current-reference root `scripts/` entries at their command/source seam.
- [x] Classify root candidates: 12 `DELETE_CANDIDATE`, 1 `KEEP_AND_WIRE` frontend launcher regression.
- [x] Delete exactly the 12 approved root-script candidates in `wave-7-root-scripts-disposition.csv`; retained regression remains.
- [x] Wire `scripts/frontend-unit-runner-args.test.mjs` as `npm run test:frontend-unit-launcher` in root `verify` and GitHub Actions.
- [x] Run post-delete reference scan, launcher policy, ignore/taxonomy policy and diff gates.

Gate: PASS. Root-script result: [`WAVE7-W7.3-ROOT-SCRIPTS-RESULT.md`](WAVE7-W7.3-ROOT-SCRIPTS-RESULT.md). The two retained Golden workbook hashes still differ from `docs/EVIDENCE-INDEX.md`; this is inherited evidence debt owned by W7.5. Other results: [`WAVE7-W7.3-RESULT.md`](WAVE7-W7.3-RESULT.md), [`WAVE7-W7.3-ROOT-SCRIPTS-AUDIT.md`](WAVE7-W7.3-ROOT-SCRIPTS-AUDIT.md).

### W7.4 — planning active/history split

- [x] Defer physical `.planning` archival until W7.5 closes the indexed `.planning` mismatch and three missing directory pointers.
- [x] Inventory 575 tracked `.planning` files using GSD state/roadmap, workstream status, MEMORY/evidence pointers and repository backlinks; write `wave-7-planning-active-history-inventory.csv`.
- [x] Enrich the ledger with original/current path, lifecycle, exact backlink count and explicit disposition.
- [x] Archive the first proven batch: 9 complete zero-backlink quick-task directories / 21 files to `.planning/archive/v1.4/quick/`.
- [x] Review four previously unclassified notes and all ambiguous quick owners individually.
- [x] Archive completed zero-backlink quick `260820-whz` after resolving its stale plan/complete-summary conflict; 2 canonical-byte-identical files moved.
- [x] Keep three referenced quick-history owners and the open table-standardization program at current paths; do not infer completion from age.
- [ ] Keep current GSD state/checklists active.
- [ ] Promote durable conclusions to canonical docs/HISTORY where required.
- [ ] Archive or untrack superseded raw planning output only with explicit lineage disposition.

Gate: enriched 575/575 ledger with no review/ambiguous disposition remaining; archive now contains 10 completed quick directories / 23 canonical-byte-identical files. Referenced quick history, active notes, open programs and phase trees remain at current paths. Ignore policy 4/4 and diff gates pass. Receipts: [`WAVE7-W7.4-PLANNING-ACTIVE-HISTORY.md`](WAVE7-W7.4-PLANNING-ACTIVE-HISTORY.md), [`WAVE7-W7.4-NOTES-AMBIGUOUS-QUICK-REVIEW.md`](WAVE7-W7.4-NOTES-AMBIGUOUS-QUICK-REVIEW.md).

### W7.5 — evidence and artifact owner reconciliation

- [x] Run fresh evidence-index preflight across `.artifacts`, `.planning`, root `artifacts`, `tools` and `frontend/docs`.
- [x] Correct the denominator from stale Wave 0 `21 mismatch / 3 missing` to `33 mismatch / 3 missing`; the old parser omitted 12 root/frontend-doc entries.
- [x] Classify mismatch owners: `.artifacts` 13, root `artifacts` 10, `tools` 7, `frontend/docs` 2, `.planning` 1; 25 tracked and 8 untracked.
- [x] Analyze all seven `tools/` mismatches against Git blobs/history and the retained workbook builder.
- [x] Disposition five SQL fixtures as `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`: indexed hash equals committed LF blob; Windows CRLF checkout caused the raw mismatch.
- [x] Disposition two Golden workbooks as `BLOCKED_RESEAL_NEEDS_DETERMINISTIC_BUILDER`: current bytes equal HEAD, indexed bytes never existed in Git, and repeated builder runs differ only by ZIP timestamps.
- [x] Update the evidence scanner to use committed bytes for tracked evidence, `is_dir()` for declared roots, section-relative child resolution and table-column hash pairing; regression 3/3 PASS.
- [x] Report corrected denominator: 358 references, 9 mismatches, 0 missing.
- [x] Make the workbook builder byte-deterministic at both production/template and fixture-population ZIP owners.
- [x] Add and wire generate-twice byte/SHA regression; regenerate/reseal ANV and DAV fixtures in one reviewed batch.
- [x] Close evidence denominator at 353 references, 0 mismatches, 0 missing.
- [x] Analyze all ten root `artifacts/` mismatches against Git history.
- [x] Disposition all ten as `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`: indexed hashes equal committed/introducing Git blobs and LF-normalized checkout bytes exactly.
- [x] Choose `.artifacts/performance/legacy-root-probes/` and atomically migrate root `artifacts/`; 12 root indexed hashes remain unchanged and 22 other local companions were preserved.
- [x] Analyze two `frontend/docs/perf` mismatches: both are `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`.
- [x] Analyze the single `.planning` mismatch: `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`.
- [x] Close all three missing directory pointers as `DIRECTORY_ROOT_VALID_SCANNER_FALSE_MISSING`; directories exist and all 23 indexed child hashes match.
- [x] Apply the reviewed evidence-index-only batch: 2 semantic reseals, 4 stale-reference retirements and 1 duplicate-row retirement; no evidence bytes changed.
- [x] Re-run corrected scanner: 353 references, 2 mismatches, 0 missing; only Golden XLSX blockers remain.
- [x] Resolve scanner policy: tracked files use committed bytes, directories use `is_dir`, section-relative child paths resolve under their declared evidence root, and inline references cannot steal a table hash.
- [ ] Move reusable scripts out of `.artifacts` into `tools/` only after indexed path disposition.
- [x] Retire root `artifacts/` and `frontend/docs/` after moving all contents to the canonical `.artifacts/performance/` owner.

Gate: corrected scan has 353 references, 0 mismatches and 0 missing references. Five stale rows were retired, two `.artifacts` hashes were semantically resealed, and two Golden XLSX fixtures were deterministically regenerated/resealed; every mutation has a focused receipt and no database/runtime action occurred. Preflight: [`WAVE7-W7.5-PREFLIGHT.md`](WAVE7-W7.5-PREFLIGHT.md). Tools analysis: [`WAVE7-W7.5-TOOLS-LINEAGE.md`](WAVE7-W7.5-TOOLS-LINEAGE.md). XLSX result: [`WAVE7-W7.5-XLSX-DETERMINISM-RESULT.md`](WAVE7-W7.5-XLSX-DETERMINISM-RESULT.md). Root artifacts analysis: [`WAVE7-W7.5-ROOT-ARTIFACTS-LINEAGE.md`](WAVE7-W7.5-ROOT-ARTIFACTS-LINEAGE.md). Frontend/planning/directory analysis: [`WAVE7-W7.5-FRONTEND-PLANNING-LINEAGE.md`](WAVE7-W7.5-FRONTEND-PLANNING-LINEAGE.md). `.artifacts`/scanner analysis: [`WAVE7-W7.5-DOT-ARTIFACTS-SCANNER.md`](WAVE7-W7.5-DOT-ARTIFACTS-SCANNER.md). Semantic review/applied receipt: [`WAVE7-W7.5-OVERWRITTEN-ARTIFACTS-SEMANTIC-REVIEW.md`](WAVE7-W7.5-OVERWRITTEN-ARTIFACTS-SEMANTIC-REVIEW.md). Migration receipt: [`WAVE7-PERFORMANCE-EVIDENCE-MIGRATION.md`](WAVE7-PERFORMANCE-EVIDENCE-MIGRATION.md).

### W7.6 — frontend test physical taxonomy completion

- [x] Extract shared fixtures imported from Playwright specs.
- [x] Make whole Playwright `--list` pass without spec-to-spec imports.
- [x] Move all 32 browser specs and both snapshot directories under `tests/browser/`; move shared Phase 31 helpers under `tests/support/`.
- [x] Reconcile Phase 27/28 exact-path contracts, manifests, scripts and deterministic identity hash.
- [x] Keep `frontend/src` unit/component tests colocated.

Gate: root Playwright debt 0; discovery remains 250 tests in 32 files; taxonomy 1/1, lineage 92/92, frontend unit 1,608 PASS/2 SKIP, ESLint and build PASS. Receipt: [`WAVE7-W7.6-FRONTEND-TEST-TAXONOMY.md`](WAVE7-W7.6-FRONTEND-TEST-TAXONOMY.md).

### W7.7 — final clean-candidate and commit review

- [x] Create detached clean candidate at baseline HEAD and overlay tracked/untracked task changes without staging main worktree.
- [x] Run `npm ci`, corrected root `npm run verify`, OpenAPI parity and EF pending-model checks.
- [x] Fix linked-worktree root discovery in Phase 29/30 migration tests.
- [x] Align root verify with clean-CI evidence exclusions and frontend build-before-unit ordering.
- [x] Remove the date-input lazy fallback that caused a repeatable aggregate accessibility/test failure.
- [x] Confirm evidence-bearing scanner 353/0/0, clean-candidate diff check and clean main index.
- [x] Produce seven proposed commit boundaries without staging, committing or pushing.

Gate: final clean-CI `verify` PASS; backend 49 + 1,350 PASS / 3 SKIP; frontend 1,608 PASS / 2 SKIP; builds/parity/EF/architecture/ignore/taxonomy/determinism PASS. Evidence remains a separate local-bearing lane because clean checkout intentionally omits 309 ignored retained references. Receipt: [`WAVE7-FINAL-CLEAN-CANDIDATE.md`](WAVE7-FINAL-CLEAN-CANDIDATE.md).

## Current next action

No automatic execution remains for W7.4–W7.7. Await owner authorization to stage and create bounded local commits from the reviewed boundary map; do not push.
