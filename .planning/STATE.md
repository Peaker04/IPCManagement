---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — Architecture workflow 11–18
status: completed
stopped_at: Milestone v1.2 complete; Phase 18 verification and milestone audit passed
last_updated: "2026-07-29T19:18:00+07:00"
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 22
  completed_plans: 22
  percent: 100
current_phase: 18
current_phase_name: guardrails-and-workflow-closeout
---

# Project State

## Project Reference

See `.planning/PROJECT.md`. The sole active roadmap is `.planning/ROADMAP.md`, which mirrors Part F of `docs/ARCHITECTURE-AUDIT-2026-07-26.md`.

The previous v1.1 BOM/supplier roadmap, requirements and state are preserved in `.planning/archive/v1.1-legacy/` and are not executable work.

## Current Position

Phase: 18 — COMPLETE

Plan: 8 of 8 complete

Status: Milestone v1.2 verification and audit passed

Milestone phase progress: ██████████ 100% (8/8 steps complete).

Defined-plan progress: 8/8 plans defined and executed.

Step 16 work-package progress: 5/5 complete.

## Verified Baseline

- Phase 18 is complete through `87e92fe` plus documentation/GSD closeout. Goal-backward verification
  passed 8/8 must-haves and milestone v1.2 audit passed 12/12 requirements, 8/8 phases, 7/7
  integrations and 4/4 end-to-end flows. No gap, undispositioned process or Deferred item remains.
- Guarded `ipc_lane1` evidence for week `2026-07-27` is preserved: exact ANV workbook hash, rollback
  backup/mirror, protected lineage, 15 screenshots, 112 successful API responses and five desktop
  viewports. Do not rerun sanitizer/import/reset/seed for closeout.
- Final source gate: Application 49/49, API 682 pass + 1 intentional skip, frontend 433/433,
  comparator 6/6, strict growth/dependency/lint/build/contract/EF/migration gates green.

- Phase 18 Plan 06 non-mutating checkpoint is green. Root verify passed at Application 49/49,
  API 680 + 1 intentional skip and frontend 80 files/433 tests; contracts are deterministic,
  EF snapshot and five migration contract tests pass, secret/whitespace scans are clean. Final PDG
  compare is LOW at 365 symbols/39 files/0 process; Deferred empty. Guarded E2E is authorized only
  after `ipc_lane1` backup/checksum/lineage checks.

- Phase 18 Plan 05 is complete at `e4ce7fc`. The strict growth gate records exactly ten
  production-only findings, rejects any test debt/new debt/worsening/stale improvement and compares
  the JSON ceiling with the CI base ref. Its six black-box comparator cases, current-tree gate,
  lint and dependency gates pass; staged GitNexus was LOW with 48 symbols and zero affected process.

- Phase 18 Plans 01–04 are complete at `3a787a5`, `8fc7463`, `86ac57d` and `4bee50d`.
  Three backend monoliths and the route-smoke Playwright monolith are decomposed. Route-smoke discovery is
  17/17 with stable title/body fingerprints; focused Chromium, lint and production build pass. Final staged
  GitNexus for Plan 18-04 was LOW with 15 symbols, zero affected process and Deferred empty.

- Branch `feature/workflow-b17-b18`; current Phase 17 implementation baseline is
  `1ca2bbb fix(17-08): close full-gate regressions`. Không push trong phiên này.

- Plans 17-01 through 17-08 are complete. Coordination transport/types/actions and all workflow endpoints
  now have explicit lower/feature owners, Projects has zero Coordination feature imports, and the dependency
  baseline reduced 54 → 44 → 16 → 0 without weakening R1-R6.

- Plan 17-04 full gates passed at 428/428 frontend tests plus lint, dependency-cruiser, production build
  and deterministic API-contract generation. The application has one RTK Query slice with exactly 75
  workflow endpoint keys and 75 hooks.

- GitNexus Plan 17-04 final staged audit reported HIGH risk, 8 changed symbols and 8 expected
  Dashboard/Warehouse overview processes. All were enumerated and handled by the full frontend gates;
  exact Cypher found 38 compatibility-barrel importers and Deferred is empty.

- Plan 17-05 full frontend gates passed at 428/428 tests plus lint, strict dependency-cruiser and build.
  Its HIGH staged audit named six Chef/Coordination/Weekly Menu processes; all six traces were verified at
  confidence 0.85. Final Cypher found zero feature→app/routes edges and zero cycles; Deferred is empty.

- Plan 17-06 split the Admin model into seven panel-owned hooks behind the unchanged compatibility facade.
  Admin tests pass at 12/12 plus lint, zero-violation dependency-cruiser and production build. Its final
  staged audit named five expected Admin processes; Cypher found one facade caller, no moved helper left in
  the facade and no deferred node/process.

- Plan 17-07 split the Reports model into five view-owned hooks behind the unchanged compatibility facade.
  Reports tests pass at 22/22 and the full frontend suite at 433/433 plus lint, zero-violation dependency-
  cruiser and production build. Its staged audit named four expected Reports processes; Cypher found no
  direct endpoint call left in the facade and no deferred node/process.

- Plan 17-08 full gate passed: Application 49/49, API 680 pass + 1 intentional skip, frontend 433/433,
  lint/build/strict dependency/contract determinism and secret/whitespace scans green. Three-viewport headed
  evidence records 30 app routes, 3 Shipyard captures, 96 tab interactions, 48 warm revisits and 64 2xx API
  responses with zero new warm request/error/overflow/CLS/long task. Goal-backward verification passed 7/7.

- No database reset, seed, import or lane mutation occurred during Phase 17 execution.

- OpenAPI remained 152 paths / 396 schemas.
- Step 15 and the Step 16 refactor sequence did not call import endpoints, seed/reset/import a database or access `ipc_lane1`.

## Completed Scope — Step 16

1. **Done (`7e94eb3`):** 53 EF mappings live in 11 feature-owned `IEntityTypeConfiguration<T>` files;
   `IpcManagementContext` is the assembly registration root.

2. **Done (`b37606b`):** execution-strategy transaction runner, duplicate-side-effect regression,
   mapped domain/application exceptions, canonical migration lineage and disposable restore rehearsal.

3. **Done (`f3e7bcd`):** runner adopted across Coordination, Purchasing, Inventory, SampleData, Catalog,
   Reports, Approvals and Admin. Mutable loads occur inside runner operations and every operation has a
   stable database verifier.

4. **Done (`59add79`):** removed unused `IUnitOfWork.BeginTransactionAsync`/`UnitOfWork.BeginTransactionAsync`,
   enabled `EnableRetryOnFailure` and added convention coverage that permits only the runner transaction opener.

5. **Done:** full Step 16 gates and synchronized closeout of ARCH-16A–E.

Restore/hash evidence is valid, but C:/D: matching mirrors are not proof of physically independent/off-site
storage. A NAS/cloud/external-media target remains a non-blocking operational gap.

## Intervening Production Incident and BOM Verification

- User-authorized production synchronization completed at 61/61 tables and 53,404/53,404 rows with zero
  missing table, row-count mismatch or checksum mismatch. Production health and migration checks are Healthy.

- Commit `7e79106` makes the two temporary-key data migrations collation-safe; rerun was idempotent and the
  full source gate above passed.

- Workbook `weekly-menu-template-ANV-default.xlsx` was checked through preview only: 114/114 existing-dish
  rows, 0 new dishes, valid with 0 errors/warnings. The committed ANV menu has 90/90 display dishes with BOM,
  0 matched-without-BOM and 0 unmatched. No repeat import or database mutation occurred during diagnosis.

- The earlier `0/90` display was stale cache after direct restore: backend catalog cache lasts 30 minutes and
  frontend RTK Query cache 5 minutes; direct restore bypasses cache invalidation. Production restore runbook
  must include restart/cache clear. Evidence is in `.artifacts/shipyard-live/production-bom-debug.json` and
  `.artifacts/shipyard-live/production-weekly-menu-bom-debug.png`.

## Gate 16

- Retry cannot duplicate side effects.
- Fresh-install and upgrade lineage are both explained and tested.
- Restore rehearsal meets the documented RPO/RTO target and preserves protected lineage/checksums.
- No production/lane database reset, seed or import.
- Full backend/frontend/contract/dependency/migration gates and staged GitNexus change audit are green.

## Remaining Workflow

- None for milestone v1.2. Start a new milestone before adding implementation work.
- Operational follow-up only: configure and verify a genuinely physical off-site backup target.

## Decisions Made

| Phase | Decision | Rationale |
|---|---|---|
| 16 | Load mutable EF entities inside the transaction-runner operation and require a stable database verifier. | Retry and commit verification clear tracking; external tracked entities could detach or silently skip writes. |
| 16 | Enable `EnableRetryOnFailure` only after retiring the legacy UnitOfWork transaction API and proving one transaction owner with retry regression. | A single execution-strategy-aware owner prevents user-initiated transaction failures and duplicate side effects. |
| 16 | Do not call the C:/D: mirror proven off-site storage. | Logical drive letters do not prove different physical devices or sites. |
| Incident | Do not repeat the production restore/import; direct restore procedures must restart or clear catalog/application caches. | Production is already synchronized, and direct database restore bypasses application cache invalidation. |

- [Phase 17]: Keep exactly one coordination injector and use feature API/type modules only as compatibility re-exports. — Preserves endpoint, hook, cache and existing import contracts without duplicate RTK Query registration.
- [Phase 17]: Move only cross-feature weekly-menu actions to lib while Coordination retains reducer and presentation ownership. — Removes Projects-to-Coordination imports without broadening shared state ownership or changing Redux action types.
- [Phase 17]: Keep workflowApi as a deterministic compatibility barrel over one apiSlice and seven enumerated owner injectors. — Preserves all 75 endpoint and hook contracts while assigning implementation ownership.
- [Phase 17]: Keep employee administration endpoints outside workflow registration and expose approval-rule hooks through adminWorkflowApi plus adminApi re-exports. — Prevents five unrelated employee endpoints from expanding the exact 75-key workflow surface.
- [Phase 17]: Permit only exact compatibility-barrel-to-owner imports through a milestone-v1.3 dependency rule. — Supports the stable barrel without expanding the known dependency violation baseline.
- [Phase 17]: Keep app/routes on the exact store-typed dispatch hook while feature callers use a lower thunk-capable dispatch primitive. — Feature modules no longer depend on app, while logout orchestration retains the configured store dispatch contract.
- [Phase 17]: Keep full Coordination state typing feature-owned and expose only the cross-feature read projection needed by Chef and Projects. — Removes reverse imports without making presentation state a shared contract.
- [Phase 17]: Keep useAdminDataPageModel as the sole AdminDataPage API while seven unconditional panel hooks own query, state and mutation behavior. — Preserves all panel props and UI behavior while removing the 784-line ownership monolith.
- [Phase 17]: Keep cross-panel customer-contract and current-stock queries in Contracts and Inventory owners. — Avoids duplicate endpoints/cache subscriptions while preserving the BOM/Statistics skip contracts.
- [Phase 17]: Keep Reports URL/permission/reset orchestration facade-owned and place query transforms plus CSV columns in five view owners. — Preserves cross-view navigation and export behavior without recreating a page-model monolith.
- [Phase 17]: Close Gate 17 only when one-api-slice, public/cache, dependency, full regression, headed browser, GitNexus and documentation evidence agree. — Risk controls rigor rather than scope; every caller and affected process must be handled with no Deferred item.
- [Phase 18]: Use five desktop browser-gate viewports: 1920x1080, 1440x900, 1366x768, 1365x900 and 1280x900; remove 768x1024. — User explicitly replaced the tablet viewport on 2026-07-29; tablet/mobile remain out of the default gate.

## Blockers

- Non-blocking operational gap: configure and verify a genuinely off-site production backup target; the current C:/D: mirror proves copy integrity and disposable restore only.

## Session

**Last Date:** 2026-07-29T19:18:00+07:00

**Stopped At:** Milestone v1.2 complete; Phase 18 verifier and milestone audit passed

**Resume File:** .planning/ROADMAP.md

## Constraints

- Do not push or reset.
- Do not seed/import/reset or further mutate `ipc_lane1`; preserve the completed Phase 18 week/evidence.
- Do not rewrite, delete or move applied migrations.
- Run upstream impact before every symbol edit; warn on HIGH/CRITICAL; run staged `detect_changes` before every commit.
- Browser evidence is required only for frontend/route/UI behavior changes until the final workflow closeout.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 17 P01 | 8 min | 2 tasks | 4 files |
| Phase 17 P02 | 30min | 2 tasks | 16 files |
| Phase 17 P03 | 25min | 2 tasks | 39 files |
| Phase 17 P04 | 39min | 4 tasks | 14 files |
| Phase 17 P05 | 15min | 2 tasks | 24 files |
| Phase 17 P06 | 26min | 1 tasks | 11 files |
| Phase 17 P07 | 16min | 1 tasks | 10 files |
| Phase 17 P08 | 77min | 3 tasks | 16 files |
| Phase 18 P04 | 46min | 1 tasks | 10 files |
| Phase 18 P05 | 18min | 1 tasks | 7 files |
| Phase 18 P06 | 13min | 2 tasks | 2 files |
| Phase 18 P07 | 73min | 2 tasks | guarded DB/E2E + 4 atomic commits |
| Phase 18 P08 | 35min | 2 tasks | documentation/verifier/audit |
