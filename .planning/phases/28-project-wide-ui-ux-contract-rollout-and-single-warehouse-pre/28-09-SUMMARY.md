---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 09
subsystem: database
tags: [mysql8, pomelo, ef-core, warehouse, generated-column, unique-index]
requires:
  - phase: 28-08
    provides: observation-only configured warehouse resolver and pre-traffic fail-closed gate
provides:
  - additive inactive-by-default operational warehouse marker
  - database-generated nullable singleton discriminator with normal unique index
  - authorization-gated activation and rollback runbook
  - schema-contract regression tests for MySQL singleton semantics

affects: [28-10, deployment, warehouse-invariant]
actuals:
  tokens: 183207
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns: [MySQL nullable generated singleton key, additive inactive-by-default schema, separately authorized activation]
key-files:
  created:
    - backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.cs
    - backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.Designer.cs
    - backend/tests/IPCManagement.Api.Tests/MySqlOperationalWarehouseInvariantTests.cs
  modified:
    - backend/src/IPCManagement.Api/Models/Entities/Warehouse.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Persistence/InventoryEntityConfigurations.cs
    - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
    - docs/DEPLOYMENT.md
    - docs/DATA-GRAIN-MATRIX.md
key-decisions:
  - "OperationalSingletonKey is a shadow, database-generated nullable int using exactly CASE WHEN IsOperationalActive THEN 1 ELSE NULL END; it has no application-writable CLR property."
  - "A normal MySQL unique index enforces at-most-one active row while multiple inactive NULL values remain legal."
  - "Migration application and activation remain separate operator-authorized checkpoints; autonomous execution performs neither."
patterns-established:
  - "Schema enforcement is additive and inactive-by-default; no row, ID, FK, stock, history, audit, or lineage mutation occurs during migration generation."
requirements-completed: [SWH-02, SWH-03]
coverage:
  - id: D1
    description: "MySQL 8/Pomelo singleton schema with generated nullable discriminator and normal unique index"
    requirement: SWH-02
    verification:
      - kind: integration
        ref: "backend/tests/IPCManagement.Api.Tests/MySqlOperationalWarehouseInvariantTests.cs#MySqlSingleton"
        status: pass
      - kind: other
        ref: "dotnet ef migrations has-pending-model-changes and idempotent script inspection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Separately authorized activation and rollback contract preserving warehouse identity and data grain"
    requirement: SWH-03
    verification:
      - kind: other
        ref: "docs runbook scan and historical migration diff gate"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-08-24
status: complete
---

# Phase 28 Plan 09: MySQL Operational Warehouse Singleton Summary

**MySQL 8/Pomelo now models an inactive-by-default warehouse marker and a non-writable generated nullable singleton key whose normal unique index permits inactive history but rejects a second active warehouse.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-24T16:13:30Z
- **Completed:** 2026-08-24T16:21:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added migration `20260824161853_EnforceSingleOperationalWarehouse` with `IsOperationalActive DEFAULT FALSE`, generated nullable `OperationalSingletonKey AS (CASE WHEN IsOperationalActive THEN 1 ELSE NULL END)`, and normal unique index `uqWarehousesOperationalSingleton`.
- Kept the discriminator as EF shadow state with database generation and no CLR/API property, preventing application-written NULL/non-1 bypasses.
- Added focused schema-contract tests for exact expression/model metadata, inactive NULL multiplicity, duplicate-active key collision semantics, additive migration operations, and absent writable discriminator.
- Documented separately authorized transactional activation, exact configured-ID checks, rollback-on-mismatch, and preservation of IDs/FKs/stock/audit/lineage.

## Task Commits

1. **Task 1 RED: failing MySQL singleton schema contracts** - `0cd79f8d`
2. **Task 1 GREEN: additive generated singleton migration and model** - `fbf1cb27`
3. **Task 2: authorization-gated activation and grain runbook** - `e899faef`

## Files Created/Modified

- `backend/src/IPCManagement.Api/Models/Entities/Warehouse.cs` - Adds the application-settable active flag only.
- `backend/src/IPCManagement.Api/Features/Inventory/Persistence/InventoryEntityConfigurations.cs` - Maps exact generated shadow discriminator and unique index.
- `backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.cs` - Adds two columns and one index without data operations.
- `backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.Designer.cs` - Records generated target model.
- `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs` - Advances only the current model snapshot.
- `backend/tests/IPCManagement.Api.Tests/MySqlOperationalWarehouseInvariantTests.cs` - Locks schema and non-writability contract.
- `docs/DEPLOYMENT.md` - Defines separate operator authorization, transaction, post-check, and rollback.
- `docs/DATA-GRAIN-MATRIX.md` - Preserves warehouse-bearing grain and historical lineage.

## Decisions Made

- Used exactly one locked design: nullable generated `OperationalSingletonKey`; no writable discriminator, filtered index, fallback selector, or repair path was introduced.
- Kept all existing warehouse IDs, FKs, stock identities, authorization, audit, and lineage unchanged.
- Generated and inspected migration SQL only. No migration was applied to a database and no warehouse row was activated, retired, seeded, reset, restored, merged, reassigned, deleted, or repaired.

## Verification

- Focused MySQL/Pomelo schema-contract suite: 6/6 passed.
- API build and test-project build: zero warnings and zero errors.
- EF pending-model check: no pending model changes.
- EF idempotent script contains exact inactive default, generated nullable CASE expression, and normal unique index.
- Historical migration changed-path gate, source secret/stub/no-fallback scans, and `git diff --check`: passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated migration after stale no-build model produced an empty migration**
- **Found during:** Task 1 migration generation
- **Issue:** The first design-time command used a stale compiled model and generated an empty new migration.
- **Fix:** Deleted only the two newly generated uncommitted files, corrected the shadow-index overload, rebuilt, and generated the declared migration once from the current model. No historical migration or database was touched.
- **Files modified:** Current Task 1 model and new migration files only.
- **Verification:** Migration operations, idempotent SQL, focused tests, and pending-model check all pass.
- **Committed in:** `fbf1cb27`

**Total deviations:** 1 auto-fixed blocking generation issue.
**Impact on plan:** No scope expansion and no deployed history or data mutation.

## Known Stubs

None.

## Threat Flags

No unplanned threat surface. The planned migration-to-MySQL trust boundary is covered by additive-operation tests, exact generated SQL inspection, and immutable historical-migration diff checks.

## Issues Encountered

The first `--no-build` migration generation saw stale binaries; it was discarded before commit and regenerated after a clean project build. The generated migration name is `20260824161853_EnforceSingleOperationalWarehouse`.

## User Setup Required

A residual deployment checkpoint remains: a human operator must separately authorize migration application and later separately authorize transactional activation after database/lane, backup, lineage, configured ID, and pre-state checks. This plan intentionally performs neither operation.

## Next Phase Readiness

- The executable additive schema is ready for separately authorized deployment review.
- Runtime remains observation-only and will fail closed until the migration is applied and exactly the configured existing warehouse is activated through the documented checkpoint.
- Physical consolidation, retirement, deletion, stock merge, or ID reassignment remain prohibited and deferred.

## Self-Check: PASSED

All eight declared implementation/test/documentation files exist. Commits `0cd79f8d`, `fbf1cb27`, and `e899faef` are present. Focused tests, builds, EF model/script checks, scans, and diff checks passed.

---
*Phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre*
*Completed: 2026-08-24*
