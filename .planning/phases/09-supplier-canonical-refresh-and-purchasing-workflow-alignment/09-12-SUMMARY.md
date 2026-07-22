---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 12
subsystem: frontend-approval-workflow
tags: [react, rtk-query, shadcn, approval, purchasing, warehouse]
requires:
  - phase: 09-11
    provides: Warehouse-owned receipt contract and approval inbox evidence
provides:
  - Typed Phase 09 purchasing, supplier-evidence, and Warehouse receipt RTK Query hooks
  - Weekly Menu material-demand approval status and context-preserving handoff
  - Actionable material-demand and price-exception approval evidence
affects: [09-13, purchasing-workbench, warehouse-receiving, manager-approvals]
tech-stack:
  added: []
  patterns: [targeted RTK Query invalidation, server-authoritative status mapping, contextual safe-action dialogs]
key-files:
  created: []
  modified:
    - frontend/src/features/workflow/workflowApi.ts
    - frontend/src/features/workflow/types.ts
    - frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts
    - frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx
    - frontend/src/components/common/ApprovalQueue.tsx
    - frontend/src/features/workflow/pages/ApprovalPage.tsx
    - backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs
    - backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs
key-decisions:
  - "Treat generated DRAFT material demand as the authoritative pending approval state; do not invent a duplicate submit mutation."
  - "Expose source document code and supplier name as read-only inbox evidence instead of inferring either value in the client."
  - "Keep Manager decisions on the existing generic approval endpoint and invalidate only the affected target and week."
patterns-established:
  - "Approval deep links preserve ISO Monday week, service date, FULLDAY scope, target type, and target ID."
  - "Operational rejection dialogs focus the contextual safe action and remain non-dismissible while the mutation is pending."
requirements-completed: [PUR-01, PUR-03, PUR-04, PUR-05, WHR-01, PUI-01]
duration: 24m26s
completed: 2026-07-22
---

# Phase 09 Plan 12: Frontend Approval Handoff Summary

Typed week-scoped purchasing contracts now connect Weekly Menu demand status to an evidence-complete, accessible Manager approval queue with Warehouse-owned receiving boundaries intact.

## Performance

- **Duration:** 24m26s
- **Started:** 2026-07-22T14:56:19Z
- **Completed:** 2026-07-22T15:20:45Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added typed RTK Query boundaries for the purchasing workbench, supplier evidence and confirmation, targeted approval invalidation, and retry-safe Warehouse receipt recording.
- Added authoritative `Chưa tạo`, `Chờ duyệt`, `Đã duyệt`, and `Từ chối` demand presentation to Weekly Menu with exact operational deep links and rejection recovery.
- Enabled both material-demand and purchase-price-exception records in the existing paged approval queue with server-owned evidence, contextual actions, URL selection, pending locks, safe focus, and adjacent error recovery.
- Kept authorization server-owned: the client hides Manager decision controls where appropriate but sends no actor, derived variance, ledger ID, or server path.

## Task Commits

Each task followed RED then GREEN:

1. **Task 1: Typed RTK Query contracts**
   - `e1e45ad` test(09-12): add failing purchasing API contract tests
   - `a236e1d` feat(09-12): add typed purchasing workflow contracts
2. **Task 2: Weekly Menu demand approval handoff**
   - `f5ce4b7` test(09-12): add failing demand approval handoff tests
   - `20da4d8` feat(09-12): surface demand approval handoff
   - `e8f4db6` fix(09-12): keep manager approval handoff visible
3. **Task 3: Actionable approval evidence**
   - `27fb49f` test(09-12): add failing approval evidence tests
   - `f9a7872` feat(09-12): make demand and price approvals actionable

## Files Created/Modified

- `frontend/src/features/workflow/workflowApi.ts` - Phase 09 DTO mirrors, endpoints, hooks, scoped tags, and approval evidence mapping.
- `frontend/src/features/workflow/types.ts` - Optional server-owned demand and approval evidence fields.
- `frontend/src/features/workflow/purchasing/purchasingModel.test.ts` - Query serialization, authorized payload, and cache invalidation coverage.
- `frontend/src/features/projects/weekly-menu/demand/demandModel.ts` - Pure demand approval status and deep-link selectors.
- `frontend/src/features/projects/weekly-menu/demand/demandModel.test.ts` - Status, recovery copy, and context round-trip coverage.
- `frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts` - Authoritative active-date status and rejection history composition.
- `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx` - Compact approval row, role-aware handoff, and rejected-demand guidance.
- `frontend/src/components/common/ApprovalQueue.tsx` - Bounded demand and price-exception evidence renderers.
- `frontend/src/features/workflow/pages/ApprovalPage.tsx` - URL-selected records, contextual decisions, safe confirmations, pending locks, and inline recovery.
- `frontend/src/features/workflow/pages/approvalCopy.ts` - Target-specific Vietnamese decision copy.
- `frontend/src/features/workflow/pages/approval-copy.test.ts` - Evidence and safe-action copy coverage.
- `backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs` - Read-only source-document and supplier evidence fields.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs` - Populates the two missing evidence fields.
- `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` - Verifies both read-only evidence values.

## Decisions Made

- Demand generation already persists a `DRAFT` snapshot and places it in the Manager inbox, so `DRAFT` maps to `Chờ duyệt`; a second client-side submit mutation would duplicate server state.
- Rejected demand uses the durable generic approval history for Manager reason copy while the existing demand generation owner retains the regeneration action.
- Approval links accept both the Phase 09 `target/week/date/scope/id` contract and legacy backend `targetType/targetId` aliases.
- Price variance, evidence type/date, proposal fingerprint/version, and supplier identity are displayed exactly from server responses; the client never recomputes approval eligibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added missing approval evidence fields**
- **Found during:** Task 3
- **Issue:** The inbox DTO did not expose the demand source document code or price-exception supplier name required by the locked UI evidence contract.
- **Fix:** Added two nullable read-only DTO fields, populated them from loaded server entities, and covered both with backend tests.
- **Files modified:** `ApprovalWorkflowDto.cs`, `ApprovalInboxService.cs`, `MaterialDemandAndPriceExceptionApprovalTests.cs`
- **Commit:** `f9a7872`

**2. [Rule 3 - Blocking test environment] Normalized relative API URLs in RTK Query tests**
- **Found during:** Task 1 GREEN
- **Issue:** Node's native `Request` rejected the application's browser-relative `/api` URL before the test fetch spy could inspect it.
- **Fix:** Added a test-only `Request` wrapper that prefixes `http://localhost` without changing production serialization.
- **Files modified:** `purchasingModel.test.ts`
- **Commit:** `a236e1d`

**3. [Rule 1 - Lint] Removed synchronous state update from deep-link focus effect**
- **Found during:** Task 3 verification
- **Issue:** React lint rejected `setActiveView` inside an effect.
- **Fix:** Kept the queue as the initial view and limited the effect to DOM focus synchronization.
- **Files modified:** `ApprovalPage.tsx`
- **Commit:** `f9a7872`

**4. [Rule 1 - Authorization presentation] Kept the Manager handoff visible with stale fallback permissions**
- **Found during:** Final scope review
- **Issue:** The fallback Manager identity has the correct role but does not yet carry the newly introduced permission string, so a role-and-permission UI guard could hide the deep link from an eligible Manager.
- **Fix:** Gate presentation by Manager role only while keeping the approval API's permission policy authoritative for every decision.
- **Files modified:** `MaterialDemandSection.tsx`
- **Commit:** `e8f4db6`

## Verification

- `npm run test:unit --workspace frontend` - 36 files, 150 tests passed.
- `npm run lint --workspace frontend` - passed.
- `npm run build --workspace frontend` - passed.
- `dotnet test ... -c Release --filter FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests --no-restore` - 45 tests passed.
- Debug backend test attempt was blocked by the already-running API PID 6796 locking its apphost; Release verification passed without stopping the user's service.
- `git diff --exit-code 07bd702 -- frontend/package.json package-lock.json` - no package changes.
- GitNexus compare against `main` reports CRITICAL cumulative Phase 9 scope (135 files); isolated `07bd702..HEAD` contains only the 14 files above. GitNexus also listed the user's dirty README files in its working-tree comparison, but they are absent from all 09-12 commits.

## Known Stubs

None. Empty collection defaults are DTO/query safety defaults, and `Chưa có` evidence copy represents nullable server fields rather than placeholder data.

## Residual Safety State

- Plan 09-05 remains intentionally incomplete at its evidence checkpoint.
- `backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql` remains untracked and unchanged at SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.
- No canonical reconciliation apply, database mutation, real/shared apply, or Plan 09-13 work was performed.

## Next Phase Readiness

- Plan 09-13 can consume the typed workbench, supplier-decision, exception, order, and Warehouse receipt hooks.
- The existing 09-05 residual checkpoint must remain visible until disposable clone/restore evidence and the required E2E rounds exist.

## Self-Check: PASSED

All declared source files, the canonical summary, all six RED/GREEN task commits, and the final scoped authorization-presentation fix were found on disk and in Git history.
