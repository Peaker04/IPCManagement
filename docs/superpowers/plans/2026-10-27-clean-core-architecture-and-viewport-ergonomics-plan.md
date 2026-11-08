# Clean Core Architecture & Viewport Ergonomics Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eradicate stacked duplicate toolbars on `/reconciliation`, anchor sticky customer staging filters on `/warehouse?view=mrx-preparation`, implement active-only smart sidebar expansion on `AppShell.tsx`, and verify across all test suites and viewports.

**Architecture:** Consolidate filter buttons and search input directly into `TelemetrySubbar` on `/reconciliation`, eliminating the secondary 40px gray toolbar; make the customer selection bar sticky in `MrxMultiCustomerPreparationWorkbench.tsx`; configure active-route accordion expansion in `AppShell.tsx`; verify with Vitest, Playwright, and screenshot captures.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-clean-core-architecture-and-viewport-ergonomics-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strictly $\le 600$ lines per FE source file; $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).
- Zero-CLS: 0px layout shift on subview switches.
- No orphan code: All components and utilities must have active production callers.

## Review Focus

- Reconciliation Subbar: Must render search input + filter buttons + status pills in a single 44px bar (no stacked second gray bar).
- Customer Staging Filter: Must stay sticky at top when DataGrid is scrolled vertically.
- Sidebar Navigation: Active group must expand automatically, while inactive groups collapse, keeping the profile and Logout button in view without a scrollbar.
- Tests: All existing test assertions for column headers, search inputs, and filters must remain 100% green.

---

### Task 1: Consolidate Single 44px Subbar on `/reconciliation`

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] In `ReconciliationPage.tsx`, integrate search input and the 4 filter buttons (`Tất cả`, `Cần xử lý`, `Đã giải trình`, `Khớp định mức`) into `TelemetrySubbar`'s `leftControls`.
- [ ] Position lifecycle status and line counts into `TelemetrySubbar`'s `telemetryPills`.
- [ ] Remove the standalone `ReconciliationLinesFilterToolbar` call above `DataGrid`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx` and verify all tests pass.

---

### Task 2: Sticky Customer Staging Filter in `MrxMultiCustomerPreparationWorkbench.tsx`

**Files:**
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

- [ ] In `MrxMultiCustomerPreparationWorkbench.tsx`, make the customer selection chips and supplier input container `sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200`.
- [ ] Ensure the DataGrid scrolls smoothly underneath without obscuring the sticky controls.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx` and verify all tests pass.

---

### Task 3: Active-Only Smart Accordion on `AppShell.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

- [ ] In `AppShell.tsx`, initialize `expandedParents` based on `location.pathname`, expanding only the active group.
- [ ] Add an effect or handler that auto-expands the matching parent when navigating to a different feature group.
- [ ] Maintain manual toggle capability via `toggleParent(parentId)`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx` and verify all tests pass.

---

### Task 4: Centralized Scope Mutator in `useUrlWorkbenchState.ts`

**Files:**
- Modify: `frontend/src/hooks/useUrlWorkbenchState.ts`
- Test: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx`

- [ ] In `useUrlWorkbenchState.ts`, export `setWorkspaceScope` updating URL search params, `workspaceSessionStore`, and screen snapshots in a single synchronized call.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/RouteNavigationIntegrity.test.tsx` and verify all tests pass.

---

### Task 5: Final Multi-Layer Verification & Capture Audits

**Files:**
- Audit: All modified files
- Script: `scripts/verify-precommit-gate.mjs`
- Script: `scripts/check-architecture-growth.mjs`

- [ ] Run `node scripts/check-architecture-growth.mjs` (strictly $\le 600$ lines per FE file).
- [ ] Run `npm run precommit:verify` (Gates A-E pass 100%).
- [ ] Run `npx playwright test` (63/63 browser tests pass 100%).
- [ ] Run `dotnet test backend/IPCManagement.slnx` (1,419 tests pass 100%).
- [ ] Update `.planning/WORK.md`.
