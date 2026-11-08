# MRX Operational & Responsive Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement line-level detail inspection modal, responsive layout geometry stabilization, and per-shift dish BOM inspection across MRX mode (with Chef station preserved as-is).

**Architecture:** 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`) with standalone modal primitives (`ReconciliationLineDetailModal`), responsive flex geometry, and zero `.no-scrollbar` hacks.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-operational-recovery-spec.md`

## Global Constraints

- Strict Operational Mode Isolation (`DOM-MODE-1`): Zero DEFAULT API mutation in MRX mode.
- File Size Invariant: Every frontend file must remain strictly under 600 lines (`check-architecture-growth.mjs`).
- Chef View Invariant: Chef view (`/chef?view=mrx-cooking`) is strictly preserved as-is (read-only sanitized cooking sheet with CSV/XLSX exports).
- Single Styling Authority: All styling via semantic tokens in `frontend/src/styles/index.css` and Tailwind primitives.

## Review Focus

1. **Responsive Viewport Squeeze**: On 1024px and 1366px screens, select dropdowns must not clip or push primary action buttons offscreen.
2. **Line Detail Modal Transition**: Clicking "Xử lý chênh lệch" from within `ReconciliationLineDetailModal` must cleanly transition to `ReconciliationDispositionModal` with correct line context.
3. **Line Identity Authority**: `dailyLineId` must be preserved as the unique key across inspection, bulk disposition, and line mutations.
4. **Zero Residual Scrollbars**: DocumentElement and body must never show horizontal scrollbars across all tested viewports.

---

### Task 1: Create `ReconciliationLineDetailModal.tsx`

**Files:**
- Create: `frontend/src/components/workbench/ReconciliationLineDetailModal.tsx`
- Modify: `frontend/src/features/reconciliation/reconciliationColumns.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`

- [ ] **Step 1.1**: Build `ReconciliationLineDetailModal.tsx` with full fact list (ingredient code, name, unit, required BOM qty, actual issued qty, difference with +/- highlighting, tolerance, warehouse notes, disposition conclusion).
- [ ] **Step 1.2**: Add `onOpenDetail` handler to `reconciliationColumns.tsx` making the ingredient name clickable with an accessible inspection link.
- [ ] **Step 1.3**: Wire `ReconciliationLineDetailModal` in `ReconciliationPage.tsx` with seamless transition to `ReconciliationDispositionModal` on clicking "Xử lý chênh lệch".
- [ ] **Step 1.4**: Run unit tests and verify line count `< 600`.

---

### Task 2: Root-Cause Responsive Layout Geometry Stabilization

**Files:**
- Modify: `frontend/src/components/workbench/WorkspaceHeader.tsx`
- Modify: `frontend/src/components/workbench/TelemetrySubbar.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`

- [ ] **Step 2.1**: Update `WorkspaceHeader.tsx` to support responsive multi-tier / flex-wrap on narrow viewports (`< 1280px`) without forcing overflow.
- [ ] **Step 2.2**: Update `TelemetrySubbar.tsx` to wrap or priority-collapse telemetry pills on narrow screens.
- [ ] **Step 2.3**: Update select width constraints in `ReconciliationPage.tsx` and `MrxBatchWorkbench.tsx` to responsive scaling (`w-40 sm:w-48 lg:w-60 xl:w-72`).
- [ ] **Step 2.4**: Verify across 5 viewports (1920, 1440, 1366, 1280, 1024) with Playwright probe script.

---

### Task 3: Enhance `MrxBatchDishesModal.tsx` with Shift Filtering

**Files:**
- Modify: `frontend/src/components/workbench/MrxBatchDishesModal.tsx`

- [ ] **Step 3.1**: Add a shift filter toolbar (`Tất cả`, `Ca 1 (Sáng)`, `Ca 2 (Chiều)`) in `MrxBatchDishesModal.tsx`.
- [ ] **Step 3.2**: Filter displayed dishes and their service scopes based on selected shift.
- [ ] **Step 3.3**: Verify dish component BOM ingredient breakdowns render with 4-decimal precision.
- [ ] **Step 3.4**: Run unit tests and verify line count `< 600`.

---

### Task 4: Full E2E Lifecycle & Interactive Click Verification

- [ ] **Step 4.1**: Run full frontend unit test suite (`npm run test:fe:unit`).
- [ ] **Step 4.2**: Run Playwright runtime conformance suite (`conformance-runtime.spec.ts`).
- [ ] **Step 4.3**: Run 7-day 4-actor operational lifecycle test (`run-mrx-full-path-lifecycle-test.mjs`).
- [ ] **Step 4.4**: Verify ESLint, Depcruise, and Vite production build.
