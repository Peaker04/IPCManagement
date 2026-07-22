---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 09
subsystem: purchasing-workflow
tags: [ef-core, purchasing, supplier-evidence, decision-versioning, audit, tdd]
requires:
  - phase: 09-08
    provides: durable supplier-decision rows, evidence snapshots, fingerprints, and optimistic concurrency
provides:
  - deterministic supplier candidates backed by effective quotations or comparable latest receipts
  - explicit Purchasing confirmation of supplier, price, and delivery with server-owned actor and evidence validation
  - append-only current/superseded decision history projected into the weekly purchasing workbench
  - submit-time enforcement that every purchase line has a matching current decision
affects: [09-10, 09-11, purchasing-workbench, purchase-submit, supplier-audit]
tech-stack:
  added: []
  patterns:
    - evidence-first supplier selection with no active-supplier fallback
    - transactional append-only decision versioning with deterministic SHA-256 fingerprints
    - server-owned actor and reference values at workflow trust boundaries
key-files:
  created:
    - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseSupplierDecisionDto.cs
  modified:
    - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseRequestWorkflowDto.cs
    - backend/src/IPCManagement.Api/Services/Workflow/IPurchaseRequestWorkflowService.cs
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs
    - backend/src/IPCManagement.Api/Controllers/PurchaseWorkflowController.cs
    - backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs
key-decisions:
  - "Prefer effective quotations; only when none exist, offer each active supplier's latest comparable receipt evidence, and never infer a supplier from activity alone."
  - "Treat confirmation as an append-only evidence snapshot: identical retries are idempotent, changed choices supersede the current row and increment the version."
  - "Accept only evidence identity, proposed price/delivery, and expected version from the client; derive reference values, fingerprint, and confirmer from server state."
  - "Require a current decision matching the purchase-line snapshot before submit and expose current plus historical decisions in the workbench."
patterns-established:
  - "Supplier choice is a Purchasing-owned decision, not a draft-generation default."
  - "Workflow write endpoints revalidate evidence inside the write path before persisting operational snapshots."
requirements-completed: [PUR-03]
duration: 28m
completed: 2026-07-22
---

# Phase 09 Plan 09: Evidence-Backed Supplier Confirmation Summary

Explicit Purchasing confirmation backed by effective quotation or comparable receipt evidence, with transactional decision versioning and auditable workbench history.

## Performance

- **Duration:** 28 minutes
- **Started:** 2026-07-22T12:38:44Z
- **Completed:** 2026-07-22T13:06:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added deterministic supplier-evidence queries that prefer effective quotations and fall back only to the latest unit-comparable valid receipt for active suppliers.
- Removed the permissive supplier-update contract; Purchasing now explicitly confirms evidence, supplier, price, delivery date, and expected version through protected endpoints.
- Revalidates evidence and request status server-side, takes the actor from authenticated claims, fingerprints the proposal, and commits current/superseded decision versions transactionally.
- Projects current decision state and complete decision history into the selected workbench date, and blocks submit when the line snapshot lacks a matching current decision.
- Preserved the Phase 09-05 residual checkpoint and the protected reconciliation SQL without executing any reconciliation apply path.

## Task Commits

1. **Task 1 RED: Specify valid supplier evidence behavior** — `c9e53d8` (`test`)
2. **Task 1 GREEN: Return evidence-backed supplier candidates** — `3f010a3` (`feat`)
3. **Task 2 RED: Specify explicit confirmation and audit behavior** — `898dc9b` (`test`)
4. **Task 2 GREEN: Persist explicit supplier decisions** — `3e7ec23` (`feat`)

## Files Created/Modified

- `backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseSupplierDecisionDto.cs` — evidence candidate, explicit confirmation, and decision-audit contracts.
- `backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseRequestWorkflowDto.cs` — current decision status/history and selected-date purchase-line projection.
- `backend/src/IPCManagement.Api/Services/Workflow/IPurchaseRequestWorkflowService.cs` — evidence query and confirmation service contracts.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs` — evidence eligibility, transactional confirmation/versioning, submit enforcement, and workbench mapping.
- `backend/src/IPCManagement.Api/Controllers/PurchaseWorkflowController.cs` — protected evidence-read and supplier-confirmation endpoints; permissive update endpoint removed.
- `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs` — evidence inclusion/exclusion, blocker, confirmation conflict, version, policy, and audit coverage.
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs` — existing workflow callers migrated to explicit quotation-backed confirmation and SQLite decision schema aligned.

## Decisions Made

- Effective quotations are the primary supplier evidence. Receipt evidence is considered only when no effective quotation exists, is normalized through configured unit conversion, and is rejected with diagnostics when incomparable.
- The client cannot provide reference price, variance, confirmer identity, or fingerprint. The server reloads evidence and derives all trusted fields at confirmation time.
- Identical retries return the existing current decision. A changed valid confirmation supersedes the prior current row and appends a new version in the same transaction.
- Purchase submit requires a current decision whose supplier, proposed price, and delivery date match the operational line snapshot.

## Verification

- Task 1 evidence-focused tests: 5 passed.
- Task 2 supplier-decision suite: 20 passed, 1 future Plan 09-10 test skipped.
- Existing workflow-generation regression: 91 passed.
- Full backend tests: 453 passed, 4 future-plan tests skipped, 0 failed.
- Release backend build: 0 warnings, 0 errors.
- GitNexus staged Task 2 check: HIGH, 7 files, 58 symbols, 10 expected execution flows; no unrelated flow detected.
- GitNexus required `main` comparison: CRITICAL from the accumulated Phase 09 branch (113 files, 777 symbols, 31 flows). Isolated 09-09 range `a6832ff..3e7ec23`: HIGH, 9 files, 108 symbols, and the same 10 planned confirmation/submit/workbench flows.
- Protected cleanup SQL remained untracked with SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`; user-owned README modifications were neither staged nor committed.

## TDD Gate Compliance

- RED gate for evidence behavior: `c9e53d8`.
- GREEN gate for evidence implementation: `3f010a3`.
- RED gate for confirmation behavior: `898dc9b`.
- GREEN gate for confirmation implementation: `3e7ec23`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test compatibility] Replaced an expression-tree-incompatible null pattern**
- **Found during:** Task 1 RED/GREEN verification
- **Issue:** The EF-backed assertion used a pattern form that cannot be represented in an expression tree.
- **Fix:** Used an equivalent explicit null comparison without changing the tested evidence behavior.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs`.
- **Committed in:** `3f010a3`

**2. [Rule 3 - Provider fidelity] Preserved relational evidence filtering while supporting tracked InMemory fixtures**
- **Found during:** Task 1 focused verification
- **Issue:** Existing InMemory fixtures expose newly tracked evidence before a relational no-tracking query can observe it.
- **Fix:** Kept production queries no-tracking and database-filtered, while merging only matching tracked entities for the InMemory test provider.
- **Files modified:** `backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs`.
- **Committed in:** `3f010a3`

**3. [Rule 3 - Blocking regression fixture] Added supplier-decision schema and explicit confirmation helpers to legacy workflow tests**
- **Found during:** Task 2 full workflow regression
- **Issue:** The manual SQLite schema lacked `purchaselinesupplierdecisions`, and existing tests still called the removed permissive supplier-update method, causing 22 failures before behavior assertions.
- **Fix:** Added the mapped decision table/indexes and routed existing callers through quotation-backed explicit confirmation.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`.
- **Verification:** all 91 workflow-generation tests passed.
- **Committed in:** `3e7ec23`

**4. [Rule 3 - Locked Debug output] Verified with Release configuration**
- **Found during:** Task 2 regression rerun
- **Issue:** A user-owned running API process (PID 6796) held the Debug executable open.
- **Fix:** Left the service running and executed all verification against Release outputs.
- **Files modified:** none.
- **Verification:** Release build and all 457 backend test cases completed without a build lock.
- **Committed in:** not applicable

---

**Total deviations:** 4 auto-fixed (1 test compatibility issue, 3 blocking provider/fixture/environment issues).  
**Impact on plan:** All fixes preserve the explicit evidence-backed workflow; no package, schema migration, reconciliation apply path, or protected artifact changed.

## Issues Encountered

- GitNexus correctly classified the isolated plan as HIGH because submit and workbench behavior changed. The warning was surfaced before commit, all affected flows were verified, and no unrelated process appeared in the isolated comparison.
- The required comparison to `main` includes all prior Phase 09 work and is therefore CRITICAL; the isolated pre-plan comparison is recorded separately for an auditable 09-09 scope.

## Known Stubs

- `SupplierDecisionWorkflowTests.Supplier_price_above_threshold_routes_to_manager_exception_approval` remains intentionally skipped for Plan 09-10. It does not block the evidence and confirmation goal delivered here.
- DTO empty collections/string initializers are serialization-safe defaults; service mappings populate operational evidence and decision data before returning workbench results.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 09-10 can bind Manager price-exception handling to the persisted supplier decision fingerprint/version and server-derived evidence reference price.
- Plan 09-11 can generate purchase orders only after the submit-time current-decision invariant passes.
- Phase 09-05 remains a separate residual reconciliation checkpoint and was not modified or applied.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*

## Self-Check: PASSED

- All seven key implementation/test files and this summary exist on disk.
- All four RED/GREEN task commits exist in repository history.
- Focused, affected-process, full-backend, build, GitNexus, and protected-file checks passed with the documented risk classifications.
