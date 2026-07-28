---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 04
subsystem: backend
tags: [ef-core, mysql, migrations, reconciliation, audit, warehouse, tdd]
requires:
  - phase: 09-03
    provides: deterministic reconciliation manifest, action matrix, and immutable-history preview contract
provides:
  - durable reconciliation run and action audit evidence
  - nullable receipt package quantity, base-unit, and policy snapshots with completeness constraints
  - one forward-only EF migration proven on disposable fresh-bootstrap and populated-clone paths
affects: [09-05, 09-11, supplier-reconciliation, warehouse-receiving]
tech-stack:
  added: []
  patterns:
    - append-only run/action evidence with manifest and per-run action uniqueness
    - nullable complete-triple package snapshots for immutable receipt conversion evidence
    - disposable MySQL migration proof with pre/post immutable receipt fingerprints
key-files:
  created:
    - backend/src/IPCManagement.Api/Models/Entities/Purchasehistoryreconciliationrun.cs
    - backend/src/IPCManagement.Api/Models/Entities/Purchasehistoryreconciliationaction.cs
    - backend/src/IPCManagement.Api/Migrations/20260721120000_AddPurchaseHistoryReconciliation.cs
  modified:
    - backend/src/IPCManagement.Api/Models/Entities/Inventoryreceiptline.cs
    - backend/src/IPCManagement.Api/Data/IpcManagementContext.cs
    - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
    - backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs
    - backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs
    - backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs
key-decisions:
  - "Persist accepted reconciliation evidence as one uniquely identified manifest run with required server actor and append-only deterministic action rows."
  - "Store package conversion evidence only as an all-null or complete positive quantity/base-unit/policy triple; never infer cross-unit conversion from a plain package value."
  - "Keep the production migration limited to the reconciliation tables and three nullable receipt-line columns; correct current snapshot metadata drift without emitting unrelated supplier ALTER operations."
  - "Limit fresh-install compensation to the test fixture, exactly two duplicate index statements and four omitted history IDs, while recording that this is not a full baseline/model parity proof."
requirements-completed: []
duration: 35m
completed: 2026-07-22
---

# Phase 09 Plan 04: Reconciliation Evidence Persistence Summary

Forward-only reconciliation audit storage and immutable receipt package snapshots, proven against disposable fresh-bootstrap and populated MySQL upgrade lanes.

This plan provides persistence prerequisites for `SUP-04` and `WHR-01`; both remain open until their atomic apply and Warehouse receiving workflows are delivered by downstream plans.

## Accomplishments

- Added run-level manifest, source, policy, as-of, database fingerprint, backup/restore, actor, status, and count evidence with a unique manifest hash.
- Added per-action source trace, target, disposition, reason, before/after evidence, and hashes with required run ownership and per-run action uniqueness.
- Added nullable package quantity, package base-unit, and package policy snapshots to receipt lines, guarded by complete-triple and positive-quantity constraints.
- Added the single chronological `20260721120000_AddPurchaseHistoryReconciliation` migration and updated only the current model snapshot; no prior migration was edited.
- Proved migration-up on disposable `ipc_lane8` and a restored populated `ipc_lane9`; receipt IDs, values, counts, and SHA-256 fingerprint remained unchanged on upgrade.
- Kept the protected cleanup SQL untracked and byte-identical throughout execution.

## Task Commits

| Commit | Type | Description |
| --- | --- | --- |
| `0b1fcf8` | RED | Failing reconciliation persistence and package-snapshot contract tests |
| `6890d96` | GREEN | Durable entities, mappings, relationships, uniqueness, and check constraints |
| `3c5d110` | GREEN | Forward migration, fresh/upgrade MySQL proof, and aligned SQLite regression fixtures |

## Files Created/Modified

- `backend/src/IPCManagement.Api/Models/Entities/Purchasehistoryreconciliationrun.cs` — accepted manifest, environment, restore, actor, status, and count evidence.
- `backend/src/IPCManagement.Api/Models/Entities/Purchasehistoryreconciliationaction.cs` — deterministic per-action source and before/after audit evidence.
- `backend/src/IPCManagement.Api/Models/Entities/Inventoryreceiptline.cs` — optional immutable package conversion snapshot triple.
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` — entity mappings, FKs, unique indexes, lengths, precision, and checks.
- `backend/src/IPCManagement.Api/Migrations/20260721120000_AddPurchaseHistoryReconciliation.cs` — forward schema migration only.
- `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs` — current EF model snapshot.
- `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs` — model contracts, disposable fresh bootstrap, populated upgrade, migration history, schema, and fingerprint assertions.
- `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs` — package snapshot contract coverage.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`, `backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs` — nullable snapshot columns in manual SQLite fixture DDL.

## Decisions Made

- `AppliedBy` is a required FK to `users`; callers cannot supply detached audit evidence.
- Reconciliation actions cascade only with their owning run, while actor and package base-unit relationships use restrictive deletion.
- Existing receipt rows migrate with all three package snapshot fields `NULL`; no historical conversion is fabricated.
- The test-only fresh fixture executes the official baseline after removing exactly its two duplicate trailing index statements, then inserts exactly four omitted migration-history IDs before allowing every remaining discovered migration to run.
- The fresh proof explicitly asserts the official baseline still lacks `menuversions.successRowCount`, `errorRowCount`, and `warningRowCount`; this plan does not claim or manufacture full current-model parity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Corrected EF metadata test access and expression-tree syntax**
- **Found during:** Task 1 RED/GREEN
- **Issue:** Runtime optimized metadata omitted design-time check constraints, and a collection expression could not be compiled inside the test expression tree.
- **Fix:** Read `IDesignTimeModel.Model` for persistence contracts and use an expression-compatible array.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`, `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs`
- **Commit:** `6890d96`

**2. [Rule 3 - Blocking issue] Removed unrelated supplier ALTER operations caused by prior snapshot drift**
- **Found during:** Task 2 migration generation
- **Issue:** Current snapshot metadata disagreed with already-applied supplier nullability migrations, causing EF to scaffold unrelated `AlterColumn` operations.
- **Fix:** Removed those operations from 09-04 and corrected only the current snapshot to match the current model and migration history.
- **Files modified:** `backend/src/IPCManagement.Api/Migrations/20260721120000_AddPurchaseHistoryReconciliation.cs`, `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- **Commit:** `3c5d110`

**3. [Rule 3 - Blocking issue] Added explicitly approved fresh-install test compensation**
- **Found during:** Task 2 fresh migration proof
- **Issue:** EF migrations start with an additive migration and cannot create an empty database alone. The official baseline then failed on duplicate `ixApprovalHistoriesTarget` and `IX_approvalassignments_approverUserId` statements, while its history initializer omitted four represented migration IDs.
- **Fix:** After a user-approved checkpoint, the test fixture only removes those exact two duplicate statements in memory and inserts exactly `20260702061320_AddImportAuditFields`, `20260702072352_AddProductionPlanUpdatedAt`, `20260702124738_AddSupplierQuotations`, and `20260702164531_AddPurchaseOrders`. Official SQL and prior migrations remain unchanged.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`
- **Commit:** `3c5d110`

**4. [Rule 3 - Blocking issue] Aligned manual SQLite regression schemas**
- **Found during:** Overall backend test verification
- **Issue:** Twenty-one workflow tests failed because two hand-written SQLite schemas did not include the newly mapped receipt snapshot columns.
- **Fix:** Added only the three nullable columns to the two fixture DDL definitions; no workflow behavior changed.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`, `backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs`
- **Commit:** `3c5d110`

### User-Approved Scope Gate

- Pre-edit GitNexus reported `Inventoryreceiptline` as CRITICAL: 20 direct callers, 85 total dependants, and 19 affected processes; `IpcManagementContext` was also CRITICAL with 52 direct and 82 total dependants.
- The user explicitly approved only the three nullable receipt snapshot columns, two reconciliation audit entities, context constraints, one forward migration/current snapshot, and fresh/upgrade tests.
- `CreateMinimalWorkflowSchemaAsync` reported MEDIUM risk across 91 tests and `InventoryReceiptServiceTests.CreateInMemoryContext` reported LOW risk across three tests; edits were limited to nullable test-fixture columns.
- Final staged GitNexus scan reported LOW risk: five files, 25 symbols, and zero affected processes. Compare-to-`main` remained CRITICAL because it includes 99 files and 20 flows from pre-existing Phase 9 branch work outside this plan.

## Verification

- Task 1 focused persistence/package filter: **2 passed, 0 failed**.
- Actual MySQL fresh and populated-upgrade migration filter: **2 passed, 0 failed**.
- Fresh lane: migration history contains 09-04 once; both audit tables, three receipt snapshot columns, and seven check constraints exist.
- Populated lane: clone `ipc_e2e_template -> ipc_lane9` reported **56 tables** and `VERIFY=PASS`; receipt and line counts plus the immutable receipt-history SHA-256 fingerprint were stable before/after migration.
- Full backend Release suite: **390 passed, 0 failed, 6 skipped**.
- Backend Release build: **succeeded with 0 warnings and 0 errors**.
- `dotnet ef migrations list`: 09-04 is recognized chronologically before 09-07's later supplier-nullability migration.
- `dotnet ef migrations has-pending-model-changes`: **No changes have been made to the model since the last migration.**
- Package/project manifest diff: **empty**.
- Protected SQL SHA-256 remains `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`, porcelain remains exactly `?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql`, and the file remains untracked.

## Deferred Issues

- The official `backend/database/IPCmanagement.sql` fresh baseline duplicates `ixApprovalHistoriesTarget` and `IX_approvalassignments_approverUserId`; this plan compensates in the disposable test fixture only.
- The official baseline/history pair does not provide full current-model parity: `menuversions.successRowCount`, `errorRowCount`, and `warningRowCount` remain absent after the compensated fresh path. The test asserts this exact gap; repairing official database scripts is outside 09-04 scope.

## Known Stubs

- `PurchaseHistoryReconciliationTests.Apply_preserves_immutable_history_and_second_apply_is_no_op` remains intentionally skipped; Plan 09-05 owns guarded apply and no-op replay.
- Two `WarehousePurchaseReceivingTests` remain intentionally skipped; Plan 09-11 owns the Warehouse-authorized receiving transaction and rejection of Purchasing receipt writes.
- These future behavior seams do not block this plan's persistence and migration objective.

## Next Phase Readiness

- Plan 09-05 can persist accepted preview manifests/actions with server actor and backup/restore evidence, then prove no-op replay.
- Plan 09-11 can write a complete package snapshot triple when Warehouse receives a purchase order.
- `SUP-04` remains open for Plan 09-05 apply/no-op completion; only `WHR-01` is marked complete here.
- No live/shared database, reconciliation apply, cleanup SQL, service behavior, endpoint, or package dependency was changed.

## Self-Check: PASSED

- All three created implementation artifacts and this summary exist on disk.
- Commits `0b1fcf8`, `6890d96`, and `3c5d110` resolve in repository history.
- No unexpected tracked deletion or generated untracked output was found; the only untracked database SQL remains the protected user file.
