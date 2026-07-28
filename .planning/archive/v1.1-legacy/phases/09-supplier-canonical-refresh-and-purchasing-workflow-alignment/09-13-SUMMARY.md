---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 13
subsystem: ui
tags: [react, rtk-query, purchasing, warehouse, accessibility, idempotency]

requires:
  - phase: 09-12
    provides: Approval handoffs and authoritative purchasing workflow endpoints
provides:
  - Deterministic six-stage Purchasing workbench with week/date/stage URL restoration
  - Evidence-backed supplier decisions and read-only receipt progress
  - Warehouse-only partial/final purchase receipt entry with stable idempotency
affects: [09-14, purchasing, warehouse, route-smoke]

tech-stack:
  added: []
  patterns: [server-owned evidence requirements, confirmed mutations, bounded operational tables]

key-files:
  created:
    - frontend/src/features/workflow/purchasing/PurchaseWorkflowGuide.tsx
    - frontend/src/features/workflow/purchasing/PurchaseServiceDateWorkbench.tsx
    - frontend/src/features/workflow/purchasing/PurchaseDecisionPanel.tsx
    - frontend/src/features/workflow/warehouse/WarehousePurchaseReceiptDialog.tsx
  modified:
    - frontend/src/features/workflow/pages/PurchasingPage.tsx
    - frontend/src/features/workflow/pages/WarehousePage.tsx
    - frontend/src/features/workflow/workflowApi.ts
    - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseOrderDto.cs
    - backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs

key-decisions:
  - "Receipt evidence requirements are projected by the server from ingredient policy; the client never infers them from names or categories."
  - "Actual receipt mutation is exposed only in Warehouse UI, while Purchasing keeps a read-only handoff and progress view."
  - "One generated idempotency key and all operator-entered evidence survive validation or conflict retries."

patterns-established:
  - "Guided workflow: canonical stage model drives URL state, next action, and visible recovery."
  - "Confirmed receipt: validate raw evidence, show a summary, then submit with a stable idempotency key."

requirements-completed: [PUR-01, PUR-02, PUR-03, PUR-04, PUR-05, WHR-01]

duration: 28min
completed: 2026-07-22
---

# Phase 09 Plan 13: Purchasing and Warehouse Workbench Summary

**Six-stage Purchasing workbench with evidence-backed supplier decisions and Warehouse-only idempotent partial/final receipt entry**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-22T15:41:23Z
- **Completed:** 2026-07-22T16:09:38Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Replaced five disconnected Purchasing tabs with the exact six-stage workflow, stable week/date/stage URLs, bounded service-date tables, and one explicit next action or blocker.
- Kept supplier quotations/latest receipts visible before an explicit supplier, price, and delivery confirmation; request, order, exception, and receipt progress remain in one workbench.
- Added a paged Warehouse purchase-order queue and Warehouse-only confirmed receipt dialog for partial/final quantities, prices, lot/date evidence, optional package snapshots, and retry-safe idempotency.
- Exposed lot/manufacture/expiry requirements and inactive-ingredient blockers from the server so the browser does not infer receipt policy.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define deterministic six-stage URL and next-action presentation** - `0a78f39` (test)
2. **Task 1 GREEN: Define deterministic six-stage URL and next-action presentation** - `e336ceb` (feat)
3. **Task 2: Build the guided Purchasing week/date workbench** - `6d27d5a` (feat)
4. **Task 3: Add Warehouse-only actual receipt entry and read-only upstream progress** - `159bb37` (feat)

## Files Created/Modified

- `frontend/src/features/workflow/purchasing/purchasingModel.ts` - Canonical six-stage URL and next-action model.
- `frontend/src/features/workflow/purchasing/purchasingModel.test.ts` - URL, stage, blocker, recovery, and next-action fixtures.
- `frontend/src/features/workflow/purchasing/PurchaseWorkflowGuide.tsx` - Exact six-stage progress/navigation contract.
- `frontend/src/features/workflow/purchasing/PurchaseServiceDateWorkbench.tsx` - One active FULLDAY service date with bounded, paged line table.
- `frontend/src/features/workflow/purchasing/PurchaseDecisionPanel.tsx` - Evidence, confirmation, exception, request/order, and read-only Warehouse handoff states.
- `frontend/src/features/workflow/pages/PurchasingPage.tsx` - Week/date/stage composition on the preserved `/purchasing` route.
- `frontend/src/features/workflow/warehouse/WarehousePurchaseReceiptDialog.tsx` - Confirmed receipt form with raw evidence and stable idempotency.
- `frontend/src/features/workflow/pages/WarehousePage.tsx` - Paged purchase-order queue, detail, role presentation, and receipt integration.
- `frontend/src/features/workflow/workflowApi.ts` - Receipt evidence flags on the purchase-order line contract.
- `backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseOrderDto.cs` - Server-owned receipt evidence fields.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs` - Existing ingredient policy projected into purchase-order lines.
- `frontend/src/features/workflow/purchasing/purchasingHooksBehavior.test.tsx` - Evidence confirmation and conflict-preservation interaction coverage.

## Decisions Made

- Used the existing purchase-order DTO projection to surface receipt requirements; no new endpoint, table, schema, or client-side policy duplication was introduced.
- Kept the receipt unit tied to the server-provided order line and made supplier/order context read-only; operators enter actual quantities, price, and raw evidence only.
- Retained the approved IPC/shadcn primitives, tokens, route paths, and local table overflow; no package or UI kit was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added server-owned receipt requirement flags**
- **Found during:** Task 3 (Warehouse actual receipt entry)
- **Issue:** The purchase-order response did not expose evidence requirements before submission, so a compliant client would otherwise need to infer lot/manufacture/expiry policy.
- **Fix:** Extended the existing line DTO and mapper with required flags and inactive-ingredient blocker text, then mirrored those fields in the frontend contract.
- **Files modified:** `PurchaseOrderDto.cs`, `PurchaseOrderService.cs`, `workflowApi.ts`
- **Verification:** Backend Release build and 38 focused PurchaseOrder/PurchaseReceiving/Warehouse tests passed.
- **Committed in:** `159bb37`

**2. [Rule 3 - Blocking] Removed imports of a formatter that is not exported**
- **Found during:** Task 2 (guided Purchasing workbench)
- **Issue:** The in-progress workbench components referenced a non-exported `formatDate` helper and could not compile.
- **Fix:** Added small local ISO-date display helpers matching the existing Vietnamese presentation.
- **Files modified:** `PurchaseWorkflowGuide.tsx`, `PurchaseServiceDateWorkbench.tsx`
- **Verification:** TypeScript production build passed.
- **Committed in:** `6d27d5a`

**3. [Rule 1 - Bug] Handled nullable ingredient activation correctly**
- **Found during:** Task 3 backend build
- **Issue:** The generated entity exposes `IsActive` as nullable, which initially caused a bool conversion compile error.
- **Fix:** Treat only explicit `true` as active when projecting the receipt blocker.
- **Files modified:** `PurchaseOrderService.cs`
- **Verification:** Backend Release build passed with zero warnings and zero errors.
- **Committed in:** `159bb37`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** All fixes were required for the planned server-authoritative receipt contract and compilable UI; no schema, endpoint, dependency, or route expansion was added.

## Issues Encountered

- The first Debug backend build was blocked by the already-running `IPCManagement.Api` process locking its executable. Release configuration built cleanly without stopping the user's service.
- A full 17-test route-smoke run exhausted Node memory and the Vite test server disconnected after nine passing tests. The affected subset was rerun with one worker: protected routes passed at desktop/tablet/mobile and the bounded Warehouse movement check passed (4/4). Plan 09-14 remains the owner of the dedicated four-route seam test.
- GitNexus compare-to-main reports CRITICAL because it covers the cumulative Phase 09 branch (144 files/48 flows). Exact staged Task 3 scope was 7 files/26 symbols/9 flows at HIGH and contained only the planned workbench/DTO changes.

## Verification

- Focused frontend unit tests: 27/27 passed across `purchasingModel.test.ts` and `purchasingHooksBehavior.test.tsx`.
- Frontend lint: passed.
- Frontend production build: passed.
- Backend Release build: passed with 0 warnings and 0 errors.
- Focused backend tests: 38/38 passed.
- Affected route smoke: 4/4 passed with one worker.
- GitNexus staged-scope change detection: 7 files, 26 symbols, 9 expected flows; no unrelated user file was staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-14 can add the dedicated preserved-route Purchasing-to-Warehouse seam and four-viewport interaction coverage.
- The existing untracked reconciliation SQL remains untouched; no supplier/BOM reconciliation or database apply occurred.
- Residual Plan 09-05 state remains preserved and was not treated as implementation evidence.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-22*

## Self-Check: PASSED

- All 12 created or modified implementation/test files exist.
- Task commits `0a78f39`, `e336ceb`, `6d27d5a`, and `159bb37` exist in git history.
- The canonical `09-13-SUMMARY.md` exists on disk.
