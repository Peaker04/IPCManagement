# Eliminate Flashing & Unify Workbench Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the flashing 2px micro-bar from `StateBoundary.tsx`, enforce visual token stability on badges and lifecycle steppers, eliminate canvas layout shift from conditional banners, and verify across all 14 routes.

**Architecture:** Purge the 2px top gradient bar from StateBoundary; stabilize badge variant resolution to prevent premature green flashing; keep TelemetrySubbar and DataGrid adjacent without intermediate banners; verify with Vitest, Playwright, and cold-start MutationObserver test scripts.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-eliminate-flashing-and-unify-workbench-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strictly $\le 600$ lines per FE source file; $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).
- Zero-CLS: 0px layout shift on all data transitions.
- No orphan code: All components and utilities must have active production callers.

## Review Focus

- Flashing "Khung Xanh": The 2px top gradient bar must be completely removed from `StateBoundary.tsx`.
- Badge Stability: No green badge or green step frame should flash and then disappear on page load.
- Canvas Cleanliness: No intermediate banners between Subbar and DataGrid.
- Cold-Start: Zero flashes of empty notices or premature state changes.

---

### Task 1: Remove Flashing 2px Top Micro-Bar from `StateBoundary.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] In `StateBoundary.tsx`, remove `showMicroBar` and the `absolute top-0 left-0 right-0 h-0.5 z-30 bg-gradient-to-r ...` element.
- [ ] Update `Primitives.test.tsx` assertions to reflect calm canvas revalidation without micro-bar.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx` and verify all tests pass.

---

### Task 2: Stabilize Badge & Lifecycle Stepper Color Resolution

**Files:**
- Modify: `frontend/src/components/workbench/ReconciliationLifecycleStrip.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] In `ReconciliationPage.tsx`, resolve header status badge calmly: do not show green `variant="success"` if data is in a revalidating or non-completed state.
- [ ] In `ReconciliationLifecycleStrip.tsx`, ensure step 5 `Đã chốt sổ` is only rendered green when status is confirmed `COMPLETED`, keeping routine steps in calm neutral/blue tones.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx` and verify all tests pass.

---

### Task 3: Zero-Banner Canvas Invariant in Warehouse Workbenches

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

- [ ] Ensure `MrxDailyIssueWorkbench.tsx` has no intermediate banners between TelemetrySubbar and DataGrid.
- [ ] In `MrxMultiCustomerPreparationWorkbench.tsx`, ensure the sticky filter container is clean and no shifting banners are inserted.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx` and verify all tests pass.

---

### Task 4: Empirical Cold-Start & MutationObserver Verification

**Files:**
- Script: `scripts/test-all-cold-starts.mjs`
- Script: `scripts/reproduce-first-load-trace.mjs`

- [ ] Run `node scripts/test-all-cold-starts.mjs` to verify 0 flashes across all routes.
- [ ] Run `node scripts/reproduce-first-load-trace.mjs` to verify zero intermediate DOM flickers.

---

### Task 5: Final Multi-Layer Verification & Pre-Commit Gates

**Files:**
- Audit: All modified files
- Script: `scripts/verify-precommit-gate.mjs`
- Script: `scripts/check-architecture-growth.mjs`

- [ ] Run `node scripts/check-architecture-growth.mjs` (strictly $\le 600$ lines per FE file).
- [ ] Run `npm run precommit:verify` (Gates A-E pass 100%).
- [ ] Run `npx playwright test` (63/63 browser tests pass 100%).
- [ ] Run `dotnet test backend/IPCManagement.slnx` (1,419 tests pass 100%).
- [ ] Update `.planning/WORK.md`.
