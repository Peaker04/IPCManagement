---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 10
subsystem: purchasing
tags: [dotnet, ef-core, approvals, price-exception, purchase-orders, idempotency]

requires:
  - phase: 09-09
    provides: Durable supplier decisions, proposal fingerprints, price-exception schema, and unique purchase-request/supplier order key
provides:
  - Purchase-only strict greater-than-15-percent price-exception policy
  - Manager-only durable exception inbox and approval workflow
  - Submit and purchase-order gates bound to current supplier decision fingerprint/version
  - Transactional idempotent one-purchase-order-per-supplier creation
affects: [09-11, purchasing, approvals, receiving, workflow-reports]

tech-stack:
  added: []
  patterns:
    - Isolated business threshold policy instead of changing shared reporting semantics
    - Fingerprint/version-bound approval evidence
    - Serializable load-or-create with unique-race reload and snapshot verification

key-files:
  created:
    - backend/src/IPCManagement.Api/Services/Workflow/PurchasePricePolicy.cs
  modified:
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs
    - backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs
    - backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs

key-decisions:
  - "Keep WorkflowReportCalculator.IsPriceIncreaseWarning unchanged at >=15%; purchasing uses isolated strict >15% PurchasePricePolicy."
  - "Bind Manager decisions and PO reuse to the current supplier proposal fingerprint/version; superseded evidence cannot authorize a new proposal."
  - "Use the existing composite unique key plus a Serializable transaction and reload-on-race; no schema or dependency expansion."
  - "Derive each new purchase-order-line ID from request-line ID plus decision fingerprint so an established order carries a verifiable immutable proposal snapshot without a new column."

patterns-established:
  - "Strict price exception: 14.99% and 15.00% pass; 15.01% requires Manager approval."
  - "PO retry: return the established supplier-split set only when every line snapshot still matches the current decision."

requirements-completed: [PUR-04, PUR-05]

duration: 49min
completed: 2026-07-22
---

# Phase 09 Plan 10: Price Exception Approval and Idempotent Purchase Orders Summary

**Strict purchase-price exceptions now require durable Manager approval, and approved requests create one fingerprint-verified purchase order per supplier exactly once.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-07-22T13:12:35Z
- **Completed:** 2026-07-22T14:01:51Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added decimal-safe purchase-only threshold behavior with explicit 14.99/15.00/15.01 boundaries while preserving all shared report behavior.
- Added Manager-only pending exception projection and approval/rejection handling with complete price/evidence/reason context and stale-fingerprint protection.
- Enforced current supplier decisions and approved current exceptions during request submission and immediately before PO creation.
- Split approved lines into exactly one order per current supplier inside a Serializable transaction, with identity-stable sequential/concurrent retry and conflict detection for changed decisions.
- Kept package manifests unchanged and preserved the protected cleanup SQL byte-for-byte.

## Task Commits

Each task was committed atomically using TDD gates:

1. **Task 1 RED: strict price exception tests** - `b1c8244`
2. **Task 1 GREEN: strict durable purchase price exceptions** - `6608104`
3. **Task 2 RED: approval and submit-gate tests** - `f842a25`
4. **Task 2 GREEN: Manager exception approval flow** - `f061df4`
5. **Task 3 RED: supplier-split retry tests** - `dfb86f4`
6. **Task 3 GREEN: transactional idempotent supplier orders** - `ef3a95b`
7. **Regression fixture compensation: PO schema and retry contract** - `fe12646`
8. **Regression assertion compensation: durable exception semantics** - `8156c71`

## Files Created/Modified

- `backend/src/IPCManagement.Api/Services/Workflow/PurchasePricePolicy.cs` - Strict purchasing variance calculation and exception boundary.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs` - Durable proposal creation/supersession and submit gates.
- `backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs` - Price-exception target and decision evidence fields.
- `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs` - Manager/Admin-only price-exception permission.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs` - Current-fingerprint exception decisions and purchase-request approval gate.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs` - Pending exception projection with complete decision evidence.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalWorkflowService.cs` - Target aliases, dispatch, and authorization mapping.
- `backend/src/IPCManagement.Api/DependencyInjection.cs` - Price-exception handler registration.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs` - Transactional supplier split, snapshot matching, and retry/race handling.
- `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` - Threshold, durability, role, stale-target, and recovery coverage.
- `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs` - Submit, supplier split, retry, and mismatch coverage.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs` - Phase 09 SQLite fixture and regression expectations.

## Decisions Made

- Shared reporting retains its locked `>= 15%` warning behavior; purchasing uses an isolated strict `> 15%` policy.
- The server, not UI/role claims, writes decision actors, timestamps, reasons, evidence, and proposal identity.
- Existing orders are reusable only when supplier grouping, quantities, units, prices, and fingerprint-derived line identity all match the current decisions.
- InMemory-specific materialization is isolated to tests; relational execution retains server-filtered queries and Serializable transactions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected nullable-decimal xUnit boundary data**
- **Found during:** Task 1 RED
- **Issue:** Integer `InlineData` could not bind reliably to nullable decimal parameters.
- **Fix:** Used typed decimal test data so the intended missing/zero/negative reference cases execute.
- **Files modified:** `MaterialDemandAndPriceExceptionApprovalTests.cs`
- **Verification:** Focused threshold and report tests passed.
- **Committed in:** `b1c8244`

**2. [Rule 3 - Blocking] Preserved InMemory inbox visibility for tracked exceptions**
- **Found during:** Task 2 GREEN
- **Issue:** EF InMemory did not expose newly tracked exception navigation rows through the relational-shaped query.
- **Fix:** Merged tracked entities only for InMemory while retaining server filtering for relational providers.
- **Files modified:** `ApprovalInboxService.cs`
- **Verification:** Approval/submit suites passed 67/67 at Task 2.
- **Committed in:** `f061df4`

**3. [Rule 3 - Blocking] Added provider-faithful PO materialization for concurrency tests**
- **Found during:** Task 3 GREEN
- **Issue:** EF InMemory byte-array relationship fixup did not reliably hydrate supplier-decision/order navigation graphs across contexts.
- **Fix:** Materialized no-tracking scalar rows and joined them by stable keys only on the InMemory path; relational execution remained unchanged.
- **Files modified:** `PurchaseOrderService.cs`
- **Verification:** New supplier-split/retry tests passed 4/4 and full API suite passed.
- **Committed in:** `ef3a95b`

**4. [Rule 3 - Blocking] Updated the legacy SQLite workflow fixture for Phase 09 tables and decisions**
- **Found during:** Task 3 regression
- **Issue:** The minimal fixture had supplier-decision schema but no price-exception table and seeded PO lines without current decisions.
- **Fix:** Added the missing fixture table and durable current decisions; no production schema changed.
- **Files modified:** `WorkflowGenerationTests.cs`
- **Verification:** Legacy PO regression passed 6/6.
- **Committed in:** `fe12646`

**5. [Rule 1 - Bug] Replaced obsolete transient-warning regression expectations**
- **Found during:** Full backend regression
- **Issue:** Tests still expected `price-alert`/request-level targets, missing reasons, and retry rejection from the superseded transient workflow.
- **Fix:** Asserted durable `purchase-price-exception` targets, required proposal reasons, current blocker copy, and stable retry IDs.
- **Files modified:** `WorkflowGenerationTests.cs`
- **Verification:** API suite passed 475 with 2 existing future-plan skips; Application suite passed 8/8.
- **Committed in:** `8156c71`

---

**Total deviations:** 5 auto-fixed (2 Rule 1, 3 Rule 3)
**Impact on plan:** All fixes were required for deterministic test execution or alignment with the approved durable workflow; no production endpoint, database schema, dependency, receiving, controller, or UI scope was added.

## Issues Encountered

- A parallel invocation of the same API test project contended on `MvcTestingAppManifest.json`; rerunning the filters sequentially with `--no-build` produced the authoritative results.
- GitNexus reports CRITICAL cumulative risk from the approved Task 1-2 submit/inbox boundary. The isolated Plan 09-10 comparison contains only the expected submit, inbox, confirmation, and CreateFromRequest flows; full regression is green.

## Verification

- API tests: **475 passed, 2 skipped, 0 failed** (477 total). The two skips are existing Phase 09-11 warehouse receiving scenarios.
- Application tests: **8 passed, 0 failed**.
- Release build: **0 warnings, 0 errors**.
- Plan-focused price/approval/PO filter: **49 passed, 0 failed**.
- Package manifest diff: empty.
- `WorkflowReportCalculator.cs` diff from pre-plan commit: empty.
- Protected SQL SHA-256: `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-11 can consume approved, supplier-split purchase orders with stable identities for Warehouse receiving.
- The existing Phase 09-05 residual checkpoint remains preserved; no reconciliation apply or shared-data mutation occurred.
- `README.md`, `frontend/README.md`, and the protected cleanup SQL remain user-owned and uncommitted.

## Self-Check: PASSED

All key files and all eight task/regression commits were verified on disk and in Git history.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*
