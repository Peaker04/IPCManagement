---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — Architecture workflow 11–18
status: completed
stopped_at: Phase 17 complete; ready to discuss Phase 18 guardrails and workflow closeout
last_updated: "2026-07-29T07:54:31.377Z"
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 14
  completed_plans: 14
  percent: 88
current_phase: 17
current_phase_name: frontend-ownership
---

# Project State

## Project Reference

See `.planning/PROJECT.md`. The sole active roadmap is `.planning/ROADMAP.md`, which mirrors Part F of `docs/ARCHITECTURE-AUDIT-2026-07-26.md`.

The previous v1.1 BOM/supplier roadmap, requirements and state are preserved in `.planning/archive/v1.1-legacy/` and are not executable work.

## Current Position

Phase: 17 — COMPLETE

Plan: 8 of 8

Status: Phase 17 complete

Milestone phase progress: █████████░ 88% (7/8 steps complete).

Defined-plan progress: 8/8 plans defined and executed.

Step 16 work-package progress: 5/5 complete.

## Verified Baseline

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

- Step 18: test decomposition, growth gates, complete evidence and documentation closeout.

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

## Blockers

- Non-blocking operational gap: configure and verify a genuinely off-site production backup target; the current C:/D: mirror proves copy integrity and disposable restore only.

## Session

**Last Date:** 2026-07-29T07:54:31.041Z

**Stopped At:** Phase 17 complete; ready to discuss Phase 18 guardrails and workflow closeout

**Resume File:** .planning/ROADMAP.md

## Constraints

- Do not push or reset.
- Do not seed/import existing databases and do not mutate `ipc_lane1`.
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
