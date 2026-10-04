# Active work

Status: DONE — FULL PROCESS / ROADMAP / WORKFLOW RESET.
Reset verdict: PASS_WITH_INHERITED_FAILURES. This closes only process reset, not product/UI/recovery acceptance.

## Goal / scope
Replace legacy process/state with one entrypoint, documentation map, outcome roadmap and this active work file. Allowed: docs, process assets, tooling, test support and config consumers. Excluded: product behavior/API/auth/UI, migrations/schema/data, deployment, commit/push, external sibling repos and user browser tabs.

## Constraints / authority
Current source, behavior tests and product contracts decide technical truth. No compatibility layer, new archive or duplicate state owner. Parent sole writer; prior read-only audits reused, not restarted.
HEAD `e29ead163c2c4d452c1d32723c15d486631202cb`; branch `backup/four-planning-screens-20261001-223942`; index empty. Inherited preimages/hashes, logs and private recovery safety copies are outside repository at `D:/Temp/ipc-process-reset-safety`; they are evidence/backups, not workflow authority.

## Checklist
- [x] Inventory — reused tracked/untracked/ignored/filesystem audit; generated/private binary contents were not exhaustively inspected.
- [x] Classification — product/technical owners retained, mixed consumers migrated, process/history retired.
- [x] Remove legacy process
- [x] Build new minimal workflow
- [x] Repair references/tooling
- [x] Verify project
- [x] Final residual scan

## Acceptance / verification
| Check | Result / evidence under safety directory |
|---|---|
| Backend build | PASS — `final-build-backend.log` |
| Frontend build | PASS — `final-build-frontend.log` |
| Backend core | PASS — 1,308 API + 49 Application = 1,357; `final-core-backend-recheck.log` |
| Frontend suite | 20 inherited FAIL / 1,677 PASS / 2 skipped; 296 files; `final-core-frontend.log` |
| Migrated focused tests | PASS — 13 backend, 14 frontend; `final-migrated-backend.log`, `final-migrated-frontend.log` |
| Node ignore/taxonomy/launcher/measurement | PASS — 9; `final-node-checks.log` |
| Lint / dependency rules | Inherited FAIL — 35 errors + 2 warnings / 84 errors + 2 warnings; same normalized diagnostic sets reproduced pre-reset |
| Package scripts / CI targets | PASS — all referenced commands/files resolve; offline lock refresh with scripts disabled |
| Documentation links | PASS — 75 local links, 0 broken; `broken-links.json` |
| Browser collection | PASS — 256 tests / 32 files; `final-browser-discovery.log`; discovery only, no browser launched |
| Secret/private-key/stub added-line scan | PASS — 0 strong-pattern candidates; no recovery/private inputs newly published |
| Production preservation | PASS — all 21 backed-up inherited non-test production hashes unchanged; zero reset-owned production business files |
| Whitespace / index | PASS — `git diff --check`; no staged files |
| Process dependency scan | PASS — no active retired-path dependency or duplicate authority; `.planning` contains only WORK; `.artifacts` only generated build/contract/test output |

## Frontend baseline attribution
`INHERITED_FAILURE`: all original 19 failures reproduced on isolated HEAD + saved pre-reset inherited files. `baseline-frontend.log` reproduces 18; `baseline-disposition.log` reproduces remaining D-01 after including its original ignored aggregate. `RESET_REGRESSION`: 0 frontend; `OUT_OF_SCOPE_PRODUCT`: 0 diagnosed, no unsupported defect attribution.
- buttonPrimitiveConvergence (1); criticalRouteOwnership (1); formPrimitiveConvergence (1)
- pcActionCompletenessDisposition D-01 (1); pcActionCompletenessFixture (1)
- presentationSurfaceInventory (3); sectionPanelHeadingContract (1); sectionPanelPaddingOwnership (1)
- uiFloorplanScopeContract (3); uiStatePurityContract (1)
- workflowApi.publicSurface (1); dataGrainUiContracts (1); operationalPagePerformanceContracts (1); modePageComposition (1); operationalTables ApprovalQueue (1)
D-01 is now `weeklyMenuPublishPermissions.test.ts`, retaining all five source assertions. Final suite adds one previously excluded accessibility assertion, reproduced in original pre-reset test (`baseline-route-accessibility.log`), so total inherited failures is 20. No assertion was weakened or product failure fixed/deleted to obtain green.
Lint/dependency baseline: `baseline-lint.log` and `baseline-dependencies.log` reproduce identical normalized sets. Temporary attribution checkout was deleted.

## Consumer disposition / canonical knowledge
- MIGRATE: product accessibility/purchasing → source owners; publish permissions → independent test; archive key/restore → ArchiveSafetyContractTests; exact SQL allowlist/target/outside-scope → DatabaseMaintenanceSafetyTests; warehouse doc inventory → warehouse contract; browser output → ignored test-results.
- DELETE: old MEMORY/HISTORY/CLAUDE and extra state; all planning phases/notes/research/archive; harness/GSD/Shipyard assets; imported/disabled/local process skills; dated audits/reviews/research/process archives; receipt/ancestry/seal/blind-review/ledger emitters; aggregate gate runner/spec; dead counters/checkers/generators; hooks/commitlint and their package/config callers. Historical artifacts deleted, not moved into a new repository legacy directory.
- KEEP-AS-PRODUCT-CONTRACT: failing product tests, domain registries/table fixtures, real DB recovery/lineage/SQL/rehearsal guards, deterministic workbook generator, product build/test/security CI, perf source-identity helper, private workbook/schema/image inputs and derived diagram/font licenses. Dated DB/migration/API identifiers and generic test-harness terms are technical contracts, not workflow state.
- Canonical migration: service-run/receipt/lineage → lifecycle; template/range/diagnostics and planning facts → weekly menu; normalization/unit ambiguity → DOMAIN; migration/clone/PITR/backup → recovery; actor walkthrough → user-workflows; UI grammar/a11y → DESIGN/rules; measurement → TESTING. GLOSSARY is the distinct UI label/status owner linked by DOMAIN.
- Canonical process owners: AGENTS, docs/README, ROADMAP, this WORK. Workflow: INTAKE → PLAN → EXECUTE → VERIFY → CLOSE.

## Reset regression resolved
Backend performance disclaimer test pinned retired translated D04 prose after runbook rewrite. Migrated assertions to equivalent explicit 50-user/write-correctness disclaimer; probe rate/dropped-work checks unchanged. Focused and full backend core reruns PASS.

## Residuals / next action
Only documented inherited failures remain in verification. Two inert source comments retain historical provenance (migration redesign citation; Program health-probe Shipyard mention), deliberately KEEP-AS-PRODUCT-CONTRACT to preserve immutable source; neither reads/executes the retired path or owns state. No active legacy dependency.
Recovery/business packages and source-preimages preserved privately outside repository are not independent recovery certification. Readonly/long-path artifact deletion retries completed without following junctions or stopping user processes. Local retired hooksPath removed; no commit/push/deploy/DB/mode/browser operation.
Next action: none for reset. At the next explicitly authorized intake, replace completed task details here; do not resume an old product/UI campaign automatically.

## Publication authorization
Operator subsequently authorized committing **all current changes**, including inherited frontend work, and force-pushing the current branch. Target: `origin/backup/four-planning-screens-20261001-223942`; observed remote tip before staging equals HEAD above. Use an exact `--force-with-lease`, never unconditional force. This authorization does not change the documented inherited verification failures or permit deployment/DB actions.
