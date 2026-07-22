---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 06
subsystem: approvals
tags: [dotnet, ef-core, authorization, approval-history, material-demand, inbox]

requires:
  - phase: 09-01
    provides: Phase 09 approval and workflow safety seams
provides:
  - Manager/Admin-only material-demand and purchase-request decision permissions
  - Durable material-demand approve/reject handler with idempotent history
  - Stable paged material-demand projection in the Manager approval inbox
  - Immutable approved material-demand snapshots that require explicit recalculation versions
affects: [purchasing-workflow, approval-ui, material-demand, phase-09]

tech-stack:
  added: []
  patterns: [typed approval targets, handler-authored approval history, role-derived inbox projection]

key-files:
  created: []
  modified:
    - backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs
    - backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalWorkflowService.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs
    - backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandService.cs
    - backend/src/IPCManagement.Api/DependencyInjection.cs
    - backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs

key-decisions:
  - "Only Manager/Admin can decide material demand and purchase requests; Purchasing retains preparation and quotation permissions only."
  - "Material demand reuses its request ID/status plus approval history as the durable target instead of adding a parallel approval table."
  - "Approved demand snapshots are immutable; changed demand must use an explicit future recalculation/version path."

patterns-established:
  - "Approval handlers own status validation, actor attribution, terminal conflict detection, and history persistence."
  - "Approval inbox items use stable target IDs and operational deep-link context while authorization remains server-enforced."

requirements-completed: [PUR-01]

duration: 32min
completed: 2026-07-22
---

# Phase 09 Plan 06: Material-Demand Approval Workflow Summary

**Manager-owned material-demand decisions with durable history, immutable approved snapshots, and stable operational inbox projection**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-22T06:09:35Z
- **Completed:** 2026-07-22T06:41:35Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Enforced the decision boundary at the server: Manager/Admin can approve material demand and purchase requests; Purchasing cannot.
- Added first-class `material-demand` parsing, handler dispatch, approve/reject transitions, actor/timestamp/reason history, replay idempotency, and stale/conflicting decision rejection.
- Added one stable pending inbox item per draft demand with week, service date, scope, line count, aggregate quantity, submitter/time, materials, and deep-link parameters.
- Preserved approved demand and downstream purchase snapshots instead of silently demoting or deleting them during recalculation.

## Task Commits

Each task followed a RED then GREEN TDD gate:

1. **Task 1: Lock the Manager/Purchasing approval permission boundary**
   - `9279a50` — test: lock approval role boundary
   - `e344e11` — feat: enforce manager approval permissions
2. **Task 2: Route material demand through approval handler and history**
   - `2450ab8` — test: define durable material demand decisions
   - `d73cf2d` — feat: route material demand decisions
3. **Task 3: Project pending material demand into the Manager inbox**
   - `c0e47c1` — test: define material demand inbox projection
   - `9722ae9` — feat: project material demand into manager inbox

Additional regression alignment:

- `a803f51` — test: align approved demand regression

## Files Created/Modified

- `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs` — Adds Manager-only material-demand approval and removes purchase-request decision authority from Purchasing.
- `backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs` — Adds the material-demand target and operational inbox context fields.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs` — Implements durable material-demand approval/rejection and replay/conflict handling.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalWorkflowService.cs` — Dispatches and authorizes material-demand decisions.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs` — Projects draft demand into stable, paged Manager inbox items.
- `backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandService.cs` — Protects approved demand snapshots from destructive recalculation.
- `backend/src/IPCManagement.Api/DependencyInjection.cs` — Registers the new approval handler.
- `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` — Covers role boundaries, transitions, history, idempotency, stale targets, inbox context, paging, and terminal visibility.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs` — Aligns legacy inbox and recalculation regressions with Manager ownership and immutable snapshots.

## Decisions Made

- Kept one canonical approval path by using the existing handler abstraction and `approvalhistories`; no new approval table or schema was introduced.
- Treated an identical replay as idempotent only when persisted status still matches the established history; a different decision or stale status is a conflict.
- Used demand status as pending membership and kept history terminal, so approved/rejected demand leaves the inbox without losing audit evidence.
- Kept `TotalValue` nullable because material demand has quantities but no supplier price decision at this stage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved approved demand snapshots during recalculation**
- **Found during:** Task 2
- **Issue:** Existing recalculation demoted `MANAGERAPPROVED` demand to draft and deleted draft purchase lines, violating the required immutable decision snapshot.
- **Fix:** Reject recalculation of an approved snapshot and require an explicit new version/recalculation path.
- **Files modified:** `MaterialDemandService.cs`, `WorkflowGenerationTests.cs`
- **Verification:** Snapshot preservation tests pass; full suite passes.
- **Committed in:** `d73cf2d`, regression alignment in `a803f51`

**2. [Rule 1 - Bug] Corrected invalid InMemory relationship setup in inbox tests**
- **Found during:** Task 3
- **Issue:** Test rows supplied foreign keys but omitted required navigation relationships, causing relational includes to return no demand rows in the InMemory fixture.
- **Fix:** Seeded the required plan, creator, request, ingredient, and unit navigation graph.
- **Files modified:** `MaterialDemandAndPriceExceptionApprovalTests.cs`
- **Verification:** All 3 material-demand inbox acceptance tests pass.
- **Committed in:** `9722ae9`

**3. [Rule 1 - Bug] Aligned legacy approval-inbox role expectations**
- **Found during:** Task 3 regression verification
- **Issue:** Existing inbox tests still treated Purchasing as the purchase-request/price approver.
- **Fix:** Asserted those decision items under Manager while retaining Warehouse-specific filtering.
- **Files modified:** `WorkflowGenerationTests.cs`
- **Verification:** Existing ApprovalInbox regression filter passes 3/3.
- **Committed in:** `9722ae9`

**4. [Rule 1 - Bug] Replaced obsolete approved-demand rollback expectation**
- **Found during:** Overall verification
- **Issue:** A legacy test expected destructive draft invalidation to start after an approved snapshot, conflicting with the new mandatory early rejection.
- **Fix:** Asserted early rejection and unchanged demand/purchase data, then removed the unused failure interceptor.
- **Files modified:** `WorkflowGenerationTests.cs`
- **Verification:** Targeted test and full backend suite pass.
- **Committed in:** `a803f51`

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs)
**Impact on plan:** All fixes were required to enforce the planned authorization and immutable-snapshot contracts; no new feature scope or dependency was added.

## Issues Encountered

- The repository has no `backend/IPCManagement.sln`; verification used the test project, which builds the API and database tool dependencies successfully.
- Two test invocations briefly contended for `MvcTestingAppManifest.json` when launched in parallel; all subsequent verification ran sequentially and passed.
- GitNexus compare-to-`main` reports HIGH because the shared branch contains prior Phase 09 work and authorization is broad. Plan-local changes affect only the expected `GetInbox` and `Execute` approval flows.

## Verification

- Release build: 0 warnings, 0 errors.
- Full backend suite: 368 passed, 6 intentionally skipped, 0 failed (374 total).
- Material-demand approval suite: 27 passed, 1 intentionally skipped.
- Approval inbox regression filter: 3 passed.
- Material-demand inbox acceptance: 3 passed.
- Package manifests: no package changes in any Plan 09-06 commit.
- Protected cleanup SQL SHA-256 remains `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53` and was not staged.
- GitNexus refreshed to 7,835 nodes / 22,218 edges / 300 flows; affected flows are limited to approval inbox and decision execution.

## Known Stubs

- `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs:286` — one intentionally skipped price-exception test is owned by Plan 09-10 and does not block this plan's material-demand approval goal.

## User Setup Required

None - no external service configuration or package installation required.

## Self-Check: PASSED

- All 9 modified implementation/test files and this summary exist.
- All 7 RED/GREEN/regression commits are present in repository history.
- Full backend verification passed after the final regression alignment.

## Next Phase Readiness

- Purchasing can now consume an explicit Manager-approved demand outcome without possessing decision authority.
- Approval UI plans can use the stable material-demand target ID and deep-link context.
- Plan 09-10 still owns auditable price-exception approval behavior.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*
