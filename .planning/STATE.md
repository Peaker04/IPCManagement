---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: architecture-hardening-steps-11-18
status: paused
paused_at: "2026-07-28T19:04:01+07:00"
current_phase: "16"
current_phase_name: persistence-and-reliability
current_plan: "16-01"
stopped_at: Step 16 Task 4/5; retire unused UnitOfWork transaction API, update DI retry note and decide EnableRetryOnFailure
last_updated: "2026-07-28T23:05:41+07:00"
last_activity: 2026-07-28 — Production synchronized with local; BOM 90/90 verified; Step 16 remains paused at Task 4
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

See `.planning/PROJECT.md`. The sole active roadmap is `.planning/ROADMAP.md`, which mirrors Part F of `docs/ARCHITECTURE-AUDIT-2026-07-26.md`.

The previous v1.1 BOM/supplier roadmap, requirements and state are preserved in `.planning/archive/v1.1-legacy/` and are not executable work.

## Current Position

Phase: 16 of 18 — Persistence and reliability

Plan: 16-01 active

Status: paused after Task 3; resume Task 4 only after upstream impact analysis

**Paused At:** 2026-07-28 19:04 +07:00 — Step 16 Task 4/5

Milestone phase progress: ██████░░░░ 63% (5/8 steps complete).

Defined-plan progress: ████████░░ 83% (5/6 defined plans complete; Steps 17–18 remain intentionally unplanned until their dependency gates close).

Step 16 work-package progress: 3/5 complete; Task 4 in progress; Task 5 not started.

## Verified Baseline

- Branch `feature/production-plan`; source baseline trước commit handoff là
  `7e79106 fix(db): make data migrations collation-safe`. Sau commit tài liệu này branch ở trước
  `origin/feature/production-plan` hai commit; không push trong phiên này.
- Working tree has only user-owned untracked `.dockerignore` and `Dockerfile`; do not stage, overwrite or remove them.
- GitNexus was refreshed at `7e79106`: 10,629 nodes, 29,171 edges and 300 execution flows.
- Latest full gates: backend API 667 pass/1 skip; Application 47/47; frontend 416/416; Debug/Release build, lint, dependency, production build, OpenAPI/TypeScript determinism, EF pending-model, diff and secret gates green.
- OpenAPI remained 152 paths / 396 schemas.
- Step 15 and the Step 16 refactor sequence did not call import endpoints, seed/reset/import a database or access `ipc_lane1`.

## Active Scope — Step 16

1. **Done (`7e94eb3`):** 53 EF mappings live in 11 feature-owned `IEntityTypeConfiguration<T>` files;
   `IpcManagementContext` is the assembly registration root.
2. **Done (`b37606b`):** execution-strategy transaction runner, duplicate-side-effect regression,
   mapped domain/application exceptions, canonical migration lineage and disposable restore rehearsal.
3. **Done (`f3e7bcd`):** runner adopted across Coordination, Purchasing, Inventory, SampleData, Catalog,
   Reports, Approvals and Admin. Mutable loads occur inside runner operations and every operation has a
   stable database verifier.
4. **In progress:** remove unused `IUnitOfWork.BeginTransactionAsync`/`UnitOfWork.BeginTransactionAsync`,
   update the stale DI retry warning and decide `EnableRetryOnFailure` only after source scan and focused retry gates.
5. **Not started:** final Step 16 gates and synchronized closeout of ARCH-16A–E.

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
| 16 | Keep `EnableRetryOnFailure` disabled until the legacy UnitOfWork transaction API is removed and final retry gates pass. | A single transaction owner is required before enabling provider-level transient retries safely. |
| 16 | Do not call the C:/D: mirror proven off-site storage. | Logical drive letters do not prove different physical devices or sites. |
| Incident | Do not repeat the production restore/import; direct restore procedures must restart or clear catalog/application caches. | Production is already synchronized, and direct database restore bypasses application cache invalidation. |

## Blockers

- Non-blocking operational gap: configure and verify a genuinely off-site production backup target; the current C:/D: mirror proves copy integrity and disposable restore only.

## Session

**Last Date:** 2026-07-28 23:05 +07:00

**Stopped At:** Step 16 Task 4/5 — impact and retire the unused UnitOfWork transaction API before deciding retry enablement.

**Resume File:** `.planning/phases/16-persistence-and-reliability/.continue-here.md`

## Constraints

- Do not push or reset.
- Do not seed/import existing databases and do not mutate `ipc_lane1`.
- Do not rewrite, delete or move applied migrations.
- Run upstream impact before every symbol edit; warn on HIGH/CRITICAL; run staged `detect_changes` before every commit.
- Browser evidence is required only for frontend/route/UI behavior changes until the final workflow closeout.
