---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 07
subsystem: purchasing-workflow
tags: [dotnet, ef-core, mysql, purchasing, pagination, tdd]
requires:
  - phase: 09-06
    provides: approval authorization and immutable approved-demand snapshot
provides:
  - approval-bound supplier-neutral FULLDAY purchase draft generation
  - nullable draft supplier migration with guarded downstream consumers
  - bounded Monday-week purchasing workbench with selected-date paging and six stage counts
affects: [09-08, 09-10, 09-11, purchasing-ui]
tech-stack:
  added: []
  patterns: [approved snapshot boundary, supplier-neutral draft, bounded week and selected-date projection]
key-files:
  created:
    - backend/src/IPCManagement.Api/Migrations/20260722160000_MakePurchaseRequestLineSupplierOptional.cs
  modified:
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs
    - backend/src/IPCManagement.Api/Controllers/PurchaseWorkflowController.cs
    - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseRequestWorkflowDto.cs
    - backend/src/IPCManagement.Api/Data/IpcManagementContext.cs
    - backend/src/IPCManagement.Api/Models/Entities/Purchaserequestline.cs
    - backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs
key-decisions:
  - Generated purchase drafts remain supplier-neutral; supplier is required only at explicit selection and all submit, order, and receipt consumers reject a missing supplier.
  - The workbench uses six mutually exclusive service-date stages and pages only the selected date, with page size 8 by default and 100 maximum.
  - A price exception is raised only when the proposed price exceeds the reference by strictly more than 15 percent.
  - Plan 09-08 follows the 09-07 nullability migration and must not repeat the SupplierId nullability alteration.
requirements-completed: [PUR-02]
duration: 55m
completed: 2026-07-22
---

# Phase 09 Plan 07: Approved Demand Purchasing Workbench Summary

Approved-demand-only, supplier-neutral purchase draft generation with a bounded weekly purchasing workbench, explicit paging, and mutually exclusive operational stage counts.

## Performance

- **Duration:** 55 minutes
- **Started:** 2026-07-22T15:35:00+07:00
- **Completed:** 2026-07-22T16:30:00+07:00
- **Tasks:** 2
- **Implementation and handoff files:** 18

## Accomplishments

- Restricted purchase draft generation to current, approved FULLDAY demand snapshots and made replay idempotent for both requests and lines.
- Removed automatic supplier and price assignment from generated drafts while preserving downstream correctness through explicit supplier guards.
- Added a forward-only nullable `Purchaserequestline.SupplierId` migration, updated EF mapping and model snapshot, and verified no pending model changes.
- Added `GET api/purchase-workflow/workbench` with ISO Monday-week validation, optional in-week selected date, stage filtering, stable ordering, and server paging.
- Classified each service date into exactly one of six stages: demand, supplier-price, exception, submitted, approved-order, or receiving.
- Kept workbench reads bounded: a seven-day production window and no more than eight SELECT statements in the SQLite query-budget test.

## Task Commits

Each task was committed atomically using TDD RED and GREEN gates:

1. **Task 1: Enforce approved supplier-neutral purchase draft generation**
   - `c348d75` — `test(09-07): define approved demand generation gate`
   - `36775fd` — `feat(09-07): enforce approved supplier-neutral purchase drafts`
2. **Task 2: Add bounded purchase workbench read model**
   - `087edb5` — `test(09-07): define bounded purchase workbench contract`
   - `8464899` — `feat(09-07): add bounded purchase workbench read model`

## Verification

- `dotnet build backend/IPCManagement.sln`: passed with 0 warnings and 0 errors.
- Full backend test suite: 394 passed and 6 explicitly skipped for future-plan behavior.
- Focused generation tests: 5 passed; full workflow generation suite: 91 passed.
- Focused workbench contract tests: 4 passed, including validation, stable ordering, paging defaults/cap, exact stage counts, strict 15% threshold, and query bound.
- `dotnet ef migrations has-pending-model-changes`: no pending model changes.
- GitNexus plan-range analysis from `bc1a3cd` reported HIGH scope because the approved generation service and nullable supplier schema are central; no additional unapproved CRITICAL symbol was introduced.
- GitNexus comparison with `main` remained CRITICAL because the feature branch contains earlier Phase 09 work; plan-range analysis was used to attribute this plan's scope.

## Decisions Made

- A generated request line has no supplier or price until purchasing makes an explicit selection.
- Missing supplier state is valid only for a draft; submission, order creation, approval projections, reporting, and receiving fail safely or omit supplier-specific data as appropriate.
- The workbench returns compact summaries for all seven dates but detailed approved-demand rows only for the selected date.
- Exactly 15% above reference remains within tolerance; only a value greater than 15% enters the exception stage.
- The 09-08 plan now owns only supplier decision/evidence/exception schema and related constraints, after the 09-07 nullability prerequisite.

## Deviations from Plan

### User-approved Architectural Adjustment

**1. [Rule 4 - Architecture] Moved the nullable current-draft supplier prerequisite from 09-08 to 09-07**
- **Found during:** Task 1
- **Issue:** Supplier-neutral generation cannot be represented while `PurchaseRequestLine.SupplierId` is non-nullable.
- **Decision:** The user approved moving only the nullability migration, entity mapping, and snapshot update into 09-07. Supplier decisions, evidence, exception records, and purchase-order constraints remain in 09-08.
- **Files modified:** entity, DbContext, model snapshot, new forward migration, and the 09-08 handoff plan.
- **Commit:** `36775fd` for implementation; handoff correction is included in the final documentation commit.

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Guarded legacy consumers against supplier-neutral drafts**
- **Found during:** Task 1
- **Issue:** Existing submission, purchase-order, approval, reporting, and receipt paths assumed every request line already had a supplier.
- **Fix:** Added explicit draft-safe projections and validation before operations that require a supplier.
- **Files modified:** purchase request controller, approval handlers/inbox, purchase order, receipt, and workflow report services and DTOs.
- **Commit:** `36775fd`

**2. [Rule 3 - Blocking Issue] Aligned workflow test storage and setup with the neutral-draft contract**
- **Found during:** Task 1
- **Issue:** The SQLite test schema still required a supplier and legacy workflow tests submitted generated requests without explicit selection.
- **Fix:** Made the test column nullable and updated scenarios to approve demand first and select a supplier before submission.
- **Files modified:** `WorkflowGenerationTests.cs`
- **Commit:** `36775fd`

**3. [Rule 1 - Bug] Isolated provider-specific relationship behavior in bounded workbench tests**
- **Found during:** Task 2
- **Issue:** EF InMemory byte-array foreign keys did not reliably materialize relationships, while SQLite `EnsureCreated` could not execute MySQL enum DDL.
- **Fix:** Preserved date-bounded production queries, added a tracked-entry fallback only for the InMemory provider, and used a minimal read-only SQLite schema for the query-budget contract.
- **Files modified:** purchase workflow service and supplier decision workflow tests.
- **Commit:** `8464899`

## Known Stubs

None. Empty collections and nullable supplier/selected-date values are intentional runtime states and are populated or validated by the workbench and draft workflows.

## Threat Surface Review

No unplanned threat surface was introduced. The new endpoint inherits purchase authorization and rate limiting, validates bounded week/date/page inputs, and performs read-only projections. The nullable schema boundary is protected by explicit validation before supplier-dependent state transitions.

## Issues Encountered

- GitNexus staged analysis for Task 2 remained HIGH because the service-file diff also contained the already approved high-impact generation change; individual workbench symbols were LOW risk.
- Branch-wide comparison against `main` includes earlier Phase 09 commits, so the parent of the first 09-07 commit was also used as the plan-specific comparison base.

## Next Phase Readiness

- Plan 09-08 can add supplier decisions, evidence, price exceptions, legacy snapshots, and purchase-order uniqueness without duplicating the nullable `SupplierId` alteration.
- The workbench API contract is ready for the purchasing UI plans to consume.
- The protected local legacy-cleanup SQL and unrelated README edits remain untouched.

## Self-Check: PASSED

- Summary and nullable supplier migration exist on disk.
- All four task gate commits are present in Git history.
- Verification claims match the final build, test, EF migration, and GitNexus results.
