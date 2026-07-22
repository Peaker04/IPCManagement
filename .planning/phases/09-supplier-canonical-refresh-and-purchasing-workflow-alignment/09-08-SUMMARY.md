---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 08
subsystem: database
tags: [ef-core, mysql, migrations, purchasing, supplier-decisions, price-exceptions, tdd]
requires:
  - phase: 09-04
    provides: forward-only audit persistence and disposable fresh/upgrade migration proof
  - phase: 09-07
    provides: nullable supplier-neutral purchase-request draft contract
provides:
  - versioned supplier decision snapshots with exact evidence, actor, fingerprint, and optimistic concurrency
  - durable strict price-exception proposals with append-only supersession and Manager decision fields
  - legacy supplier snapshot marker and forward migration proven on fresh and populated disposable MySQL lanes
  - database-enforced one purchase order per approved request and supplier
affects: [09-09, 09-10, 09-11, purchasing-workflow, approval-inbox, purchase-orders]
tech-stack:
  added: []
  patterns:
    - append-only decision versions with nullable unique current key
    - proposal fingerprint and version as immutable price-exception identity
    - legacy snapshot marker without fabricated confirmation evidence
key-files:
  created:
    - backend/src/IPCManagement.Api/Models/Entities/Purchaselinesupplierdecision.cs
    - backend/src/IPCManagement.Api/Models/Entities/Purchasepriceexception.cs
    - backend/src/IPCManagement.Api/Migrations/20260722163000_AddSupplierDecisionsAndPriceExceptions.cs
  modified:
    - backend/src/IPCManagement.Api/Models/Entities/Purchaserequestline.cs
    - backend/src/IPCManagement.Api/Data/IpcManagementContext.cs
    - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
    - backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs
    - backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs
    - backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs
key-decisions:
  - "Represent pre-existing supplier links with an isLegacySupplierSnapshot marker and create no supplier-decision rows during migration, so history is retained without fabricated evidence or confirmer identity."
  - "Use a nullable unique currentDecisionKey plus immutable line-version and line-fingerprint uniqueness to enforce at most one current decision while retaining unlimited superseded versions."
  - "Retain the existing unique purchase-order request-supplier index from the original purchase-order migration instead of attempting to create a duplicate index in 09-08."
  - "Keep price exceptions strictly above 15 percent and bind each exception to one supplier-decision proposal fingerprint and version."
patterns-established:
  - "Decision snapshots are append-only: updates create a new version and point the prior row at its superseding row."
  - "Legacy data is marked explicitly at its existing owner row; migrations never manufacture modern audit evidence."
requirements-completed: [PUR-03, PUR-04, PUR-05]
duration: 14m
completed: 2026-07-22
---

# Phase 09 Plan 08: Supplier Decision and Price Exception Persistence Summary

Versioned supplier and strict price-exception records with immutable evidence identity, legacy-safe migration, and idempotent purchase-order uniqueness proven on disposable MySQL fresh and upgrade lanes.

## Performance

- **Duration:** 14 minutes
- **Started:** 2026-07-22T19:18:28+07:00
- **Completed:** 2026-07-22T19:32:01+07:00
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added supplier-decision persistence for eligible quotation/latest-receipt evidence, explicit confirmer identity, proposal price/delivery, deterministic fingerprint, version, current/superseded state, and optimistic concurrency.
- Added durable price exceptions with strict greater-than-15-percent variance, evidence snapshot, reason, requester, Manager decision lifecycle, proposal identity, and append-only supersession.
- Added a forward-only migration after the 09-07 nullable-supplier migration; existing supplier values remain byte-identical and receive only the explicit legacy marker.
- Proved fresh bootstrap on `ipc_lane8` and populated template-clone upgrade on `ipc_lane9`; no confirmation evidence was fabricated, and duplicate request-supplier purchase orders were rejected by MySQL.
- Preserved the protected cleanup SQL as untracked and byte-identical.

## Task Commits

1. **Task 1 RED: Define persistence contracts** — `2a13a18` (`test`)
2. **Task 1 GREEN: Persist versioned supplier decisions** — `02ce7d3` (`feat`)
3. **Task 2: Add forward migration and disposable proof** — `d085c81` (`feat`)
4. **Task 2 regression fix: Align receipt fixture** — `9c9b7d3` (`test`)

## Files Created/Modified

- `backend/src/IPCManagement.Api/Models/Entities/Purchaselinesupplierdecision.cs` — versioned supplier/evidence/actor snapshot and supersession links.
- `backend/src/IPCManagement.Api/Models/Entities/Purchasepriceexception.cs` — proposal-bound exception and decision lifecycle.
- `backend/src/IPCManagement.Api/Models/Entities/Purchaserequestline.cs` — legacy supplier marker and supplier-decision navigation.
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` — sets, relationships, unique indexes, concurrency tokens, and completeness/state checks.
- `backend/src/IPCManagement.Api/Migrations/20260722163000_AddSupplierDecisionsAndPriceExceptions.cs` — forward schema and non-destructive legacy marker backfill.
- `backend/src/IPCManagement.Api/Migrations/20260722163000_AddSupplierDecisionsAndPriceExceptions.Designer.cs` — generated target model for the migration.
- `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs` — current model, retaining nullable request-line supplier.
- `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs` — persistence contracts and disposable fresh/upgrade migration proof.
- `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` — proposal binding, exception constraints, nullability, and PO uniqueness contracts.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs` — SQLite fixture alignment for the legacy marker.
- `backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs` — SQLite receipt fixture alignment for the legacy marker.

## Decisions Made

- Historical non-null supplier links remain on their original purchase-request lines and are marked `isLegacySupplierSnapshot`; no `Purchaselinesupplierdecision` row is inserted without eligible evidence and an explicit confirmer.
- Current-decision uniqueness uses a nullable binary key equal to the purchase-request-line ID only for `CURRENT` rows, relying on MySQL unique-null behavior to retain multiple superseded rows.
- The existing `ixPurchaseOrdersRequestSupplier` unique index already satisfies PUR-05. The 09-08 migration verifies and tests it rather than creating the same index again.
- Exception records require `variancePercent > 15`, preserve request and decision actors/times/reasons, and cannot detach from their proposal fingerprint/version.

## Verification

- Task 1 focused persistence tests: 2 passed.
- Task 2 migration contract tests: 3 passed.
- Actual MySQL migration proof with `IPC_RUN_MYSQL_MIGRATION_TESTS=1`: 3 passed across fresh `ipc_lane8` and populated `ipc_lane9`.
- Affected-process regression: 143 passed, 5 future-plan tests skipped.
- Full backend build: 0 warnings, 0 errors.
- Full backend tests: 446 passed, 5 future-plan tests skipped.
- `dotnet ef migrations has-pending-model-changes`: no pending model changes.
- Protected SQL: expected SHA-256, exact `??` porcelain state, and untracked status all passed before and after migration tests.
- GitNexus `main` comparison: CRITICAL from the accumulated Phase 09 branch (111 files, 29 flows); isolated 09-08 range `2948217..9c9b7d3`: LOW, 13 files, 0 affected execution flows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Existing constraint] Reused the existing purchase-order composite uniqueness**
- **Found during:** Task 2
- **Issue:** `ixPurchaseOrdersRequestSupplier` was already created as unique by `20260702164531_AddPurchaseOrders`; creating it again would fail the migration.
- **Fix:** Kept the existing index unchanged and added model/MySQL verification that it is unique and rejects a duplicate key without deleting or merging rows.
- **Files modified:** migration tests only; no earlier migration changed.
- **Verification:** populated upgrade test received MySQL duplicate-key error 1062.
- **Committed in:** `d085c81`

**2. [Rule 3 - Blocking fixture drift] Added the legacy marker to manual SQLite schemas**
- **Found during:** Task 2 affected-process and full-backend regression
- **Issue:** manual SQLite tables did not contain the new non-null `isLegacySupplierSnapshot` column, causing queries to fail before behavior assertions.
- **Fix:** Added only `INTEGER NOT NULL DEFAULT 0` to the purchasing and receipt test schemas.
- **Files modified:** `SupplierDecisionWorkflowTests.cs`, `WorkflowGenerationTests.cs`, `InventoryReceiptServiceTests.cs`.
- **Verification:** affected regression passed 143 tests; full backend passed 446 tests.
- **Committed in:** `d085c81`, `9c9b7d3`

**3. [Rule 3 - Build blocker] Generated the migration in Release configuration**
- **Found during:** Task 2
- **Issue:** a user-owned running Debug API process locked `bin/Debug/.../IPCManagement.Api.exe`.
- **Fix:** Left the process running and generated/verified the migration with Release configuration.
- **Files modified:** none beyond planned migration output.
- **Verification:** Release solution build passed with zero warnings/errors.
- **Committed in:** `d085c81`

---

**Total deviations:** 3 auto-fixed (1 existing-constraint correction, 2 blocking execution/fixture issues).  
**Impact on plan:** All changes were required for migration correctness or regression fidelity; no service behavior, API surface, package manifest, prior migration, reconciliation apply path, or protected artifact changed.

## Issues Encountered

- PowerShell promoted the expected stderr from `git ls-files --error-unmatch` into a terminating error. The preservation check was rerun with `git ls-files -- path` and an explicit empty-output assertion.
- The migration timestamp generated by EF was renamed to the plan-locked `20260722163000` ID; the migration attribute and generated designer were updated together, then fresh/upgrade application and pending-model checks passed.

## Known Stubs

None. Five pre-existing skipped tests remain intentionally assigned to Plans 09-09 through 09-11 and do not block this persistence goal.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 09-09 can implement evidence-backed supplier candidate/confirmation behavior against these durable records.
- Plan 09-10 can implement the Manager price-exception approval transitions against the stored proposal identity.
- Plan 09-11 can rely on database-enforced request-supplier purchase-order uniqueness.
- Phase 09-05 remains a separate residual reconciliation checkpoint and was not modified or applied.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*

## Self-Check: PASSED

- All key created files exist on disk.
- All four task commits exist in repository history.
- Task acceptance criteria, plan verification, actual MySQL migration lanes, affected-process regression, full backend build/tests, and protected-file invariants passed.
