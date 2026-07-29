---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — Architecture workflow 11–18
status: executing
stopped_at: Completed 17-01-PLAN.md
last_updated: "2026-07-29T03:48:33.965Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 14
  completed_plans: 7
  percent: 50
current_phase: 17
current_phase_name: frontend-ownership
---

# Project State

## Project Reference

See `.planning/PROJECT.md`. The sole active roadmap is `.planning/ROADMAP.md`, which mirrors Part F of `docs/ARCHITECTURE-AUDIT-2026-07-26.md`.

The previous v1.1 BOM/supplier roadmap, requirements and state are preserved in `.planning/archive/v1.1-legacy/` and are not executable work.

## Current Position

Phase: 17 (frontend-ownership) — EXECUTING

Plan: 2 of 8

Status: Ready to execute

Milestone phase progress: ████████░░ 75% (6/8 steps complete).

Defined-plan progress: 8/8 plans defined; 0/8 executed

Step 16 work-package progress: 5/5 complete.

## Verified Baseline

- Branch `feature/production-plan`; Step 16 code baseline trước closeout docs là
  `59add79 refactor(persistence): retire legacy transaction API`. Không push trong phiên này.

- Working tree has only user-owned untracked `.dockerignore` and `Dockerfile`; do not stage, overwrite or remove them.
- GitNexus was refreshed before Task 4 impact: 10,629 nodes, 29,171 edges and 300 execution flows.
- Step 16 full gates: backend API 667 pass/1 skip; Application 49/49; frontend 416/416;
  Debug/Release 0 warning/error, lint, dependency, production build, OpenAPI/TypeScript determinism,
  EF pending-model, diff and secret gates green.

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

- Step 17: frontend endpoint/layout/page-model ownership and dependency debt retirement.
- Step 18: test decomposition, growth gates, complete evidence and documentation closeout.

## Decisions Made

| Phase | Decision | Rationale |
|---|---|---|
| 16 | Load mutable EF entities inside the transaction-runner operation and require a stable database verifier. | Retry and commit verification clear tracking; external tracked entities could detach or silently skip writes. |
| 16 | Enable `EnableRetryOnFailure` only after retiring the legacy UnitOfWork transaction API and proving one transaction owner with retry regression. | A single execution-strategy-aware owner prevents user-initiated transaction failures and duplicate side effects. |
| 16 | Do not call the C:/D: mirror proven off-site storage. | Logical drive letters do not prove different physical devices or sites. |
| Incident | Do not repeat the production restore/import; direct restore procedures must restart or clear catalog/application caches. | Production is already synchronized, and direct database restore bypasses application cache invalidation. |

## Blockers

- Non-blocking operational gap: configure and verify a genuinely off-site production backup target; the current C:/D: mirror proves copy integrity and disposable restore only.

## Session

**Last Date:** 2026-07-29T03:48:33.956Z

**Stopped At:** Completed 17-01-PLAN.md

**Resume File:** .planning/phases/17-frontend-ownership/17-02-PLAN.md

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
