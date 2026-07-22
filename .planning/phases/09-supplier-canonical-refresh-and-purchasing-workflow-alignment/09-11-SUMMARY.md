---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 11
subsystem: warehouse-receiving
tags: [dotnet, ef-core, warehouse, inventory, idempotency, authorization]

requires:
  - phase: 09-10
    provides: Approved, supplier-split, fingerprint-verified purchase orders
provides:
  - Warehouse/Admin-only purchase receipt API and bounded actual-evidence contract
  - Atomic receipt, stock ledger, purchase-order progress, package snapshot, and audit writer
  - Deterministic idempotent replay with mismatched-body conflict protection
  - Single Warehouse-owned purchase receiving mutation path
affects: [09-12, warehouse, purchasing, inventory, workflow-reports]

tech-stack:
  added: []
  patterns:
    - Deterministic receipt identity derived from purchase order and idempotency key
    - Full-body fingerprint validation before idempotent replay
    - One transaction owns receipt, ledger, order progress, package evidence, and audit

key-files:
  created:
    - backend/src/IPCManagement.Api/Models/DTOs/Workflow/WarehousePurchaseReceiptDto.cs
    - backend/src/IPCManagement.Api/Services/Workflow/IPurchaseReceivingService.cs
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseReceivingService.cs
    - backend/src/IPCManagement.Api/Controllers/WarehousePurchaseReceiptsController.cs
  modified:
    - backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs
    - backend/src/IPCManagement.Api/Program.cs
    - backend/src/IPCManagement.Api/DependencyInjection.cs
    - backend/src/IPCManagement.Api/Controllers/PurchaseOrdersController.cs
    - backend/src/IPCManagement.Api/Services/Workflow/IPurchaseOrderService.cs
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs
    - backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs

key-decisions:
  - "Require raw lot evidence for every received ingredient; additionally require manufacture and expiry dates for fresh-daily ingredients, and block inactive ingredient policy evidence."
  - "Derive a deterministic receipt ID from purchase order plus idempotency key, then compare the persisted full raw-evidence body before returning a replay."
  - "Keep purchasing and Manager progress reads intact while removing their legacy receipt writer entirely; generic inventory receipts remain unable to attach to a purchase order."

patterns-established:
  - "Warehouse ownership: only api/warehouse/purchase-orders/{purchaseOrderId}/receipts mutates purchase receipts."
  - "Atomic receiving: validate authoritative order/evidence first, then commit receipt, ledger, progress, package snapshot, and audit together."

requirements-completed: [WHR-01]

duration: 25min
completed: 2026-07-22
---

# Phase 09 Plan 11: Warehouse Purchase Receiving Summary

**Warehouse/Admin now records actual purchase receipts through one atomic, evidence-preserving, and idempotent writer while Purchasing and Manager retain read-only progress.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-22T14:24:27Z
- **Completed:** 2026-07-22T14:49:06Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added a dedicated `WarehousePurchaseReceive` policy restricted to Admin and actual Warehouse roles, with a server-owned DTO contract for raw lot/date evidence and complete package snapshots.
- Added one canonical receiving service that validates authoritative order data, rejects stale units/over-receipt/missing evidence, and atomically writes the receipt, ledger, order progress, package snapshot, and audit.
- Made retries identity-stable: the same key and full body returns the original receipt, while key reuse with different evidence conflicts without changing stock.
- Removed the Purchase-owned route, interface method, and service writer; route enumeration now finds exactly one purchase receipt POST while purchase progress reads remain available.
- Passed all 487 backend tests, including 17 Warehouse receiving and 18 adjacent inventory/ledger/authorization tests.

## Task Commits

Each task was committed atomically using TDD gates:

1. **Task 1 RED: Warehouse receipt contract tests** - `d2924d5`
2. **Task 1 GREEN: Warehouse receipt contract and policy** - `9c764b0`
3. **Task 2 RED: atomic and idempotent receiving tests** - `44ed9b8`
4. **Task 2 GREEN: canonical Warehouse receiving writer** - `1a37279`
5. **Task 3 RED: single-writer route tests** - `f2a522f`
6. **Task 3 GREEN: retired Purchase-owned receipt writer** - `12456f4`

## Files Created/Modified

- `backend/src/IPCManagement.Api/Models/DTOs/Workflow/WarehousePurchaseReceiptDto.cs` - Bounded request, line evidence, server requirement, and result contracts.
- `backend/src/IPCManagement.Api/Services/Workflow/IPurchaseReceivingService.cs` - Canonical purchase receiving service boundary.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseReceivingService.cs` - Validation, atomic persistence, ledger reuse, order progress, package snapshots, audit, and idempotent replay.
- `backend/src/IPCManagement.Api/Controllers/WarehousePurchaseReceiptsController.cs` - Dedicated Warehouse-owned purchase receipt endpoint.
- `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs` - Warehouse/Admin-only receiving role matrix.
- `backend/src/IPCManagement.Api/Program.cs` - Dedicated policy registration.
- `backend/src/IPCManagement.Api/DependencyInjection.cs` - Canonical receiving service registration.
- `backend/src/IPCManagement.Api/Controllers/PurchaseOrdersController.cs` - Removed the legacy Purchase-owned receipt mutation while preserving read/cancel behavior.
- `backend/src/IPCManagement.Api/Services/Workflow/IPurchaseOrderService.cs` - Removed the legacy receipt writer contract.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs` - Removed the second receipt implementation while preserving progress queries and cancellation guards.
- `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs` - Policy, validation, package evidence, fault rollback, replay, over-receipt, progress, and single-writer coverage.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs` - Migrated three receipt/cancellation regressions to the canonical Warehouse service.

## Decisions Made

- Lot evidence is mandatory for every purchase receipt line; fresh-daily ingredients additionally require manufacture and expiry dates. Inactive ingredient metadata is treated as missing authoritative policy and blocks receiving.
- Receipt identity is deterministic from the purchase order and normalized idempotency key. A persisted receipt is returned only when its full raw-evidence fingerprint still matches the request.
- The existing stock ledger rules remain the quantity authority; the receiving service orchestrates them inside the same relational transaction rather than introducing a second inventory implementation.
- The old Purchase DTO types remain harmless compatibility types, but no controller or service method consumes them; there is exactly one inbound purchase receipt mutation route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stabilized current-stock lookup in EF InMemory fault tests**
- **Found during:** Task 2 (atomic receiving writer)
- **Issue:** EF InMemory byte-array key comparison could not reliably find the tracked current-stock row during repeated receipt assertions.
- **Fix:** Used a test-only `ICurrentStockRepository` substitute backed by the fixture's tracked entities; production relational behavior and source code were unchanged.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs`
- **Verification:** Four injected rollback boundaries, retry, partial/final, stock, and audit tests passed in the 17-test Warehouse suite.
- **Committed in:** `1a37279`

**2. [Rule 3 - Blocking] Migrated legacy receipt regressions after removing the interface method**
- **Found during:** Task 3 (retire Purchase-owned mutation)
- **Issue:** Three existing workflow tests directly called the removed `IPurchaseOrderService.RecordReceiptAsync` writer and would no longer compile.
- **Fix:** Repointed those receipt/progress/cancellation assertions to `PurchaseReceivingService`, preserving their business expectations without restoring a second writer.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`
- **Verification:** The three affected regressions passed, followed by the full 487-test backend suite.
- **Committed in:** `12456f4`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both changes were test-only correctness accommodations required to verify the planned single-writer implementation; no production scope expanded.

## Issues Encountered

- GitNexus comparison against `main` reports CRITICAL because the branch contains the cumulative Phase 09 work (123 files and 36 flows). The isolated Plan 09-11 comparison against `b433d44` is LOW: 12 files on disk, 95 indexed symbols, and 0 affected flows.
- No NuGet or npm manifest changed. The protected cleanup SQL retained SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`; `README.md`, `frontend/README.md`, and the Phase 09-05 residual checkpoint remained untouched by this plan.

## Known Stubs

None. Empty DTO collection/string initializers are model-binding defaults, not rendered or unwired data sources.

## TDD Gate Compliance

- RED/GREEN commit pairs exist in order for all three tasks.
- Each RED test failed for the intended missing contract/writer behavior before its GREEN implementation.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 09-12 may consume the canonical Warehouse receiving endpoint and read-only purchase progress contract.
- The earlier Phase 09-05 residual checkpoint remains unresolved and must continue to gate any real/shared reconciliation apply.

## Self-Check: PASSED

- All four created production artifacts and this summary exist on disk.
- All six RED/GREEN task commits exist in Git history.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*
