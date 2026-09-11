---
phase: 27-warehouse-data-workspace-contract-pilot
plan: 03
subsystem: ui
tags: [react, responsive-layout, warehouse, evidence-fixture]
requires:
  - phase: 27-warehouse-data-workspace-contract-pilot/27-02
    provides: immutable baseline and three accepted finding IDs
provides:
  - Warehouse-only responsive document rail at the measured 1366px transition
  - Shape-correct Warehouse movement evidence fixture through the production mapper
  - Scoped disposition for the route-forbidden duplicate H1 outside the detailed Warehouse owner
affects: [27-04, Warehouse Data Workspace]
actuals:
  tokens: 2640
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [bounded shared-component opt-in, evidence-fixture DTO parity]
key-files:
  created:
    - frontend/src/components/common/SplitWorkbench.test.tsx
    - frontend/src/features/warehouse/pages/WarehouseMovementPanel.test.tsx
  modified:
    - frontend/src/components/common/SplitWorkbench.tsx
    - frontend/src/styles/components/operations.css
    - frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx
    - frontend/tests/ui-audit.spec.ts
    - frontend/tests/warehouseDataWorkspaceFixture.ts
    - frontend/tests/warehouseDataWorkspaceContract.test.ts
key-decisions:
  - "Use a single opt-in wideDetailRail flag only from Warehouse; Approval and Chef retain the unchanged stacked default."
  - "Treat technical IDs, blank ingredient and NaN as a fixture DTO/mapper mismatch, not a production presentation defect."
  - "Do not modify RoleGuard, ForbiddenPage or the shared shell for the duplicate-H1 finding because Plan 27-03 authorizes only the detailed Warehouse surface."
requirements-completed: [UIC-01, UIC-03, UIC-05, WHP-02, WHP-03]
coverage:
  - id: D1
    description: Warehouse rail is side-by-side at 1366px and stacked at 1365px with one primary-to-rail DOM sequence.
    requirement: UIC-01
    verification:
      - kind: automated_ui
        ref: "frontend/tests/ui-audit.spec.ts#Warehouse Data Workspace responsive contract"
        status: pass
    human_judgment: false
  - id: D2
    description: Approval and Chef retain SplitWorkbench default geometry while Warehouse alone opts in.
    requirement: WHP-03
    verification:
      - kind: unit
        ref: "frontend/src/components/common/SplitWorkbench.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: Evidence movement DTOs map to meaningful document, ingredient and finite quantity values.
    requirement: WHP-02
    verification:
      - kind: unit
        ref: "frontend/tests/warehouseDataWorkspaceContract.test.ts#keeps the representative fixture domain-valid"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-08-22
status: complete
---

# Phase 27 Plan 03: Warehouse Lowest-Owner Remediation Summary

**Warehouse alone opts into the measured responsive rail, while invalid operational labels are corrected at the evidence DTO seam rather than masked in production.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-08-22
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Resolved `phase27-baseline-responsive-wide-rail-stacked` with a bounded `wideDetailRail` opt-in: side-by-side at 1366px and wider, stacked at 1365px and narrower, with one unchanged primary→aside DOM sequence.
- Preserved SplitWorkbench defaults for Approval and Chef and retained Warehouse query, pagination, route, permission and cache behavior.
- Proved `phase27-baseline-operational-data-presented-as-technical-placeholders` was owned by the test fixture: it supplied rendered-model fields where `reportsApi` expected `StockMovementViewDto`. The fixture now traverses the real mapper with meaningful labels and finite quantities.

## Task Commits

1. **Task 1: Remediate the proven responsive owner without changing shared defaults** — `e527b9ba`
2. **Task 2: Apply only authorized semantic and region corrections** — `726eab94`

## Files Created/Modified

- `frontend/src/components/common/SplitWorkbench.tsx` — adds the reversible opt-in flag without changing the default.
- `frontend/src/styles/components/operations.css` — applies the measured 1366px Warehouse rail grid.
- `frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx` — consumes the opt-in only on the detailed Warehouse tab.
- `frontend/src/components/common/SplitWorkbench.test.tsx` — locks default and opt-in semantics/DOM order.
- `frontend/src/features/warehouse/pages/WarehouseMovementPanel.test.tsx` — locks one rail and independent dataset owners.
- `frontend/tests/ui-audit.spec.ts` — focused adjacent-viewport browser regression.
- `frontend/tests/warehouseDataWorkspaceFixture.ts` — shape-correct API DTO fixture.
- `frontend/tests/warehouseDataWorkspaceContract.test.ts` — mapper-level valid presentation regression.

## Finding Dispositions

| Finding | Disposition | Lowest owner / reason |
|---|---|---|
| `phase27-baseline-responsive-wide-rail-stacked` | Fixed | `SplitWorkbench` opt-in plus Warehouse-only consumption |
| `phase27-baseline-operational-data-presented-as-technical-placeholders` | Fixed at evidence source | `warehouseDataWorkspaceFixture`; production mapper and presentation were correct |
| `phase27-baseline-forbidden-duplicate-h1` | Scoped blocker for closeout | `RoleGuard`/forbidden route shell, outside `WarehouseMovementPanel` and the Plan 27-03 production path allowlist; no shared shell redesign was authorized |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing focused responsive Playwright contract**
- **Found during:** Task 1 verification
- **Issue:** The exact plan grep named a test that did not exist.
- **Fix:** Added a two-viewport read-only regression using the existing UI audit runner.
- **Files modified:** `frontend/tests/ui-audit.spec.ts`
- **Commit:** `e527b9ba`

**2. [Rule 1 - Bug] Corrected evidence fixture DTO ownership**
- **Found during:** Task 2 owner classification
- **Issue:** The fixture supplied `StockMovement` presentation fields to an endpoint transformed from `StockMovementViewDto`, producing blank/NaN output.
- **Fix:** Made the fixture conform to the API DTO and asserted the production mapper output.
- **Files modified:** `frontend/tests/warehouseDataWorkspaceFixture.ts`, `frontend/tests/warehouseDataWorkspaceContract.test.ts`
- **Commit:** `726eab94`

## Verification

- Focused Vitest: 4 files / 16 tests passed.
- Focused Playwright responsive contract: 1/1 passed in headed-compatible Chromium configuration.
- ESLint: passed.
- dependency-cruiser: 435 modules / 1,636 dependencies / zero violations.
- Production build: 2,293 modules transformed; passed.
- `git diff --check`: passed.

## Known Stubs

None.

## Residual Risks

- `phase27-baseline-forbidden-duplicate-h1` remains unresolved by design. It must not be silently treated as Warehouse-panel work; Plan 27-04 must fail closed or obtain explicit shared route/shell authorization.
- The focused Playwright command clears its configured output directory; the immutable tracked baseline was restored immediately and remained byte-identical in Git.

## Threat Flags

None — no endpoint, auth path, file-access boundary, schema or permission behavior changed.

## Next Phase Readiness

- The detailed Warehouse production surface and evidence fixture are ready for fresh Plan 27-04 capture.
- Phase closeout is blocked on the explicitly scoped duplicate-H1 finding unless its route/shell owner is separately authorized.

## Self-Check: PASSED

All eight changed source/test paths and both task commits (`e527b9ba`, `726eab94`) exist; the working tree has no staged files.
